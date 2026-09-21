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
      .from('revisao_nr_registros')
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    all = all.concat(data ?? [])
    if (!data || data.length < PAGE) break
  }

  return Response.json(all)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { nome, empresa, aso, epi_capacete, epi_cinto } = await req.json()
  if (!nome?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('revisao_nr_registros')
    .insert({ nome: nome.trim(), empresa: empresa?.trim() ?? '', aso: !!aso, epi_capacete: !!epi_capacete, epi_cinto: !!epi_cinto, created_by: user.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
