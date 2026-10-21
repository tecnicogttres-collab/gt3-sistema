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

type PerfilAtivo = { id: string; papel: string }

/** Perfis ativos (login não bloqueado) — carregar uma vez e reaproveitar em alvosDaEnquete. */
export async function carregarPerfisAtivos(admin: ReturnType<typeof createAdminClient>): Promise<PerfilAtivo[]> {
  const [{ data: profiles }, ativos] = await Promise.all([
    admin.from('profiles').select('id, papel'),
    getActiveProfileIds(admin),
  ])
  return (profiles ?? [])
    .filter((p: { id: string }) => ativos.has(p.id))
    .map((p: { id: string; papel: string | null }) => ({ id: p.id, papel: p.papel ?? 'colaborador' }))
}

/** Ids de quem deve responder — o autor nunca entra. */
export function alvosDaEnquete(e: EnqueteAlvo, autorId: string | null, perfis: PerfilAtivo[]): string[] {
  return perfis.filter(p => p.id !== autorId && enqueteParaMim(e, p.id, p.papel)).map(p => p.id)
}

/** Ids dos perfis ativos que devem responder (e ser notificados) — o autor nunca entra. */
export async function resolverAlvosEnquete(
  admin: ReturnType<typeof createAdminClient>,
  e: EnqueteAlvo,
  autorId: string | null,
): Promise<string[]> {
  return alvosDaEnquete(e, autorId, await carregarPerfisAtivos(admin))
}

/** Todos os participantes responderam? (enquete sem nenhum participante nunca conta como completa) */
export function todosResponderam(alvos: string[], respondentes: Set<string>): boolean {
  return alvos.length > 0 && alvos.every(id => respondentes.has(id))
}

/** Depois de um voto: se todos os participantes já responderam, a enquete fica inativa (closed). */
export async function encerrarSeTodosResponderam(
  admin: ReturnType<typeof createAdminClient>,
  enqueteId: string,
  e: EnqueteAlvo & { criado_por: string | null },
) {
  const [alvos, { data: resps }] = await Promise.all([
    resolverAlvosEnquete(admin, e, e.criado_por),
    admin.from('enquete_respostas').select('usuario_id').eq('enquete_id', enqueteId),
  ])
  const respondentes = new Set((resps ?? []).map((r: { usuario_id: string }) => r.usuario_id))
  if (todosResponderam(alvos, respondentes)) {
    await admin.from('enquetes').update({ status: 'closed' }).eq('id', enqueteId).eq('status', 'active')
  }
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
