import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function GET() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()

  if (!['colaborador', 'trainee'].includes(profile?.papel ?? ''))
    return Response.json(null)

  const { data } = await admin
    .from('pdi_ciclos')
    .select('id, pdi_id, data_conversa')
    .eq('colaborador_id', user.id)
    .not('data_conversa', 'is', null)
    .is('conversa_confirmada_em', null)
    .limit(1)

  if (!data || data.length === 0) return Response.json(null)

  const row = data[0] as { id: string; pdi_id: string; data_conversa: string }
  return Response.json({ cicloId: row.id, pdiId: row.pdi_id, dataConversa: row.data_conversa })
}
