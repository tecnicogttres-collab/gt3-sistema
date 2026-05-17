import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function GET() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ count: 0 })

  const admin = createAdminClient()
  const { count } = await admin
    .from('pdi_notificacoes')
    .select('*', { count: 'exact', head: true })
    .eq('colaborador_id', user.id)
    .eq('visto', false)

  return Response.json({ count: count ?? 0 })
}
