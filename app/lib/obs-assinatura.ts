// Modelo de texto das observações ("{{data}} {{hora}} - {{observacao}} - {{nome}}") — o mesmo
// do módulo de Observações, reaproveitado onde outro módulo precisa gerar observação pronta
// pra colar no Portal (ex.: reprovação do Workflow Programas).

export const TEMPLATE_COPIA_PADRAO = '{{data}} {{hora}} - {{observacao}} - {{nome}}'
export const NOME_COMPLETO_KEY = 'gt3-obs-nome-completo'

function dataHoje(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function horaAgora(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Primeiro nome, ou "Primeiro Último" quando o primeiro nome é de mais de uma pessoa. */
export function nomeParaAssinatura(nomeCompleto: string, todosNomes: string[]): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean)
  const primeiro = partes[0] ?? nomeCompleto.trim()
  if (partes.length < 2) return primeiro
  const repetido = todosNomes.filter(n => (n.trim().split(/\s+/)[0] ?? '').toLowerCase() === primeiro.toLowerCase()).length > 1
  return repetido ? `${primeiro} ${partes[partes.length - 1]}` : primeiro
}

/** Preferência por navegador do módulo de Observações: assinar com o nome completo. */
export function lerNomeCompleto(): boolean {
  try { return localStorage.getItem(NOME_COMPLETO_KEY) === '1' } catch { return false }
}

export function aplicarTemplateObs(template: string, observacao: string, nome: string): string {
  return (template || TEMPLATE_COPIA_PADRAO)
    .replace(/\{\{data\}\}/g, dataHoje())
    .replace(/\{\{hora\}\}/g, horaAgora())
    .replace(/\{\{observacao\}\}/g, () => observacao)
    .replace(/\{\{nome\}\}/g, () => nome)
}
