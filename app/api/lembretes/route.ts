import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'

async function getCaller() {
  const user = await getAuthUser()
  if (!user) return null
  return { user }
}


export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const userId = caller.user.id
  const admin = createAdminClient()

  const now = new Date()
  const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: all, error }, { data: confirmacoes }] = await Promise.all([
    admin
      .from('lembretes')
      .select('id, titulo, descricao, periodo, data_inicio, hora_inicio, dia_semana, semana_ordinal, concluido, criado_por, created_at, visibilidade, destinatarios')
      .order('data_inicio', { ascending: true }),
    admin
      .from('lembretes_historico')
      .select('lembrete_id')
      .eq('mes_referencia', mesRef),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const confirmedIds = new Set((confirmacoes ?? []).map(c => c.lembrete_id))

  const lembretes = (all ?? [])
    .filter(r => {
      const vis = r.visibilidade ?? 'todos'
      if (vis === 'todos') return true
      if (vis === 'proprio') return r.criado_por === userId
      if (vis === 'selecionados') {
        return r.criado_por === userId || (r.destinatarios ?? []).includes(userId)
      }
      return true
    })
    .map(r => ({ ...r, confirmado: confirmedIds.has(r.id) }))

  return Response.json(lembretes)
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { titulo, descricao, periodo, data_inicio, hora_inicio, dia_semana, semana_ordinal, visibilidade, destinatarios } = body

  if (!titulo?.trim()) return Response.json({ error: 'Título obrigatório' }, { status: 400 })
  if (!data_inicio) return Response.json({ error: 'Data obrigatória' }, { status: 400 })

  const vis = ['todos', 'proprio', 'selecionados'].includes(visibilidade) ? visibilidade : 'todos'

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lembretes')
    .insert({
      titulo: titulo.trim(),
      descricao: descricao?.trim() || null,
      periodo: periodo ?? 'unico',
      data_inicio,
      hora_inicio: hora_inicio ?? null,
      dia_semana: periodo === 'mensal_dia_semana' ? dia_semana ?? null : null,
      semana_ordinal: periodo === 'mensal_dia_semana' ? semana_ordinal ?? null : null,
      concluido: false,
      criado_por: caller.user.id,
      visibilidade: vis,
      destinatarios: vis === 'selecionados' ? (destinatarios ?? []) : null,
    })
    .select('id, titulo, descricao, periodo, data_inicio, hora_inicio, dia_semana, semana_ordinal, concluido, criado_por, created_at, visibilidade, destinatarios')
    .single()

  if (error || !data) return Response.json({ error: error?.message ?? 'Erro ao criar' }, { status: 500 })

  return Response.json({
    ...data,
    confirmado: false,
    confirmado_em: null,
    confirmado_por_nome: null,
  })
}
