import { createAdminClient } from './supabase-admin'

type Admin = ReturnType<typeof createAdminClient>

export const ehGestorAdmin = (role: string) => role === 'gestor' || role === 'admin'

/** O perfil pode mexer neste questionário? Restrito (ex.: pesquisa interna) = só gestor e admin.
 *  Devolve false também quando o questionário não existe — as rotas respondem 404 nos dois casos,
 *  para não revelar a quem não tem acesso que o questionário existe. */
export async function podeAcessarQn(admin: Admin, qnId: string, role: string): Promise<boolean> {
  const { data } = await admin.from('questionarios').select('restrito').eq('id', qnId).maybeSingle()
  if (!data) return false
  return !data.restrito || ehGestorAdmin(role)
}

export const naoEncontrado = () => Response.json({ error: 'Questionário não encontrado' }, { status: 404 })
