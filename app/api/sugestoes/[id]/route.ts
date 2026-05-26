import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: NextRequest, context: RouteContext) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (!['admin', 'gestor'].includes(profile?.papel ?? '')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const { error } = await admin
    .from('sugestoes')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
