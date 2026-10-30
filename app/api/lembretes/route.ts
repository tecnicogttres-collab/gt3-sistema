import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'
import { dataConfirmada } from '../../lib/lembretes'
import { carregarConfirmacoes } from '../../lib/lembretes-server'

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

  const { data: all, error } = await admin
    .from('lembretes')
    .select('id, titulo, descricao, periodo, data_inicio, hora_inicio, dia_semana, semana_ordinal, concluido, criado_por, created_at, visibilidade, destinatarios')
    .order('data_inicio', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const visiveis = (all ?? [])
    .filter(r => {
      const vis = r.visibilidade ?? 'todos'
      if (vis === 'todos') return true
      if (vis === 'proprio') return r.criado_por === userId
      if (vis === 'selecionados') {
        return r.criado_por === userId || (r.destinatarios ?? []).includes(userId)
      }
      return true
    })

  const now = new Date()
  const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  try {
    // OK de qualquer usuário finaliza a ocorrência — o lembrete é compartilhado.
    const confirmacoes = await carregarConfirmacoes(admin, visiveis, hoje)
    const lembretes = visiveis.map(r => ({
      ...r,
      confirmadas: confirmacoes.filter(c => c.lembrete_id === r.id).map(c => dataConfirmada(r, c)).filter(Boolean),
    }))
    return Response.json(lembretes)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
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
    confirmadas: [],
  })
}
