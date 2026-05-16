import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'

type Params = { params: Promise<{ data: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { data: dataDia } = await params

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

  let query = admin
    .from('revisoes_registros')
    .select('*, criado_por_profile:profiles!criado_por(nome), revisado_por_profile:profiles!revisado_por(nome)')
    .eq('data_dia', dataDia)
    .order('criado_em', { ascending: true })

  if (isTrainee) {
    query = query.eq('criado_por', user.id)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}
