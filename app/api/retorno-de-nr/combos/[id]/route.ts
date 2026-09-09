import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.nome !== undefined) {
    const nome = String(body.nome).trim()
    if (!nome) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })
    updates.nome = nome
  }
  if (body.treinamento_ids !== undefined) {
    const ids: string[] = Array.isArray(body.treinamento_ids) ? body.treinamento_ids.map(String) : []
    if (ids.length < 2) return Response.json({ error: 'Selecione ao menos dois treinamentos' }, { status: 400 })
    updates.treinamento_ids = ids
  }
  if (body.ordem !== undefined) updates.ordem = Number(body.ordem) || 0

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('rnr_combos').update(updates).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.from('rnr_combos').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
