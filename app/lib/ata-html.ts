// Gerador de HTML "frio" (autocontido, sem JavaScript) de uma ata.
// Fonte única usada por: download .html, geração de PDF e página pública /ata/[token].

import type { Participante, Topico, TopicoHistorico } from '../atas/AtasEditor'

export type AtaHtmlData = {
  titulo?: string | null
  data: string
  cliente?: string | null
  local_reuniao?: string | null
  numero_ata?: string | null
  status?: string | null
}

export function escapeHtml(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Extrai o número puro de "numero_ata" (ex.: "07/26" → "7") — usado no nome de arquivo do PDF. */
function numeroAtaCurto(numeroAta: string | null | undefined): string {
  if (!numeroAta) return ''
  const m = numeroAta.match(/^0*(\d+)/)
  return m ? m[1] : numeroAta.trim()
}

/** "Bertolini Colatina / Bertolini Matriz" → "Colatina e Matriz" (tira o nome repetido,
 *  fica só com o que diferencia cada unidade). Quando as partes não têm um prefixo comum
 *  (ex.: contratantes realmente diferentes na mesma ata), devolve o texto original. */
function contratanteParaArquivo(cliente: string): string {
  const partes = cliente.split(' / ').map(p => p.trim()).filter(Boolean)
  if (partes.length < 2) return cliente
  const primeiraPalavra = (s: string) => s.split(/[\s-]+/)[0]?.toLowerCase() ?? ''
  const prefixo = primeiraPalavra(partes[0])
  if (!prefixo || !partes.every(p => primeiraPalavra(p) === prefixo)) return cliente
  const diferenciadores = partes.map(p => p.slice(prefixo.length).replace(/^[\s-]+/, '').trim())
  if (diferenciadores.some(d => !d)) return cliente
  return diferenciadores.join(' e ')
}

function dataParaArquivo(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}${m}${y.slice(2)}`
}

/** Nome sugerido do PDF — ex.: "ATA 7 Reunião - BSA x GT3 100826" ou, quando a mesma ata
 *  cobre mais de uma unidade da contratante, "ATA 5 Reunião - Matriz e Colatina x GT3 100826". */
export function nomeArquivoAta(ata: AtaHtmlData): string {
  const n = numeroAtaCurto(ata.numero_ata)
  const contratante = contratanteParaArquivo(ata.cliente?.trim() ?? '')
  const dataFmt = dataParaArquivo(ata.data)
  const cabecalho = n ? `ATA ${n} Reunião` : 'ATA Reunião'
  const meio = contratante ? `${contratante} x GT3` : 'GT3'
  return [cabecalho, dataFmt ? `${meio} ${dataFmt}` : meio].join(' - ')
}

function renderTopicoCard(t: Topico, numero: number, dateDisplay: string): string {
  const cor = t.cor ?? '#2A4F96'
  const hist: TopicoHistorico[] = t.historico ?? []
  const statusColors: Record<string, string> = {
    'Pendente': 'color:#92400E;background:#FEF3C7',
    'Em análise': 'color:#6D28D9;background:#EDE9FE',
    'Em andamento': 'color:#1D4ED8;background:#DBEAFE',
    'Acompanhamento': 'color:#0F766E;background:#CCFBF1',
    'Concluído': 'color:#065F46;background:#D1FAE5',
    'Cancelado': 'color:#6B7280;background:#F3F4F6',
  }
  const statusLabel: Record<string, string> = {
    'Pendente': '● Pendente', 'Em análise': '◔ Em análise',
    'Em andamento': '◑ Em andamento', 'Acompanhamento': '↻ Acompanhamento',
    'Concluído': '✓ Concluído', 'Cancelado': '✕ Cancelado',
  }
  const metaHtml = (t.contratante || t.prazo || t.responsavel || t.status)
    ? `<div style="display:flex;gap:16px;font-size:12px;color:#5a6178;border-top:1px solid #eee;padding-top:8px;flex-wrap:wrap;align-items:center;margin-bottom:${hist.length > 0 ? '8px' : '0'}">
        ${t.contratante ? `<span><strong>Contratante:</strong> ${escapeHtml(t.contratante)}</span>` : ''}
        ${t.prazo ? `<span><strong>Prazo:</strong> ${new Date(t.prazo + 'T12:00').toLocaleDateString('pt-BR')}</span>` : ''}
        ${t.responsavel ? `<span><strong>Responsável:</strong> ${escapeHtml(t.responsavel)}</span>` : ''}
        ${t.status && statusColors[t.status] ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;${statusColors[t.status]}">${statusLabel[t.status]}</span>` : ''}</div>` : ''
  const histHtml = hist.length > 0
    ? `<details open style="border-top:1px dashed #e2e8f0;padding-top:6px;margin-top:10px">
        <summary style="font-size:10px;font-weight:600;color:#94A3B8;display:inline-block">Histórico (${hist.length})</summary>
        <div style="margin-top:6px">
          ${hist.map(h => `<div style="margin-bottom:6px;padding:4px 0 4px 10px;border-left:2px solid #E2E8F0">
            <div style="font-size:10px;font-weight:600;color:#94A3B8;margin-bottom:1px">${new Date(h.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            <div style="font-size:11px;color:#94A3B8;line-height:1.5">${h.texto}</div>
          </div>`).join('')}
        </div></details>` : ''
  return `<div class="topico" style="margin-bottom:18px;padding:14px 16px;border:1px solid #e0e5ef;border-left:3px solid ${cor};border-radius:6px">
    <div style="font-weight:700;font-size:14px;color:${cor};margin-bottom:8px">${numero}. ${escapeHtml(t.titulo || '(Sem título)')}</div>
    ${t.andamentoGeral ? `<div style="margin-bottom:10px;padding:10px 12px;background:#F8FAFC;border-left:3px solid #94A3B8;border-radius:6px"><div style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">📌 Até aqui</div><div style="font-size:14px;line-height:1.75;color:#1E293B;font-weight:500">${t.andamentoGeral}</div></div>` : ''}
    ${t.descricao ? `<div style="margin-bottom:10px;padding:12px 14px;background:${cor}12;border-left:4px solid ${cor};border-radius:6px"><div style="font-size:11px;font-weight:800;color:${cor};text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">🗓️ Na data desta reunião (${dateDisplay}), definiu-se</div><div style="font-size:14px;line-height:1.75;color:#1E293B;font-weight:600">${t.descricao}</div></div>` : ''}
    ${metaHtml}${histHtml}</div>`
}

export function renderAtaHtml(
  ata: AtaHtmlData,
  topicos: Topico[],
  partes: Participante[],
  forPrint = false,
): string {
  const dateDisplay = ata.data
    ? new Date(ata.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  const titulo = ata.titulo || `Ata de Reunião — ${ata.cliente ?? ''}`
  // No PDF, o título do documento é o que o navegador sugere como nome de arquivo ao
  // "Salvar como PDF" — por isso, só para impressão, ele segue o padrão combinado
  // (ex.: "ATA 7 Reunião - BSA x GT3 100826") em vez do título descritivo da ata.
  const tituloDocumento = forPrint ? nomeArquivoAta(ata) : titulo

  const partsHtml = partes.length > 0
    ? `<div style="margin-bottom:24px"><div style="font-size:11px;font-weight:700;color:#2A4F96;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Participantes</div>
        ${partes.map(p => `<div style="margin-bottom:4px;font-size:13px"><strong>${escapeHtml(p.nome)}</strong>${p.empresa ? ` — ${escapeHtml(p.empresa)}` : ''}</div>`).join('')}</div>` : ''

  const ativos = topicos.filter(t => !t.finalizado)
  const finalizados = topicos.filter(t => t.finalizado)
  const topicosHtml = ativos.map((t, idx) => renderTopicoCard(t, idx + 1, dateDisplay)).join('')
  const finalizadosHtml = finalizados.length > 0
    ? `<div style="margin-top:28px">
        <div style="font-size:11px;font-weight:700;color:#10B981;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">✓ Tópicos finalizados nesta reunião</div>
        ${finalizados.map((t, idx) => renderTopicoCard(t, idx + 1, dateDisplay)).join('')}
      </div>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(tituloDocumento)}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:820px;margin:0 auto;padding:40px 32px;color:#1a1f2e;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}summary{cursor:pointer;list-style:none;user-select:none}summary::-webkit-details-marker{display:none}${forPrint ? '@page{margin:16mm}@media print{body{padding:0;max-width:none}.topico{page-break-inside:avoid}}' : ''}</style>
</head><body>
<div style="border-bottom:3px solid #2A4F96;margin-bottom:24px;padding-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <div style="font-size:20px;font-weight:700;color:#2A4F96;margin-bottom:4px">${escapeHtml(titulo)}</div>
    <div style="font-size:13px;color:#5a6178">${dateDisplay}${ata.local_reuniao ? ` — ${escapeHtml(ata.local_reuniao)}` : ''}</div>
  </div>
  <div style="text-align:right">
    ${ata.numero_ata ? `<div style="display:inline-block;padding:3px 10px;background:#D1AE6E;color:#fff;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:4px">${escapeHtml(ata.numero_ata)}</div><br>` : ''}
    <span style="font-size:11px;color:#5a6178">${escapeHtml(ata.status)}</span>
  </div>
</div>
${ata.cliente ? `<div style="margin-bottom:16px;font-size:13px;color:#334155"><strong>Contratante:</strong> ${escapeHtml(ata.cliente)}</div>` : ''}
${partsHtml}
<div>
  <div style="font-size:11px;font-weight:700;color:#2A4F96;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Pontos discutidos</div>
  ${topicosHtml || '<p style="color:#94A3B8">Nenhum tópico ativo.</p>'}
</div>
${finalizadosHtml}
</body></html>`
}
