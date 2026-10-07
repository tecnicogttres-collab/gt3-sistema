import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('revisoes_datas')
    .select('*, finalizador:profiles!finalizado_por(nome)')
    .order('data', { ascending: false })
    .limit(60)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
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

  const body = await request.json() as { data_dia: string }
  const { data_dia } = body

  if (!data_dia) return Response.json({ error: 'data_dia obrigatório' }, { status: 400 })

  const { data: existing } = await admin
    .from('revisoes_datas')
    .select('id')
    .eq('data', data_dia)
    .maybeSingle()

  if (existing) return Response.json({ error: 'Esta data já existe' }, { status: 400 })

  const { error } = await admin
    .from('revisoes_datas')
    .insert({ data: data_dia, finalizado: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true }, { status: 201 })
}
