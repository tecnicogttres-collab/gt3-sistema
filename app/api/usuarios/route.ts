import { createAdminClient } from '../../lib/supabase-admin'
import { createClient } from '../../lib/supabase-server'

export async function GET() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })
  if (profile.papel !== 'gestor' && profile.papel !== 'admin') {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id, nome')
    .order('nome')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json((data ?? []).filter((p: { nome: string | null }) => p.nome))
}
