import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin.from('workflow_programas_analises').select('*').eq('id', id).single()
  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json({ ...data, minha: data.criado_por === user.id })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.empresa !== undefined) updates.empresa = body.empresa
  if (body.cnpj !== undefined) updates.cnpj = body.cnpj
  if (body.finalizada !== undefined) updates.finalizada = body.finalizada
  if (body.data_final !== undefined) updates.data_final = body.data_final
  if (body.dados !== undefined) updates.dados = body.dados

  const { data, error } = await admin
    .from('workflow_programas_analises')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ...data, minha: data.criado_por === user.id })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: prof } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  const papel = (prof as { papel?: string } | null)?.papel ?? ''
  const { data: row } = await admin.from('workflow_programas_analises').select('criado_por').eq('id', id).single()

  if (row && row.criado_por !== user.id && !['admin', 'gestor'].includes(papel)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { error } = await admin.from('workflow_programas_analises').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
