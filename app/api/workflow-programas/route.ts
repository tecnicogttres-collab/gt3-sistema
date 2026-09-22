import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const PAGE = 1000
  let all: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('workflow_programas_analises')
      .select('id, empresa, cnpj, finalizada, data_final, criado_por, criado_por_nome, created_at, updated_at, dados')
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    all = all.concat(data ?? [])
    if (!data || data.length < PAGE) break
  }

  return Response.json(all.map(r => ({ ...r, minha: r.criado_por === user.id })))
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { empresa, cnpj, dados } = await req.json()

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('nome').eq('id', user.id).single()
  const nomeUser = (prof as { nome?: string } | null)?.nome ?? null

  const { data, error } = await admin
    .from('workflow_programas_analises')
    .insert({
      empresa: empresa ?? '',
      cnpj: cnpj ?? '',
      criado_por: user.id,
      criado_por_nome: nomeUser,
      dados: dados ?? {},
    })
    .select('id, empresa, cnpj, finalizada, data_final, criado_por, criado_por_nome, created_at, updated_at, dados')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ...data, minha: true }, { status: 201 })
}
