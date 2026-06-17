import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

async function getCaller() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  const raw = (data?.papel as string) ?? 'colaborador'
  return { user, role: raw === 'trainee' ? 'colaborador' : raw }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const isGestorAdmin = ['admin', 'gestor'].includes(caller.role)

  const { data: enquete, error } = await admin.from('enquetes').select('id, titulo, descricao, encerramento, publico_alvo, status, anonima, permitir_alterar_voto, mostrar_resultados_parciais, criado_por, criado_em').eq('id', id).single()
  if (error || !enquete) return Response.json({ error: 'Não encontrada' }, { status: 404 })
  if (!isGestorAdmin && enquete.status === 'draft') return Response.json({ error: 'Não encontrada' }, { status: 404 })

  const { data: perguntas } = await admin
    .from('enquete_perguntas')
    .select('id, ordem, texto, tipo, obrigatoria')
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
    perguntas: (perguntas ?? []).map((p: { id: string; ordem: number; texto: string; tipo: string; obrigatoria: boolean }) => ({
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
  if (!caller || !['admin', 'gestor'].includes(caller.role)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const body = await req.json()
  const { error } = await admin.from('enquetes').update(body).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller || !['admin', 'gestor'].includes(caller.role)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('enquetes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
