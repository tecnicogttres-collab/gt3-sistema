import type { createAdminClient } from './supabase-admin'
import type { ConfirmacaoLembrete, Period } from './lembretes'

export type ConfirmacaoComUsuario = ConfirmacaoLembrete & { usuario_id: string }

const COLUNAS = 'lembrete_id, usuario_id, data_ocorrencia, mes_referencia'

/** Confirmações necessárias para saber a ocorrência vigente de cada lembrete. O diário gera
 *  uma linha por dia e só importa de hoje em diante; os demais precisam do histórico todo,
 *  senão um único confirmado há meses voltaria como vencido. */
export async function carregarConfirmacoes(
  admin: ReturnType<typeof createAdminClient>,
  lembretes: { id: string; periodo: Period }[],
  hoje: string,
): Promise<ConfirmacaoComUsuario[]> {
  const ids = (p: (r: { periodo: Period }) => boolean) => lembretes.filter(p).map(r => r.id)
  const [naoDiarios, diarios] = await Promise.all([
    admin.from('lembretes_historico').select(COLUNAS).in('lembrete_id', ids(r => r.periodo !== 'diario')),
    admin.from('lembretes_historico').select(COLUNAS).in('lembrete_id', ids(r => r.periodo === 'diario')).gte('data_ocorrencia', hoje),
  ])
  const erro = naoDiarios.error ?? diarios.error
  if (erro) throw new Error(erro.message)
  return [...(naoDiarios.data ?? []), ...(diarios.data ?? [])] as ConfirmacaoComUsuario[]
}
