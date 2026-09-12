import { getAuthUser } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'

/** Lista simples de nomes — usada para detectar primeiro-nome repetido e decidir se o
 *  texto copiado precisa do sobrenome de quem copiou (ver observacoes-copy-config). */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('id, nome').order('nome')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json((data ?? []).filter((p: { nome: string | null }) => p.nome))
}
