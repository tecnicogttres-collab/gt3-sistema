// Paleta compartilhada de cores do Calendário de Férias — mesma ordem usada
// tanto para colaboradores com login ativo (ferias_cores_usuarios) quanto para
// colaboradores extras (ferias_pessoas), pra manter todo mundo com uma cor
// estável e sem repetição enquanto a paleta não se esgota.
export const FERIAS_COLOR_POOL = [
  '#2A4F96', '#D1AE6E', '#3B6D11', '#7B1FA2', '#0288D1', '#F06292', '#993556',
  '#00796B', '#185FA5', '#993C1D', '#0F6E56', '#533AB7', '#E65100',
  '#B71C1C', '#880E4F', '#4A148C', '#006064', '#33691E', '#827717',
  '#BF360C', '#4E342E', '#37474F', '#0D47A1',
]

/** Primeira cor da paleta ainda não usada; se a paleta se esgotar, cicla por
 *  índice (repete cores) em vez de travar. */
export function pickNextFeriasColor(usedColors: Set<string>, index: number): string {
  const free = FERIAS_COLOR_POOL.find(c => !usedColors.has(c))
  return free ?? FERIAS_COLOR_POOL[index % FERIAS_COLOR_POOL.length]
}
