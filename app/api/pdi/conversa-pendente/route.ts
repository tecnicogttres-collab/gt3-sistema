import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()

  if (!['colaborador', 'trainee'].includes(profile?.papel ?? ''))
    return Response.json(null)

  const now = new Date().toISOString()

  const { data } = await admin
    .from('pdi_ciclos')
    .select('id, pdi_id, data_conversa')
    .eq('colaborador_id', user.id)
    .eq('status', 'ativo')
    .not('data_conversa', 'is', null)
    .gte('data_conversa', now)
    .or('autoavaliacao_salva.is.null,autoavaliacao_salva.eq.false')
    .limit(1)

  if (!data || data.length === 0) return Response.json(null)

  const row = data[0] as { id: string; pdi_id: string; data_conversa: string }
  return Response.json({ cicloId: row.id, pdiId: row.pdi_id, dataConversa: row.data_conversa })
}
