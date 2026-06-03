import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lembretes_confirmacoes')
    .select('id, user_id, mes_referencia, confirmado_em')
    .eq('lembrete_id', id)
    .order('confirmado_em', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const userIds = [...new Set(rows.map(r => r.user_id))]
  let nameMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, nome')
      .in('id', userIds)
    nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.nome as string]))
  }

  return Response.json(rows.map(r => ({
    id: r.id,
    usuario_nome: nameMap[r.user_id] ?? 'Usuário',
    mes_referencia: r.mes_referencia,
    created_at: r.confirmado_em,
  })))
}
