import { createAdminClient } from '../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../lib/api-helpers'
import { currentMonthOccurrence } from '../../../lib/lembretes'

// IDs dos colaboradores (que não o próprio caller) com pelo menos um lembrete
// próprio ainda pendente neste mês — usado pra destacar, na lista de "Lembretes
// demais colaboradores", quem tem lembrete ativo. Mesma regra de visibilidade
// de papel do /equipe-hoje (gestor só vê colaborador/trainee; admin vê todo mundo).
export async function GET() {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const now = new Date()
  const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: profiles }, { data: lembretes }, { data: historico }] = await Promise.all([
    admin.from('profiles').select('id, papel'),
    admin.from('lembretes').select('id, periodo, data_inicio, hora_inicio, concluido, criado_por'),
    admin.from('lembretes_historico').select('lembrete_id, usuario_id').eq('mes_referencia', mesRef),
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.id as string, p as { id: string; papel: string }]))
  const confirmedSet = new Set((historico ?? []).map(h => `${h.lembrete_id}|${h.usuario_id}`))
  const allowedPapeis = caller.role === 'admin' ? null : ['colaborador', 'trainee']

  const ativos = new Set<string>()
  for (const r of lembretes ?? []) {
    if (!r.criado_por || r.criado_por === caller.user.id) continue
    const p = profileMap.get(r.criado_por)
    if (!p) continue
    if (allowedPapeis && !allowedPapeis.includes(p.papel ?? '')) continue
    if (confirmedSet.has(`${r.id}|${r.criado_por}`)) continue
    if (r.concluido && r.periodo === 'unico') continue
    const occ = currentMonthOccurrence(r, now)
    if (!occ) continue
    ativos.add(r.criado_por)
  }

  return Response.json([...ativos])
}
