import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'

type Params = { params: Promise<{ id: string }> }

async function requireGestor() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { error: Response.json({ error: 'Não autenticado' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return { error: Response.json({ error: 'Perfil não encontrado' }, { status: 403 }) }
  if (profile.papel !== 'gestor' && profile.papel !== 'admin') {
    return { error: Response.json({ error: 'Sem permissão' }, { status: 403 }) }
  }
  return { admin }
}

function newToken() {
  // 24 bytes aleatórios → 32 chars base64url: ~192 bits de entropia, impossível de adivinhar.
  return randomBytes(24).toString('base64url')
}

// Liga o compartilhamento (gera token se não houver). ?rotate=1 gera um link novo (invalida o antigo).
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireGestor()
  if (auth.error) return auth.error
  const { admin } = auth

  const rotate = new URL(request.url).searchParams.get('rotate') === '1'

  const { data: existing, error: readErr } = await admin
    .from('atas_contratantes').select('share_token').eq('id', id).single()
  if (readErr || !existing) return Response.json({ error: 'Ata não encontrada' }, { status: 404 })

  const token = (existing.share_token && !rotate) ? existing.share_token : newToken()

  const { error } = await admin
    .from('atas_contratantes')
    .update({ share_token: token, share_enabled: true, share_created_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ enabled: true, token })
}

// Desliga o compartilhamento (o link para de funcionar imediatamente).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireGestor()
  if (auth.error) return auth.error
  const { admin } = auth

  const { error } = await admin
    .from('atas_contratantes')
    .update({ share_enabled: false })
    .eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ enabled: false })
}
