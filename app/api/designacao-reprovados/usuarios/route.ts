import { getCaller } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, nome, papel')
    .order('nome', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
