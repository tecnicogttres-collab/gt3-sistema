import { NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase-server'
import { createAdminClient } from '../../lib/supabase-admin'
import { MODULES } from '../../lib/modules'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Sincroniza a lista de módulos do "Melhorias" com os módulos do sistema
 * (os mesmos exibidos em Usuários), seguindo os nomes personalizados (modulos_config).
 * - Vincula linhas legadas (seed) ao módulo do sistema pelo nome padrão.
 * - Cria os módulos do sistema que ainda não existem.
 * - Atualiza o nome quando muda na nomenclatura.
 * Idempotente: só escreve quando há algo faltando ou um nome divergente.
 * Não toca em `arquivado` (arquivar = ocultar no Melhorias) nem em módulos custom.
 */
async function syncSystemModules(admin: AdminClient) {
  try {
    const { data: allMods } = await admin
      .from('caf_modulos')
      .select('id, nome, modulo_sistema')
    const rows = allMods ?? []

    // Nomes efetivos (com overrides da nomenclatura)
    const { data: cfg } = await admin.from('modulos_config').select('id, label')
    const overrides = Object.fromEntries(
      (cfg ?? []).map((r) => [r.id as string, ((r.label as string | null) ?? '').trim()])
    )
    const effLabel = (id: string, fallback: string) => overrides[id] || fallback

    // 1. Vincula linhas existentes sem modulo_sistema, casando pelo nome padrão
    const byDefaultLabel = Object.fromEntries(MODULES.map((m) => [m.label, m.id]))
    const usados = new Set(rows.map((r) => r.modulo_sistema).filter(Boolean) as string[])
    for (const r of rows.filter((r) => !r.modulo_sistema)) {
      const sysId = byDefaultLabel[r.nome as string]
      if (sysId && !usados.has(sysId)) {
        await admin.from('caf_modulos').update({ modulo_sistema: sysId }).eq('id', r.id)
        usados.add(sysId)
        r.modulo_sistema = sysId
      }
    }

    // 2. Cria os que faltam / corrige nomes divergentes
    const bySys = new Map(rows.filter((r) => r.modulo_sistema).map((r) => [r.modulo_sistema as string, r]))
    const toUpsert = MODULES
      .map((m) => ({ modulo_sistema: m.id, nome: effLabel(m.id, m.label), criado_por: 'Sistema' }))
      .filter((row) => {
        const ex = bySys.get(row.modulo_sistema)
        return !ex || ex.nome !== row.nome
      })
    if (toUpsert.length) {
      await admin.from('caf_modulos').upsert(toUpsert, { onConflict: 'modulo_sistema' })
    }
  } catch {
    // Coluna modulo_sistema ainda não existe (migração não rodada) — segue sem sync
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel, nome, usuario')
    .eq('id', user.id)
    .single()

  const papel = profile?.papel ?? 'colaborador'
  const isManager = papel === 'admin' || papel === 'gestor'
  const nomeUsuario = ((profile?.nome as string) ?? '').trim() || ((profile?.usuario as string) ?? '').trim()

  // Mantém a lista de módulos do Melhorias igual à do sistema (Usuários)
  await syncSystemModules(createAdminClient())

  const [{ data: modulos }, { data: itens }] = await Promise.all([
    supabase.from('caf_modulos').select('*').eq('arquivado', false).order('nome', { ascending: true }),
    supabase.from('caf_itens').select('*').order('criado_em', { ascending: false }),
  ])

  // Colaborador/trainee vê apenas os próprios itens
  const filteredItens = isManager
    ? (itens ?? [])
    : (itens ?? []).filter((i: { autor?: string }) => i.autor === nomeUsuario)

  return NextResponse.json({ modulos: modulos ?? [], itens: filteredItens })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, usuario, papel')
    .eq('id', user.id)
    .single()

  const nome_autor = profile?.nome?.trim() || profile?.usuario?.trim() || 'Usuário'
  const papel = profile?.papel ?? 'colaborador'
  const canManage = papel === 'admin' || papel === 'gestor'

  const body = await req.json()

  if (body.tipo === 'modulo') {
    if (!canManage) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { data, error } = await supabase
      .from('caf_modulos')
      .insert({ nome: body.nome, criado_por: nome_autor })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  if (body.tipo === 'item') {
    const { data, error } = await supabase
      .from('caf_itens')
      .insert({
        modulo_id: body.modulo_id,
        texto: body.texto,
        status: 'ativo',
        origem: body.origem ?? 'interna',
        autor: nome_autor,
        visibilidade: body.visibilidade ?? 'todos',
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()

  const papel = profile?.papel ?? 'colaborador'
  if (papel !== 'admin' && papel !== 'gestor') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.modulo_id) return NextResponse.json({ error: 'modulo_id obrigatório' }, { status: 400 })

  // Permissão já verificada acima (admin/gestor). A tabela caf_modulos não tem
  // policy de UPDATE, então usamos o admin client para a mutação privilegiada.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('caf_modulos')
    .update({ arquivado: body.arquivado ?? true })
    .eq('id', body.modulo_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
