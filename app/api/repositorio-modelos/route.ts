import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller } from '../../lib/api-helpers'

const BUCKET = 'repositorio-modelos'
const SELECT = 'id, nome, categoria, tipo, filename, mime_type, size_bytes, criado_por_nome, created_at, updated_at'

export async function GET(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const tipo = req.nextUrl.searchParams.get('tipo') ?? 'empresas'
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('repositorio_modelos')
    .select(SELECT)
    .eq('tipo', tipo)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: prof } = await admin
    .from('profiles')
    .select('papel, nome, usuario')
    .eq('id', caller.user.id)
    .single()

  if (!['gestor', 'admin'].includes(prof?.papel ?? '')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const nome      = (formData.get('nome')      as string | null)?.trim() || file.name.replace(/\.[^.]+$/, '')
  const categoria = (formData.get('categoria') as string | null)?.trim() || 'Outros'
  const tipo      = (formData.get('tipo')      as string | null)?.trim() || 'empresas'

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

  const criadoPorNome = prof?.nome?.trim() || prof?.usuario?.trim() || 'Usuário'

  const { data, error } = await admin
    .from('repositorio_modelos')
    .insert({
      nome,
      categoria,
      tipo,
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      criado_por: caller.user.id,
      criado_por_nome: criadoPorNome,
    })
    .select(SELECT)
    .single()

  if (error) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
