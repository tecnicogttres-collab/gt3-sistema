// Indicativo visual de urgência da Designação de Reprovados — usado no módulo e no
// dashboard para os dois mostrarem a mesma cor. Conta os dias desde a data da designação:
// dia 1 (até dar ciência e no primeiro dia) azul, dia 2 laranja fraco, dia 3 em diante vermelho.

export type UrgenciaDesig = {
  dia: number
  fg: string
  bg: string
  border: string
  label: string
}

const AZUL: Omit<UrgenciaDesig, 'dia' | 'label'>    = { fg: '#2A4F96', bg: '#EFF6FF', border: '#BFDBFE' }
const LARANJA: Omit<UrgenciaDesig, 'dia' | 'label'> = { fg: '#C2761A', bg: '#FFF6E8', border: '#F8D9A6' }
const VERMELHO: Omit<UrgenciaDesig, 'dia' | 'label'> = { fg: '#C53030', bg: '#FEF2F2', border: '#FCA5A5' }

/** dataVerificacao: YYYY-MM-DD. O próprio dia da designação é o dia 1. */
export function urgenciaDesig(dataVerificacao: string, hoje: Date = new Date()): UrgenciaDesig {
  const [y, m, d] = dataVerificacao.split('-').map(Number)
  const inicio = new Date(y, (m || 1) - 1, d || 1)
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const dia = Math.max(1, Math.round((h.getTime() - inicio.getTime()) / 86400000) + 1)
  const cor = dia >= 3 ? VERMELHO : dia === 2 ? LARANJA : AZUL
  return { dia, ...cor, label: dia >= 3 ? `Dia ${dia} — urgente` : `Dia ${dia}` }
}
