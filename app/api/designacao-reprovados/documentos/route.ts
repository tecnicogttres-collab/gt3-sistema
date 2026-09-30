import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('desig_documentos')
    .select('id, setor_id, pasta_id, nome, ativo, created_at')
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { setor_id, nome, pasta_id } = await req.json()
  if (!setor_id) return Response.json({ error: 'Setor obrigatório' }, { status: 400 })
  if (!nome?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('desig_documentos')
    .insert({ setor_id, nome: nome.trim(), pasta_id: pasta_id || null })
    .select('id, setor_id, pasta_id, nome, ativo, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
