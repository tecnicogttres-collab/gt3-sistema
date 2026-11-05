'use client'

// Exportação de PDIs (somente gestor/admin): escolhe as pessoas e os itens e gera PDF (impressão) ou Excel.

import { useMemo, useState } from 'react'
import type { PdiColaborador, EneagramaRank, Animal, Mbti } from '../../data/pdis/types'

type ItemId =
  | 'dados'
  | 'acoes_ativas' | 'acoes_historico'
  | 'aval_notas' | 'aval_conversas' | 'aval_rascunhos'
  | 'en_ranking' | 'en_fortes' | 'en_atencao' | 'en_desenvolver'
  | 'animais'
  | 'mbti'
  | 'c_forcas' | 'c_pontosAtencao' | 'c_ondeAgrega' | 'c_comoPodeApoiar' | 'c_comoLiderar' | 'c_riscos'

const GRUPOS: { titulo: string; itens: { id: ItemId; label: string }[] }[] = [
  { titulo: 'Dados gerais', itens: [{ id: 'dados', label: 'Nome, função e período' }] },
  { titulo: 'Plano de Ações', itens: [
    { id: 'acoes_ativas', label: 'Ações em aberto' },
    { id: 'acoes_historico', label: 'Ações concluídas (histórico)' },
  ] },
  { titulo: 'Avaliações', itens: [
    { id: 'aval_notas', label: 'Notas por competência (cada ciclo)' },
    { id: 'aval_conversas', label: 'Períodos e datas das conversas' },
    { id: 'aval_rascunhos', label: 'Anotações da conversa' },
  ] },
  { titulo: 'Eneagrama', itens: [
    { id: 'en_ranking', label: 'Ranking de tipos' },
    { id: 'en_fortes', label: 'Pontos fortes' },
    { id: 'en_atencao', label: 'Pontos de atenção' },
    { id: 'en_desenvolver', label: 'Como desenvolver' },
    { id: 'animais', label: 'Perfil por animais' },
  ] },
  { titulo: 'MBTI', itens: [{ id: 'mbti', label: 'Tipo e análise' }] },
  { titulo: 'Conclusões', itens: [
    { id: 'c_forcas', label: 'Forças visíveis' },
    { id: 'c_pontosAtencao', label: 'Pontos de atenção' },
    { id: 'c_ondeAgrega', label: 'Onde agrega mais' },
    { id: 'c_comoPodeApoiar', label: 'Pode apoiar bem' },
    { id: 'c_comoLiderar', label: 'Como liderar' },
    { id: 'c_riscos', label: 'Riscos se mal alocado' },
  ] },
]
const TODOS = GRUPOS.flatMap(g => g.itens.map(i => i.id))
const CONC_KEYS = ['forcas', 'pontosAtencao', 'ondeAgrega', 'comoPodeApoiar', 'comoLiderar', 'riscos'] as const
const CONC_LABEL: Record<typeof CONC_KEYS[number], string> = {
  forcas: 'Forças visíveis', pontosAtencao: 'Pontos de atenção', ondeAgrega: 'Onde agrega mais',
  comoPodeApoiar: 'Pode apoiar bem', comoLiderar: 'Como liderar', riscos: 'Riscos se mal alocado',
}
const MBTI_CAMPOS: { k: keyof Mbti; label: string }[] = [
  { k: 'tipo', label: 'Tipo' }, { k: 'nucleo', label: 'Núcleo' }, { k: 'veredito', label: 'Veredito' },
  { k: 'estiloDecisao', label: 'Estilo de decisão' }, { k: 'relacionamentoAutoridade', label: 'Relacionamento com autoridade' },
  { k: 'curvaAprendizado', label: 'Curva de aprendizado' }, { k: 'impactoClima', label: 'Impacto no clima' }, { k: 'zonaRisco', label: 'Zona de risco' },
]

type Acao = { competencia: string; desenvolver: string; acoes: string; resultados: string; inicio: string; termino: string; status: string; concluido_em: string | null }
type Ciclo = {
  numero_ciclo: number; status: string
  avaliacao_diretiva: number[]; autoavaliacao: number[]; ambicao: number[]
  data_conversa: string | null; conversa_confirmada_em: string | null; data_inicio: string | null; data_fim: string | null
  rascunhos: { user_nome: string | null; texto: string | null; updated_at: string }[]
}
type Dados = {
  nome: string; funcao: string; periodo: string
  competencias: string[]
  acoes: Acao[]
  ciclos: Ciclo[]
  eneagrama: { ranking: EneagramaRank[]; pontosFortes: string[]; pontosAtencao: string[]; comoDesenvolver: string[] }
  animais: Animal[]
  mbti: Mbti | null
  conclusoes: PdiColaborador['conclusoes']
}

const fmtData = (s: string | null | undefined) => {
  if (!s) return ''
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR')
}
const soma = (a: number[]) => a.reduce((x, y) => x + (Number(y) || 0), 0)
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')

async function carregar(pdi: PdiColaborador): Promise<Dados> {
  const r = await fetch(`/api/pdi/${pdi.id}/exportar`)
  if (!r.ok) throw new Error(r.status === 403 ? 'Somente gestor/admin pode exportar.' : 'Não foi possível carregar os dados do PDI.')
  const j = await r.json() as {
    pdi: { nome: string; funcao: string; data_inicio: string | null; eneagrama: Dados['eneagrama'] | null; animais: Animal[] | null; conclusoes: Record<string, unknown> | null; competencias: string[] | null } | null
    acoes: { competencia: string; desenvolver: string; acoes: string; resultados_esperados: string; inicio: string; termino: string; status: string; concluido_em: string | null }[]
    ciclos: Ciclo[]
  }
  const db = j.pdi
  const conc = (db?.conclusoes ?? null) as Record<string, unknown> | null
  const mbtiDb = conc?._mbti as Mbti | undefined
  return {
    nome: db?.nome ?? pdi.nome,
    funcao: db?.funcao ?? pdi.funcao,
    periodo: db ? fmtData(db.data_inicio) : pdi.periodo,
    competencias: db?.competencias?.length ? db.competencias : pdi.matrizAvaliacao.competencias,
    acoes: j.acoes.length
      ? j.acoes.map(a => ({ ...a, resultados: a.resultados_esperados }))
      : pdi.planoDeAcao.map(a => ({ ...a, resultados: a.resultadosEsperados, concluido_em: null })),
    ciclos: j.ciclos,
    eneagrama: db ? {
      ranking: db.eneagrama?.ranking ?? [], pontosFortes: db.eneagrama?.pontosFortes ?? [],
      pontosAtencao: db.eneagrama?.pontosAtencao ?? [], comoDesenvolver: db.eneagrama?.comoDesenvolver ?? [],
    } : pdi.perfilComportamental.eneagrama,
    animais: db ? (db.animais ?? []) : pdi.perfilComportamental.animais,
    mbti: db ? (mbtiDb?.tipo ? mbtiDb : null) : (pdi.perfilComportamental.mbti ?? null),
    conclusoes: db ? Object.fromEntries(CONC_KEYS.map(k => [k, (conc?.[k] as string[] | undefined) ?? []])) as PdiColaborador['conclusoes'] : pdi.conclusoes,
  }
}

// ── PDF (janela de impressão → "Salvar como PDF") ────────────────────────────

function gerarCorpo(d: Dados, sel: Set<ItemId>): string {
  const h: string[] = []
  const lista = (t: string, itens: string[]) => itens.length ? `<h3>${esc(t)}</h3><ul>${itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<h3>${esc(t)}</h3><p class="vazio">Sem informações.</p>`
  const tabAcoes = (t: string, a: Acao[]) => `<h3>${esc(t)}</h3>` + (a.length
    ? `<table><thead><tr><th>Competência</th><th>O que desenvolver</th><th>Ações</th><th>Resultados esperados</th><th>Início</th><th>Término</th><th>Status</th></tr></thead><tbody>${a.map(x => `<tr><td>${esc(x.competencia)}</td><td>${esc(x.desenvolver)}</td><td>${esc(x.acoes)}</td><td>${esc(x.resultados)}</td><td>${esc(x.inicio)}</td><td>${esc(x.termino)}</td><td>${esc(x.status)}${x.concluido_em ? `<br><small>em ${esc(fmtData(x.concluido_em))}</small>` : ''}</td></tr>`).join('')}</tbody></table>`
    : '<p class="vazio">Nenhuma ação.</p>')

  h.push(`<h1>PDI — ${esc(d.nome)}</h1>`)
  if (sel.has('dados')) h.push(`<p class="sub">${esc(d.funcao || 'Função não informada')}${d.periodo ? ` · Início: ${esc(d.periodo)}` : ''}</p>`)

  if (sel.has('acoes_ativas') || sel.has('acoes_historico')) {
    h.push('<h2>Plano de Ações</h2>')
    if (sel.has('acoes_ativas')) h.push(tabAcoes('Em aberto', d.acoes.filter(a => a.status !== 'Concluído')))
    if (sel.has('acoes_historico')) h.push(tabAcoes('Concluídas', d.acoes.filter(a => a.status === 'Concluído')))
  }

  if (sel.has('aval_notas') || sel.has('aval_conversas') || sel.has('aval_rascunhos')) {
    h.push('<h2>Avaliações</h2>')
    if (!d.ciclos.length) h.push('<p class="vazio">Nenhum ciclo de avaliação.</p>')
    for (const c of d.ciclos) {
      h.push(`<h3>Ciclo ${c.numero_ciclo}${c.status === 'arquivado' ? ' (arquivado)' : ' (ativo)'}</h3>`)
      if (sel.has('aval_conversas')) h.push(`<p class="meta">Período: ${esc(fmtData(c.data_inicio) || '—')} a ${esc(fmtData(c.data_fim) || 'em aberto')} · Conversa: ${esc(fmtData(c.data_conversa) || 'não agendada')}${c.conversa_confirmada_em ? ` · confirmada em ${esc(fmtData(c.conversa_confirmada_em))}` : ''}</p>`)
      if (sel.has('aval_notas')) {
        const max = d.competencias.length * 5
        h.push(`<table><thead><tr><th>Competência</th><th>Diretiva</th><th>Autoavaliação</th><th>Ambição</th></tr></thead><tbody>${d.competencias.map((comp, i) => `<tr><td>${esc(comp)}</td><td class="n">${c.avaliacao_diretiva[i] ?? ''}</td><td class="n">${c.autoavaliacao[i] ?? ''}</td><td class="n">${c.ambicao[i] ?? ''}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td class="n">${soma(c.avaliacao_diretiva)}/${max}</td><td class="n">${soma(c.autoavaliacao)}/${max}</td><td class="n">${soma(c.ambicao)}/${max}</td></tr></tbody></table>`)
      }
      if (sel.has('aval_rascunhos')) {
        h.push(c.rascunhos.length
          ? c.rascunhos.map(r => `<div class="nota"><b>${esc(r.user_nome || 'Sem nome')}</b> <small>${esc(fmtData(r.updated_at))}</small><div>${esc(r.texto).replace(/\n/g, '<br>')}</div></div>`).join('')
          : '<p class="vazio">Sem anotações da conversa.</p>')
      }
    }
  }

  if (sel.has('en_ranking') || sel.has('en_fortes') || sel.has('en_atencao') || sel.has('en_desenvolver') || sel.has('animais')) {
    h.push('<h2>Eneagrama</h2>')
    if (sel.has('en_ranking')) h.push(`<h3>Ranking</h3>` + (d.eneagrama.ranking.length ? `<ol>${d.eneagrama.ranking.map(r => `<li>${esc(r.tipo)}${r.pontuacao ? ` — ${esc(r.pontuacao)}` : ''}</li>`).join('')}</ol>` : '<p class="vazio">Sem informações.</p>'))
    if (sel.has('en_fortes')) h.push(lista('Pontos fortes', d.eneagrama.pontosFortes))
    if (sel.has('en_atencao')) h.push(lista('Pontos de atenção', d.eneagrama.pontosAtencao))
    if (sel.has('en_desenvolver')) h.push(lista('Como desenvolver', d.eneagrama.comoDesenvolver))
    if (sel.has('animais')) h.push(`<h3>Perfil por animais</h3>` + (d.animais.length
      ? `<table><thead><tr><th>Animal</th><th>%</th><th>Ponto forte</th><th>Tendência</th></tr></thead><tbody>${d.animais.map(a => `<tr><td>${esc(a.emoji)} ${esc(a.animal)}</td><td class="n">${a.percentual ?? ''}</td><td>${esc(a.pontoForte)}</td><td>${esc(a.tendencia)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="vazio">Sem informações.</p>'))
  }

  if (sel.has('mbti')) {
    h.push('<h2>MBTI</h2>')
    h.push(d.mbti ? `<table><tbody>${MBTI_CAMPOS.filter(c => d.mbti![c.k]).map(c => `<tr><th class="lado">${esc(c.label)}</th><td>${esc(d.mbti![c.k]).replace(/\n/g, '<br>')}</td></tr>`).join('')}</tbody></table>` : '<p class="vazio">Sem informações.</p>')
  }

  const concSel = CONC_KEYS.filter(k => sel.has(`c_${k}` as ItemId))
  if (concSel.length) {
    h.push('<h2>Conclusões</h2>')
    concSel.forEach(k => h.push(lista(CONC_LABEL[k], d.conclusoes[k])))
  }

  return h.join('')
}

function gerarHtml(pessoas: Dados[], sel: Set<ItemId>): string {
  const titulo = pessoas.length === 1 ? `PDI - ${pessoas[0].nome}` : `PDIs (${pessoas.length})`
  const corpo = pessoas.map(d => `<section class="pessoa">${gerarCorpo(d, sel)}</section>`).join('')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
    .pessoa + .pessoa{break-before:page;page-break-before:always;margin-top:32px}
    body{font-family:Inter,Arial,sans-serif;color:#1E293B;margin:28px;font-size:12px}
    h1{font-size:20px;margin:0 0 4px;color:#1E3A6E}.sub{color:#6B7A99;margin:0 0 14px}
    h2{font-size:15px;color:#2A4F96;border-bottom:2px solid #D1AE6E;padding-bottom:4px;margin:22px 0 8px}
    h3{font-size:13px;margin:12px 0 6px}ul,ol{margin:0 0 8px;padding-left:20px}li{margin:2px 0}
    table{width:100%;border-collapse:collapse;margin:4px 0 10px}th,td{border:1px solid #E2E8F0;padding:5px 7px;text-align:left;vertical-align:top}
    th{background:#F5ECDC}th.lado{width:28%}td.n{text-align:center}tr.tot td{font-weight:700;background:#F8FAFC}
    .meta{color:#6B7A99;margin:0 0 6px}.vazio{color:#94A3B8;font-style:italic;margin:0 0 8px}
    .nota{border-left:3px solid #D1AE6E;padding:4px 10px;margin:6px 0;background:#FBF8F1}.nota small{color:#94A3B8}
    .rod{margin-top:24px;color:#94A3B8;font-size:10px}
    @media print{body{margin:12mm}h2{break-after:avoid}tr{break-inside:avoid}}
  </style></head><body>${corpo}<div class="rod">GT3 Consultoria · exportado em ${new Date().toLocaleString('pt-BR')}</div></body></html>`
}

// ── Excel (uma aba por seção, com a coluna "Pessoa") ─────────────────────────

async function gerarExcel(pessoas: Dados[], sel: Set<ItemId>) {
  const { Workbook } = await import('exceljs')
  const wb = new Workbook()
  wb.creator = 'GT3 Consultoria'
  type WS = import('exceljs').Worksheet
  const aba = (nome: string, cols: string[], widths: number[]) => {
    const ws = wb.addWorksheet(nome)
    ws.columns = [{ width: 26 }, ...widths.map(w => ({ width: w }))]
    const r = ws.addRow(['Pessoa', ...cols])
    r.font = { bold: true, color: { argb: 'FF132649' } }
    r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5ECDC' } } })
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    return ws
  }
  const wrap = (ws: WS) => ws.eachRow(r => { r.alignment = { vertical: 'top', wrapText: true } })

  if (sel.has('dados')) {
    const ws = aba('Dados gerais', ['Função', 'Início'], [30, 14])
    pessoas.forEach(d => ws.addRow([d.nome, d.funcao, d.periodo]))
  }
  if (sel.has('acoes_ativas') || sel.has('acoes_historico')) {
    const ws = aba('Plano de Ações', ['Competência', 'O que desenvolver', 'Ações', 'Resultados esperados', 'Início', 'Término', 'Status', 'Concluído em'], [24, 36, 44, 36, 12, 12, 14, 14])
    pessoas.forEach(d => d.acoes
      .filter(a => a.status === 'Concluído' ? sel.has('acoes_historico') : sel.has('acoes_ativas'))
      .forEach(a => ws.addRow([d.nome, a.competencia, a.desenvolver, a.acoes, a.resultados, a.inicio, a.termino, a.status, fmtData(a.concluido_em)])))
    wrap(ws)
  }
  if (sel.has('aval_notas') || sel.has('aval_conversas')) {
    const cols = ['Ciclo', 'Status']
    if (sel.has('aval_conversas')) cols.push('Início', 'Fim', 'Data da conversa', 'Confirmada em')
    if (sel.has('aval_notas')) cols.push('Competência', 'Diretiva', 'Autoavaliação', 'Ambição')
    const ws = aba('Avaliações', cols, cols.map(c => c === 'Competência' ? 34 : 14))
    for (const d of pessoas) for (const c of d.ciclos) {
      const base = [d.nome, c.numero_ciclo, c.status]
      const conv = sel.has('aval_conversas') ? [fmtData(c.data_inicio), fmtData(c.data_fim), fmtData(c.data_conversa), fmtData(c.conversa_confirmada_em)] : []
      if (sel.has('aval_notas')) {
        d.competencias.forEach((comp, i) => ws.addRow([...base, ...conv, comp, c.avaliacao_diretiva[i] ?? '', c.autoavaliacao[i] ?? '', c.ambicao[i] ?? '']))
        const max = d.competencias.length * 5
        ws.addRow([...base, ...conv, 'Total', `${soma(c.avaliacao_diretiva)}/${max}`, `${soma(c.autoavaliacao)}/${max}`, `${soma(c.ambicao)}/${max}`]).font = { bold: true }
      } else ws.addRow([...base, ...conv])
    }
  }
  if (sel.has('aval_rascunhos')) {
    const ws = aba('Anotações da conversa', ['Ciclo', 'Autor', 'Atualizado em', 'Texto'], [8, 22, 14, 90])
    pessoas.forEach(d => d.ciclos.forEach(c => c.rascunhos.forEach(r => ws.addRow([d.nome, c.numero_ciclo, r.user_nome ?? '', fmtData(r.updated_at), r.texto ?? '']))))
    wrap(ws)
  }
  const enItens: [ItemId, string, (d: Dados) => string[]][] = [
    ['en_fortes', 'Ponto forte', d => d.eneagrama.pontosFortes],
    ['en_atencao', 'Ponto de atenção', d => d.eneagrama.pontosAtencao],
    ['en_desenvolver', 'Como desenvolver', d => d.eneagrama.comoDesenvolver],
  ]
  if (sel.has('en_ranking') || enItens.some(([id]) => sel.has(id))) {
    const ws = aba('Eneagrama', ['Item', 'Descrição', 'Pontuação'], [20, 80, 12])
    for (const d of pessoas) {
      if (sel.has('en_ranking')) d.eneagrama.ranking.forEach(r => ws.addRow([d.nome, `Ranking ${r.rank}º`, r.tipo, r.pontuacao]))
      enItens.forEach(([id, label, get]) => { if (sel.has(id)) get(d).forEach(t => ws.addRow([d.nome, label, t])) })
    }
    wrap(ws)
  }
  if (sel.has('animais')) {
    const ws = aba('Animais', ['Animal', '%', 'Ponto forte', 'Tendência'], [18, 8, 50, 50])
    pessoas.forEach(d => d.animais.forEach(a => ws.addRow([d.nome, `${a.emoji} ${a.animal}`, a.percentual ?? '', a.pontoForte, a.tendencia])))
    wrap(ws)
  }
  if (sel.has('mbti')) {
    const ws = aba('MBTI', ['Campo', 'Valor'], [28, 90])
    pessoas.forEach(d => { if (d.mbti) MBTI_CAMPOS.forEach(c => { if (d.mbti![c.k]) ws.addRow([d.nome, c.label, d.mbti![c.k]]) }) })
    wrap(ws)
  }
  const concSel = CONC_KEYS.filter(k => sel.has(`c_${k}` as ItemId))
  if (concSel.length) {
    const ws = aba('Conclusões', ['Seção', 'Item'], [24, 90])
    pessoas.forEach(d => concSel.forEach(k => d.conclusoes[k].forEach(t => ws.addRow([d.nome, CONC_LABEL[k], t]))))
    wrap(ws)
  }

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${pessoas.length === 1 ? `PDI_${slug(pessoas[0].nome)}` : 'PDIs'}_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Modal ────────────────────────────────────────────────────────────────────

/** PDI disponível para exportar. `estatico` = PDI do arquivo de dados ainda não migrado ao banco. */
export type PdiExportOpcao = { id: string; nome: string; funcao: string; arquivado?: boolean; estatico?: PdiColaborador }

function stub(o: PdiExportOpcao): PdiColaborador {
  return o.estatico ?? {
    id: o.id, nome: o.nome, funcao: o.funcao, periodo: '',
    matrizAvaliacao: { competencias: [], diretiva: [], auto: [], ambicao: [], totais: { diretiva: 0, auto: 0, ambicao: 0, max: 0 } },
    planoDeAcao: [],
    perfilComportamental: { eneagrama: { ranking: [], pontosFortes: [], pontosAtencao: [], comoDesenvolver: [] }, animais: [] },
    conclusoes: { forcas: [], pontosAtencao: [], ondeAgrega: [], comoPodeApoiar: [], riscos: [], comoLiderar: [] },
  }
}

export default function PdiExportModal({ opcoes, onClose }: { opcoes: PdiExportOpcao[]; onClose: () => void }) {
  const [pessoasSel, setPessoasSel] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [verArquivados, setVerArquivados] = useState(false)
  const [sel, setSel] = useState<Set<ItemId>>(() => new Set(TODOS))
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState<'pdf' | 'excel' | null>(null)

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return opcoes.filter(o => (verArquivados || !o.arquivado) && (!q || o.nome.toLowerCase().includes(q) || o.funcao.toLowerCase().includes(q)))
  }, [opcoes, busca, verArquivados])
  const temArquivados = opcoes.some(o => o.arquivado)

  const toggle = (id: ItemId) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleGrupo = (ids: ItemId[]) => setSel(s => {
    const n = new Set(s)
    const todosMarcados = ids.every(i => n.has(i))
    ids.forEach(i => { if (todosMarcados) n.delete(i); else n.add(i) })
    return n
  })
  const togglePessoa = (id: string) => setPessoasSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const todasVisiveisMarcadas = visiveis.length > 0 && visiveis.every(o => pessoasSel.has(o.id))
  const toggleTodasPessoas = () => setPessoasSel(s => {
    const n = new Set(s)
    visiveis.forEach(o => { if (todasVisiveisMarcadas) n.delete(o.id); else n.add(o.id) })
    return n
  })

  async function carregarSelecionados(): Promise<Dados[]> {
    const escolhidos = opcoes.filter(o => pessoasSel.has(o.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return Promise.all(escolhidos.map(o => carregar(stub(o))))
  }

  async function exportar(tipo: 'pdf' | 'excel') {
    setErro('')
    // A janela abre já no clique: depois do carregamento o navegador a bloquearia como pop-up.
    const w = tipo === 'pdf' ? window.open('', '_blank') : null
    if (tipo === 'pdf' && !w) { setErro('O navegador bloqueou a nova janela. Libere pop-ups para este site.'); return }
    if (w) w.document.write('<p style="font-family:Arial;color:#6B7A99;margin:28px">Gerando PDF…</p>')
    setGerando(tipo)
    try {
      const dados = await carregarSelecionados()
      if (tipo === 'excel') await gerarExcel(dados, sel)
      else if (w) {
        w.document.open()
        w.document.write(gerarHtml(dados, sel))
        w.document.close()
        w.focus()
        setTimeout(() => w.print(), 300)
      }
    } catch (e) {
      w?.close()
      setErro(e instanceof Error ? e.message : 'Erro ao exportar.')
    } finally {
      setGerando(null)
    }
  }

  const bloqueado = pessoasSel.size === 0 || sel.size === 0 || !!gerando
  const BTN: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' }
  const TITULO: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }
  const LINK: React.CSSProperties = { background: 'none', border: 'none', color: '#2A4F96', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: 12 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(860px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Exportar PDI</div>
            <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>Escolha as pessoas e o que exportar de cada uma</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Pessoas */}
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={TITULO}>1. Pessoas {pessoasSel.size > 0 && <span style={{ color: '#2A4F96' }}>({pessoasSel.size})</span>}</div>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou função"
              style={{ padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <button onClick={toggleTodasPessoas} style={LINK}>{todasVisiveisMarcadas ? 'Desmarcar todas' : 'Marcar todas'}</button>
              {temArquivados && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7A99', cursor: 'pointer' }}>
                  <input type="checkbox" checked={verArquivados} onChange={e => setVerArquivados(e.target.checked)} /> Incluir arquivados
                </label>
              )}
            </div>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflowY: 'auto', maxHeight: 340 }}>
              {visiveis.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: '#94A3B8', textAlign: 'center' }}>Nenhum PDI encontrado.</div>}
              {visiveis.map(o => (
                <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: pessoasSel.has(o.id) ? '#F5F8FF' : '#fff' }}>
                  <input type="checkbox" checked={pessoasSel.has(o.id)} onChange={() => togglePessoa(o.id)} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.nome}{o.arquivado && <span style={{ fontWeight: 400, color: '#94A3B8' }}> · arquivado</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: '#6B7A99' }}>{o.funcao || 'Função não informada'}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Itens */}
          <div style={{ flex: '1.4 1 340px', minWidth: 0 }}>
            <div style={TITULO}>2. O que exportar</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <button onClick={() => setSel(new Set(TODOS))} style={LINK}>Marcar tudo</button>
              <button onClick={() => setSel(new Set())} style={{ ...LINK, color: '#6B7A99', fontWeight: 400 }}>Desmarcar tudo</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {GRUPOS.map(g => {
                const ids = g.itens.map(i => i.id)
                const marcados = ids.filter(i => sel.has(i)).length
                return (
                  <div key={g.titulo} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 11px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#1E293B', cursor: 'pointer', marginBottom: g.itens.length > 1 ? 5 : 0 }}>
                      <input type="checkbox" checked={marcados === ids.length} ref={el => { if (el) el.indeterminate = marcados > 0 && marcados < ids.length }} onChange={() => toggleGrupo(ids)} />
                      {g.titulo}
                    </label>
                    {g.itens.length > 1 && g.itens.map(i => (
                      <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#475569', cursor: 'pointer', padding: '2px 0 2px 22px' }}>
                        <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} />
                        {i.label}
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: erro ? '#DC2626' : '#94A3B8', marginRight: 'auto' }}>
            {erro || (gerando ? 'Carregando dados…' : pessoasSel.size === 0 ? 'Selecione ao menos uma pessoa.' : '')}
          </span>
          <button onClick={onClose} style={{ ...BTN, background: '#fff', color: '#475569', border: '1px solid #E2E8F0', fontWeight: 400 }}>Cancelar</button>
          <button onClick={() => void exportar('excel')} disabled={bloqueado} style={{ ...BTN, background: '#16A34A', color: '#fff', opacity: bloqueado ? 0.5 : 1 }}>{gerando === 'excel' ? 'Gerando…' : 'Excel'}</button>
          <button onClick={() => void exportar('pdf')} disabled={bloqueado} style={{ ...BTN, background: '#2A4F96', color: '#fff', opacity: bloqueado ? 0.5 : 1 }}>{gerando === 'pdf' ? 'Gerando…' : 'PDF / Imprimir'}</button>
        </div>
      </div>
    </div>
  )
}
