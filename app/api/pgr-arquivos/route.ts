import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller } from '../../lib/api-helpers'

const BUCKET = 'pgr-arquivos'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pgr_arquivos')
    .select('id, name, filename, mime_type, size_bytes, notes, situations, contratantes, created_at')
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const admin = createAdminClient()

  // garante que o bucket existe
  await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {})

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 })

  const displayName = (formData.get('name') as string | null)?.trim()
    || file.name.replace(/\.[^.]+$/, '')

  const { data, error } = await admin
    .from('pgr_arquivos')
    .insert({
      name: displayName,
      filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      notes: '',
      situations: ['all'],
      contratantes: ['all'],
      storage_path: storagePath,
      created_by: caller.user.id,
    })
    .select('id, name, filename, mime_type, size_bytes, notes, situations, contratantes, created_at')
    .single()

  if (error) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
