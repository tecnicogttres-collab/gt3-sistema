import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('workflow_programas_config')
    .select('dados')
    .eq('id', 1)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ dados: data?.dados ?? null })
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { dados } = await req.json()
  if (!dados) return Response.json({ error: 'dados obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('nome').eq('id', user.id).single()
  const nomeUser = (prof as { nome?: string } | null)?.nome ?? null

  const { error } = await admin.from('workflow_programas_config').upsert({
    id: 1,
    dados,
    updated_at: new Date().toISOString(),
    updated_por: user.id,
    updated_por_nome: nomeUser,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
