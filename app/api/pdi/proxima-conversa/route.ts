import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json(null)

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data } = await admin
    .from('pdi_ciclos')
    .select('id, pdi_id, data_conversa, numero_ciclo')
    .eq('colaborador_id', caller.user.id)
    .eq('status', 'ativo')
    .not('data_conversa', 'is', null)
    .gte('data_conversa', now)
    .order('data_conversa', { ascending: true })
    .limit(1)

  if (!data || data.length === 0) return Response.json(null)

  const row = data[0] as { id: string; pdi_id: string; data_conversa: string; numero_ciclo: number }
  return Response.json({
    cicloId: row.id,
    pdiId: row.pdi_id,
    dataConversa: row.data_conversa,
    numeroCiclo: row.numero_ciclo,
  })
}
