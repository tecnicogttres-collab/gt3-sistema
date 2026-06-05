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

  const admin = createAdminClient()
  const { data: lembretes, error } = await admin
    .from('lembretes')
    .select('id, titulo, descricao, periodo, data_inicio, concluido, criado_por, created_at')
    .order('data_inicio', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(lembretes ?? [])
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { titulo, descricao, periodo, data_inicio } = body

  if (!titulo?.trim()) return Response.json({ error: 'Título obrigatório' }, { status: 400 })
  if (!data_inicio) return Response.json({ error: 'Data obrigatória' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lembretes')
    .insert({
      titulo: titulo.trim(),
      descricao: descricao?.trim() || null,
      periodo: periodo ?? 'unico',
      data_inicio,
      concluido: false,
      criado_por: caller.user.id,
    })
    .select('id, titulo, descricao, periodo, data_inicio, concluido, criado_por, created_at')
    .single()

  if (error || !data) return Response.json({ error: error?.message ?? 'Erro ao criar' }, { status: 500 })

  return Response.json({
    ...data,
    confirmado: false,
    confirmado_em: null,
    confirmado_por_nome: null,
  })
}
