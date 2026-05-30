import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function GET() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ count: 0, pdiId: null })

  const admin = createAdminClient()
  const { data, count } = await admin
    .from('pdi_notificacoes')
    .select('pdi_id, tipo, created_at', { count: 'exact' })
    .eq('colaborador_id', user.id)
    .eq('visto', false)
    .order('created_at', { ascending: false })
    .limit(1)

  const row = data?.[0] as Record<string, string> | undefined
  return Response.json({
    count: count ?? 0,
    pdiId: row?.pdi_id ?? null,
    tipo: row?.tipo ?? 'atualizado',
    dataAcao: row?.created_at ?? null,
  })
}
