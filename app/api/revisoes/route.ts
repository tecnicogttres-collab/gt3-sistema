import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { createClient } from '../../lib/supabase-server'

export async function GET(req: NextRequest) {
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

  // Historical date query: ?date=YYYY-MM-DD returns records for that date
  const dateParam = req.nextUrl.searchParams.get('date')
  if (dateParam) {
    let query = admin
      .from('revisoes_trainee')
      .select('*, criado_por_profile:profiles!criado_por(nome), revisado_por_profile:profiles!revisado_por(nome)')
      .eq('data_dia', dateParam)
      .order('created_at', { ascending: true })

    if (isTrainee) query = query.eq('criado_por', user.id)

    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data ?? [])
  }

  // Active date: latest non-finalized date
  let { data: activeDateRow } = await admin
    .from('revisoes_datas')
    .select('*')
    .eq('finalizado', false)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Auto-create today if no active date exists and today hasn't been inserted yet
  if (!activeDateRow) {
    const today = new Date().toISOString().split('T')[0]
    const { data: todayRow } = await admin
      .from('revisoes_datas')
      .select('*')
      .eq('data', today)
      .maybeSingle()

    if (!todayRow) {
      const { data: created } = await admin
        .from('revisoes_datas')
        .insert({ data: today, finalizado: false })
        .select('*')
        .single()
      activeDateRow = created ?? null
    }
    // If todayRow exists but is finalized, leave activeDate as null (day was already closed)
  }

  const activeDate = activeDateRow?.data ?? null

  // Records for active date
  let records: unknown[] = []
  if (activeDate) {
    let query = admin
      .from('revisoes_trainee')
      .select('*, criado_por_profile:profiles!criado_por(nome), revisado_por_profile:profiles!revisado_por(nome)')
      .eq('data_dia', activeDate)
      .order('created_at', { ascending: true })

    if (isTrainee) query = query.eq('criado_por', user.id)

    const { data } = await query
    records = data ?? []
  }

  // History: finalized dates (desc)
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

const AUTO_AVAL_VALUES = ['aprovado', 'pendente', 'reprovado'] as const

export async function POST(request: NextRequest) {
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

  const body = await request.json() as {
    data_dia: string
    empresa: string
    colaborador?: string | null
    documento: string
    observacoes?: string | null
    auto_avaliacao?: string | null
  }
  const { data_dia, empresa, colaborador, documento, observacoes, auto_avaliacao } = body

  if (!data_dia || !empresa?.trim() || !documento?.trim()) {
    return Response.json(
      { error: 'Campos obrigatórios: data_dia, empresa e documento' },
      { status: 400 }
    )
  }

  if (auto_avaliacao && !AUTO_AVAL_VALUES.includes(auto_avaliacao as typeof AUTO_AVAL_VALUES[number])) {
    return Response.json({ error: 'auto_avaliacao inválido' }, { status: 400 })
  }

  const { data: dateRow } = await admin
    .from('revisoes_datas')
    .select('finalizado')
    .eq('data', data_dia)
    .maybeSingle()

  if (dateRow?.finalizado) {
    return Response.json({ error: 'Este dia já foi finalizado' }, { status: 400 })
  }

  const { count } = await admin
    .from('revisoes_trainee')
    .select('id', { count: 'exact', head: true })
    .eq('data_dia', data_dia)
    .eq('criado_por', user.id)

  if ((count ?? 0) >= 150) {
    return Response.json({ error: 'Limite de 150 registros por dia atingido.' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: record, error } = await admin
    .from('revisoes_trainee')
    .insert({
      data: today,
      data_dia,
      empresa: empresa.trim(),
      colaborador: colaborador?.trim() || null,
      documento: documento.trim(),
      observacoes: observacoes?.trim() || null,
      auto_avaliacao: auto_avaliacao || null,
      criado_por: user.id,
      status: 'pending',
    })
    .select('*, criado_por_profile:profiles!criado_por(nome), revisado_por_profile:profiles!revisado_por(nome)')
    .single()

  if (error) {
    console.error('[POST /api/revisoes] erro insert:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(record, { status: 201 })
}
