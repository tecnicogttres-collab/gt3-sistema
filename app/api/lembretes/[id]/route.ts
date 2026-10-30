import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

async function getCaller() {
  const user = await getAuthUser()
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
  if (body.periodo !== undefined) {
    update.periodo = body.periodo
    // dia_semana/semana_ordinal só fazem sentido pra 'mensal_dia_semana' — qualquer
    // outro período limpa os dois (evita sobrar lixo de uma periodicidade antiga).
    update.dia_semana = body.periodo === 'mensal_dia_semana' ? (body.dia_semana ?? null) : null
    update.semana_ordinal = body.periodo === 'mensal_dia_semana' ? (body.semana_ordinal ?? null) : null
  }
  if (body.data_inicio !== undefined) update.data_inicio = body.data_inicio
  if (body.hora_inicio !== undefined) update.hora_inicio = body.hora_inicio ?? null
  if (body.concluido !== undefined) update.concluido = body.concluido
  if (body.visibilidade !== undefined) {
    const vis = ['todos', 'proprio', 'selecionados'].includes(body.visibilidade) ? body.visibilidade : 'todos'
    update.visibilidade = vis
    update.destinatarios = vis === 'selecionados' ? (body.destinatarios ?? []) : null
  }

  const admin = createAdminClient()

  // Reagendar substitui adiamentos e descartes feitos para a data antiga. Apaga antes do update:
  // o realtime do update faz as telas recarregarem, e elas não podem ler o adiamento velho.
  const { data: atual } = await admin
    .from('lembretes')
    .select('periodo, data_inicio, dia_semana, semana_ordinal')
    .eq('id', id)
    .single()
  const reagendou = atual && (['periodo', 'data_inicio', 'dia_semana', 'semana_ordinal'] as const)
    .some(c => update[c] !== undefined && update[c] !== atual[c])
  if (reagendou) {
    const { error: adiError } = await admin.from('lembretes_adiamentos').delete().eq('lembrete_id', id)
    if (adiError) return Response.json({ error: adiError.message }, { status: 500 })
  }

  const { data, error } = await admin
    .from('lembretes')
    .update(update)
    .eq('id', id)
    .select('id, titulo, descricao, periodo, data_inicio, hora_inicio, dia_semana, semana_ordinal, concluido, criado_por, created_at, visibilidade, destinatarios')
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
