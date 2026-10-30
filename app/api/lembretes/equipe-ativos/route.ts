import { createAdminClient } from '../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../lib/api-helpers'
import { dataConfirmada, fimDoMes, ocorrenciaVigente } from '../../../lib/lembretes'
import { carregarConfirmacoes } from '../../../lib/lembretes-server'

// IDs dos colaboradores (que não o próprio caller) com pelo menos um lembrete
// próprio ainda pendente neste mês — usado pra destacar, na lista de "Lembretes
// demais colaboradores", quem tem lembrete ativo. Mesma regra de visibilidade
// de papel do /equipe-hoje (gestor só vê colaborador/trainee; admin vê todo mundo).
export async function GET() {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const now = new Date()
  const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [{ data: profiles }, { data: lembretes }] = await Promise.all([
    admin.from('profiles').select('id, papel'),
    admin.from('lembretes').select('id, periodo, data_inicio, hora_inicio, dia_semana, semana_ordinal, concluido, criado_por'),
  ])

  const confirmacoes = await carregarConfirmacoes(admin, lembretes ?? [], hoje)
  const profileMap = new Map((profiles ?? []).map(p => [p.id as string, p as { id: string; papel: string }]))
  const allowedPapeis = caller.role === 'admin' ? null : ['colaborador', 'trainee']

  const ativos = new Set<string>()
  for (const r of lembretes ?? []) {
    if (!r.criado_por || r.criado_por === caller.user.id) continue
    const p = profileMap.get(r.criado_por)
    if (!p) continue
    if (allowedPapeis && !allowedPapeis.includes(p.papel ?? '')) continue
    if (r.concluido && r.periodo === 'unico') continue
    const doDono = confirmacoes.filter(c => c.lembrete_id === r.id && c.usuario_id === r.criado_por)
    const confirmadas = new Set(doDono.map(c => dataConfirmada(r, c)).filter((d): d is string => !!d))
    const vigente = ocorrenciaVigente(r, confirmadas, now)
    if (vigente && vigente.data <= fimDoMes(now)) ativos.add(r.criado_por)
  }

  return Response.json([...ativos])
}
