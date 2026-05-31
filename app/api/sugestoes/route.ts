import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller, getAuthUser } from '../../lib/api-helpers'

export async function GET() {
  const caller = await getCaller()
  if (!caller || !['admin', 'gestor'].includes(caller.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sugestoes')
    .select('id, texto, created_at, autor_id, lida, lida_em')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map((s: { id: string; texto: string; created_at: string; autor_id: string | null; lida: boolean; lida_em: string | null }) => ({
    id: s.id,
    texto: s.texto,
    created_at: s.created_at,
    lida: s.lida ?? false,
    lida_em: s.lida_em ?? null,
    ...(caller.role === 'admin' ? { autor_id: s.autor_id } : {}),
  }))

  return Response.json(result)
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
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
