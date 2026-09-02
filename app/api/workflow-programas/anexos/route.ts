import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

const BUCKET = 'workflow-programas-anexos'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('workflow_programas_anexos')
    .select('id, texto_id, name, filename, mime_type, size_bytes, created_at')
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const textoId = (formData.get('texto_id') as string | null)?.trim()
  if (!file) return Response.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (!textoId) return Response.json({ error: 'texto_id obrigatório' }, { status: 400 })

  const admin = createAdminClient()

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

  const displayName = (formData.get('name') as string | null)?.trim() || file.name.replace(/\.[^.]+$/, '')

  const { data, error } = await admin
    .from('workflow_programas_anexos')
    .insert({
      texto_id: textoId,
      name: displayName,
      filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      storage_path: storagePath,
      criado_por: user.id,
    })
    .select('id, texto_id, name, filename, mime_type, size_bytes, created_at')
    .single()

  if (error) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data, { status: 201 })
}
