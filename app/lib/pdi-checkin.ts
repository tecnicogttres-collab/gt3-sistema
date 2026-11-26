// Situações do "status das ações" (pergunta dos pop-ups do PDI). As respostas
// ficam em pdi_checkins, uma por ação e dia, e aparecem na ação, nos alertas e
// na Linha do tempo.

export const SITUACOES = {
  avancei: { label: 'Avancei', icon: '✅', cor: '#1E9E6A', bg: '#E8F7F0' },
  travei: { label: 'Travei', icon: '⛔', cor: '#D64545', bg: '#FDEEEE' },
  nao_mexi: { label: 'Não mexi', icon: '⏸️', cor: '#64748B', bg: '#EEF2F7' },
} as const
export type Situacao = keyof typeof SITUACOES
