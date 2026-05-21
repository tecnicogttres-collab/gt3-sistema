import { NextRequest } from 'next/server'
import { createClient } from '../../lib/supabase-server'
import { createAdminClient } from '../../lib/supabase-admin'

async function getCaller() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  return { user, role: (data?.papel as string) ?? null }
}

export async function GET() {
  const caller = await getCaller()
  if (!caller || !['admin', 'gestor'].includes(caller.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sugestoes')
    .select('id, texto, created_at, autor_id')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map((s: { id: string; texto: string; created_at: string; autor_id: string | null }) => ({
    id: s.id,
    texto: s.texto,
    created_at: s.created_at,
    // autor_id só chega para admin — gestor recebe undefined
    ...(caller.role === 'admin' ? { autor_id: s.autor_id } : {}),
  }))

  return Response.json(result)
}

export async function POST(request: NextRequest) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as { texto?: string }
  if (!body.texto?.trim()) {
    return Response.json({ error: 'Texto é obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('sugestoes').insert({
    texto: body.texto.trim(),
    autor_id: user.id,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Dispara notificação (fire-and-forget — não bloqueia a resposta)
  fetch(`${request.nextUrl.origin}/api/notificacoes/disparar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
    body: JSON.stringify({ modulo: 'sugestoes' }),
  }).catch(() => {})

  return Response.json({ success: true })
}
