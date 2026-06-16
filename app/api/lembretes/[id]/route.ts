import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

async function getCaller() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('nome').eq('id', user.id).single()
  return { user, nome: (data?.nome as string | null) ?? 'Usuário' }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.titulo !== undefined) update.titulo = String(body.titulo).trim()
  if (body.descricao !== undefined) update.descricao = body.descricao?.trim() || null
  if (body.periodo !== undefined) update.periodo = body.periodo
  if (body.data_inicio !== undefined) update.data_inicio = body.data_inicio
  if (body.hora_inicio !== undefined) update.hora_inicio = body.hora_inicio ?? null
  if (body.concluido !== undefined) update.concluido = body.concluido
  if (body.visibilidade !== undefined) {
    const vis = ['todos', 'proprio', 'selecionados'].includes(body.visibilidade) ? body.visibilidade : 'todos'
    update.visibilidade = vis
    update.destinatarios = vis === 'selecionados' ? (body.destinatarios ?? []) : null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lembretes')
    .update(update)
    .eq('id', id)
    .select('id, titulo, descricao, periodo, data_inicio, hora_inicio, concluido, criado_por, created_at, visibilidade, destinatarios')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.from('lembretes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
