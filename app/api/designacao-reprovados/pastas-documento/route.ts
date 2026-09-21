import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller, requireGestorAdmin } from '../../../lib/api-helpers'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('desig_pastas_documento')
    .select('id, setor_id, nome, ordem, created_at')
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { setor_id, nome } = await req.json()
  if (!setor_id) return Response.json({ error: 'Setor obrigatório' }, { status: 400 })
  if (!nome?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  const { count } = await admin
    .from('desig_pastas_documento')
    .select('id', { count: 'exact', head: true })
    .eq('setor_id', setor_id)

  const { data, error } = await admin
    .from('desig_pastas_documento')
    .insert({ setor_id, nome: nome.trim(), ordem: count ?? 0 })
    .select('id, setor_id, nome, ordem, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
