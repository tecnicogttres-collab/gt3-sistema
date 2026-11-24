/** Temas sazonais do sistema (Dashboard, entrada e módulos).
 *  Janelas, todo ano:
 *   - Natal:    07/12 a 27/12
 *   - Ano Novo: 28/12 a 09/01 do ano seguinte */
export type TemaSazonal = 'natal' | 'anonovo'

export function temaPorData(d: Date = new Date()): TemaSazonal | null {
  const mes = d.getMonth() + 1
  const dia = d.getDate()
  if (mes === 12 && dia >= 7 && dia <= 27) return 'natal'
  if ((mes === 12 && dia >= 28) || (mes === 1 && dia <= 9)) return 'anonovo'
  return null
}

/** Ano que está chegando (ou que acabou de chegar) no tema de Ano Novo. */
export function anoNovoAlvo(d: Date = new Date()): number {
  // 2º semestre = o ano que vem (inclui testar o tema fora da data, ex.: em novembro)
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear()
}

/** Chave do localStorage com a escolha manual de tema — só lida em desenvolvimento (localhost). */
export const TEMA_DEV_KEY = 'gt3-tema-dev'
