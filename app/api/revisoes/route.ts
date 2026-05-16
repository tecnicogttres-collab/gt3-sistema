import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { createClient } from '../../lib/supabase-server'

export async function GET(_req: NextRequest) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })

  const isTrainee = profile.papel === 'trainee'

  // Active date: latest non-finalized date
  const { data: activeDateRow } = await admin
    .from('revisoes_datas')
    .select('*')
    .eq('finalizado', false)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()

  const activeDate = activeDateRow?.data ?? null

  // Records for active date
  let records: unknown[] = []
  if (activeDate) {
    let query = admin
      .from('revisoes_registros')
      .select('*, criado_por_profile:profiles!criado_por(nome), revisado_por_profile:profiles!revisado_por(nome)')
      .eq('data_dia', activeDate)
      .order('criado_em', { ascending: true })

    if (isTrainee) {
      query = query.eq('criado_por', user.id)
    }

    const { data } = await query
    records = data ?? []
  }

  // History: finalized dates (desc) with their record counts
  const { data: historyDates } = await admin
    .from('revisoes_datas')
    .select('*, finalizador:profiles!finalizado_por(nome)')
    .eq('finalizado', true)
    .order('data', { ascending: false })
    .limit(30)

  // Trainees list (for revisor view)
  let trainees: unknown[] = []
  if (!isTrainee) {
    const { data } = await admin
      .from('profiles')
      .select('id, nome')
      .eq('papel', 'trainee')
      .order('nome', { ascending: true })
    trainees = data ?? []
  }

  return Response.json({
    activeDate,
    activeDateRow: activeDateRow ?? null,
    records,
    historyDates: historyDates ?? [],
    trainees,
    currentUserId: user.id,
    currentPapel: profile.papel,
  })
}
