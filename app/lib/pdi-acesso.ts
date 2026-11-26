import { createAdminClient } from './supabase-admin'
import { getCallerWithNome } from './api-helpers'

/** Quem está chamando e o que pode fazer num PDI.
 *  Gestão (gestor/admin) vê e edita tudo; o colaborador só vê o próprio PDI
 *  (e, no Diário, só as anotações marcadas como visíveis). */
export async function getPdiAcesso(pdiId: string) {
  const caller = await getCallerWithNome()
  if (!caller) return null
  const gestao = caller.role === 'gestor' || caller.role === 'admin'
  let podeVer = gestao
  if (!gestao) {
    const admin = createAdminClient()
    const { data } = await admin.from('profiles').select('pdi_slug').eq('id', caller.user.id).maybeSingle()
    podeVer = data?.pdi_slug === pdiId
  }
  return { userId: caller.user.id, nome: caller.nome, gestao, podeVer }
}

/** Registra um evento no histórico do PDI (falha silenciosa: o histórico nunca bloqueia a ação). */
export async function logPdi(
  admin: ReturnType<typeof createAdminClient>,
  e: { pdiId: string; acaoId?: string | null; evento: string; detalhe?: string; userId: string; nome: string },
) {
  await admin.from('pdi_historico').insert({
    pdi_id: e.pdiId,
    acao_id: e.acaoId ?? null,
    evento: e.evento,
    detalhe: e.detalhe ?? '',
    usuario_id: e.userId,
    usuario_nome: e.nome,
  })
}

/** Interruptor geral das notificações do PDI para o colaborador (sino / "PDI atualizado").
 *  Desligado a pedido da gestão (26/11/2026): nada do PDI gera notificação por enquanto.
 *  Para religar, troque para true. */
export const PDI_NOTIFICACOES_LIGADAS = false

/** Cria a notificação do PDI para o colaborador, se o interruptor estiver ligado. */
export async function notificarPdi(
  admin: ReturnType<typeof createAdminClient>,
  n: { pdiId: string; colaboradorId: string | null | undefined; tipo?: 'criado' | 'atualizado' },
) {
  if (!PDI_NOTIFICACOES_LIGADAS || !n.colaboradorId) return
  await admin.from('pdi_notificacoes').insert({
    pdi_id: n.pdiId, colaborador_id: n.colaboradorId, visto: false, ...(n.tipo ? { tipo: n.tipo } : {}),
  })
}
