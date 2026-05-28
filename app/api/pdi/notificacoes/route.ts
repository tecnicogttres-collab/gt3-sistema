import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function GET() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ count: 0, pdiId: null })

  const admin = createAdminClient()
  const { data, count } = await admin
    .from('pdi_notificacoes')
    .select('pdi_id, tipo', { count: 'exact' })
    .eq('colaborador_id', user.id)
    .eq('visto', false)
    .limit(1)

  return Response.json({
    count: count ?? 0,
    pdiId: data?.[0]?.pdi_id ?? null,
    tipo: (data?.[0] as Record<string, string> | undefined)?.tipo ?? 'atualizado',
  })
}
