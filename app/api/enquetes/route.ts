import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'
import { enqueteParaMim, notificarEnquete } from '../../lib/enquetes-destinatarios'

const COLS = 'id, titulo, descricao, encerramento, publico_alvo, destinatarios, status, anonima, permitir_alterar_voto, mostrar_resultados_parciais, criado_por, criado_em'

async function getCaller() {
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await createAdminClient().from('profiles').select('papel').eq('id', user.id).maybeSingle()
  if (!data) return null
  return { user, papel: (data.papel as string) ?? 'colaborador' }
}

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const isGestorAdmin = ['admin', 'gestor'].includes(caller.papel)

  let query = admin
    .from('enquetes')
    .select(COLS)
    .order('criado_em', { ascending: false })

  if (!isGestorAdmin) query = query.neq('status', 'draft')

  const { data: todas, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Gestor/admin enxergam todas (e sempre os resultados); os demais só as que são para eles.
  type Row = { id: string; publico_alvo: string | null; destinatarios: string[] | null }
  const enquetes = ((todas ?? []) as Row[])
    .map(e => ({ ...e, para_mim: enqueteParaMim(e, caller.user.id, caller.papel) }))
    .filter(e => isGestorAdmin || e.para_mim)

  const ids = enquetes.map(e => e.id)
  if (ids.length === 0) return Response.json([])

  const [{ data: pergsData }, { data: respsData }, { data: minhas }] = await Promise.all([
    admin.from('enquete_perguntas').select('enquete_id').in('enquete_id', ids),
    admin.from('enquete_respostas').select('enquete_id, usuario_id').in('enquete_id', ids),
    admin.from('enquete_respostas').select('enquete_id').eq('usuario_id', caller.user.id).in('enquete_id', ids),
  ])

  const pergMap: Record<string, number> = {}
  const respMap: Record<string, Set<string>> = {}
  const votedSet = new Set<string>()

  ;(pergsData ?? []).forEach((p: { enquete_id: string }) => { pergMap[p.enquete_id] = (pergMap[p.enquete_id] ?? 0) + 1 })
  ;(respsData ?? []).forEach((r: { enquete_id: string; usuario_id: string }) => { (respMap[r.enquete_id] ??= new Set()).add(r.usuario_id) })
  ;(minhas ?? []).forEach((r: { enquete_id: string }) => votedSet.add(r.enquete_id))

  return Response.json(enquetes.map(e => ({
    ...e,
    // Lista de pessoas só para quem gerencia
    destinatarios: isGestorAdmin ? e.destinatarios : null,
    total_perguntas: pergMap[e.id] ?? 0,
    total_respostas: respMap[e.id]?.size ?? 0,
    ja_votou: votedSet.has(e.id),
  })))
}

type PerguntaBody = {
  texto?: string; tipo: string; obrigatoria?: boolean; opcoes?: string[]
  /** Índice (no array enviado) da pergunta da qual esta depende */
  condicao_pergunta?: number | null
  /** Índices das opções daquela pergunta que fazem esta aparecer */
  condicao_opcoes?: number[]
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller || !['admin', 'gestor'].includes(caller.papel)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { titulo, descricao, encerramento, publico_alvo, destinatarios, status, anonima, permitir_alterar_voto, mostrar_resultados_parciais } = body
  const perguntas = (body.perguntas ?? []) as PerguntaBody[]

  if (!titulo?.trim()) return Response.json({ error: 'Título obrigatório' }, { status: 400 })
  if (!perguntas.length) return Response.json({ error: 'Adicione pelo menos uma pergunta' }, { status: 400 })

  const pessoas = Array.isArray(destinatarios) ? (destinatarios as string[]).filter(Boolean) : []
  if (publico_alvo === 'usuarios' && pessoas.length === 0) {
    return Response.json({ error: 'Escolha pelo menos um usuário' }, { status: 400 })
  }

  const admin = createAdminClient()

  const alvo = {
    // "usuarios" fica como 'todos' + destinatarios, que é o que define o alvo
    publico_alvo: publico_alvo === 'usuarios' ? 'todos' : (publico_alvo ?? 'todos'),
    destinatarios: publico_alvo === 'usuarios' ? pessoas : null,
  }

  const { data: enquete, error: eErr } = await admin
    .from('enquetes')
    .insert({
      titulo: titulo.trim(),
      descricao: descricao?.trim() || null,
      encerramento: encerramento || null,
      ...alvo,
      status: status ?? 'active',
      anonima: anonima ?? true,
      permitir_alterar_voto: permitir_alterar_voto ?? true,
      mostrar_resultados_parciais: mostrar_resultados_parciais ?? false,
      criado_por: caller.user.id,
    })
    .select('id')
    .single()

  if (eErr || !enquete) return Response.json({ error: eErr?.message ?? 'Erro ao criar' }, { status: 500 })

  // Índice enviado → ids gravados, para resolver as condições ("só aparece se…")
  const pergIds: (string | null)[] = []
  const opcaoIds: string[][] = []

  for (let i = 0; i < perguntas.length; i++) {
    const p = perguntas[i]
    pergIds[i] = null
    opcaoIds[i] = []
    if (!p.texto?.trim()) continue

    const cp = p.condicao_pergunta
    const condPergId = cp != null && cp < i ? pergIds[cp] : null
    const condOpcoes = condPergId
      ? (p.condicao_opcoes ?? []).map(oi => opcaoIds[cp!][oi]).filter(Boolean)
      : []

    const { data: perg, error: pErr } = await admin
      .from('enquete_perguntas')
      .insert({
        enquete_id: enquete.id, ordem: i, texto: p.texto.trim(), tipo: p.tipo, obrigatoria: p.obrigatoria ?? false,
        condicao_pergunta_id: condOpcoes.length ? condPergId : null,
        condicao_opcao_ids: condOpcoes.length ? condOpcoes : null,
      })
      .select('id')
      .single()

    if (pErr || !perg) continue
    pergIds[i] = perg.id

    if ((p.tipo === 'radio' || p.tipo === 'checkbox') && Array.isArray(p.opcoes)) {
      const opcoes = p.opcoes
        .map((o, j) => ({ pergunta_id: perg.id, ordem: j, texto: o?.trim() ?? '' }))
        .filter(o => o.texto)
      if (opcoes.length) {
        const { data: inseridas } = await admin.from('enquete_opcoes').insert(opcoes).select('id, ordem')
        // opcaoIds indexado pela posição original da opção (é o que condicao_opcoes referencia)
        ;(inseridas ?? []).forEach((o: { id: string; ordem: number }) => { opcaoIds[i][o.ordem] = o.id })
      }
    }
  }

  if ((status ?? 'active') === 'active') await notificarEnquete(admin, alvo, caller.user.id)

  return Response.json({ id: enquete.id })
}
