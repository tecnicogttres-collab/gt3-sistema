// Saídas do cronograma: print (PNG), Excel e PDF. Portado do HTML de referência.
// Excel usa o exceljs do projeto; print e PDF carregam html2canvas/jsPDF por CDN sob demanda
// (mesma abordagem do Comparador de Comprovantes com o pdf.js).

import type { Borders, Fill } from 'exceljs'
import { type Cronograma, type Model, type Vis, D, DAY, days, fmt, fmtDT } from './model'
import { CSS as STYLES } from './styles'

const CDN = {
  html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
}

const scriptCache = new Map<string, Promise<void>>()
function loadScript(url: string): Promise<void> {
  let p = scriptCache.get(url)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = url
      s.onload = () => resolve()
      s.onerror = () => { scriptCache.delete(url); reject(new Error('Falha ao carregar ' + url)) }
      document.head.appendChild(s)
    })
    scriptCache.set(url, p)
  }
  return p
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '')
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
}

export const respName = (c: Cronograma, r: string) => r === 'C' ? c.cliente.toUpperCase() : 'GT3'

export const XCOL: Record<Vis, string> = { concluido: 'C6EFCE', andamento: 'D6E2F5', aguardando: 'FBE5B6', pendente: 'E7EBF1', bloqueado: 'EEEEEE' }
const XTXT: Record<Vis, string> = { concluido: '1E6B40', andamento: '2A4F96', aguardando: '7A5410', pendente: '4A5568', bloqueado: '6B778C' }
const SCOL: Record<Vis, [string, string, string]> = {
  concluido: ['#E3F4EA', '#2E8B57', '#2E8B57'],
  andamento: ['#E4ECFA', '#2A4F96', '#2A4F96'],
  aguardando: ['#FBF0D9', '#A87617', '#D1AE6E'],
  pendente: ['#EEF1F5', '#6B778C', '#B4BDCC'],
  bloqueado: ['#F4F5F8', '#8C98AD', '#CDD3DE'],
}

const inMonth = (m: Model, it: Parameters<Model['span']>[0], mo: { a: Date; b: Date }) => {
  const [a, b] = m.span(it)
  return !!a && !!b && D(a) <= mo.b && D(b) >= mo.a
}

/** "2/5" — itens concluídos entre os itens finais de uma etapa/subetapa. */
const progresso = (m: Model, it: Parameters<Model['span']>[0]) => {
  const l = m.desc(it.id).filter(x => !m.isGrp(x))
  return `${l.filter(x => m.status(x) === 'concluido').length}/${l.length}`
}

// ─── Print do cronograma ─────────────────────────────────────────────────────

export function reportHtml(m: Model, c: Cronograma, user: string, today: Date): string {
  const st = m.stats(), months = m.projMonths()
  if (!months.length) return ''
  const rs = months[0].a, re = months[months.length - 1].b, tot = (re.getTime() - rs.getTime()) / DAY + 1
  const pos = (d: Date) => ((d.getTime() - rs.getTime()) / DAY) / tot * 100
  const mLines = months.slice(1).map(mo => `<i class="ml" style="left:${pos(mo.a)}%"></i>`).join('')
  const tIn = today >= rs && today <= re, tLine = tIn ? `<i class="td" style="left:${pos(today)}%"></i>` : ''
  const now = new Date()
  const rows = m.flatAll().map(it => {
    const g = m.isGrp(it), [a, b] = m.span(it), v = m.vis(it), lt = m.late(it), col = SCOL[v]
    let br = ''
    if (a && b) {
      const l = pos(D(a)), w = Math.max((days(a, b) + 1) / tot * 100, .5)
      br = g ? `<span class="br gp" style="left:${l}%;width:${w}%"><i style="width:${m.leafPct(it) * 100}%"></i></span>`
        : `<span class="br ${lt ? 'lt' : ''}" style="left:${l}%;width:${w}%;background:${col[2]}"></span>`
    }
    const dp = m.depth(it)
    const desc = g
      ? `<div class="gt">${esc(dp === 0 ? it.t.toUpperCase() : it.t)}</div><div class="cnt">${progresso(m, it)} itens concluídos</div>`
      : `${dp > 0 ? '<span class="tw">└</span>' : ''}${esc(it.t)}`
    return `<tr class="${g ? `g d${Math.min(dp, 2)}` : 'l'}"><td class="id" style="padding-left:${8 + dp * 8}px">${esc(it.id)}</td>
      <td style="padding-left:${10 + dp * 22}px">${desc}</td>
      <td>${(it.resp || []).map(r => esc(respName(c, r))).join(' / ')}</td>
      <td class="dt">${fmt(a)}</td><td class="dt">${fmt(b)}</td>
      <td><div class="gc">${mLines}${tLine}${br}</div></td>
      <td><span class="pill" style="background:${col[0]};color:${col[1]}">${m.visLabel(it)}</span>${lt ? '<span class="late">atrasado</span>' : ''}</td>
      <td class="ob">${esc(it.obs || '')}</td></tr>`
  }).join('')
  const cnt: [string, number, string][] = [['Concluídos', st.c.concluido, '#2E8B57'], ['Em andamento', st.c.andamento, '#2A4F96'], ['Aguardando cliente', st.c.aguardando, '#D1AE6E'], ['Pendentes', st.c.pendente, '#B4BDCC'], ['Bloqueados', st.blk, '#8C98AD'], ['Atrasados', st.late, '#C0392B']]
  return `<div class="rep">
    <div class="rep-h"><div class="t"><h1>Cronograma – ${esc(c.projeto)}</h1><div class="sub">${esc(c.cliente.toUpperCase())} · GT3 Consultoria</div></div>
      <div class="pct"><b>${Math.round(st.pct * 100)}%</b><span>andamento geral</span></div></div>
    <div class="rep-s">${cnt.map(([l, n, col]) => `<span class="c"><i style="background:${col}"></i><b>${n}</b> ${l}</span>`).join('')}<span class="sp"></span>
      <span>Início <b>${fmt(st.ini)}</b></span><span>Término previsto <b>${fmt(st.fim)}</b></span>${st.next ? `<span>Próximo prazo <b>${fmt(st.next.fim)}</b> · item ${esc(st.next.id)}</span>` : ''}</div>
    <table><colgroup><col style="width:56px"><col style="width:290px"><col style="width:130px"><col style="width:72px"><col style="width:72px"><col><col style="width:150px"><col style="width:240px"></colgroup>
      <thead><tr><th>Item</th><th>Descrição</th><th>Resp.</th><th>Início</th><th>Prazo</th>
        <th><div class="gh">${months.map(mo => `<span style="left:${pos(mo.a)}%">${mo.lab}</span>`).join('')}</div></th>
        <th>Status</th><th>Observação</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <div class="rep-f"><div class="lg"><span><i style="background:#2E8B57"></i>Concluído</span><span><i style="background:#2A4F96"></i>Em andamento</span><span><i style="background:#D1AE6E"></i>Aguardando cliente</span><span><i style="background:#B4BDCC"></i>Pendente</span><span><i style="background:#CDD3DE"></i>Bloqueado</span><span><i style="background:#fff;border:1.5px solid #C0392B"></i>Atrasado</span><span><i style="background:#D1AE6E;width:2px"></i>Hoje</span></div>
      <span>Emitido em ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por ${esc(user)}</span></div>
  </div>`
}

type Html2Canvas = (el: HTMLElement, o: Record<string, unknown>) => Promise<HTMLCanvasElement>

/**
 * Gera o PNG do cronograma completo, baixa e tenta copiar para a área de transferência.
 * O relatório é desenhado num iframe com documento próprio, longe do CSS global do sistema.
 * Além disso, o html2canvas mede a linha de base do texto com uma <img> inline na página principal;
 * o reset do Tailwind (img { display:block }) estraga essa medida e todo texto sai deslocado para
 * baixo, fora das caixas e "pílulas". Por isso a regra é neutralizada só durante a captura.
 */
export async function snapshot(html: string, c: Cronograma): Promise<'copiado' | 'baixado'> {
  await loadScript(CDN.html2canvas)
  const h2c = (window as unknown as { html2canvas?: Html2Canvas }).html2canvas
  if (!h2c) throw new Error('html2canvas indisponível')
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1600px;height:900px;border:0'
  document.body.appendChild(iframe)
  const fix = document.createElement('style')
  fix.textContent = 'img{display:inline !important;vertical-align:baseline !important}'
  document.head.appendChild(fix)
  try {
    const doc = iframe.contentDocument
    if (!doc) throw new Error('Não foi possível preparar o print')
    doc.open()
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${STYLES}</style></head><body style="margin:0;background:#fff"><div class="crm" style="display:block;height:auto;min-height:0">${html}</div></body></html>`)
    doc.close()
    await new Promise(r => setTimeout(r, 60))
    iframe.style.height = doc.documentElement.scrollHeight + 'px'
    const el = doc.querySelector('.rep') as HTMLElement | null
    if (!el) throw new Error('Relatório vazio')
    const canvas = await h2c(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, width: 1600, windowWidth: 1600 })
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new Error('Falha ao gerar a imagem')
    download(blob, `Cronograma_${slug(c.cliente)}_${stamp()}.png`)
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'copiado'
    } catch { return 'baixado' }
  } finally {
    fix.remove()
    iframe.remove()
  }
}

// ─── Excel ───────────────────────────────────────────────────────────────────

const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

export async function exportXls(m: Model, c: Cronograma, user: string) {
  const months = m.projMonths()
  if (!months.length) throw new Error('Não há itens com data para exportar')
  const { Workbook } = await import('exceljs')
  const wb = new Workbook(), rowsAll = m.flatAll()
  wb.creator = 'GT3 Consultoria'
  const ws = wb.addWorksheet('Cronograma', { views: [{ state: 'frozen', ySplit: 4 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  const cols = ['Item', 'Descrição', 'Resp.', 'Início', 'Prazo', ...months.map(mo => mo.lab), 'Status', 'Observação']
  ws.columns = [{ width: 8 }, { width: 50 }, { width: 16 }, { width: 11 }, { width: 11 }, ...months.map(() => ({ width: 7 })), { width: 20 }, { width: 60 }]
  ws.mergeCells(1, 1, 1, cols.length)
  const c1 = ws.getCell(1, 1)
  c1.value = `Cronograma – ${c.projeto} – ${c.cliente.toUpperCase()}`
  c1.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  c1.fill = solid('FF2A4F96')
  ws.getRow(1).height = 24
  ws.mergeCells(2, 1, 2, cols.length)
  const L = m.leaves(), done = L.filter(i => m.status(i) === 'concluido').length
  ws.getCell(2, 1).value = `GT3 Consultoria · emitido em ${new Date().toLocaleDateString('pt-BR')} por ${user} · ${done}/${L.length} itens concluídos · ${Math.round(m.stats().pct * 100)}% de andamento`
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF4A5568' } }
  const hr = ws.getRow(4)
  hr.values = cols
  hr.font = { bold: true, color: { argb: 'FF132649' } }
  hr.height = 20
  hr.eachCell(cell => {
    cell.fill = solid('FFF5ECDC')
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFD1AE6E' } } }
  })
  ws.properties.outlineProperties = { summaryBelow: false, summaryRight: false }
  rowsAll.forEach(it => {
    const g = m.isGrp(it), dp = m.depth(it), [a, b] = m.span(it), v = m.vis(it), lt = m.late(it)
    const etapa = g && dp === 0
    const titulo = g
      ? (etapa ? it.t.toUpperCase() : it.t) + `   (${progresso(m, it)} concluídos)`
      : (dp > 0 ? '└ ' : '') + it.t + (it.det ? '\n' + it.det : '')
    const r = ws.addRow([it.id, titulo, (it.resp || []).map(x => respName(c, x)).join(' / '), a ? D(a) : '', b ? D(b) : '', ...months.map(() => ''), m.visLabel(it) + (lt ? ' · ATRASADO' : ''), it.obs || ''])
    r.alignment = { vertical: 'top', wrapText: true }
    r.getCell(2).alignment = { vertical: 'top', wrapText: true, indent: Math.min(dp * 2, 15) }
    r.getCell(4).numFmt = 'dd/mm/yy'
    r.getCell(5).numFmt = 'dd/mm/yy'
    r.outlineLevel = Math.min(dp, 7) // permite recolher/expandir etapas no próprio Excel
    if (g) {
      r.font = etapa ? { bold: true, size: 11, color: { argb: 'FF132649' } } : { bold: true, color: { argb: 'FF1B3468' } }
      r.eachCell({ includeEmpty: true }, cell => { cell.fill = solid(etapa ? 'FFDCE6F7' : 'FFF1F5FB') })
      if (etapa) r.height = 22
    } else r.getCell(1).font = { color: { argb: 'FF5E6B84' } }
    months.forEach((mo, i) => { if (inMonth(m, it, mo)) r.getCell(6 + i).fill = solid('FF' + (g ? (etapa ? '8FA8D6' : 'B8C6E3') : XCOL[v])) })
    const sc = r.getCell(6 + months.length)
    sc.fill = solid('FF' + (lt ? 'F8D0CB' : XCOL[v]))
    sc.font = { bold: true, color: { argb: 'FF' + (lt ? 'C0392B' : XTXT[v]) } }
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      const bd: Partial<Borders> = { bottom: { style: 'thin', color: { argb: etapa ? 'FFB8C9E8' : 'FFE1E6EF' } } }
      if (etapa) bd.top = { style: 'medium', color: { argb: 'FF2A4F96' } }
      if (col === 1) bd.left = etapa ? { style: 'thick', color: { argb: 'FF2A4F96' } } : { style: 'medium', color: { argb: g ? 'FF7F9AD0' : 'FFE4EAF5' } }
      cell.border = bd
    })
  })
  const h = wb.addWorksheet('Histórico')
  h.columns = [{ header: 'Data', width: 18 }, { header: 'Item', width: 8 }, { header: 'Descrição do item', width: 44 }, { header: 'Usuário', width: 16 }, { header: 'Registro', width: 70 }]
  h.getRow(1).font = { bold: true }
  m.itens.flatMap(it => (it.hist || []).map(x => ({ ...x, id: it.id, t2: it.t }))).sort((a, b) => a.d.localeCompare(b.d))
    .forEach(x => h.addRow([fmtDT(x.d), x.id, x.t2, x.u, x.t]))
  const buf = await wb.xlsx.writeBuffer()
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Cronograma_${slug(c.cliente)}_${stamp()}.xlsx`)
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

type AutoTableHook = { section: string; row: { index: number }; column: { index: number }; cell: { styles: Record<string, unknown> } }
type JsPdfDoc = {
  internal: { pageSize: { getWidth(): number; getHeight(): number }; getNumberOfPages(): number }
  setFillColor(...c: number[]): void
  rect(x: number, y: number, w: number, h: number, style?: string): void
  setTextColor(...c: number[]): void
  setFont(name: string, style: string): void
  setFontSize(n: number): void
  text(t: string, x: number, y: number, o?: { align?: string }): void
  autoTable(o: Record<string, unknown>): void
  save(name: string): void
}

export async function exportPdf(m: Model, c: Cronograma, user: string) {
  const months = m.projMonths()
  if (!months.length) throw new Error('Não há itens com data para exportar')
  await loadScript(CDN.jspdf)
  await loadScript(CDN.autotable)
  const lib = (window as unknown as { jspdf?: { jsPDF: new (o: Record<string, unknown>) => JsPdfDoc } }).jspdf
  if (!lib) throw new Error('jsPDF indisponível')
  const doc = new lib.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), rowsAll = m.flatAll()
  doc.setFillColor(19, 38, 73); doc.rect(0, 0, W, 22, 'F'); doc.setFillColor(209, 174, 110); doc.rect(0, 22, W, 1.2, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(`Cronograma – ${c.projeto}`, 12, 10)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`${c.cliente.toUpperCase()}  ·  GT3 Consultoria`, 12, 16.5)
  doc.setTextColor(209, 174, 110); doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(Math.round(m.stats().pct * 100) + '%', W - 12, 12, { align: 'right' })
  doc.setFontSize(8); doc.setTextColor(200); doc.setFont('helvetica', 'normal'); doc.text('andamento geral', W - 12, 17, { align: 'right' })
  const L = m.leaves(), cn = (k: string) => L.filter(i => m.status(i) === k).length
  doc.setTextColor(74, 85, 104); doc.setFontSize(9)
  doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')} por ${user}   ·   Concluídos ${cn('concluido')}   ·   Em andamento ${cn('andamento')}   ·   Aguardando cliente ${cn('aguardando')}   ·   Pendentes ${cn('pendente')}   ·   Atrasados ${L.filter(m.late).length}`, 12, 30)
  const rows = rowsAll.map(it => {
    const [a, b] = m.span(it)
    const dp = m.depth(it), pad = '    '.repeat(dp)
    const titulo = m.isGrp(it)
      ? pad + (dp === 0 ? it.t.toUpperCase() : it.t) + `  (${progresso(m, it)} concluídos)`
      : pad + (dp > 0 ? '- ' : '') + it.t + (it.det ? '\n' + pad + it.det : '')
    return [it.id, titulo, (it.resp || []).map(r => respName(c, r)).join(' / '), fmt(a), fmt(b), ...months.map(() => ''), m.visLabel(it) + (m.late(it) ? '\nATRASADO' : ''), it.obs || '']
  })
  const hex = (h: string) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16)]
  doc.autoTable({
    startY: 34, head: [['Item', 'Descrição', 'Resp.', 'Início', 'Prazo', ...months.map(mo => mo.lab), 'Status', 'Observação']], body: rows,
    theme: 'grid', styles: { fontSize: 7.6, cellPadding: 1.6, lineColor: [225, 230, 239], lineWidth: .2, textColor: [26, 34, 51], valign: 'top' },
    headStyles: { fillColor: [42, 79, 150], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: Object.assign({ 0: { cellWidth: 12 }, 1: { cellWidth: 68 }, 2: { cellWidth: 24 }, 3: { cellWidth: 15 }, 4: { cellWidth: 15 }, [5 + months.length]: { cellWidth: 24 } }, Object.fromEntries(months.map((_, i) => [5 + i, { cellWidth: 10 }]))),
    didParseCell: (d: AutoTableHook) => {
      if (d.section !== 'body') return
      const it = rowsAll[d.row.index], g = m.isGrp(it), v = m.vis(it), lt = m.late(it)
      if (g && m.depth(it) === 0) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [220, 230, 247]; d.cell.styles.textColor = [19, 38, 73]; d.cell.styles.fontSize = 8.6 }
      else if (g) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [241, 245, 251]; d.cell.styles.textColor = [27, 52, 104] }
      const mi = d.column.index - 5
      if (mi >= 0 && mi < months.length && inMonth(m, it, months[mi])) d.cell.styles.fillColor = hex(g ? 'B8C6E3' : XCOL[v])
      if (d.column.index === 5 + months.length) { d.cell.styles.fillColor = hex(lt ? 'F8D0CB' : XCOL[v]); d.cell.styles.textColor = hex(lt ? 'C0392B' : XTXT[v]); d.cell.styles.fontStyle = 'bold' }
    },
    didDrawPage: () => { doc.setFontSize(7.5); doc.setTextColor(130, 144, 166); doc.text(`GT3 Consultoria · ${c.cliente} · página ${doc.internal.getNumberOfPages()}`, 12, doc.internal.pageSize.getHeight() - 6) },
  })
  doc.save(`Cronograma_${slug(c.cliente)}_${stamp()}.pdf`)
}
