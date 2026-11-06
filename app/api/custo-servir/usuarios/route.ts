import { getAuthUser } from '../../../lib/api-helpers'
import { getUsuariosDesativados } from '../../../lib/usuarios-desativados'
import { createAdminClient } from '../../../lib/supabase-admin'

// Avaliadores do Custo de Servir = usuarios do sistema. Devolve tambem os desativados
// (marcados), para que o nome continue aparecendo nas medicoes antigas.
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
    .map((p: { id: string; nome: string | null; usuario: string | null; papel: string | null }) => ({
      id: p.id, nome: p.nome ?? null, usuario: p.usuario ?? null, papel: p.papel ?? null, desativado: desativados.has(p.id),
    }))
    .sort((a, b) => (a.nome ?? a.usuario ?? '').localeCompare(b.nome ?? b.usuario ?? '', 'pt-BR'))

  return Response.json(lista)
}
