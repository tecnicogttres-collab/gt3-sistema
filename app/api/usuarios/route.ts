import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'
import { getUsuariosDesativados } from '../../lib/usuarios-desativados'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })
  if (profile.papel !== 'gestor' && profile.papel !== 'admin') {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const [{ data, error }, desativados] = await Promise.all([
    admin.from('profiles').select('id, nome').order('nome'),
    getUsuariosDesativados(admin),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json((data ?? []).filter((p: { id: string; nome: string | null }) => p.nome && !desativados.has(p.id)))
}
