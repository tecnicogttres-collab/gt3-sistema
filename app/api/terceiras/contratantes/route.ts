import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

async function getCaller() {
  const server = await createClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('nome, papel').eq('id', user.id).single()
  const rawPapel = (profile?.papel as string | null) ?? 'colaborador'
  return { user, nome: (profile?.nome as string | null) ?? 'Usuário', papel: rawPapel === 'trainee' ? 'colaborador' : rawPapel }
}

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('terceiras_contratantes')
    .select('id, nome, requer_cc')
    .order('nome')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['admin', 'gestor'].includes(caller.papel)) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { nome, requer_cc } = await req.json()
  if (!nome?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('terceiras_contratantes')
    .insert({ nome: String(nome).trim().toUpperCase(), requer_cc: !!requer_cc })
    .select('id, nome, requer_cc')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
