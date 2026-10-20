import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

/**
 * GET /api/atas-contratantes/notificacoes
 * Atas validadas sobre as quais o usuário logado foi notificado e que ele ainda não leu.
 */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: notifs, error }, { data: leituras }] = await Promise.all([
    admin.from('atas_contratantes_notificacoes')
      .select('ata_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    admin.from('atas_contratantes_leituras').select('ata_id').eq('user_id', user.id),
  ])
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const lidas = new Set((leituras ?? []).map((l: { ata_id: string }) => l.ata_id))
  const ids = (notifs ?? []).map((n: { ata_id: string }) => n.ata_id).filter(id => !lidas.has(id))
  if (!ids.length) return Response.json([])

  const { data: atas } = await admin
    .from('atas_contratantes')
    .select('id, titulo, data, cliente')
    .in('id', ids)
    .eq('status', 'Validada')
  const porId = new Map((atas ?? []).map((a: { id: string }) => [a.id, a]))

  return Response.json(ids.map(id => porId.get(id)).filter(Boolean))
}
