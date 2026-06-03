import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'

async function getCaller() {
  const user = await getAuthUser()
  if (!user) return null
  return { user }
}

function mesReferenciaAtual(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const mesRef = mesReferenciaAtual()

  const [{ data: lembretes, error }, { data: confirmacoes }, { data: profile }] = await Promise.all([
    admin
      .from('lembretes')
      .select('id, titulo, descricao, periodo, data_inicio, concluido, criado_por, created_at')
      .order('data_inicio', { ascending: true }),
    admin
      .from('lembretes_confirmacoes')
      .select('lembrete_id, confirmado_em')
      .eq('user_id', caller.user.id)
      .eq('mes_referencia', mesRef),
    admin
      .from('profiles')
      .select('nome')
      .eq('id', caller.user.id)
      .single(),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const userName = (profile?.nome as string | null) ?? 'Usuário'
  const confirmMap = new Map((confirmacoes ?? []).map(c => [c.lembrete_id, c]))

  const enriched = (lembretes ?? []).map(r => ({
    ...r,
    confirmado: confirmMap.has(r.id),
    confirmado_em: confirmMap.get(r.id)?.confirmado_em ?? null,
    confirmado_por_nome: confirmMap.has(r.id) ? userName : null,
  }))

  return Response.json(enriched)
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
