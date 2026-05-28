import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

async function requireGestorAdmin() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { user: null, ok: false as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  const papel = profile?.papel as string | null
  if (!papel || !['gestor', 'admin'].includes(papel)) return { user, ok: false as const }
  return { user, ok: true as const, admin }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireGestorAdmin()
  if (!auth.ok) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>
  const allowed = ['nome', 'funcao', 'status', 'eneagrama', 'animais', 'conclusoes', 'data_inicio']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('pdis').update(updates).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireGestorAdmin()
  if (!auth.ok) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  // Clear pdi_slug from profiles that reference this PDI
  await admin.from('profiles').update({ pdi_slug: null }).eq('pdi_slug', id)
  // Delete the PDI record (cascades to ciclos, notificacoes, acoes if FK ON DELETE CASCADE)
  const { error } = await admin.from('pdis').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return new Response(null, { status: 204 })
}
