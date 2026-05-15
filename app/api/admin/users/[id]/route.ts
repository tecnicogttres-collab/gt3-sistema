import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'

async function getCallerRole(): Promise<string | null> {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  return (data?.papel as string) ?? null
}

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const role = await getCallerRole()
  if (!role || !['gestor', 'admin'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json() as Record<string, unknown>
  const admin = createAdminClient()

  const profileUpdates: Record<string, unknown> = {}
  if ('nome' in body) profileUpdates.nome = body.nome
  if ('papel' in body) profileUpdates.papel = body.papel
  if ('pdi_slug' in body) profileUpdates.pdi_slug = body.pdi_slug ?? null
  if (Object.keys(profileUpdates).length > 0) {
    await admin.from('profiles').update(profileUpdates).eq('id', id)
  }

  if ('password' in body) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: body.password as string,
    })
    if (error) return Response.json({ error: error.message }, { status: 400 })
  }

  if ('banned' in body) {
    await admin.auth.admin.updateUserById(id, {
      ban_duration: body.banned ? '876600h' : 'none',
    })
  }

  return Response.json({ success: true })
}
