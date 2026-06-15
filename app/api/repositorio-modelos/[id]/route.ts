import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const BUCKET = 'repositorio-modelos'

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('papel').eq('id', caller.user.id).single()
  if (!['gestor', 'admin'].includes(prof?.papel ?? '')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json() as Partial<{ nome: string; categoria: string; tipo: string }>
  const { data, error } = await admin
    .from('repositorio_modelos')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, nome, categoria, tipo, filename, mime_type, size_bytes, criado_por_nome, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('papel').eq('id', caller.user.id).single()
  if (!['gestor', 'admin'].includes(prof?.papel ?? '')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { data: row } = await admin
    .from('repositorio_modelos')
    .select('storage_path')
    .eq('id', id)
    .single()

  const { error } = await admin.from('repositorio_modelos').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (row?.storage_path) {
    await admin.storage.from(BUCKET).remove([row.storage_path])
  }

  return Response.json({ ok: true })
}
