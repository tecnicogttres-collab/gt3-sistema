import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const COLS = 'id, titulo, descricao, link, categoria, cor, autor_id, autor_nome, data, destinatarios, created_at'
const COR_RE = /^#[0-9a-fA-F]{6}$/

/** Admin mexe em qualquer campanha; gestor só nas que publicou. */
async function podeMexer(admin: ReturnType<typeof createAdminClient>, id: string, caller: { user: { id: string }; role: string }) {
  if (!['gestor', 'admin'].includes(caller.role)) return false
  if (caller.role === 'admin') return true
  const { data } = await admin.from('campanhas').select('autor_id').eq('id', id).single()
  return (data as { autor_id?: string } | null)?.autor_id === caller.user.id
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  const admin = createAdminClient()
  if (!(await podeMexer(admin, id, caller))) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (typeof body.titulo === 'string' && body.titulo.trim()) update.titulo = body.titulo.trim()
  if (typeof body.descricao === 'string') update.descricao = body.descricao.trim() || null
  if (typeof body.link === 'string' && body.link.trim()) update.link = body.link.trim()
  if (typeof body.categoria === 'string' && body.categoria.trim()) update.categoria = body.categoria
  if (typeof body.cor === 'string' && COR_RE.test(body.cor)) update.cor = body.cor

  const { data, error } = await admin.from('campanhas').update(update).eq('id', id).select(COLS).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  const admin = createAdminClient()
  if (!(await podeMexer(admin, id, caller))) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { error } = await admin.from('campanhas').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
