import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'
import { normalizaItens } from '../itens'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const nome = String(body.nome ?? '').trim()
  if (!nome) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: ultimo } = await admin
    .from('rnr_treinamentos')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('rnr_treinamentos')
    .insert({
      nome,
      descricao: String(body.descricao ?? '').trim(),
      itens: normalizaItens(body.itens),
      ordem: ((ultimo as { ordem?: number } | null)?.ordem ?? 0) + 1,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
