import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCallerWithNome as getCaller } from '../../lib/api-helpers'

function publicoAlvoFilter(role: string): string[] {
  if (role === 'admin' || role === 'gestor') return ['todos', 'colaboradores', 'trainees', 'gestores']
  if (role === 'colaborador') return ['todos', 'colaboradores']
  if (role === 'trainee') return ['todos', 'trainees']
  return ['todos']
}

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const isGestorAdmin = ['admin', 'gestor'].includes(caller.role)

  let query = admin
    .from('enquetes')
    .select('id, titulo, descricao, encerramento, publico_alvo, status, anonima, permitir_alterar_voto, mostrar_resultados_parciais, criado_por, criado_em')
    .in('publico_alvo', publicoAlvoFilter(caller.role))
    .order('criado_em', { ascending: false })

  if (!isGestorAdmin) query = query.neq('status', 'draft')

  const { data: enquetes, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const ids = (enquetes ?? []).map((e: { id: string }) => e.id)
  if (ids.length === 0) return Response.json([])

  const [{ data: pergsData }, { data: respsData }, { data: minhas }] = await Promise.all([
    admin.from('enquete_perguntas').select('enquete_id').in('enquete_id', ids),
    admin.from('enquete_respostas').select('enquete_id').in('enquete_id', ids),
    admin.from('enquete_respostas').select('enquete_id').eq('usuario_id', caller.user.id).in('enquete_id', ids),
  ])

  const pergMap: Record<string, number> = {}
  const respMap: Record<string, number> = {}
  const votedSet = new Set<string>()

  ;(pergsData ?? []).forEach((p: { enquete_id: string }) => { pergMap[p.enquete_id] = (pergMap[p.enquete_id] ?? 0) + 1 })
  ;(respsData ?? []).forEach((r: { enquete_id: string }) => { respMap[r.enquete_id] = (respMap[r.enquete_id] ?? 0) + 1 })
  ;(minhas ?? []).forEach((r: { enquete_id: string }) => votedSet.add(r.enquete_id))

  return Response.json((enquetes ?? []).map((e: { id: string }) => ({
    ...e,
    total_perguntas: pergMap[e.id] ?? 0,
    total_respostas: respMap[e.id] ?? 0,
    ja_votou: votedSet.has(e.id),
  })))
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller || !['admin', 'gestor'].includes(caller.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { titulo, descricao, encerramento, publico_alvo, status, anonima, permitir_alterar_voto, mostrar_resultados_parciais, perguntas } = body

  if (!titulo?.trim()) return Response.json({ error: 'Título obrigatório' }, { status: 400 })
  if (!perguntas?.length) return Response.json({ error: 'Adicione pelo menos uma pergunta' }, { status: 400 })

  const admin = createAdminClient()

  const { data: enquete, error: eErr } = await admin
    .from('enquetes')
    .insert({
      titulo: titulo.trim(),
      descricao: descricao?.trim() || null,
      encerramento: encerramento || null,
      publico_alvo: publico_alvo ?? 'todos',
      status: status ?? 'active',
      anonima: anonima ?? true,
      permitir_alterar_voto: permitir_alterar_voto ?? true,
      mostrar_resultados_parciais: mostrar_resultados_parciais ?? false,
      criado_por: caller.user.id,
    })
    .select('id')
    .single()

  if (eErr || !enquete) return Response.json({ error: eErr?.message ?? 'Erro ao criar' }, { status: 500 })

  for (let i = 0; i < perguntas.length; i++) {
    const p = perguntas[i]
    if (!p.texto?.trim()) continue

    const { data: perg, error: pErr } = await admin
      .from('enquete_perguntas')
      .insert({ enquete_id: enquete.id, ordem: i, texto: p.texto.trim(), tipo: p.tipo, obrigatoria: p.obrigatoria ?? false })
      .select('id')
      .single()

    if (pErr || !perg) continue

    if ((p.tipo === 'radio' || p.tipo === 'checkbox') && Array.isArray(p.opcoes)) {
      const opcoes = (p.opcoes as string[])
        .filter(o => o?.trim())
        .map((o, j) => ({ pergunta_id: perg.id, ordem: j, texto: o.trim() }))
      if (opcoes.length) await admin.from('enquete_opcoes').insert(opcoes)
    }
  }

  return Response.json({ id: enquete.id })
}
