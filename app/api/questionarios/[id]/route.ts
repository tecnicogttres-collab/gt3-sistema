import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../lib/api-helpers'
import { QN_SELECT } from '../../../questionarios/types'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.titulo === 'string') patch.titulo = body.titulo
  if (body.publico === 'Contratante' || body.publico === 'Prestador') patch.publico = body.publico
  if (body.status === 'rascunho' || body.status === 'ativo' || body.status === 'encerrado') patch.status = body.status
  if (Array.isArray(body.perguntas)) patch.perguntas = body.perguntas
  if (body.painel_config && typeof body.painel_config === 'object') patch.painel_config = body.painel_config

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('questionarios')
    .update(patch)
    .eq('id', id)
    .select(QN_SELECT)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

/** Exclui o questionário e, em cascata, os convites e respostas dele. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('questionarios').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
