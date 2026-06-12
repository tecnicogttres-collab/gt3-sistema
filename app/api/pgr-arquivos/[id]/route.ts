import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const BUCKET = 'pgr-arquivos'

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as Partial<{ name: string; notes: string; situations: string[] }>
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('pgr_arquivos')
    .update(body)
    .eq('id', id)
    .select('id, name, filename, mime_type, size_bytes, notes, situations, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: row } = await admin
    .from('pgr_arquivos')
    .select('storage_path')
    .eq('id', id)
    .single()

  const { error } = await admin.from('pgr_arquivos').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (row?.storage_path) {
    await admin.storage.from(BUCKET).remove([row.storage_path])
  }

  return Response.json({ ok: true })
}
