import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'

async function getCaller(): Promise<{ role: string | null; id: string | null }> {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { role: null, id: null }
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  return { role: (data?.papel as string) ?? null, id: user.id }
}

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const caller = await getCaller()
  if (!caller.role || !['gestor', 'admin'].includes(caller.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const admin = createAdminClient()

  // Admin rows can only be edited by that same admin
  const { data: targetProfile } = await admin.from('profiles').select('papel').eq('id', id).single()
  if (targetProfile?.papel === 'admin' && caller.id !== id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as Record<string, unknown>

  const profileUpdates: Record<string, unknown> = {}
  if ('nome' in body) profileUpdates.nome = body.nome
  if ('papel' in body) profileUpdates.papel = body.papel
  if ('pdi_slug' in body) profileUpdates.pdi_slug = body.pdi_slug ?? null
  if ('modulos_permitidos' in body) profileUpdates.modulos_permitidos = body.modulos_permitidos ?? null
  if ('modulos_dashboard' in body) profileUpdates.modulos_dashboard = body.modulos_dashboard ?? null
  if (Object.keys(profileUpdates).length > 0) {
    const { error: updateErr } = await admin.from('profiles').update(profileUpdates).eq('id', id)
    if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })
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
