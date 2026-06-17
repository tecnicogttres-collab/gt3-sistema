import { createClient } from '../../lib/supabase-server'
import { createAdminClient } from '../../lib/supabase-admin'

export async function GET() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json(null, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, nome, usuario, email, papel, modulos_permitidos, modulos_dashboard')
    .eq('id', user.id)
    .single()

  return Response.json(data)
}
