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
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })

  const body = await request.json() as {
    data_dia: string
    empresa: string
    colaborador: string
    documento: string
  }
  const { data_dia, empresa, colaborador, documento } = body

  if (!data_dia || !empresa?.trim() || !colaborador?.trim() || !documento?.trim()) {
    return Response.json({ error: 'Campos obrigatórios: data_dia, empresa, colaborador, documento' }, { status: 400 })
  }

  // Verify the date is active (not finalized)
  const { data: dateRow } = await admin
    .from('revisoes_datas')
    .select('finalizado')
    .eq('data', data_dia)
    .maybeSingle()

  if (dateRow?.finalizado) {
    return Response.json({ error: 'Este dia já foi finalizado' }, { status: 400 })
  }

  const { data: record, error } = await admin
    .from('revisoes_registros')
    .insert({
      data_dia,
      empresa: empresa.trim(),
      colaborador: colaborador.trim(),
      documento: documento.trim(),
      criado_por: user.id,
    })
    .select('*, criado_por_profile:profiles!criado_por(nome), revisado_por_profile:profiles!revisado_por(nome)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(record, { status: 201 })
}
