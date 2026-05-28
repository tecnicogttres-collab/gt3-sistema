import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type FileData = { name: string; size: number; data?: string }
type Params = { params: Promise<{ id: string }> }

const MIME_BY_EXT: Record<string, string> = {
  eml: 'message/rfc822',
  msg: 'application/vnd.ms-outlook',
  oft: 'application/vnd.ms-outlook',
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return new Response('Não autenticado', { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_templates')
    .select('file')
    .eq('id', id)
    .single()

  if (error || !data?.file) return new Response('Arquivo não encontrado', { status: 404 })

  const f = data.file as FileData
  if (!f.data) return new Response('Arquivo sem dados', { status: 404 })

  // f.data is a base64 data URI: "data:<mime>;base64,<data>"
  const commaIdx = f.data.indexOf(',')
  if (commaIdx === -1) return new Response('Formato inválido', { status: 422 })
  const b64 = f.data.slice(commaIdx + 1)

  const ext = f.name?.split('.').pop()?.toLowerCase() ?? ''
  const mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream'
  const filename = f.name ?? `email.${ext}`
  const encodedName = encodeURIComponent(filename)

  const binary = Buffer.from(b64, 'base64')

  return new Response(binary, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${filename}"; filename*=UTF-8''${encodedName}`,
      'Content-Length': String(binary.length),
    },
  })
}
