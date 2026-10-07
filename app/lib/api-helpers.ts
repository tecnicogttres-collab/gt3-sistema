import { createClient } from './supabase-server'
import { createAdminClient } from './supabase-admin'

export type AuthUser = { id: string; email: string | null }

/** Usuário logado a partir do token da sessão. getClaims() valida a assinatura localmente
 *  (chave ECC do projeto) e só consulta o Auth do Supabase quando o token precisa ser
 *  renovado — antes, getUser() ia ao Auth em toda chamada de /api/*. */
async function getSessionUser(): Promise<AuthUser | null> {
  const serverClient = await createClient()
  const { data, error } = await serverClient.auth.getClaims()
  const sub = data?.claims?.sub
  if (error || !sub) return null
  return { id: sub, email: (data.claims.email as string | undefined) ?? null }
}

export async function getCaller() {
  const user = await getSessionUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).maybeSingle()
  // Sem perfil = login excluído (o perfil cai junto, ON DELETE CASCADE) mas token ainda válido.
  if (!data) return null
  const raw = (data.papel as string) ?? 'colaborador'
  return { user, role: raw === 'trainee' ? 'colaborador' : raw }
}

export async function getCallerWithNome() {
  const user = await getSessionUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel, nome').eq('id', user.id).maybeSingle()
  if (!data) return null
  const raw = (data.papel as string) ?? 'colaborador'
  return { user, role: raw === 'trainee' ? 'colaborador' : raw, nome: (data.nome as string) ?? '' }
}

export async function getAuthUser() {
  return getSessionUser()
}

export async function requireGestorAdmin() {
  const caller = await getCaller()
  if (!caller || !['gestor', 'admin'].includes(caller.role)) return null
  return caller
}

/** IDs de perfis com login ativo (não banido no Supabase Auth) — regra geral para
 *  tirar contas desativadas de QUALQUER lista de seleção de usuário (responsável,
 *  colaborador, notificação etc.), sem precisar mexer módulo a módulo quando alguém
 *  é desativado. Não usar em telas de administração de contas (ex.: /api/admin/users),
 *  que precisam listar todo mundo, ativo ou não, para poder reativar. */
export async function getActiveProfileIds(admin: ReturnType<typeof createAdminClient>): Promise<Set<string>> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const now = new Date()
  return new Set(
    (data?.users ?? [])
      .filter(u => {
        const bannedUntil = (u as unknown as { banned_until?: string }).banned_until
        return !(bannedUntil && new Date(bannedUntil) > now)
      })
      .map(u => u.id)
  )
}
