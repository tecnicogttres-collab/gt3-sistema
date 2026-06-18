import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getCaller } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['gestor', 'admin'].includes(caller.role)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.label !== undefined) update.label = String(body.label).trim()
  if (body.color !== undefined) update.color = String(body.color)
  if (body.bg    !== undefined) update.bg    = String(body.bg)
  if (body.ordem !== undefined) update.ordem = Number(body.ordem)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('legislacoes_categorias')
    .update(update)
    .eq('id', id)
    .select('id, label, color, bg, ordem')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['gestor', 'admin'].includes(caller.role)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('legislacoes_categorias').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
