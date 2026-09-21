import { createAdminClient } from '../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../lib/api-helpers'
import { currentMonthOccurrence } from '../../../lib/lembretes'

// Lembretes de outros colaboradores com ocorrência hoje — usado pela aba "Equipe"
// no widget de Lembretes do dashboard (só gestor/admin). Gestor só vê colaborador/trainee;
// admin vê todo mundo. Cada lembrete é tratado como pertencendo a quem o criou.
export async function GET() {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const now = new Date()
  const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [{ data: profiles }, { data: lembretes }, { data: historico }] = await Promise.all([
    admin.from('profiles').select('id, nome, papel'),
    admin.from('lembretes').select('id, titulo, periodo, data_inicio, hora_inicio, dia_semana, semana_ordinal, concluido, criado_por'),
    admin.from('lembretes_historico').select('lembrete_id, usuario_id').eq('mes_referencia', mesRef),
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.id as string, p as { id: string; nome: string; papel: string }]))
  const confirmedSet = new Set((historico ?? []).map(h => `${h.lembrete_id}|${h.usuario_id}`))
  const allowedPapeis = caller.role === 'admin' ? null : ['colaborador', 'trainee']

  const items = (lembretes ?? [])
    .filter(r => r.criado_por !== caller.user.id)
    .filter(r => {
      const p = profileMap.get(r.criado_por)
      if (!p) return false
      if (allowedPapeis && !allowedPapeis.includes(p.papel ?? '')) return false
      return true
    })
    .filter(r => {
      if (confirmedSet.has(`${r.id}|${r.criado_por}`)) return false
      if (r.concluido && r.periodo === 'unico') return false
      const occ = currentMonthOccurrence(r, now)
      if (!occ) return false
      return occ.getTime() === today.getTime()
    })
    .map(r => ({
      id: r.id as string,
      titulo: r.titulo as string,
      horaInicio: (r.hora_inicio as string | null) ?? null,
      colaboradorId: r.criado_por as string,
      colaboradorNome: profileMap.get(r.criado_por)?.nome ?? '',
    }))
    .sort((a, b) => a.colaboradorNome.localeCompare(b.colaboradorNome) || (a.horaInicio ?? '').localeCompare(b.horaInicio ?? ''))

  return Response.json(items)
}
