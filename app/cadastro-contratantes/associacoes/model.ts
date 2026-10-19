// Associações entre contratantes — modelo e regras de isentar / ignorar / desisentar.
//
// Regras (GTSoft):
//  • Empresa ligada a UMA contratante que dispensa um documento → ISENTAR (sai da visão de todos).
//  • Empresa ligada a MAIS de uma e só parte delas dispensa → IGNORAR (GT0120) para quem dispensa;
//    segue obrigatório para as outras, então a empresa continua enxergando e enviando.
//  • Doc que estava ISENTO e agora precisa ser ignorado/exigido → primeiro DESISENTAR, depois ignorar.
//
// "Padrão" é o modelo neutro: lista de documentos exigidos que vale para quem não tem configuração própria.

import type { Company, Field } from '../types'

export const PADRAO_ID = '__padrao__'
/** Chave usada em `exige` quando a contratante não tem variações. */
export const SEM_VARIACAO = '_'

export type Escopo = 'empresa' | 'pessoa'

export type Variacao = { id: string; nome: string }

export type RegraDoc = {
  id: string
  codigo: string
  descricao: string
  escopo: Escopo
  /** Por variação: true = exige, false = contratante pede para tirar, null = não se aplica (vale o Padrão, se houver). */
  exige: Record<string, boolean | null>
  /** Observação por variação, vinda da tabela da ficha (ex.: "X ou contrato", "Limitar pessoas"). */
  notas?: Record<string, string>
}

export type PerfilAssoc = {
  contratanteId: string
  /** Herda a lista de documentos do Padrão (os próprios documentos sobrescrevem os de mesmo código). */
  herdaPadrao: boolean
  variacoes: Variacao[]
  documentos: RegraDoc[]
}

export type Selecao = { contratanteId: string; variacaoId: string | null }

export type Associacao = {
  id: string
  empresa: string
  cnpj: string
  /** Contratantes em que a empresa já presta serviço. */
  origem: Selecao[]
  /** Contratantes às quais a empresa está sendo associada. */
  destino: Selecao[]
  /** Chaves dos passos já feitos no GTSoft. */
  feitos: string[]
  obs: string
  status: 'em_andamento' | 'concluida'
  totalPassos: number
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  finalizadaEm: string | null
}

export type TipoPasso = 'desisentar' | 'remover_ignorado' | 'ignorar' | 'isentar' | 'adicionar'

export type Passo = {
  key: string
  tipo: TipoPasso
  docKey: string
  codigo: string
  descricao: string
  escopo: Escopo
  /** Contratante a que o passo se refere (ignorar / remover ignorado). */
  contratanteId: string | null
  motivo: string
  /** Observações das contratantes para este documento. */
  notas: string
}

export const FASES: { tipo: TipoPasso; titulo: string; dica: string; cor: string; bg: string }[] = [
  { tipo: 'desisentar', titulo: 'Desisentar', dica: 'Primeiro: tirar a isenção desses documentos no GTSoft.', cor: '#B7791F', bg: '#FFFAF0' },
  { tipo: 'remover_ignorado', titulo: 'Remover "ignorado"', dica: 'GT0120: deixar de ignorar para a contratante, porque ela agora exige o documento.', cor: '#6B46C1', bg: '#FAF5FF' },
  { tipo: 'ignorar', titulo: 'Ignorar no GT0120', dica: 'Segue obrigatório para quem exige; a contratante indicada não contabiliza.', cor: '#2B6CB0', bg: '#EBF8FF' },
  { tipo: 'isentar', titulo: 'Isentar', dica: 'Nenhuma contratante da empresa exige: sai da visão de todos.', cor: '#C53030', bg: '#FFF5F5' },
  { tipo: 'adicionar', titulo: 'Adicionar / passa a exigir', dica: 'Documento novo para a empresa por causa da nova contratante.', cor: '#2F855A', bg: '#F0FFF4' },
]

export const PRESET_NIVEIS = ['Baixo', 'Médio', 'Alto', 'Crítico']

// ── Helpers ────────────────────────────────────────────────────────────────

export function novoId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Identidade do documento: código GTSoft se houver, senão a descrição normalizada. */
export function docKey(d: Pick<RegraDoc, 'codigo' | 'descricao' | 'escopo'>) {
  const cod = d.codigo.trim()
  return `${d.escopo}:${cod ? 'c' + cod.replace(/^0+/, '') : 'd' + norm(d.descricao)}`
}

export function perfilVazio(contratanteId: string): PerfilAssoc {
  return { contratanteId, herdaPadrao: contratanteId !== PADRAO_ID, variacoes: [], documentos: [] }
}

export function exigeNa(regra: RegraDoc, variacaoId: string | null): boolean | null {
  const k = variacaoId ?? SEM_VARIACAO
  if (k in regra.exige) return regra.exige[k]
  // Sem valor para a variação → considera exigido (comportamento neutro).
  return regra.exige[SEM_VARIACAO] ?? true
}

export function notaNa(regra: RegraDoc, variacaoId: string | null) {
  return regra.notas?.[variacaoId ?? SEM_VARIACAO] ?? ''
}

export function precisaVariacao(perfil: PerfilAssoc | undefined) {
  return !!perfil && perfil.variacoes.length > 0
}

export function nomeVariacao(perfil: PerfilAssoc | undefined, variacaoId: string | null) {
  return perfil?.variacoes.find(v => v.id === variacaoId)?.nome ?? null
}

type DocEfetivo = { key: string; codigo: string; descricao: string; escopo: Escopo; exige: boolean; origem: 'padrao' | 'proprio'; nota: string }

/** Lista final de documentos de uma contratante numa variação (Padrão + próprios por cima). */
export function docsEfetivos(
  perfis: Record<string, PerfilAssoc>,
  contratanteId: string,
  variacaoId: string | null,
): Map<string, DocEfetivo> {
  const out = new Map<string, DocEfetivo>()
  const padrao = perfis[PADRAO_ID]
  const perfil = contratanteId === PADRAO_ID ? undefined : perfis[contratanteId]
  if (padrao && (!perfil || perfil.herdaPadrao)) {
    for (const d of padrao.documentos) {
      out.set(docKey(d), { key: docKey(d), codigo: d.codigo, descricao: d.descricao, escopo: d.escopo, exige: true, origem: 'padrao', nota: '' })
    }
  }
  if (perfil) {
    for (const d of perfil.documentos) {
      const exige = exigeNa(d, variacaoId)
      if (exige === null) continue // não se aplica nesta variação: fica o do Padrão, se houver
      out.set(docKey(d), { key: docKey(d), codigo: d.codigo, descricao: d.descricao, escopo: d.escopo, exige, origem: 'proprio', nota: notaNa(d, variacaoId) })
    }
  }
  return out
}

type Situacao =
  | { tipo: 'ausente' }
  | { tipo: 'obrigatorio'; por: string[] }
  | { tipo: 'isento'; dispensam: string[] }
  | { tipo: 'ignorado'; por: string[]; para: string[] }

type InfoDoc = { codigo: string; descricao: string; escopo: Escopo }

function situacoes(perfis: Record<string, PerfilAssoc>, sel: Selecao[]) {
  const info = new Map<string, InfoDoc>()
  const exigem = new Map<string, string[]>()
  const dispensam = new Map<string, string[]>()
  const notas = new Map<string, { c: string; nota: string }[]>()
  for (const s of sel) {
    for (const d of docsEfetivos(perfis, s.contratanteId, s.variacaoId).values()) {
      if (!info.has(d.key)) info.set(d.key, { codigo: d.codigo, descricao: d.descricao, escopo: d.escopo })
      if (d.nota) notas.set(d.key, [...(notas.get(d.key) ?? []), { c: s.contratanteId, nota: d.nota }])
      const m = d.exige ? exigem : dispensam
      m.set(d.key, [...(m.get(d.key) ?? []), s.contratanteId])
    }
  }
  const sit = new Map<string, Situacao>()
  for (const k of info.keys()) {
    const R = exigem.get(k) ?? []
    const N = dispensam.get(k) ?? []
    if (R.length && N.length) sit.set(k, { tipo: 'ignorado', por: R, para: N })
    else if (R.length) sit.set(k, { tipo: 'obrigatorio', por: R })
    else if (N.length) sit.set(k, { tipo: 'isento', dispensam: N })
  }
  return { info, sit, notas }
}

/** Origem + destino; se a mesma contratante aparece nos dois, vale a variação do destino (mudança de nível). */
export function selecaoFinal(origem: Selecao[], destino: Selecao[]) {
  const m = new Map<string, Selecao>()
  for (const s of origem) m.set(s.contratanteId, s)
  for (const s of destino) m.set(s.contratanteId, s)
  return [...m.values()]
}

export type ResumoContratante = {
  contratanteId: string
  variacaoId: string | null
  ignorados: number
  passaEnxergar: number
  exigeNovos: number
}

export type Plano = {
  passos: Passo[]
  resumo: ResumoContratante[]
  obrigatorios: number
  isentos: number
  ignorados: number
}

export function calcularPlano(
  perfis: Record<string, PerfilAssoc>,
  origem: Selecao[],
  destino: Selecao[],
  nome: (id: string) => string,
): Plano {
  const final = selecaoFinal(origem, destino)
  const antes = situacoes(perfis, origem)
  const depois = situacoes(perfis, final)
  const temOrigem = origem.length > 0
  const passos: Passo[] = []
  const lista = (ids: string[]) => ids.map(nome).join(', ')

  const add = (tipo: TipoPasso, k: string, inf: InfoDoc, contratanteId: string | null, motivo: string) =>
    passos.push({
      key: `${tipo}|${k}|${contratanteId ?? ''}`, tipo, docKey: k, ...inf, contratanteId, motivo,
      notas: [...(depois.notas.get(k) ?? []), ...(antes.notas.get(k) ?? [])]
        .filter((n, i, arr) => arr.findIndex(x => x.c === n.c && x.nota === n.nota) === i)
        .map(n => `${nome(n.c)}: ${n.nota}`).join(' · '),
    })

  const keys = new Set([...antes.info.keys(), ...depois.info.keys()])
  for (const k of keys) {
    const inf = depois.info.get(k) ?? antes.info.get(k)!
    const P = antes.sit.get(k) ?? { tipo: 'ausente' as const }
    const X = depois.sit.get(k) ?? { tipo: 'ausente' as const }

    if (X.tipo === 'isento') {
      if (P.tipo !== 'isento') add('isentar', k, inf, null, X.dispensam.length > 1 ? `Nenhuma contratante exige (${lista(X.dispensam)} dispensam)` : `Única contratante (${lista(X.dispensam)}) dispensa`)
      continue
    }
    if (X.tipo === 'ausente') continue

    if (P.tipo === 'isento') {
      add('desisentar', k, inf, null, `Estava isento por ${lista(P.dispensam)}; agora ${lista(X.por)} exige`)
    } else if (P.tipo === 'ausente' && temOrigem) {
      add('adicionar', k, inf, null, `Passa a ser exigido por ${lista(X.por)}`)
    }

    const paraAntes = P.tipo === 'ignorado' ? P.para : []
    const paraDepois = X.tipo === 'ignorado' ? X.para : []
    for (const c of paraDepois) {
      if (!paraAntes.includes(c)) add('ignorar', k, inf, c, `${lista(X.por)} exige; ${nome(c)} dispensa`)
    }
    const finais = new Set(final.map(s => s.contratanteId))
    for (const c of paraAntes) {
      if (!paraDepois.includes(c) && finais.has(c)) add('remover_ignorado', k, inf, c, `${nome(c)} passa a exigir`)
    }
  }

  const ordem = FASES.map(f => f.tipo)
  passos.sort((a, b) =>
    ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo)
    || (a.escopo === b.escopo ? 0 : a.escopo === 'empresa' ? -1 : 1)
    || (Number(a.codigo) || 1e9) - (Number(b.codigo) || 1e9)
    || a.descricao.localeCompare(b.descricao, 'pt-BR'))

  const exigidoPor = (k: string) => {
    const s = depois.sit.get(k)
    return s && (s.tipo === 'obrigatorio' || s.tipo === 'ignorado') ? s.por : []
  }
  const resumo: ResumoContratante[] = final.map(s => ({
    contratanteId: s.contratanteId,
    variacaoId: s.variacaoId,
    ignorados: passos.filter(p => p.tipo === 'ignorar' && p.contratanteId === s.contratanteId).length,
    passaEnxergar: passos.filter(p => p.tipo === 'desisentar').length,
    exigeNovos: passos.filter(p => p.tipo === 'adicionar' && exigidoPor(p.docKey).includes(s.contratanteId)).length,
  }))

  const sits = [...depois.sit.values()]
  return {
    passos,
    resumo,
    obrigatorios: sits.filter(x => x.tipo === 'obrigatorio').length,
    isentos: sits.filter(x => x.tipo === 'isento').length,
    ignorados: sits.filter(x => x.tipo === 'ignorado').length,
  }
}

// ── Importar da tabela da ficha ─────────────────────────────────────────────

export type TabelaFicha = Extract<Field, { type: 'table' }>

export function tabelasDaFicha(c: Company | undefined): TabelaFicha[] {
  return (c?.fields ?? []).filter((f): f is TabelaFicha => f.type === 'table')
}

/**
 * Lê uma tabela da ficha (ex.: Salton "Cód | Descrição | CRITICO | ALTO | MEDIO | BAIXO").
 * Colunas além de Cód/Descrição viram variações; "X" (ou qualquer texto) = exige, vazio = dispensa.
 * Sem colunas extras → todos os documentos exigidos, sem variação.
 */
export function importarTabela(t: TabelaFicha, escopo: Escopo, variacoesAtuais: Variacao[]): { variacoes: Variacao[]; documentos: RegraDoc[] } {
  const hs = t.headers.map(h => norm(h))
  let iCod = hs.findIndex(h => /^(cod|codigo|cód)/.test(h))
  let iDesc = hs.findIndex(h => /^(desc|documento|nome)/.test(h))
  if (iCod < 0 && iDesc < 0) { iCod = 0; iDesc = 1 } else if (iDesc < 0) iDesc = iCod === 0 ? 1 : 0
  const ignorar = /periodicidade|obs|observa|^nova col/
  const colsVar = t.headers.map((h, i) => ({ h: h.trim(), i }))
    .filter(c => c.i !== iCod && c.i !== iDesc && c.h && !ignorar.test(norm(c.h)) && !/^col \d+$/.test(norm(c.h)))
    // coluna sem nenhum valor (ex.: "Nova col" vazia) não é variação
    .filter(c => t.rows.some(r => (r[c.i] ?? '').trim()))

  const variacoes = [...variacoesAtuais]
  const idPorCol = new Map<number, string>()
  for (const c of colsVar) {
    const nomeBonito = c.h.charAt(0).toUpperCase() + c.h.slice(1).toLowerCase()
    const existente = variacoes.find(v => norm(v.nome) === norm(c.h))
    const id = existente?.id ?? novoId()
    if (!existente) variacoes.push({ id, nome: nomeBonito.replace('Critico', 'Crítico').replace('Medio', 'Médio') })
    idPorCol.set(c.i, id)
  }

  const documentos: RegraDoc[] = t.rows
    .map(r => ({ codigo: iCod >= 0 ? (r[iCod] ?? '').trim() : '', descricao: (r[iDesc] ?? '').trim(), r }))
    .filter(x => x.codigo || x.descricao)
    .map(x => {
      const exige: Record<string, boolean | null> = {}
      const notas: Record<string, string> = {}
      if (colsVar.length === 0) exige[SEM_VARIACAO] = true
      for (const c of colsVar) {
        const vid = idPorCol.get(c.i)!
        const cel = lerCelula(x.r[c.i] ?? '')
        exige[vid] = cel.exige
        if (cel.nota) notas[vid] = cel.nota
      }
      const doc: RegraDoc = { id: novoId(), codigo: x.codigo, descricao: x.descricao, escopo, exige }
      if (Object.keys(notas).length) doc.notas = notas
      return doc
    })
  return { variacoes, documentos }
}

/**
 * Interpreta uma célula da tabela da ficha:
 *  "X" → exige · vazio, "Isentar", "Ignorar", "Não se aplica", "Não cadastrar…" → tira
 *  outro texto ("X ou contrato", "Limitar pessoas", "Avaliação") → exige, guardando o texto como observação.
 */
export function lerCelula(valor: string): { exige: boolean; nota: string } {
  const v = valor.trim()
  if (!v) return { exige: false, nota: '' }
  if (/^x$/i.test(v)) return { exige: true, nota: '' }
  const n = norm(v)
  if (/isent|ignor|nao se aplica|^nao /.test(n)) return { exige: false, nota: /^(isentar|ignorar)$/.test(n) ? '' : v }
  return { exige: true, nota: v }
}
