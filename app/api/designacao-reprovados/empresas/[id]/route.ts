import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const patch: Record<string, string> = {}
  if (typeof body.nome === 'string') {
    if (!body.nome.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })
    patch.nome = body.nome.trim()
  }
  if (typeof body.contratante === 'string') patch.contratante = body.contratante.trim()
  if (typeof body.email === 'string') patch.email = body.email.trim()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('desig_empresas')
    .update(patch)
    .eq('id', id)
    .select('id, nome, contratante, email, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('desig_empresas').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
