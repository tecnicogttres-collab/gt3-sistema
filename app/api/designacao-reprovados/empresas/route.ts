import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller, requireGestorAdmin } from '../../../lib/api-helpers'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // O PostgREST corta em 1000 linhas por página por padrão — com 1700+ empresas
  // cadastradas, um único select() truncava a lista (ficava faltando N em diante).
  // Pagina com .range() até esgotar.
  const PAGE = 1000
  const all: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('desig_empresas')
      .select('id, nome, contratante, email, created_at')
      .order('nome', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }

  return Response.json(all)
}

export async function POST(req: NextRequest) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { nome, contratante, email } = await req.json()
  if (!nome?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('desig_empresas')
    .insert({ nome: nome.trim(), contratante: contratante?.trim() || '', email: email?.trim() || '' })
    .select('id, nome, contratante, email, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
