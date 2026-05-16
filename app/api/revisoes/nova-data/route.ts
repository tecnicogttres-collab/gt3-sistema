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

  return Response.json({ success: true })
}
