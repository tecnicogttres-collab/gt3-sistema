import { createAdminClient } from './supabase-admin'
import { getActiveProfileIds } from './api-helpers'

/** Papéis que respondem cada público-alvo. Gestor/admin só respondem quando escolhidos
 *  ("Gestores" ou nominalmente); nos demais casos eles só acompanham os resultados. */
const PAPEIS_POR_PUBLICO: Record<string, string[]> = {
  todos: ['colaborador', 'trainee'],
  colaboradores: ['colaborador', 'trainee'],
  trainees: ['trainee'],
  gestores: ['gestor', 'admin'],
}

type EnqueteAlvo = { publico_alvo: string | null; destinatarios: string[] | null }

/** A enquete é para este usuário responder? `destinatarios` preenchido = só as pessoas escolhidas. */
export function enqueteParaMim(e: EnqueteAlvo, userId: string, papel: string): boolean {
  if (e.destinatarios?.length) return e.destinatarios.includes(userId)
  return (PAPEIS_POR_PUBLICO[e.publico_alvo ?? 'todos'] ?? PAPEIS_POR_PUBLICO.todos).includes(papel)
}

/** Ids dos perfis ativos que devem responder (e ser notificados) — o autor nunca entra. */
export async function resolverAlvosEnquete(
  admin: ReturnType<typeof createAdminClient>,
  e: EnqueteAlvo,
  autorId: string | null,
): Promise<string[]> {
  const [{ data: profiles }, ativos] = await Promise.all([
    admin.from('profiles').select('id, papel'),
    getActiveProfileIds(admin),
  ])
  return (profiles ?? [])
    .filter((p: { id: string; papel: string | null }) =>
      ativos.has(p.id) && p.id !== autorId && enqueteParaMim(e, p.id, p.papel ?? 'colaborador'))
    .map((p: { id: string }) => p.id)
}

/** Badge na sidebar + pop-up "Nova enquete" (o pop-up lê GET /api/enquetes → para_mim). */
export async function notificarEnquete(
  admin: ReturnType<typeof createAdminClient>,
  e: EnqueteAlvo,
  autorId: string | null,
) {
  try {
    const alvo = await resolverAlvosEnquete(admin, e, autorId)
    if (alvo.length > 0) {
      await admin.from('notificacoes_usuario').insert(alvo.map(usuario_id => ({ usuario_id, modulo: 'enquetes', visto: false })))
    }
  } catch { /* noop */ }
}
