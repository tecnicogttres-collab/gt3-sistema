import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.nome !== undefined) update.nome = String(body.nome).trim()
  if (body.cor !== undefined) update.cor = String(body.cor)
  if (body.ativo !== undefined) update.ativo = Boolean(body.ativo)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('desig_situacoes')
    .update(update)
    .eq('id', id)
    .select('id, nome, cor, ativo, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()

  const { count } = await admin
    .from('designacoes')
    .select('id', { count: 'exact', head: true })
    .eq('situacao_id', id)

  if ((count ?? 0) > 0) {
    return Response.json({ error: 'Status em uso por designações existentes — desative em vez de excluir.' }, { status: 400 })
  }

  const { error } = await admin.from('desig_situacoes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
