import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller } from '../../lib/api-helpers'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('banco_empresas_cic')
    .select('nome')
    .order('nome', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json((data ?? []).map(r => r.nome))
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const nomes: string[] = Array.isArray(body) ? body : [body.nome]
  const rows = nomes.map(n => n.trim()).filter(Boolean).map(nome => ({ nome }))
  if (!rows.length) return Response.json({ ok: true })

  const admin = createAdminClient()
  const { error } = await admin
    .from('banco_empresas_cic')
    .upsert(rows, { onConflict: 'nome', ignoreDuplicates: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
