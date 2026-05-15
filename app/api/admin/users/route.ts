import { createAdminClient } from '../../../lib/supabase-admin'
import { createClient } from '../../../lib/supabase-server'

async function getCallerRole(): Promise<string | null> {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  return (data?.papel as string) ?? null
}

export async function GET() {
  const role = await getCallerRole()
  if (!role || !['gestor', 'admin'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: profiles } = await admin.from('profiles').select('*')
  const profileMap = new Map(
    (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p])
  )

  const result = users.map((u) => {
    const profile = profileMap.get(u.id) as Record<string, unknown> | undefined
    const bannedUntil = (u as unknown as { banned_until?: string }).banned_until
    return {
      id: u.id,
      email: u.email ?? '',
      last_sign_in: u.last_sign_in_at ?? null,
      created_at: u.created_at,
      banned: bannedUntil ? new Date(bannedUntil) > new Date() : false,
      nome: profile?.nome ?? null,
      papel: profile?.papel ?? null,
      pdi_slug: profile?.pdi_slug ?? null,
    }
  })

  return Response.json(result)
}
