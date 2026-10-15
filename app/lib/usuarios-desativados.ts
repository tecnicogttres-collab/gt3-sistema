import type { createAdminClient } from './supabase-admin'

// IDs de logins desativados (banidos no Supabase Auth) — regra geral para tirar contas
// desativadas de QUALQUER lista de seleção de usuário (responsável, colaborador, "quem não
// leu" etc.). Guarda os DESATIVADOS, não os ativos: assim um login recém-criado aparece nas
// listas na hora, e só a desativação/reativação leva até 2 min para refletir.
//
// Cache em memória por instância da função (2 min). Chamadas simultâneas com o cache vencido
// compartilham a mesma consulta. Falha do Auth não vai para o cache e devolve conjunto vazio
// (lista completa) — a próxima chamada tenta de novo.
//
// Não usar em telas de administração de contas (ex.: /api/admin/users), que precisam ver o
// estado real na hora para poder desativar e reativar.

const VALIDADE_MS = 2 * 60_000

let cache: { ids: Set<string>; expiraEm: number } | null = null
let emAndamento: Promise<Set<string>> | null = null

export async function getUsuariosDesativados(admin: ReturnType<typeof createAdminClient>): Promise<Set<string>> {
  if (cache && Date.now() < cache.expiraEm) return cache.ids
  if (!emAndamento) {
    emAndamento = (async () => {
      try {
        const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
        if (error || !data) return new Set<string>()
        const agora = new Date()
        const ids = new Set(
          data.users
            .filter(u => {
              const bannedUntil = (u as unknown as { banned_until?: string }).banned_until
              return !!bannedUntil && new Date(bannedUntil) > agora
            })
            .map(u => u.id)
        )
        cache = { ids, expiraEm: Date.now() + VALIDADE_MS }
        return ids
      } catch {
        return new Set<string>()
      } finally {
        emAndamento = null
      }
    })()
  }
  return emAndamento
}
