import { getAuthUser, getActiveProfileIds } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'

/** Lista simples de nomes — usada para detectar primeiro-nome repetido e decidir se o
 *  texto copiado precisa do sobrenome de quem copiou (ver observacoes-copy-config). */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data, error }, ativos] = await Promise.all([
    admin.from('profiles').select('id, nome').order('nome'),
    getActiveProfileIds(admin),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json((data ?? []).filter((p: { id: string; nome: string | null }) => p.nome && ativos.has(p.id)))
}
