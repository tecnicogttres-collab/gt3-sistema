import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller } from '../../lib/api-helpers'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const PAGE = 1000
  let all: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('anotacoes_cic')
      .select('id, nome, periodo, dados, created_at, updated_at, atualizado_por_nome')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    all = all.concat(data ?? [])
    if (!data || data.length < PAGE) break
  }

  return Response.json(all)
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { nome, periodo, dados } = body
  if (!nome?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('anotacoes_cic')
    .insert({
      nome: nome.trim(),
      periodo: (periodo ?? '').trim(),
      dados: dados ?? [],
      criado_por: caller.user.id,
    })
    .select('id, nome, periodo, dados, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
