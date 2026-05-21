import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

async function getCallerRole(): Promise<string | null> {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  return (data?.papel as string) ?? null
}

export async function GET() {
  const role = await getCallerRole()
  if (role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('notificacoes_config').select('*')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function PUT(request: NextRequest) {
  const role = await getCallerRole()
  if (role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { modulo: string; perfis_notificados: string[]; ativo: boolean }
  const { modulo, perfis_notificados, ativo } = body

  if (!modulo) return Response.json({ error: 'modulo obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('notificacoes_config').upsert(
    { modulo, perfis_notificados, ativo, updated_at: new Date().toISOString() },
    { onConflict: 'modulo' }
  )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
