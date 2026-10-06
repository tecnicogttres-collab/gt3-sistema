import { createAdminClient } from './supabase-admin'
import { getActiveProfileIds } from './api-helpers'

/** Resolve `destinatarios` ('todos' | papéis | ids de usuário) para os perfis ativos que
 *  recebem a campanha — o autor nunca entra (ele não precisa "ler" o que publicou). */
export async function resolverDestinatarios(
  admin: ReturnType<typeof createAdminClient>,
  destinatarios: string[],
  autorId: string | null,
): Promise<{ id: string; nome: string }[]> {
  const [{ data: profiles }, ativos] = await Promise.all([
    admin.from('profiles').select('id, nome, usuario, papel'),
    getActiveProfileIds(admin),
  ])
  const todos = destinatarios.includes('todos')
  return (profiles ?? [])
    .filter((p: { id: string; papel: string | null }) =>
      ativos.has(p.id) && p.id !== autorId &&
      (todos || destinatarios.includes(p.id) || (!!p.papel && destinatarios.includes(p.papel))))
    .map((p: { id: string; nome: string | null; usuario: string | null }) => ({ id: p.id, nome: p.nome?.trim() || p.usuario?.trim() || '—' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
