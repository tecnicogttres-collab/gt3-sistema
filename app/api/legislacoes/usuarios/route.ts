import { getAuthUser } from '../../../lib/api-helpers'
import { getUsuariosDesativados } from '../../../lib/usuarios-desativados'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const [{ data: profiles, error }, desativados] = await Promise.all([
    admin.from('profiles').select('id, nome, usuario, papel'),
    getUsuariosDesativados(admin),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const lista = (profiles ?? [])
    .filter((p: { id: string }) => !desativados.has(p.id))
    .map((p: { id: string; nome: string | null; usuario: string | null; papel: string | null }) => ({
      id: p.id, nome: p.nome ?? null, usuario: p.usuario ?? null, papel: p.papel ?? null,
    }))
    .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))

  return Response.json(lista)
}
