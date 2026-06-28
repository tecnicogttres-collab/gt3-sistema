import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.title    !== undefined) updates.title    = String(body.title).trim()
  if (body.client   !== undefined) updates.client   = String(body.client).trim()
  if (body.category !== undefined) updates.category = body.category
  if (body.subject  !== undefined) updates.subject  = String(body.subject ?? '').trim()
  if (body.tags     !== undefined) updates.tags     = Array.isArray(body.tags) ? body.tags : []
  if (body.notes    !== undefined) updates.notes    = String(body.notes ?? '').trim()
  if (body.corpo    !== undefined) updates.corpo    = String(body.corpo ?? '').trim() || null
  if (body.contratante_id !== undefined) updates.contratante_id = body.contratante_id || null
  if (body.file     !== undefined) {
    updates.file      = body.file
    const f = body.file as { name?: string; size?: number } | null
    updates.file_name = body.file_name ?? f?.name ?? null
    updates.file_size = body.file_size ?? f?.size ?? null
  }

  if (Object.keys(updates).length === 0)
    return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  updates.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_templates')
    .update(updates)
    .eq('id', id)
    .select('id, title, client, category, subject, tags, notes, corpo, contratante_id, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('email_templates').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
