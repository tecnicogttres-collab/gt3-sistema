// Gera o PDF "de verdade" (bytes reais, anexável em e-mail) de uma ata — usado só no
// servidor (rota de API), nunca em componente 'use client'. Diferente de ata-html.ts
// (que gera HTML pra impressão via navegador), aqui produzimos o binário do PDF direto
// com pdfmake, pra poder anexá-lo num .eml sem depender do diálogo "Salvar como PDF".

import fs from 'fs'
import path from 'path'
import pdfMake from 'pdfmake'
import type { Participante, Topico, TopicoHistorico } from '../atas/AtasEditor'
import { type AtaHtmlData } from './ata-html'

// ─── Fontes (Roboto, já incluídas no pacote pdfmake) ───────────────────────────
// pdfmake exige caminho (string) aqui — "resolveUrls" trata todo fontDescriptor como
// possível URL antes de renderizar, e quebra se receber um Buffer. Os caminhos são
// fixos (não vêm de entrada do usuário), por isso liberar acesso local é seguro.

function fontPath(file: string): string {
  return path.join(process.cwd(), 'node_modules', 'pdfmake', 'build', 'fonts', 'Roboto', file)
}

let fontsReady = false
function ensureFonts() {
  if (fontsReady) return
  if (!fs.existsSync(fontPath('Roboto-Regular.ttf'))) {
    throw new Error('Fontes do pdfmake não encontradas em node_modules/pdfmake/build/fonts/Roboto')
  }
  pdfMake.setFonts({
    Roboto: {
      normal: fontPath('Roboto-Regular.ttf'),
      bold: fontPath('Roboto-Medium.ttf'),
      italics: fontPath('Roboto-Italic.ttf'),
      bolditalics: fontPath('Roboto-MediumItalic.ttf'),
    },
  })
  pdfMake.setLocalAccessPolicy(() => true)
  pdfMake.setUrlAccessPolicy(() => false)
  fontsReady = true
}

// ─── HTML (do RichTextEditor) → conteúdo pdfmake ───────────────────────────────

type Run = { text: string; bold?: boolean; italics?: boolean; decoration?: string[]; color?: string; background?: string }
type Block = { type: 'p'; runs: Run[] } | { type: 'ul'; items: Run[][] }

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
}

function extractStyleValue(style: string, prop: string): string | undefined {
  const m = style.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)', 'i'))
  return m ? m[1].trim() : undefined
}

function cssColorToHex(v: string): string | undefined {
  const s = v.trim()
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (m) return '#' + [1, 2, 3].map(i => Number(m[i]).toString(16).padStart(2, '0')).join('')
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s
  return undefined
}

/** Converte o HTML gerado pelo RichTextEditor (negrito/itálico/sublinhado/tachado,
 *  cor de fonte, grifado, listas, quebras de linha) num conjunto de blocos pdfmake.
 *  Cobre só o subconjunto de tags que o editor realmente produz — não é um parser
 *  de HTML genérico. */
function parseRichHtml(html: string): Block[] {
  if (!html?.trim()) return []
  const blocks: Block[] = []
  const tokens = html.match(/<\/?[a-zA-Z][^>]*>|[^<]+/g) ?? []

  type Style = { bold: boolean; italics: boolean; underline: boolean; strike: boolean; color?: string; background?: string }
  const stack: Style[] = [{ bold: false, italics: false, underline: false, strike: false }]
  let curRuns: Run[] = []
  let listItems: Run[][] | null = null
  let liRuns: Run[] | null = null

  const flushParagraph = () => {
    if (curRuns.length > 0) { blocks.push({ type: 'p', runs: curRuns }); curRuns = [] }
  }
  const pushText = (raw: string) => {
    const text = decodeEntities(raw)
    if (!text) return
    const st = stack[stack.length - 1]
    const decoration: string[] = []
    if (st.underline) decoration.push('underline')
    if (st.strike) decoration.push('lineThrough')
    const run: Run = { text }
    if (st.bold) run.bold = true
    if (st.italics) run.italics = true
    if (decoration.length) run.decoration = decoration
    if (st.color) run.color = st.color
    if (st.background) run.background = st.background
    if (liRuns) liRuns.push(run)
    else curRuns.push(run)
  }

  for (const tok of tokens) {
    if (tok[0] !== '<') { pushText(tok); continue }
    const closing = tok[1] === '/'
    const tagMatch = tok.match(/^<\/?([a-zA-Z0-9]+)/)
    const tag = (tagMatch?.[1] ?? '').toLowerCase()
    if (!closing) {
      const top: Style = { ...stack[stack.length - 1] }
      if (tag === 'b' || tag === 'strong') top.bold = true
      else if (tag === 'i' || tag === 'em') top.italics = true
      else if (tag === 'u') top.underline = true
      else if (tag === 'strike' || tag === 's' || tag === 'del') top.strike = true
      else if (tag === 'span' || tag === 'font') {
        const styleMatch = tok.match(/style="([^"]*)"/i)
        if (styleMatch) {
          const c = extractStyleValue(styleMatch[1], 'color')
          const bg = extractStyleValue(styleMatch[1], 'background-color')
          if (c) { const hex = cssColorToHex(c); if (hex) top.color = hex }
          if (bg && !/transparent/i.test(bg)) { const hex = cssColorToHex(bg); if (hex) top.background = hex }
        }
      }
      stack.push(top)

      if (tag === 'br') { flushParagraph(); stack.pop() }
      else if (tag === 'div' || tag === 'p') { flushParagraph() }
      else if (tag === 'ul') { flushParagraph(); listItems = [] }
      else if (tag === 'li') { liRuns = [] }
    } else {
      if (tag === 'div' || tag === 'p') flushParagraph()
      else if (tag === 'li') { if (listItems && liRuns) listItems.push(liRuns); liRuns = null }
      else if (tag === 'ul') { if (listItems) { blocks.push({ type: 'ul', items: listItems }); listItems = null } }
      if (stack.length > 1) stack.pop()
    }
  }
  flushParagraph()
  return blocks
}

function runsToInline(runs: Run[]) {
  return runs.map(r => ({ text: r.text, bold: r.bold, italics: r.italics, decoration: r.decoration, color: r.color, background: r.background }))
}

// pdfmake tipa `Content` como uma união fechada que não cobre bem layouts de tabela
// customizados (vLineWidth/fillColor por célula) nem stacks montados dinamicamente —
// por isso os nós abaixo usam `PdfNode = any` e o docDefinition final é convertido
// com um cast duplo (via `unknown`) só na borda de saída, perto do createPdf().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfNode = any

function richHtmlToContent(html: string): PdfNode[] {
  return parseRichHtml(html).map(b => (
    b.type === 'ul'
      ? { ul: b.items.map(runsToInline), margin: [0, 2, 0, 4] }
      : { text: runsToInline(b.runs), margin: [0, 0, 0, 4] }
  ))
}

// ─── Layout da ata ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'Pendente': '#92400E', 'Em análise': '#6D28D9', 'Em andamento': '#1D4ED8',
  'Acompanhamento': '#0F766E', 'Concluído': '#065F46', 'Cancelado': '#6B7280',
}

function topicoCard(t: Topico, numero: number, dateDisplay: string): PdfNode {
  const cor = t.cor ?? '#2A4F96'
  const hist: TopicoHistorico[] = t.historico ?? []
  const stack: PdfNode[] = [
    { text: `${numero}. ${t.titulo || '(Sem título)'}`, bold: true, fontSize: 12, color: cor, margin: [0, 0, 0, 6] },
  ]
  if (t.andamentoGeral) {
    stack.push({ text: '📌 ATÉ AQUI', bold: true, fontSize: 8, color: '#475569', margin: [0, 0, 0, 3] })
    stack.push(...richHtmlToContent(t.andamentoGeral))
  }
  if (t.descricao) {
    stack.push({ text: `NA DATA DESTA REUNIÃO (${dateDisplay.toUpperCase()}), DEFINIU-SE`, bold: true, fontSize: 8, color: cor, margin: [0, 4, 0, 3] })
    stack.push(...richHtmlToContent(t.descricao))
  }
  const metaParts: string[] = []
  if (t.contratante) metaParts.push(`Contratante: ${t.contratante}`)
  if (t.prazo) metaParts.push(`Prazo: ${new Date(t.prazo + 'T12:00').toLocaleDateString('pt-BR')}`)
  if (t.responsavel) metaParts.push(`Responsável: ${t.responsavel}`)
  if (t.status) metaParts.push(`Status: ${t.status}`)
  if (metaParts.length) {
    stack.push({ text: metaParts.join('   ·   '), fontSize: 9, color: t.status ? (STATUS_COLORS[t.status] ?? '#6B7A99') : '#6B7A99', margin: [0, 6, 0, 0] })
  }
  if (hist.length > 0) {
    stack.push({ text: `Histórico (${hist.length})`, bold: true, fontSize: 8, color: '#94A3B8', margin: [0, 8, 0, 4] })
    for (const h of hist) {
      stack.push({ text: new Date(h.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), bold: true, fontSize: 8, color: '#94A3B8', margin: [0, 2, 0, 1] })
      stack.push(...richHtmlToContent(h.texto).map(c => ({ ...c, color: '#94A3B8' })))
    }
  }

  return {
    table: { widths: ['*'], body: [[{ stack, fillColor: '#F8FAFC', border: [false, false, false, false] }]] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i: number) => (i === 0 ? 3 : 0),
      vLineColor: () => cor,
      paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 10,
    },
    margin: [0, 0, 0, 10],
  }
}

export async function gerarAtaPdfBuffer(ata: AtaHtmlData, topicos: Topico[], partes: Participante[]): Promise<Buffer> {
  const dateDisplay = ata.data
    ? new Date(ata.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  const titulo = ata.titulo || `Ata de Reunião — ${ata.cliente ?? ''}`

  const ativos = topicos.filter(t => !t.finalizado)
  const finalizados = topicos.filter(t => t.finalizado)

  const content: PdfNode[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: titulo, fontSize: 16, bold: true, color: '#2A4F96' },
            { text: `${dateDisplay}${ata.local_reuniao ? ` — ${ata.local_reuniao}` : ''}`, fontSize: 10, color: '#5a6178', margin: [0, 3, 0, 0] },
          ],
        },
        {
          width: 'auto',
          alignment: 'right',
          stack: [
            ...(ata.numero_ata ? [{
              table: { body: [[{ text: ata.numero_ata, color: '#fff', bold: true, fontSize: 9, alignment: 'center' }]] },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 3, paddingBottom: () => 3, fillColor: () => '#D1AE6E' },
              margin: [0, 0, 0, 4],
            }] : []),
            ...(ata.status ? [{ text: ata.status, fontSize: 9, color: '#5a6178' }] : []),
          ],
        },
      ],
      columnGap: 12,
      margin: [0, 0, 0, 16],
    },
  ]

  if (ata.cliente) {
    content.push({ text: [{ text: 'Contratante: ', color: '#94A3B8' }, { text: ata.cliente, color: '#334155' }], fontSize: 11, margin: [0, 0, 0, 10] })
  }

  if (partes.length > 0) {
    content.push({ text: 'PARTICIPANTES', bold: true, fontSize: 9, color: '#2A4F96', margin: [0, 0, 0, 6] })
    content.push({
      ul: partes.map(p => (p.empresa ? `${p.nome} — ${p.empresa}` : p.nome)),
      fontSize: 10.5, color: '#1a1f2e', margin: [0, 0, 0, 16],
    })
  }

  content.push({ text: 'PONTOS DISCUTIDOS', bold: true, fontSize: 9, color: '#2A4F96', margin: [0, 0, 0, 10] })
  if (ativos.length > 0) {
    ativos.forEach((t, idx) => content.push(topicoCard(t, idx + 1, dateDisplay)))
  } else {
    content.push({ text: 'Nenhum tópico ativo.', color: '#94A3B8', italics: true, margin: [0, 0, 0, 10] })
  }

  if (finalizados.length > 0) {
    content.push({ text: '✓ TÓPICOS FINALIZADOS NESTA REUNIÃO', bold: true, fontSize: 9, color: '#10B981', margin: [0, 14, 0, 10] })
    finalizados.forEach((t, idx) => content.push(topicoCard(t, idx + 1, dateDisplay)))
  }

  ensureFonts()
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#1a1f2e', lineHeight: 1.2 },
    content,
  }
  const doc = pdfMake.createPdf(docDefinition as unknown as Parameters<typeof pdfMake.createPdf>[0])

  return doc.getBuffer()
}
