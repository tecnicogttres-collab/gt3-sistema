import { createAdminClient } from '../../../lib/supabase-admin'
import { createClient } from '../../../lib/supabase-server'

export async function POST() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('profiles')
    .select('id, papel')
    .eq('id', user.id)
    .single()

  if (existing) {
    return Response.json({ success: true, role: existing.papel, seeded: false })
  }

  const nome = (user.user_metadata?.nome as string | undefined)
    ?? user.email?.split('@')[0]
    ?? 'Usuário'

  const { error } = await admin.from('profiles').insert({
    id: user.id,
    nome,
    email: user.email ?? '',
    papel: 'admin',
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true, role: 'admin', seeded: true })
}
