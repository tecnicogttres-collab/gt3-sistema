import { createClient } from './supabase-server'
import { createAdminClient } from './supabase-admin'

export async function getCaller() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  return { user, role: (data?.papel as string) ?? 'colaborador' }
}

export async function getCallerWithNome() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel, nome').eq('id', user.id).single()
  return { user, role: (data?.papel as string) ?? 'colaborador', nome: (data?.nome as string) ?? '' }
}

export async function getAuthUser() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  return user ?? null
}

export async function requireGestorAdmin() {
  const caller = await getCaller()
  if (!caller || !['gestor', 'admin'].includes(caller.role)) return null
  return caller
}
