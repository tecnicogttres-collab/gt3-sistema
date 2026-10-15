import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'

export async function GET() {
  // getClaims() (via getAuthUser) valida o token localmente — antes, getUser() ia ao Auth do
  // Supabase em toda abertura do sistema. A data de criação da conta, que não vem no token,
  // sai de profiles.created_at (mesma data do login; conferido na Rodada 3).
  const user = await getAuthUser()
  if (!user) return Response.json(null, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, nome, usuario, email, papel, modulos_permitidos, modulos_dashboard, aniversario_dia, aniversario_mes, created_at')
    .eq('id', user.id)
    .single()

  return Response.json(data)
}
