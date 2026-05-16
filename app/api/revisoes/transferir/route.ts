import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { createClient } from '../../../lib/supabase-server'

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

  if (!profile || profile.papel === 'trainee') {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json() as { criado_por: string; from_data_dia: string }
  const { criado_por, from_data_dia } = body

  if (!criado_por || !from_data_dia) {
    return Response.json({ error: 'criado_por e from_data_dia são obrigatórios' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  // Garantir que a data de hoje existe e não está finalizada
  const { data: todayRow } = await admin
    .from('revisoes_datas')
    .select('*')
    .eq('data', today)
    .maybeSingle()

  if (todayRow?.finalizado) {
    return Response.json({ error: 'A data de hoje já foi finalizada' }, { status: 400 })
  }

  if (!todayRow) {
    await admin.from('revisoes_datas').insert({ data: today, finalizado: false })
  }

  // Mover registros pendentes do trainee da data origem para hoje
  const { data: moved, error } = await admin
    .from('revisoes_trainee')
    .update({ data_dia: today, data: today })
    .eq('criado_por', criado_por)
    .eq('data_dia', from_data_dia)
    .eq('status', 'pending')
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ transferred: moved?.length ?? 0, target: today })
}
