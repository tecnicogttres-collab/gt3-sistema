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

const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch (e) {
    console.error('[workflow-programas/anexos] falha ao ler formData:', e)
    return Response.json({ error: 'Falha ao processar o arquivo enviado. Tente novamente ou use um arquivo menor.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const textoId = (formData.get('texto_id') as string | null)?.trim()
  if (!file) return Response.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (!textoId) return Response.json({ error: 'texto_id obrigatório' }, { status: 400 })
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: 20MB.` }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error: bucketError } = await admin.storage.createBucket(BUCKET, { public: false })
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    console.error('[workflow-programas/anexos] falha ao criar bucket:', bucketError.message)
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${crypto.randomUUID()}.${ext}`

  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (e) {
    console.error('[workflow-programas/anexos] falha ao ler arquivo:', e)
    return Response.json({ error: 'Falha ao ler o conteúdo do arquivo.' }, { status: 400 })
  }

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (uploadError) {
    console.error('[workflow-programas/anexos] falha no upload:', uploadError.message)
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

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
    console.error('[workflow-programas/anexos] falha ao inserir registro:', error.message)
    await admin.storage.from(BUCKET).remove([storagePath])
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data, { status: 201 })
}
