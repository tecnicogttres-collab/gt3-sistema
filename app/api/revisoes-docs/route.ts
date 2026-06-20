import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'

type RegRow = { valores: Record<string, string | boolean>; corrigido: boolean }

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('revisoes_docs')
    .select('id, nome, criado_por, criado_por_nome, created_at, dados')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map(r => {
    const registros: RegRow[] = (r.dados?.registros ?? [])
    return {
      id: r.id, nome: r.nome,
      criado_por: r.criado_por, criado_por_nome: r.criado_por_nome,
      created_at: r.created_at, minha: r.criado_por === user.id,
      nRegistros: registros.length,
      nCampos: (r.dados?.campos ?? []).length,
      nPendencias: registros.filter(reg => Object.values(reg.valores ?? {}).some(v => v === true) && !reg.corrigido).length,
    }
  })

  return Response.json(result)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { nome, dados } = await req.json()
  if (!nome?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('nome').eq('id', user.id).single()
  const nomeUser = (prof as { nome?: string } | null)?.nome ?? null

  const dadosInicial = dados ?? { campos: [], registros: [] }
  const { data, error } = await admin
    .from('revisoes_docs')
    .insert({ nome: nome.trim(), criado_por: user.id, criado_por_nome: nomeUser, dados: dadosInicial })
    .select('id, nome, criado_por, criado_por_nome, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({
    ...data, minha: true,
    nRegistros: 0, nCampos: (dadosInicial.campos ?? []).length, nPendencias: 0,
  }, { status: 201 })
}
