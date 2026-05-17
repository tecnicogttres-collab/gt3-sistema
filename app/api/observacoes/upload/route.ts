import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function POST(req: NextRequest) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'Arquivo não encontrado' }, { status: 400 })

  const MAX_MB = 8
  if (file.size > MAX_MB * 1024 * 1024) {
    return Response.json({ error: `Tamanho máximo: ${MAX_MB}MB` }, { status: 413 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`

  const admin = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage
    .from('observacoes-imagens')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage
    .from('observacoes-imagens')
    .getPublicUrl(path)

  return Response.json({ url: publicUrl })
}
