import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase-admin'
import { getPdiAcesso } from '../../../../../lib/pdi-acesso'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; anotacaoId: string }> }) {
  const { id, anotacaoId } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const b = await req.json() as Record<string, unknown>
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['tipo', 'texto', 'data', 'visivel', 'competencia', 'resposta'] as const) {
    if (k in b) updates[k] = b[k]
  }
  if ('acao_id' in b) updates.acao_id = b.acao_id || null
  if ('ciclo_id' in b) updates.ciclo_id = b.ciclo_id || null
  if ('resolvido' in b) {
    updates.resolvido = Boolean(b.resolvido)
    updates.resolvido_em = b.resolvido ? new Date().toISOString() : null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdi_anotacoes').update(updates).eq('id', anotacaoId).eq('pdi_id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; anotacaoId: string }> }) {
  const { id, anotacaoId } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })
  const admin = createAdminClient()
  const { error } = await admin.from('pdi_anotacoes').delete().eq('id', anotacaoId).eq('pdi_id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
