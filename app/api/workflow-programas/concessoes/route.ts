import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

const TABELA = 'workflow_programas_concessoes_psico'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.from(TABELA).select('*').order('data_autorizacao', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const b = await req.json()
  if (!b.empresa?.trim() || !b.contratante_id || !b.data_autorizacao || !b.prazo_original || !b.prazo_concedido) {
    return Response.json({ error: 'Empresa, contratante, data da autorização e prazos são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('nome').eq('id', user.id).single()
  const nomeUser = (prof as { nome?: string } | null)?.nome ?? null

  const { data, error } = await admin
    .from(TABELA)
    .insert({
      empresa: b.empresa.trim(),
      cnpj: b.cnpj ?? '',
      contratante_id: b.contratante_id,
      contratante_nome: b.contratante_nome ?? '',
      autorizado_por: b.autorizado_por ?? '',
      data_autorizacao: b.data_autorizacao,
      prazo_original: b.prazo_original,
      prazo_concedido: b.prazo_concedido,
      obs: b.obs ?? '',
      criado_por: user.id,
      criado_por_nome: nomeUser,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
