import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const ids: string[] = Array.isArray(body.treinamento_ids) ? body.treinamento_ids.map(String) : []
  if (ids.length < 2) return Response.json({ error: 'Selecione ao menos dois treinamentos' }, { status: 400 })

  const nome = String(body.nome ?? '').trim()
  if (!nome) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: ultimo } = await admin
    .from('rnr_combos')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('rnr_combos')
    .insert({ nome, treinamento_ids: ids, ordem: ((ultimo as { ordem?: number } | null)?.ordem ?? 0) + 1 })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
