import { NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

async function getCaller() {
  const server = await createClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  const rawPapel = (profile?.papel as string | null) ?? 'colaborador'
  return { user, papel: rawPapel === 'trainee' ? 'colaborador' : rawPapel }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['admin', 'gestor'].includes(caller.papel)) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.requer_cc !== undefined) update.requer_cc = !!body.requer_cc
  if (body.nome !== undefined) update.nome = String(body.nome).trim().toUpperCase()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('terceiras_contratantes')
    .update(update)
    .eq('id', id)
    .select('id, nome, requer_cc')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
