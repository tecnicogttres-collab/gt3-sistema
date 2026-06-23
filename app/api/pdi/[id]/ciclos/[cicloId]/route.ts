import { NextRequest } from 'next/server'
import { createClient } from '../../../../../lib/supabase-server'
import { createAdminClient } from '../../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string; cicloId: string }> }

async function getAuth() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { user: null, papel: null, pdiSlug: null }
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('papel, pdi_slug').eq('id', user.id).single()
  return { user, papel: p?.papel as string | null, pdiSlug: p?.pdi_slug as string | null }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, cicloId } = await params
  const { user, papel } = await getAuth()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const isGestorAdmin = ['gestor', 'admin'].includes(papel ?? '')
  const isColab = papel === 'colaborador' || papel === 'trainee'

  const body = await req.json() as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (isGestorAdmin) {
    if (body.avaliacao_diretiva !== undefined) updates.avaliacao_diretiva = body.avaliacao_diretiva
    if (body.data_conversa !== undefined) {
      updates.data_conversa = body.data_conversa
      updates.conversa_confirmada_em = null // reseta ciência ao reagendar
    }
    if (body.conversa_confirmada_em !== undefined) updates.conversa_confirmada_em = body.conversa_confirmada_em
    if (body.data_inicio !== undefined) updates.data_inicio = body.data_inicio ?? null
    if (body.data_fim !== undefined) updates.data_fim = body.data_fim ?? null
  }

  if (isColab || isGestorAdmin) {
    if (body.autoavaliacao !== undefined) updates.autoavaliacao = body.autoavaliacao
    if (body.autoavaliacao_salva !== undefined) updates.autoavaliacao_salva = body.autoavaliacao_salva
    if (body.ambicao !== undefined) updates.ambicao = body.ambicao
    if (body.conversa_confirmada_em !== undefined) updates.conversa_confirmada_em = body.conversa_confirmada_em
  }

  const admin = createAdminClient()

  // Rascunho por usuário — upsert em tabela própria, não em pdi_ciclos
  if (isGestorAdmin && body.rascunho !== undefined) {
    const { data: prof } = await admin.from('profiles').select('nome').eq('id', user.id).single()
    const userNome = (prof as { nome?: string } | null)?.nome ?? null
    await admin.from('pdi_rascunhos').upsert({
      ciclo_id: cicloId,
      user_id: user.id,
      user_nome: userNome,
      texto: (body.rascunho as string | null)?.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ciclo_id,user_id' })
  }

  if (Object.keys(updates).length === 0 && body.rascunho === undefined)
    return Response.json({ error: 'Nenhum campo' }, { status: 400 })

  if (Object.keys(updates).length === 0) return Response.json({ ok: true })
  const { data, error } = await admin
    .from('pdi_ciclos')
    .update(updates)
    .eq('id', cicloId)
    .eq('pdi_id', id)
    .select('id, pdi_id, colaborador_id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const colaboradorId = (data as { colaborador_id: string | null }).colaborador_id

  // Notifica colaborador quando gestor salva avaliação diretiva
  if (isGestorAdmin && body.avaliacao_diretiva !== undefined && colaboradorId) {
    await admin.from('pdi_notificacoes').insert({
      pdi_id: id,
      colaborador_id: colaboradorId,
      visto: false,
    })
  }

  // Notifica colaborador quando gestor agenda/reagenda conversa
  if (isGestorAdmin && body.data_conversa !== undefined && body.data_conversa !== null && colaboradorId) {
    await admin.from('pdi_notificacoes').insert({
      pdi_id: id,
      colaborador_id: colaboradorId,
      visto: false,
    })
  }

  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { cicloId } = await params
  const { user, papel } = await getAuth()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['gestor', 'admin'].includes(papel ?? ''))
    return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()

  // Get cycle info before deleting
  const { data: ciclo } = await admin.from('pdi_ciclos').select('pdi_id, numero_ciclo, status').eq('id', cicloId).single()

  const { error } = await admin.from('pdi_ciclos').delete().eq('id', cicloId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // If we deleted the active cycle, activate the most recent remaining one
  if (ciclo?.status === 'ativo') {
    const { data: prev } = await admin
      .from('pdi_ciclos')
      .select('id')
      .eq('pdi_id', ciclo.pdi_id)
      .order('numero_ciclo', { ascending: false })
      .limit(1)
    if (prev?.[0]) {
      await admin.from('pdi_ciclos').update({ status: 'ativo', arquivado_em: null }).eq('id', prev[0].id)
    }
  }

  return new Response(null, { status: 204 })
}
