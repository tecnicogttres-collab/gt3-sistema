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

  // multipart quando vem arquivo novo (troca do arquivo); JSON quando é só metadado
  const isMultipart = (req.headers.get('content-type') ?? '').includes('multipart/form-data')
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  let file: File | null = null

  if (isMultipart) {
    const fd = await req.formData()
    for (const k of ['nome', 'categoria', 'tipo'] as const) {
      const v = (fd.get(k) as string | null)?.trim()
      if (v) patch[k] = v
    }
    file = fd.get('file') as File | null
  } else {
    const body = await req.json() as Partial<{ nome: string; categoria: string; tipo: string }>
    for (const k of ['nome', 'categoria', 'tipo'] as const) {
      const v = body[k]?.trim()
      if (v) patch[k] = v
    }
  }

  let oldPath: string | null = null
  let newPath: string | null = null
  if (file) {
    const { data: row } = await admin.from('repositorio_modelos').select('storage_path').eq('id', id).single()
    if (!row) return Response.json({ error: 'Não encontrado' }, { status: 404 })
    oldPath = row.storage_path

    const ext = file.name.split('.').pop() ?? 'bin'
    newPath = `${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(newPath, await file.arrayBuffer(), { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 })

    Object.assign(patch, {
      storage_path: newPath,
      filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    })
  }

  const { data, error } = await admin
    .from('repositorio_modelos')
    .update(patch)
    .eq('id', id)
    .select('id, nome, categoria, tipo, filename, mime_type, size_bytes, criado_por_nome, created_at, updated_at')
    .single()

  if (error) {
    if (newPath) await admin.storage.from(BUCKET).remove([newPath])
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (oldPath) await admin.storage.from(BUCKET).remove([oldPath])
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
