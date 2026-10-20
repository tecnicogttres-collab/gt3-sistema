import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'
import { enqueteParaMim, notificarEnquete } from '../../../lib/enquetes-destinatarios'

type Params = { params: Promise<{ id: string }> }

async function getCaller() {
  const user = await getAuthUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  return { user, papel: (data?.papel as string) ?? 'colaborador' }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const isGestorAdmin = ['admin', 'gestor'].includes(caller.papel)

  const { data: enquete, error } = await admin.from('enquetes').select('id, titulo, descricao, encerramento, publico_alvo, destinatarios, status, anonima, permitir_alterar_voto, mostrar_resultados_parciais, criado_por, criado_em').eq('id', id).single()
  if (error || !enquete) return Response.json({ error: 'Não encontrada' }, { status: 404 })
  const paraMim = enqueteParaMim(enquete, caller.user.id, caller.papel)
  if (!isGestorAdmin && (enquete.status === 'draft' || !paraMim)) return Response.json({ error: 'Não encontrada' }, { status: 404 })

  const { data: perguntas } = await admin
    .from('enquete_perguntas')
    .select('id, ordem, texto, tipo, obrigatoria, condicao_pergunta_id, condicao_opcao_ids')
    .eq('enquete_id', id)
    .order('ordem')

  const pergIds = (perguntas ?? []).map((p: { id: string }) => p.id)
  let opcoes: Array<{ id: string; pergunta_id: string; ordem: number; texto: string }> = []
  if (pergIds.length > 0) {
    const { data: opts } = await admin
      .from('enquete_opcoes')
      .select('id, pergunta_id, ordem, texto')
      .in('pergunta_id', pergIds)
      .order('ordem')
    opcoes = opts ?? []
  }

  const { data: minhasRespostas } = await admin
    .from('enquete_respostas')
    .select('pergunta_id, opcao_id, texto_livre')
    .eq('enquete_id', id)
    .eq('usuario_id', caller.user.id)

  return Response.json({
    ...enquete,
    destinatarios: isGestorAdmin ? enquete.destinatarios : null,
    para_mim: paraMim,
    perguntas: (perguntas ?? []).map((p: { id: string }) => ({
      ...p,
      opcoes: opcoes.filter(o => o.pergunta_id === p.id),
    })),
    ja_votou: (minhasRespostas ?? []).length > 0,
    minhas_respostas: minhasRespostas ?? [],
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller || !['admin', 'gestor'].includes(caller.papel)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const body = await req.json() as { status?: string }
  if (!['draft', 'active', 'closed'].includes(body.status ?? '')) return Response.json({ error: 'Status inválido' }, { status: 400 })

  const { data: antes } = await admin.from('enquetes').select('status, publico_alvo, destinatarios').eq('id', id).single()
  if (!antes) return Response.json({ error: 'Não encontrada' }, { status: 404 })

  const { error } = await admin.from('enquetes').update({ status: body.status }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Rascunho publicado agora: avisa quem deve responder
  if (antes.status === 'draft' && body.status === 'active') await notificarEnquete(admin, antes, caller.user.id)

  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller || !['admin', 'gestor'].includes(caller.papel)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('enquetes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
