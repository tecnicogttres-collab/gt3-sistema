import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.aso !== undefined) updates.aso = Boolean(body.aso)
  if (body.epi_capacete !== undefined) updates.epi_capacete = Boolean(body.epi_capacete)
  if (body.epi_cinto !== undefined) updates.epi_cinto = Boolean(body.epi_cinto)
  if (body.corrigido !== undefined) updates.corrigido = Boolean(body.corrigido)
  if (body.nome !== undefined) updates.nome = String(body.nome).trim()
  if (body.empresa !== undefined) updates.empresa = String(body.empresa).trim()

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('revisao_nr_registros')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.from('revisao_nr_registros').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
