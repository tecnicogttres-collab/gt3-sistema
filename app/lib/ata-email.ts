// Helpers de resolução de destinatários e template do "Gerar e-mail" das Atas
// Contratantes — puro (sem DOM, sem pdfmake), pode ser usado em rota de API ou,
// se um dia precisar, em componente cliente.

import type { Participante } from '../atas/AtasEditor'
import { type AtaHtmlData, nomeArquivoAta } from './ata-html'

export function normalizaNome(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Cruza os participantes de uma ata com o diretório nome→e-mail configurado.
 *  Retorna os que têm e-mail cadastrado e a lista (só nomes) dos que não têm. */
export function resolverDestinatarios(
  participantes: Participante[],
  diretorio: { nome: string; email: string; empresa?: string }[],
): { resolvidos: { nome: string; email: string }[]; semEmail: string[] } {
  const porNome = new Map(diretorio.map(d => [normalizaNome(d.nome), d.email]))
  const resolvidos: { nome: string; email: string }[] = []
  const semEmail: string[] = []
  for (const p of participantes) {
    if (!p.nome?.trim()) continue
    const email = porNome.get(normalizaNome(p.nome))
    if (email) resolvidos.push({ nome: p.nome, email })
    else semEmail.push(p.nome)
  }
  return { resolvidos, semEmail }
}

export const DOMINIO_GT3 = '@gttres.com.br'

/** Quem tem e-mail @gttres.com.br é da GT3 — nunca vai como destinatário (Para), sempre
 *  em cópia (Cc), mesmo que tenha sido adicionado como participante da própria contratante
 *  ou digitado manualmente no "Gerar e-mail". Separa a lista resolvida em dois grupos. */
export function separarGt3<T extends { email: string }>(pessoas: T[]): { contratante: T[]; gt3: T[] } {
  const contratante: T[] = []
  const gt3: T[] = []
  for (const p of pessoas) {
    if (p.email.toLowerCase().endsWith(DOMINIO_GT3)) gt3.push(p)
    else contratante.push(p)
  }
  return { contratante, gt3 }
}

/** Junta o(s) e-mail(s) fixos de Cc configurados com os endereços @gttres.com.br já
 *  resolvidos, sem duplicar. */
export function combinarCcGt3(ccConfig: string, resolvidosGt3Emails: string[]): string {
  const base = ccConfig.split(',').map(s => s.trim()).filter(Boolean)
  return Array.from(new Set([...base, ...resolvidosGt3Emails])).join(', ')
}

function fmtDataPtBr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

export function variaveisEmailAta(ata: AtaHtmlData): Record<string, string> {
  return {
    contratante: ata.cliente?.trim() ?? '',
    numero_ata: ata.numero_ata?.trim() ?? '',
    data: ata.data ? fmtDataPtBr(ata.data) : '',
    local: ata.local_reuniao?.trim() ?? '',
    titulo: ata.titulo?.trim() || `Ata de Reunião — ${ata.cliente ?? ''}`,
    nome_arquivo: nomeArquivoAta(ata),
  }
}

export function aplicaVariaveisEmail(template: string, ctx: Record<string, string>): string {
  return (template || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (ctx[k] !== undefined ? ctx[k] : m))
}

function escapeHtml(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Corpo do template é editado como texto puro (like o "construtor" de Observações) —
 *  aqui vira HTML só na hora de montar o e-mail. */
export function corpoParaHtml(corpo: string): string {
  return escapeHtml(corpo).replace(/\n/g, '<br>')
}
