import { getAuthUser } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const [{ data: { users: authUsers }, error }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('id, nome, usuario, papel'),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const profileMap = new Map(
    (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p])
  )

  const ativos = authUsers
    .filter(u => {
      const bannedUntil = (u as unknown as { banned_until?: string }).banned_until
      const banned = bannedUntil ? new Date(bannedUntil) > new Date() : false
      return !banned && profileMap.has(u.id)
    })
    .map(u => {
      const p = profileMap.get(u.id) as Record<string, unknown>
      return {
        id: u.id,
        nome: (p.nome as string | null) ?? null,
        usuario: (p.usuario as string | null) ?? null,
        papel: (p.papel as string | null) ?? null,
      }
    })
    .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))

  return Response.json(ativos)
}
