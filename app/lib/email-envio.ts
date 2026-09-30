// Envio de e-mail pelo sistema: baixar .eml e abrir direto no Outlook (mailto).
//
// REGRA DO SISTEMA: todo módulo — atual ou futuro — que gera um .eml ou abre o e-mail no
// Outlook deve usar as funções daqui. Elas anexam sozinhas, ao fim do corpo, a assinatura
// do usuário logado (Usuários → campo "Assinatura de e-mail"). Não montar .eml/mailto na mão.
// (No servidor, use getAssinaturaEmail de app/lib/email-assinatura.ts.)

/** "A; B" → "A, B" — mailto: e o cabeçalho To:/Cc: do .eml exigem vírgula. */
export function emailsParaEnvio(destino: string): string {
  return (destino ?? '').split(/[;,]/).map(e => e.trim()).filter(Boolean).join(', ')
}

/** HTML → texto puro preservando quebras de linha e tópicos (mailto: só aceita texto). */
export function htmlParaTexto(html: string): string {
  const comQuebras = (html ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n- ')
    .replace(/<\s*\/\s*(div|p|ul|ol|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<\s*(style|script)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  let texto: string
  if (typeof document === 'undefined') texto = comQuebras.replace(/<[^>]+>/g, '')
  else {
    const div = document.createElement('div')
    div.innerHTML = comQuebras
    texto = div.textContent ?? ''
  }
  return texto.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/** Assinatura (HTML) do usuário logado; '' se não tiver ou se a consulta falhar. */
export async function buscarAssinatura(): Promise<string> {
  try {
    const res = await fetch('/api/me/assinatura', { cache: 'no-store' })
    if (!res.ok) return ''
    const { assinatura } = await res.json() as { assinatura?: string }
    return (assinatura ?? '').trim()
  } catch {
    return ''
  }
}

/** Corpo do e-mail com a assinatura ao final. */
export function corpoComAssinatura(corpoHtml: string, assinaturaHtml: string): string {
  if (!assinaturaHtml) return corpoHtml
  return `${corpoHtml}<br><br><div class="assinatura">${assinaturaHtml}</div>`
}

export type OpcoesEmail = {
  to?: string
  cc?: string
  assunto: string
  /** Corpo em HTML, SEM a assinatura (ela é anexada aqui). */
  corpoHtml: string
}

/** Baixa um .eml (rascunho X-Unsent) já com Para, Cc, assunto, corpo e assinatura do usuário. */
export async function baixarEml(opts: OpcoesEmail & { nomeArquivo: string }): Promise<void> {
  const assinatura = await buscarAssinatura()
  const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
  const html = `<html><head><meta charset="utf-8"></head><body>${corpoComAssinatura(opts.corpoHtml, assinatura)}</body></html>`
  const linhas: string[] = []
  if (opts.to?.trim()) linhas.push('To: ' + emailsParaEnvio(opts.to))
  if (opts.cc?.trim()) linhas.push('Cc: ' + emailsParaEnvio(opts.cc))
  linhas.push('Subject: =?UTF-8?B?' + b64(opts.assunto) + '?=', 'X-Unsent: 1', 'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', html)
  const url = URL.createObjectURL(new Blob([linhas.join('\r\n')], { type: 'message/rfc822' }))
  const el = document.createElement('a')
  el.href = url
  el.download = opts.nomeArquivo.replace(/[\\/:*?"<>|]/g, '') + '.eml'
  el.click()
  URL.revokeObjectURL(url)
}

/** Abre o e-mail direto no cliente padrão (Outlook) com Para, Cc, assunto e corpo. O mailto:
 *  só carrega texto puro — a assinatura entra como texto (sem imagens/formatação); para
 *  manter a assinatura formatada, use o .eml. */
export async function abrirNoOutlook(opts: OpcoesEmail): Promise<void> {
  const assinatura = await buscarAssinatura()
  const corpo = htmlParaTexto(opts.corpoHtml) + (assinatura ? '\n\n' + htmlParaTexto(assinatura) : '')
  const params = [
    opts.cc?.trim() ? 'cc=' + encodeURIComponent(emailsParaEnvio(opts.cc)) : '',
    'subject=' + encodeURIComponent(opts.assunto),
    'body=' + encodeURIComponent(corpo),
  ].filter(Boolean).join('&')
  window.location.assign('mailto:' + emailsParaEnvio(opts.to ?? '') + '?' + params)
}
