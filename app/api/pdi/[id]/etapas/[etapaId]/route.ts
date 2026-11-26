import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase-admin'
import { getPdiAcesso, logPdi } from '../../../../../lib/pdi-acesso'

const STATUS_LABEL: Record<string, string> = {
  '': 'sem marcação', ok: 'feita', parcial: 'em andamento', travada: 'travada', na: 'não se aplica',
}

const fmt = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : 'sem prazo')

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; etapaId: string }> }) {
  const { id, etapaId } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>
  const admin = createAdminClient()
  const { data: atual } = await admin.from('pdi_etapas').select('*').eq('id', etapaId).eq('pdi_id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'Etapa não encontrada' }, { status: 404 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['titulo', 'status', 'responsavel', 'obs', 'ordem'] as const) {
    if (k in body) updates[k] = body[k]
  }
  if ('prazo' in body) updates.prazo = body.prazo || null
  if ('status' in body) {
    if (!(String(body.status) in STATUS_LABEL)) return Response.json({ error: 'Status inválido' }, { status: 400 })
    updates.concluido_em = body.status === 'ok' ? (atual.concluido_em ?? new Date().toISOString()) : null
  }

  const { data, error } = await admin.from('pdi_etapas').update(updates).eq('id', etapaId).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const log = (evento: string, detalhe: string) =>
    logPdi(admin, { pdiId: id, acaoId: atual.acao_id, evento, detalhe, userId: ac.userId, nome: ac.nome })
  if ('status' in body && body.status !== atual.status) await log('Etapa marcada', `${data.titulo}: ${STATUS_LABEL[String(body.status)]}`)
  if ('titulo' in body && body.titulo !== atual.titulo) await log('Etapa renomeada', `${atual.titulo} → ${data.titulo}`)
  if ('prazo' in body && (body.prazo || null) !== atual.prazo) await log('Prazo da etapa', `${data.titulo}: ${fmt(data.prazo)}`)
  if ('responsavel' in body && body.responsavel !== atual.responsavel) await log('Responsável da etapa', `${data.titulo}: ${data.responsavel || '—'}`)
  if ('obs' in body && body.obs !== atual.obs && String(body.obs).trim()) await log('Anotação na etapa', `${data.titulo}: ${String(body.obs).slice(0, 120)}`)
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; etapaId: string }> }) {
  const { id, etapaId } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data: atual } = await admin.from('pdi_etapas').select('titulo, acao_id').eq('id', etapaId).eq('pdi_id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'Etapa não encontrada' }, { status: 404 })
  const { error } = await admin.from('pdi_etapas').delete().eq('id', etapaId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await logPdi(admin, { pdiId: id, acaoId: atual.acao_id, evento: 'Etapa excluída', detalhe: atual.titulo, userId: ac.userId, nome: ac.nome })
  return new Response(null, { status: 204 })
}
