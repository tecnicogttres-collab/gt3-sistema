import { getAuthUser, getActiveProfileIds } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data, error }, ativos] = await Promise.all([
    admin.from('profiles').select('id, nome, usuario, papel').order('nome', { ascending: true }),
    getActiveProfileIds(admin),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json((data ?? []).filter(p => ativos.has(p.id)))
}
