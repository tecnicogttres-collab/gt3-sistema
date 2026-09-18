'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUser, displayName } from '../components/UserContext'

// ─── Design tokens ──────────────────────────────────────────────────────────

const PRIMARY      = '#2A4F96'
const PRIMARY_DARK = '#1D3A71'
const ACCENT       = '#D1AE6E'
const BG           = '#F4F6FA'
const BORDER       = '#DFE4EE'
const TEXT         = '#1F2733'
const MUTED        = '#5D6A7D'
const OK           = '#1F7A4D'
const OK_BG        = '#E8F5EE'
const FALTA        = '#B3261E'
const FALTA_BG     = '#FDECEA'
const NEUTRO       = '#7A6A3F'
const NEUTRO_BG    = '#FBF3E2'

const PDF_LIB_URL    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

// ─── pdf.js (carregado via CDN em runtime — ver useEffect mais abaixo) ─────

type PdfTextItem = { str: string; transform: number[] }
type PdfTextContent = { items: PdfTextItem[] }
type PdfPageProxy = { getTextContent: () => Promise<PdfTextContent> }
type PdfDocumentProxy = { numPages: number; getPage: (n: number) => Promise<PdfPageProxy> }
type PdfJsLib = {
  getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfDocumentProxy> }
  GlobalWorkerOptions: { workerSrc: string }
}

declare global {
  interface Window { pdfjsLib?: PdfJsLib }
}

function novoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return String(Date.now() + Math.random())
}

// ─── Types ──────────────────────────────────────────────────────────────────

type TipoDoc = 'guia' | 'relatorio'

type DocEntry = {
  id: string
  arquivo: string
  lendo: boolean
  texto: string
  vazias: number[]
  paginas: number
  tipo: TipoDoc
  manual: boolean
  pontos: { guia: number; relatorio: number }
}

type PessoaRelatorio = {
  pessoa: string
  cpf: string
  atividade: string
  vinculo: string
  cadastro: string
  admissao: string
  dataCad: Date | null
  dataAdmissao: Date | null
  repeticoes: number
}

type PessoaGuia = { cpf: string; nome: string; estab: string; tomador: string }

type Guia = {
  pessoas: Record<string, PessoaGuia>
  competencia: string
  razao: string
  cnpj: string
}

type Situacao = 'falta' | 'ok' | 'fora'

type Resultado = {
  dados: PessoaRelatorio
  situacao: Situacao
  motivo: string
  campo: string
  achado: PessoaGuia | null
  nota: string
  divergente: boolean
  admissaoPosterior: boolean
}

type Analise = {
  guia: Guia
  competencia: string
  cnpjs: string[]
  paginasVazias: DocEntry[]
  resultado: Resultado[]
}

type Filtro = 'falta' | 'ok' | 'fora' | 'todos'

// ─── Utilidades de texto ────────────────────────────────────────────────────

function semAcento(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}
function normNome(s: string): string {
  return semAcento(s).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim()
}
const PALAVRAS_IGNORADAS = ['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']
function chaveNome(s: string): string {
  return normNome(s).split(' ').filter(p => PALAVRAS_IGNORADAS.indexOf(p) < 0).join(' ')
}
function soDigitos(s: string): string {
  return (s || '').replace(/\D/g, '')
}
function normCpf(s: string): string {
  let d = soDigitos(s)
  if (!d) return ''
  if (d.length > 11) d = d.slice(-11)
  return d.padStart(11, '0')
}
function fmtCpf(c: string): string {
  return c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : (c || '')
}
function fmtCpfMasc(c: string): string {
  return c && c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : (c ? fmtCpf(c) : '')
}
function similar(a: string, b: string): number {
  a = chaveNome(a); b = chaveNome(b)
  if (!a || !b) return 0
  if (a === b) return 1
  const m = a.length, n = b.length
  let prev: number[] = []
  const cur: number[] = []
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur.slice()
  }
  return 1 - prev[n] / Math.max(m, n)
}

// ─── Leitura de PDF ──────────────────────────────────────────────────────────

function lerPdf(file: File): Promise<{ texto: string; arquivo: string; paginas: number; vazias: number[] }> {
  const pdfjsLib = window.pdfjsLib as PdfJsLib
  return file.arrayBuffer().then(buf => pdfjsLib.getDocument({ data: buf }).promise).then((pdf: PdfDocumentProxy) => {
    const linhas: string[] = [], seq: string[] = [], vazias: number[] = []
    function passo(n: number): Promise<void> {
      if (n > pdf.numPages) return Promise.resolve()
      return pdf.getPage(n).then((page: PdfPageProxy) => page.getTextContent()).then((tc: PdfTextContent) => {
        if (!tc.items.length) vazias.push(n)
        const mapa: Record<number, { x: number; s: string }[]> = {}
        tc.items.forEach((it: PdfTextItem) => {
          const y = Math.round(it.transform[5])
          if (!mapa[y]) mapa[y] = []
          mapa[y].push({ x: it.transform[4], s: it.str })
          seq.push(it.str)
        })
        Object.keys(mapa).map(Number).sort((a, b) => b - a).forEach(y => {
          const t = mapa[y].sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim()
          if (t) linhas.push(t)
        })
        return passo(n + 1)
      })
    }
    return passo(1).then(() => ({
      texto: linhas.join('\n') + '\n' + seq.join(' ').replace(/\s+/g, ' '),
      arquivo: file.name, paginas: pdf.numPages, vazias,
    }))
  })
}

/** Identifica, pelo conteúdo, se o PDF é a guia do FGTS ou o relatório do Portal. */
function pontuar(t: string): { guia: number; relatorio: number } {
  let g = 0, r = 0
  if (/Detalhe da Guia/i.test(t)) g += 4
  if (/Rela[çc][aã]o de Trabalhadores/i.test(t)) g += 3
  if (/Nome Trabalhador/i.test(t)) g += 3
  if (/Comp\.?\s*Apura[çc][aã]o/i.test(t)) g += 2
  if (/Total do Tomador|Total FGTS|Total do Estabelecimento/i.test(t)) g += 2
  if ((t.match(/\d{14,22}\s+\d{3}\.\d{3}\.\d{3}-\d{2}/g) || []).length > 3) g += 4

  if (/CONFER[EÊ]NCIA GUIA/i.test(t)) r += 4
  if (/GT1000|INSOFT/i.test(t)) r += 3
  if (/Empresa\s+Pessoa/i.test(t)) r += 4
  if (/Admiss[aã]o/i.test(t)) r += 3
  if (/V[ií]nculo/i.test(t)) r += 2
  if (/\bEFETIVO\b/.test(t)) r += 2
  return { guia: g, relatorio: r }
}
function classificarDoc(doc: DocEntry): DocEntry {
  const pontos = pontuar(doc.texto)
  return { ...doc, pontos, tipo: pontos.guia >= pontos.relatorio ? 'guia' : 'relatorio' }
}
/** Se todos os documentos caírem no mesmo lado, o de menor margem migra para o outro. */
function equilibrarDocs(docs: DocEntry[]): DocEntry[] {
  if (docs.length < 2 || docs.some(d => d.manual)) return docs
  const rel = docs.filter(d => d.tipo === 'relatorio')
  const gui = docs.filter(d => d.tipo === 'guia')
  const margem = (d: DocEntry) => d.pontos.guia - d.pontos.relatorio
  let flipId: string | null = null, novoTipo: TipoDoc | null = null
  if (!rel.length && gui.length) {
    const alvo = [...gui].sort((a, b) => margem(a) - margem(b))[0]
    flipId = alvo.id; novoTipo = 'relatorio'
  } else if (!gui.length && rel.length) {
    const alvo = [...rel].sort((a, b) => margem(b) - margem(a))[0]
    flipId = alvo.id; novoTipo = 'guia'
  }
  if (!flipId) return docs
  return docs.map(d => d.id === flipId ? { ...d, tipo: novoTipo! } : d)
}

// ─── Relatório do Portal GT3 (documento A) ─────────────────────────────────

const VINCULOS = ['EFETIVO', 'TEMPORARIO', 'ASSOCIADO', 'PJ', 'AUTONOMO', 'APRENDIZ', 'ESTAGIARIO', 'SOCIO', 'DIRETOR', 'COOPERADO']

function paraData(s: string, fmt: 'mdy' | 'dmy'): Date | null {
  if (!s) return null
  const p = s.split('/').map(x => parseInt(x, 10))
  if (p.length < 3 || isNaN(p[0]) || isNaN(p[1]) || isNaN(p[2])) return null
  let dia: number, mes: number
  if (fmt === 'dmy') { dia = p[0]; mes = p[1] } else { mes = p[0]; dia = p[1] }
  if (mes > 12) { const t = mes; mes = dia; dia = t }
  const ano = p[2] < 100 ? 2000 + p[2] : p[2]
  return new Date(ano, mes - 1, dia)
}
function dataBr(d: Date | null): string {
  if (!d) return ''
  const z = (n: number) => String(n).padStart(2, '0')
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`
}

function lerRelatorio(texto: string, formato: 'auto' | 'mdy' | 'dmy'): PessoaRelatorio[] {
  const linhas = texto.replace(/\t/g, ' ').split(/\n+/)
  const brutos: { antes: string; cpf: string; meio: string; cadastro: string; admissao: string }[] = []
  const re = /^(.*?)\s(\d{8,11})\s+(.*?)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+(\d{1,2}\/\d{1,2}\/\d{2,4}))?\s*$/

  linhas.forEach(l0 => {
    const l = l0.replace(/\s+/g, ' ').trim()
    if (!l || /Empresa\s+Pessoa/i.test(l)) return
    const m = re.exec(l)
    if (!m) return
    const antes = m[1].trim()
    if (!/[A-Za-zÀ-ÿ]{3}/.test(antes)) return
    brutos.push({ antes, cpf: normCpf(m[2]), meio: (m[3] || '').trim(), cadastro: m[4], admissao: m[5] || '' })
  })

  let prefixo = ''
  if (brutos.length > 1) {
    prefixo = brutos[0].antes
    brutos.forEach(b => {
      let i = 0
      while (i < prefixo.length && i < b.antes.length && prefixo[i] === b.antes[i]) i++
      prefixo = prefixo.slice(0, i)
    })
    prefixo = prefixo.replace(/\S*$/, '').trim()
  }

  let fmt = formato
  if (fmt === 'auto') {
    fmt = 'mdy'
    brutos.forEach(b => { if (parseInt(b.cadastro.split('/')[0], 10) > 12) fmt = 'dmy' })
  }

  const pessoas: PessoaRelatorio[] = brutos.map(b => {
    const pessoa = prefixo && b.antes.indexOf(prefixo) === 0 ? b.antes.slice(prefixo.length).trim() : b.antes
    let vinculo = '', atividade = b.meio
    const tokens = b.meio.split(' ')
    const ultimo = semAcento(tokens[tokens.length - 1] || '').toUpperCase()
    if (VINCULOS.indexOf(ultimo) >= 0) {
      vinculo = tokens.pop() as string
      atividade = tokens.join(' ').trim()
    }
    return {
      pessoa, cpf: b.cpf, atividade, vinculo, cadastro: b.cadastro, admissao: b.admissao,
      dataCad: paraData(b.cadastro, fmt as 'mdy' | 'dmy'),
      dataAdmissao: paraData(b.admissao, fmt as 'mdy' | 'dmy'),
      repeticoes: 1,
    }
  })

  /* o relatório repete a mesma pessoa em várias linhas: conta uma vez só */
  const vistos: Record<string, PessoaRelatorio> = {}
  const unicos: PessoaRelatorio[] = []
  pessoas.forEach(p => {
    const chave = p.cpf || chaveNome(p.pessoa)
    const j = vistos[chave]
    if (j) {
      j.repeticoes++
      if (!j.atividade && p.atividade) j.atividade = p.atividade
      if (!j.vinculo && p.vinculo) j.vinculo = p.vinculo
      if (p.dataCad && (!j.dataCad || p.dataCad < j.dataCad)) { j.dataCad = p.dataCad; j.cadastro = p.cadastro }
      if (!j.dataAdmissao && p.dataAdmissao) { j.dataAdmissao = p.dataAdmissao; j.admissao = p.admissao }
      return
    }
    vistos[chave] = p
    unicos.push(p)
  })
  return unicos
}

// ─── Detalhe da guia FGTS (documento B) ────────────────────────────────────

const RE_GUIA = /Estabelecimento:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})|Tomador:\s*(\d[\d.\/-]{9,}|Sem Tomador)|([A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ'’.\- ]{2,70}?)\s+(\d{14,22})\s+(\d{3}\.\d{3}\.\d{3}-\d{2})/g

function lerGuia(texto: string): Guia {
  const pessoas: Record<string, PessoaGuia> = {}
  let estab = '', tomador = ''
  RE_GUIA.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RE_GUIA.exec(texto)) !== null) {
    if (m[1]) { estab = m[1]; continue }
    if (m[2]) { tomador = m[2]; continue }
    const cpf = normCpf(m[5])
    const nome = (m[3] || '').replace(/\s+/g, ' ').trim()
    if (!pessoas[cpf]) pessoas[cpf] = { cpf, nome, estab, tomador }
  }
  const reCpf = /\d{3}\.\d{3}\.\d{3}-\d{2}/g
  let c: RegExpExecArray | null
  while ((c = reCpf.exec(texto)) !== null) {
    const k = normCpf(c[0])
    if (!pessoas[k]) pessoas[k] = { cpf: k, nome: '', estab, tomador: '' }
  }

  let comp = ''
  const contagem: Record<string, number> = {}
  const reComp = /(?:^|[^\d\/])(\d{2})\/(\d{4})(?![\d\/])/g
  let x: RegExpExecArray | null
  while ((x = reComp.exec(texto)) !== null) {
    const ch = x[1] + '/' + x[2]
    contagem[ch] = (contagem[ch] || 0) + 1
  }
  Object.keys(contagem).forEach(k => { if (!comp || contagem[k] > contagem[comp]) comp = k })

  const cnpjM = /Estabelecimento:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/.exec(texto)
  return { pessoas, competencia: comp, razao: acharRazao(texto), cnpj: cnpjM ? cnpjM[1] : '' }
}

/** O rótulo nem sempre fica junto do valor no texto extraído: valida e, se não
    servir, procura o nome empresarial que mais se repete no documento. */
function acharRazao(texto: string): string {
  const valido = (v: string) => /^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,'\-&\/]{3,}$/.test(v) && /[A-ZÀ-Ú]{3}/.test(v)
  const m = /Nome Empregador:\s*([^\n]{4,80}?)(?=\s{2,}|\s+(?:Qtd|Total|Origem|Vencimento|Data|Emitida)\b|\n|$)/i.exec(texto)
  if (m && valido(m[1].replace(/\s+/g, ' ').trim())) return m[1].replace(/\s+/g, ' ').trim()

  const re = /(?:^|[^A-ZÀ-Úa-zà-ÿ])([A-ZÀ-Ú][A-ZÀ-Ú0-9 .,'\-&\/]{3,60}?\s(?:LTDA|EIRELI|S\/A|S\.A\.|ME|EPP|MEI|SA))(?![A-ZÀ-Úa-zà-ÿ])/g
  const cont: Record<string, number> = {}
  let x: RegExpExecArray | null, melhor = ''
  while ((x = re.exec(texto)) !== null) {
    const k = x[1].replace(/\s+/g, ' ').trim()
    cont[k] = (cont[k] || 0) + 1
  }
  Object.keys(cont).forEach(k => { if (!melhor || cont[k] > cont[melhor]) melhor = k })
  return melhor
}

// ─── Comparação ─────────────────────────────────────────────────────────────

const EXC_VINCULO = ['TEMPORARIO', 'ASSOCIADO', 'PJ']
const EXC_CARGO = ['ESTAGIARIO', 'SOCIO', 'DIRETOR']

function ultimoDia(comp: string): Date | null {
  const p = (comp || '').split('/')
  if (p.length !== 2) return null
  return new Date(parseInt(p[1], 10), parseInt(p[0], 10), 0, 23, 59, 59)
}

function comparar(
  listaA: PessoaRelatorio[], guia: Guia,
  opcoes: { competencia: string; data: boolean; vinculo: boolean; cargo: boolean },
): Resultado[] {
  const porCpf = guia.pessoas
  const porNome: Record<string, PessoaGuia> = {}
  Object.keys(porCpf).forEach(k => { if (porCpf[k].nome) porNome[chaveNome(porCpf[k].nome)] = porCpf[k] })

  const limite = opcoes.data ? ultimoDia(opcoes.competencia) : null
  const estabs: Record<string, number> = {}
  let estabPrincipal = ''
  Object.keys(porCpf).forEach(k => { const e = porCpf[k].estab; if (e) estabs[e] = (estabs[e] || 0) + 1 })
  Object.keys(estabs).forEach(e => { if (!estabPrincipal || estabs[e] > estabs[estabPrincipal]) estabPrincipal = e })

  return listaA.map(p => {
    const admissaoPosterior = !!(p.dataAdmissao && p.dataCad && p.dataAdmissao.getTime() > p.dataCad.getTime())
    const r: Resultado = { dados: p, situacao: 'ok', motivo: '', campo: '', achado: null, nota: '', divergente: false, admissaoPosterior }
    const vin = semAcento(p.vinculo).toUpperCase()
    const car = semAcento(p.atividade).toUpperCase()

    let foraSituacao = false
    if (opcoes.vinculo && EXC_VINCULO.some(v => vin.indexOf(v) >= 0)) {
      foraSituacao = true; r.campo = 'vinculo'
      r.motivo = 'vínculo ' + (p.vinculo || '').toLowerCase()
    } else if (opcoes.cargo && EXC_CARGO.some(cg => car.indexOf(cg) >= 0)) {
      foraSituacao = true; r.campo = 'atividade'
      r.motivo = 'cargo ' + (p.atividade || '').toLowerCase()
    } else if (limite && p.dataCad && p.dataCad > limite) {
      foraSituacao = true; r.campo = 'cadastro'
      r.motivo = 'cadastro em ' + dataBr(p.dataCad) + ', posterior à competência ' + opcoes.competencia
    }

    let achado = (p.cpf && porCpf[p.cpf]) || porNome[chaveNome(p.pessoa)] || null

    if (!achado && p.pessoa) {
      let melhor: PessoaGuia | null = null, score = 0
      Object.keys(porCpf).forEach(k => {
        if (!porCpf[k].nome) return
        const s = similar(p.pessoa, porCpf[k].nome)
        if (s > score) { score = s; melhor = porCpf[k] }
      })
      if (melhor && score >= 0.86) {
        achado = melhor
        r.nota = 'correspondência aproximada com "' + (melhor as PessoaGuia).nome + '" (CPF diferente — conferir)'
      }
    } else if (achado && achado.nome && chaveNome(achado.nome) !== chaveNome(p.pessoa)) {
      r.nota = 'mesmo CPF, grafia diferente na guia: "' + achado.nome + '"'
    }

    r.achado = achado
    r.situacao = foraSituacao ? 'fora' : (achado ? 'ok' : 'falta')
    if (achado && achado.estab && estabPrincipal && achado.estab !== estabPrincipal) {
      r.nota = (r.nota ? r.nota + ' · ' : '') + 'CNPJ divergente: ' + achado.estab
      r.divergente = true
    }
    return r
  })
}

// ─── Modelo da observação ───────────────────────────────────────────────────

const MODELO_PADRAO = [
  '{#alerta}[CONFERIR ANTES DE ENVIAR — {alerta}. Apague esta linha depois da conferência.]',
  '{/alerta}{data} {hora} - {#faltantes}Por favor, verificar que o(s) seguinte(s) colaborador(es) cadastrado(s) no Portal não consta(m) no detalhe da guia emitida:',
  '{faltantes}{/faltantes}{#sem_faltantes}todos os colaboradores cadastrados no Portal constam no detalhe da guia emitida da competência {competencia}.{/sem_faltantes}',
  '{#divergentes}',
  'O(s) seguinte(s) colaborador(es) consta(m) em CNPJ diferente dos demais:',
  '{divergentes}{/divergentes}',
  '',
  '{usuario}',
].join('\n')

/** Nome usado para assinar a observação: primeiro nome, ou "Primeiro Último" quando esse
 *  primeiro nome é de mais de uma pessoa no sistema — aí o sobrenome desambigua quem gerou. */
function nomeParaAssinatura(nomeCompleto: string, todosNomes: string[]): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean)
  const primeiro = partes[0] ?? nomeCompleto.trim()
  if (partes.length < 2) return primeiro
  const repetido = todosNomes.filter(n => (n.trim().split(/\s+/)[0] ?? '').toLowerCase() === primeiro.toLowerCase()).length > 1
  return repetido ? `${primeiro} ${partes[partes.length - 1]}` : primeiro
}

const ITEM_FALTA_PADRAO = '{nome}'
const ITEM_DESC_PADRAO = '   - {nome} — {motivo}'
const ITEM_DIV_PADRAO = '{nome} — {cnpj_pessoa}{tomador}'

const LS_MODELO = 'gt3_comparativo_guia_modelo'
const LS_IT_FALTA = 'gt3_comparativo_guia_it_falta'
const LS_IT_DESC = 'gt3_comparativo_guia_it_desc'
const LS_IT_DIV = 'gt3_comparativo_guia_it_div'

function guardar(chave: string, valor: string): boolean {
  try { localStorage.setItem(chave, valor); return true } catch { return false }
}
function recuperar(chave: string): string | null {
  try { return localStorage.getItem(chave) } catch { return null }
}

type CamposItem = Record<string, string>
function preencherItem(formato: string, campos: CamposItem): string {
  return formato.replace(/\{(\w+)\}/g, (_todo, chave) => campos[chave] ?? '')
}
function preencherModelo(modelo: string, dados: Record<string, string | number | boolean>): string {
  let t = modelo
  const secoes = ['alerta', 'faltantes', 'sem_faltantes', 'desconsiderados', 'divergentes', 'varios_cnpj']
  secoes.forEach(s => {
    const re = new RegExp('\\{#' + s + '\\}([\\s\\S]*?)\\{\\/' + s + '\\}', 'g')
    t = t.replace(re, (_m, dentro) => (dados['cond_' + s] ? dentro : ''))
  })
  t = t.replace(/\{(\w+)\}/g, (_todo, chave) => {
    const v = dados[chave]
    return v === undefined || v === null ? '' : String(v)
  })
  return t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim()
}

// ─── Estilos compartilhados ─────────────────────────────────────────────────

const painelStyle: React.CSSProperties = {
  background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 18,
}
const h2Style: React.CSSProperties = { margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: PRIMARY }
const numBadge: React.CSSProperties = {
  display: 'inline-block', width: 22, height: 22, lineHeight: '22px', textAlign: 'center',
  background: PRIMARY, color: '#fff', borderRadius: '50%', fontSize: 12, marginRight: 8,
}
const botaoStyle: React.CSSProperties = {
  background: PRIMARY, color: '#fff', border: 0, borderRadius: 6, padding: '11px 26px',
  fontSize: 15, fontWeight: 600, cursor: 'pointer',
}
const botaoSecStyle: React.CSSProperties = {
  background: '#fff', color: PRIMARY, border: `1px solid ${PRIMARY}`, fontWeight: 500,
  padding: '8px 16px', fontSize: 13.5, borderRadius: 6, cursor: 'pointer',
}
const inputStyle: React.CSSProperties = { padding: '7px 9px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 14 }

function Cartao({ n, rotulo, cor, destaque }: { n: number; rotulo: string; cor?: string; destaque?: boolean }) {
  return (
    <div style={{
      flex: '1 1 150px', border: destaque ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`, borderRadius: 8,
      padding: '12px 14px', background: destaque ? NEUTRO_BG : '#fff',
    }}>
      <b style={{ display: 'block', fontSize: 24, lineHeight: 1.2, color: cor || TEXT }}>{n}</b>
      <small style={{ color: destaque ? NEUTRO : MUTED, fontSize: 12.5, fontWeight: destaque ? 600 : 400 }}>{rotulo}</small>
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function ComparativoGuiaClient() {
  const { profile } = useUser()
  const [todosNomes, setTodosNomes] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/observacoes/usuarios').then(r => r.ok ? r.json() : []).then((data: { nome: string | null }[]) => {
      setTodosNomes((Array.isArray(data) ? data : []).map(u => u.nome).filter((n): n is string => !!n))
    }).catch(() => {})
  }, [])

  const meuNomeAssinatura = useMemo(
    () => nomeParaAssinatura(displayName(profile, ''), todosNomes),
    [profile, todosNomes]
  )

  const [pdfReady, setPdfReady] = useState(false)
  const [pdfError, setPdfError] = useState(false)

  const [docs, setDocs] = useState<DocEntry[]>([])
  const [dropAtivo, setDropAtivo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fmt, setFmt] = useState<'auto' | 'mdy' | 'dmy'>('auto')
  const [rData, setRData] = useState(true)
  const [rVinculo, setRVinculo] = useState(true)
  const [rCargo, setRCargo] = useState(true)

  const [modalCfgAberto, setModalCfgAberto] = useState(false)
  const [modelo, setModelo] = useState(() => recuperar(LS_MODELO) || MODELO_PADRAO)
  const [itFalta, setItFalta] = useState(() => recuperar(LS_IT_FALTA) || ITEM_FALTA_PADRAO)
  const [itDesc, setItDesc] = useState(() => recuperar(LS_IT_DESC) || ITEM_DESC_PADRAO)
  const [itDiv, setItDiv] = useState(() => recuperar(LS_IT_DIV) || ITEM_DIV_PADRAO)
  const [statusCfg, setStatusCfg] = useState('')

  const [analise, setAnalise] = useState<Analise | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('falta')
  const [copiado, setCopiado] = useState(false)
  // Oculta parte do CPF por padrão — na tela, na observação e no CSV.
  const [ocultarCpf, setOcultarCpf] = useState(true)
  const cpfExibir = useCallback((c: string) => (ocultarCpf ? fmtCpfMasc(c) : fmtCpf(c)), [ocultarCpf])

  // Carrega o leitor de PDF (pdf.js via CDN)
  useEffect(() => {
    if (typeof window === 'undefined') return
    function marcarPronto() {
      const lib = window.pdfjsLib
      if (lib) { lib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL; setPdfReady(true) }
      else setPdfError(true)
    }
    if (window.pdfjsLib) {
      queueMicrotask(marcarPronto)
      return
    }
    let script = document.getElementById('gt3-pdfjs-lib') as HTMLScriptElement | null
    const onError = () => setPdfError(true)
    if (!script) {
      script = document.createElement('script')
      script.id = 'gt3-pdfjs-lib'
      script.src = PDF_LIB_URL
      script.async = true
      document.body.appendChild(script)
    }
    script.addEventListener('load', marcarPronto)
    script.addEventListener('error', onError)
    return () => {
      script?.removeEventListener('load', marcarPronto)
      script?.removeEventListener('error', onError)
    }
  }, [])

  // ── Documentos ────────────────────────────────────────────────────────

  const receber = useCallback((lista: File[]) => {
    const pdfs = lista.filter(f => /\.pdf$/i.test(f.name))
    pdfs.forEach(f => {
      if (!pdfReady) {
        alert('O leitor de PDF não está disponível. Recarregue a página com internet.')
        return
      }
      const id = novoId()
      const novo: DocEntry = {
        id, arquivo: f.name, lendo: true, texto: '', vazias: [], paginas: 0,
        tipo: 'guia', manual: false, pontos: { guia: 0, relatorio: 0 },
      }
      setDocs(prev => [...prev, novo])
      lerPdf(f).then(r => {
        setDocs(prev => {
          const next = prev.map(d => d.id === id
            ? classificarDoc({ ...d, texto: r.texto, vazias: r.vazias, paginas: r.paginas, lendo: false })
            : d)
          return equilibrarDocs(next)
        })
      }).catch(err => {
        setDocs(prev => prev.map(d => d.id === id ? { ...d, lendo: false, tipo: 'guia' } : d))
        alert('Não consegui ler ' + f.name + ': ' + (err?.message || err))
      })
    })
  }, [pdfReady])

  function alterarTipo(id: string, tipo: TipoDoc) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, tipo, manual: true } : d))
  }
  function removerDoc(id: string) {
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  function novaAnalise() {
    setDocs([])
    setAnalise(null)
    setFiltro('falta')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Processamento ─────────────────────────────────────────────────────

  function processar() {
    if (docs.some(d => d.lendo)) {
      alert('Ainda estou lendo um dos PDFs. Tente de novo em instantes.')
      return
    }
    let textoRel = '', textoGuia = ''
    const paginasVazias: DocEntry[] = []
    docs.forEach(d => {
      if (d.tipo === 'relatorio') textoRel += '\n' + d.texto; else textoGuia += '\n' + d.texto
      if (d.vazias && d.vazias.length) paginasVazias.push(d)
    })

    if (!textoRel.trim() || !textoGuia.trim()) {
      alert('Faltou um dos documentos: preciso do relatório do Portal e do detalhe da guia.\n\n' +
        'Se os dois PDFs já estão na lista, confira o tipo indicado ao lado de cada um.')
      return
    }

    const guia = lerGuia(textoGuia)
    const competencia = guia.competencia
    if (!competencia) {
      alert('Não consegui identificar a competência no detalhe da guia. ' +
        'A regra de cadastro posterior à competência ficará desligada nesta análise.')
    }

    const lista = lerRelatorio(textoRel, fmt)
    if (!lista.length) {
      alert('Nenhuma pessoa foi reconhecida no relatório do Portal. Confira se o documento marcado ' +
        'como "relatório do Portal" é o certo.')
      return
    }

    let resultado = comparar(lista, guia, { competencia, data: rData, vinculo: rVinculo, cargo: rCargo })
    const ordem: Record<Situacao, number> = { falta: 0, ok: 1, fora: 2 }
    resultado = [...resultado].sort((a, b) =>
      // admissão posterior ao cadastro sempre no topo, independente da situação
      (Number(b.admissaoPosterior) - Number(a.admissaoPosterior)) ||
      (ordem[a.situacao] - ordem[b.situacao]) || a.dados.pessoa.localeCompare(b.dados.pessoa, 'pt-BR'))

    const cnpjs: string[] = []
    Object.keys(guia.pessoas).forEach(k => {
      const e = guia.pessoas[k].estab
      if (e && cnpjs.indexOf(e) < 0) cnpjs.push(e)
    })

    setAnalise({ guia, competencia, cnpjs, paginasVazias, resultado })
    setFiltro('falta')
  }

  // ── Derivados da análise ──────────────────────────────────────────────

  const falta = useMemo(() => analise?.resultado.filter(r => r.situacao === 'falta') ?? [], [analise])
  const ok = useMemo(() => analise?.resultado.filter(r => r.situacao === 'ok') ?? [], [analise])
  const fora = useMemo(() => analise?.resultado.filter(r => r.situacao === 'fora') ?? [], [analise])
  const div = useMemo(() => analise?.resultado.filter(r => r.divergente) ?? [], [analise])
  const varios = (analise?.cnpjs.length ?? 0) > 1
  // Só vale gerar observação para copiar quando há algo a reportar — se está tudo ok
  // (ninguém faltando, sem CNPJ divergente e sem página ilegível), não há o que enviar.
  const precisaObservacao = falta.length > 0 || div.length > 0 || (analise?.paginasVazias.length ?? 0) > 0

  const listaFiltrada = useMemo(() => {
    if (!analise) return []
    return analise.resultado.filter(r => filtro === 'todos' || r.situacao === filtro)
  }, [analise, filtro])

  const observacao = useMemo(() => {
    if (!analise) return ''
    const camposDe = (r: Resultado): CamposItem => ({
      nome: r.dados.pessoa,
      cpf: cpfExibir(r.dados.cpf),
      cadastro: dataBr(r.dados.dataCad) || r.dados.cadastro,
      motivo: r.motivo,
      atividade: r.dados.atividade,
      vinculo: r.dados.vinculo,
      cnpj_pessoa: r.achado ? (r.achado.estab || '') : '',
      tomador: r.achado && r.achado.tomador ? ' (tomador ' + r.achado.tomador + ')' : '',
    })

    const avaliadas = analise.resultado.length - fora.length
    const agora = new Date()
    const z = (n: number) => String(n).padStart(2, '0')
    const dataTexto = `${z(agora.getDate())}/${z(agora.getMonth() + 1)}/${agora.getFullYear()}`
    const horaTexto = `${z(agora.getHours())}:${z(agora.getMinutes())}`

    const dados: Record<string, string | number | boolean> = {
      data: dataTexto,
      hora: horaTexto,
      data_hora: dataTexto + ' ' + horaTexto,
      empresa: analise.guia.razao || 'EMPRESA NÃO IDENTIFICADA',
      cnpj: analise.guia.cnpj || 'não identificado',
      competencia: analise.competencia || 'não identificada',
      avaliadas,
      contempladas: avaliadas - falta.length,
      qtd_faltantes: falta.length,
      qtd_desconsiderados: fora.length,
      cnpjs: analise.cnpjs.join(', '),
      usuario: meuNomeAssinatura || '',
      alerta: analise.paginasVazias.map(d => 'páginas sem texto em ' + d.arquivo + ': ' + d.vazias.join(', ')).join(' | '),
      faltantes: falta.map(r => preencherItem(itFalta || ITEM_FALTA_PADRAO, camposDe(r))).join('\n'),
      desconsiderados: fora.map(r => preencherItem(itDesc || ITEM_DESC_PADRAO, camposDe(r))).join('\n'),
      divergentes: div.map(r => preencherItem(itDiv || ITEM_DIV_PADRAO, camposDe(r))).join('\n'),
      cond_alerta: analise.paginasVazias.length > 0,
      cond_faltantes: falta.length > 0,
      cond_sem_faltantes: falta.length === 0,
      cond_desconsiderados: fora.length > 0,
      cond_divergentes: div.length > 0,
      cond_varios_cnpj: analise.cnpjs.length > 1,
    }
    return preencherModelo(modelo || MODELO_PADRAO, dados)
  }, [analise, falta, fora, div, modelo, itFalta, itDesc, itDiv, meuNomeAssinatura, cpfExibir])

  // ── Config modal ──────────────────────────────────────────────────────

  function salvarModelo() {
    const ok2 = guardar(LS_MODELO, modelo) && guardar(LS_IT_FALTA, itFalta) &&
      guardar(LS_IT_DESC, itDesc) && guardar(LS_IT_DIV, itDiv)
    setStatusCfg(ok2 ? 'Modelo salvo neste navegador.' : 'Não foi possível salvar aqui; o modelo vale só para esta sessão.')
    setTimeout(() => setStatusCfg(''), 4000)
  }
  function restaurarModelo() {
    setModelo(MODELO_PADRAO)
    setItFalta(ITEM_FALTA_PADRAO)
    setItDesc(ITEM_DESC_PADRAO)
    setItDiv(ITEM_DIV_PADRAO)
  }

  // ── Cópia e CSV ────────────────────────────────────────────────────────

  function copiarObservacao() {
    const texto = observacao
    const feito = () => { setCopiado(true); setTimeout(() => setCopiado(false), 1600) }
    function manual() {
      const ta = document.createElement('textarea')
      ta.value = texto
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); feito() } catch { /* ignora */ }
      document.body.removeChild(ta)
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(feito, manual)
    } else { manual() }
  }

  function baixarCsv() {
    if (!analise) return
    const linhas: (string | number)[][] = [['Situacao', 'Motivo', 'Pessoa', 'CPF', 'Atividade', 'Vinculo', 'Admissao',
      'Cadastro', 'Admissao posterior ao cadastro', 'Nome na guia', 'Estabelecimento', 'Tomador', 'Observacao']]
    analise.resultado.forEach(r => {
      linhas.push([
        r.situacao === 'ok' ? 'Consta' : r.situacao === 'falta' ? 'Nao consta' : 'Desconsiderado',
        r.motivo, r.dados.pessoa, cpfExibir(r.dados.cpf), r.dados.atividade, r.dados.vinculo,
        dataBr(r.dados.dataAdmissao) || r.dados.admissao,
        dataBr(r.dados.dataCad) || r.dados.cadastro,
        r.admissaoPosterior ? 'Sim' : 'Não',
        r.achado ? r.achado.nome : '', r.achado ? r.achado.estab : '', r.achado ? r.achado.tomador : '',
        r.nota,
      ])
    })
    const csv = '﻿' + linhas.map(l => l.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'comparativo-guia-fgts.csv'
    a.click()
  }

  // ── Drag & drop ────────────────────────────────────────────────────────

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDropAtivo(false)
    receber(Array.from(e.dataTransfer.files))
  }

  const semDocs = docs.length === 0
  const filtros: { key: Filtro; label: string }[] = [
    { key: 'falta', label: 'Não constam' },
    { key: 'ok', label: 'Constam' },
    { key: 'fora', label: 'Desconsiderados' },
    { key: 'todos', label: 'Todos' },
  ]

  return (
    <div style={{ background: BG, minHeight: '100%', margin: '-24px', padding: '24px 20px 60px', fontFamily: '"Segoe UI",Roboto,Helvetica,Arial,sans-serif', fontSize: 15, lineHeight: 1.5, color: TEXT }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, maxWidth: 1180, margin: '0 auto 20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: PRIMARY_DARK }}>Comparativo Guia x Relatório</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            Compara as pessoas cadastradas no Portal GT3 com os trabalhadores que constam no detalhe da guia do FGTS.
          </p>
        </div>
        <button
          onClick={() => setModalCfgAberto(true)}
          title="Configurações"
          aria-label="Configurações"
          style={{
            background: PRIMARY, color: '#fff', border: `1px solid ${PRIMARY_DARK}`,
            borderRadius: 8, width: 40, height: 40, fontSize: 18, cursor: 'pointer', flex: '0 0 auto',
          }}
        >⚙</button>
      </div>

      <main style={{ maxWidth: 1180, margin: '0 auto' }}>
        {!pdfReady && (
          <div style={{ background: '#fff8e6', border: `1px solid ${ACCENT}`, borderRadius: 8, padding: '12px 14px', fontSize: 13.5, marginBottom: 18 }}>
            {pdfError
              ? <><strong>O leitor de PDF não carregou.</strong> Verifique a conexão e recarregue a página.</>
              : 'Carregando o leitor de PDF.'}
          </div>
        )}

        <section style={painelStyle}>
          <h2 style={h2Style}><span style={numBadge}>1</span>Documentos</h2>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDropAtivo(true) }}
            onDragEnter={e => { e.preventDefault(); setDropAtivo(true) }}
            onDragLeave={e => { e.preventDefault(); setDropAtivo(false) }}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dropAtivo ? PRIMARY : '#c3cede'}`, borderRadius: 8, padding: '30px 18px',
              textAlign: 'center', background: dropAtivo ? '#eef3fc' : '#fafbfe', cursor: 'pointer',
            }}
          >
            <strong style={{ display: 'block', fontSize: 15, marginBottom: 4 }}>Solte aqui os PDFs, em qualquer ordem</strong>
            <small style={{ color: MUTED }}>O relatório do Portal e o detalhe da guia são identificados pelo conteúdo</small>
            <input
              ref={fileInputRef} type="file" accept="application/pdf" multiple
              style={{ display: 'none' }}
              onChange={e => { receber(Array.from(e.target.files || [])); e.target.value = '' }}
            />
          </div>

          {docs.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 12 }}>
                <button
                  onClick={novaAnalise}
                  title="Remover todos os PDFs"
                  aria-label="Remover todos os PDFs"
                  style={{ cursor: 'pointer', color: FALTA, border: 0, background: 'none', fontSize: 17, lineHeight: 1, fontWeight: 700 }}
                >×</button>
              </div>
              {docs.map(d => (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${BORDER}`,
                  borderRadius: 8, padding: '9px 12px', fontSize: 13.5, background: '#fff',
                }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {d.arquivo}</span>
                  {d.lendo ? <small style={{ color: MUTED }}>lendo…</small> : (
                    <select
                      value={d.tipo}
                      onChange={e => alterarTipo(d.id, e.target.value as TipoDoc)}
                      style={{ padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}
                    >
                      <option value="guia">detalhe da guia</option>
                      <option value="relatorio">relatório do Portal</option>
                    </select>
                  )}
                  <button
                    onClick={() => removerDoc(d.id)}
                    title="remover"
                    style={{ cursor: 'pointer', color: MUTED, border: 0, background: 'none', fontSize: 17, lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {!semDocs && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
              marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}`, flexWrap: 'wrap',
            }}>
              <button
                onClick={processar}
                style={{ ...botaoStyle, padding: '11px 28px', fontSize: 15 }}
              >Comparar</button>
            </div>
          )}
        </section>

        {modalCfgAberto && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setModalCfgAberto(false) }}
            className="gt3-overlay-fade"
            style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,45,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 1200, overflow: 'auto' }}
          >
            <div className="gt3-drop-in" style={{ background: '#fff', borderRadius: 10, maxWidth: 820, width: '100%', boxShadow: '0 18px 50px rgba(20,28,45,.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
                <h2 style={{ margin: 0, fontSize: 16, color: PRIMARY }}>Configurações</h2>
                <button onClick={() => setModalCfgAberto(false)} aria-label="Fechar" className="gt3-close-btn" style={{ border: 0, background: 'none', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: MUTED }}>×</button>
              </div>
              <div style={{ padding: '18px 20px 22px' }}>
                <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` }}>
                  <strong style={{ fontSize: 13.5, color: TEXT, display: 'block', marginBottom: 12 }}>Regras da avaliação</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 12, color: MUTED }} htmlFor="fmt">Formato das datas do relatório</label>
                      <select id="fmt" value={fmt} onChange={e => setFmt(e.target.value as 'auto' | 'mdy' | 'dmy')} style={inputStyle}>
                        <option value="auto">Detectar automaticamente</option>
                        <option value="mdy">MM/DD/AAAA</option>
                        <option value="dmy">DD/MM/AAAA</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5 }}>
                      <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={rData} onChange={e => setRData(e.target.checked)} />
                        Desconsiderar cadastro posterior à competência
                      </label>
                      <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={rVinculo} onChange={e => setRVinculo(e.target.checked)} />
                        Desconsiderar vínculo temporário, associado ou PJ
                      </label>
                      <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={rCargo} onChange={e => setRCargo(e.target.checked)} />
                        Desconsiderar cargo estagiário, sócio ou diretor
                      </label>
                    </div>
                  </div>
                </div>

                <strong style={{ fontSize: 13.5, color: TEXT, display: 'block', marginBottom: 4 }}>Modelo da observação</strong>
                <label style={{ fontSize: 13, color: MUTED }}>Texto da observação</label>
                <textarea
                  value={modelo}
                  onChange={e => setModelo(e.target.value)}
                  style={{ width: '100%', minHeight: 230, padding: 10, border: `1px solid ${BORDER}`, borderRadius: 6, fontFamily: 'Consolas,monospace', fontSize: 12.5, resize: 'vertical', boxSizing: 'border-box' }}
                />

                <div style={{ marginTop: 14 }}>
                  {[
                    { label: 'Cada pessoa que não consta', value: itFalta, set: setItFalta },
                    { label: 'Cada pessoa desconsiderada', value: itDesc, set: setItDesc },
                    { label: 'Cada pessoa em CNPJ divergente', value: itDiv, set: setItDiv },
                  ].map(({ label, value, set }) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                      <label style={{ fontSize: 13, color: MUTED }}>{label}</label>
                      <input
                        value={value}
                        onChange={e => set(e.target.value)}
                        style={{ width: '100%', padding: '7px 9px', border: `1px solid ${BORDER}`, borderRadius: 6, fontFamily: 'Consolas,monospace', fontSize: 12.5, boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={salvarModelo} style={botaoSecStyle}>Salvar como padrão</button>
                  <button onClick={restaurarModelo} style={botaoSecStyle}>Restaurar o modelo original</button>
                  {statusCfg && <span style={{ fontSize: 13, color: OK }}>{statusCfg}</span>}
                </div>

                <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.8, marginTop: 8 }}>
                  <strong style={{ color: TEXT }}>Campos disponíveis</strong><br />
                  {['{data}', '{hora}', '{data_hora}', '{empresa}', '{cnpj}', '{competencia}', '{avaliadas}', '{contempladas}', '{qtd_faltantes}', '{qtd_desconsiderados}', '{cnpjs}', '{usuario}'].map(t => (
                    <code key={t} style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12, marginRight: 4 }}>{t}</code>
                  ))}
                  {' '}— <code style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12 }}>{'{usuario}'}</code> é o nome de quem gerou a observação (já incluído no fim do modelo padrão).
                  <br />
                  Listas: {['{faltantes}', '{desconsiderados}', '{divergentes}'].map(t => (
                    <code key={t} style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12, marginRight: 4 }}>{t}</code>
                  ))}
                  — cada item segue o formato definido acima, onde valem {['{nome}', '{cpf}', '{cadastro}', '{motivo}', '{atividade}', '{vinculo}', '{cnpj_pessoa}', '{tomador}'].map(t => (
                    <code key={t} style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12, marginRight: 4 }}>{t}</code>
                  ))}.<br />
                  Trechos condicionais: <code style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12 }}>{'{#faltantes}…{/faltantes}'}</code> só aparece se houver quem não conste.
                  Também existem <code style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12 }}>{'{#sem_faltantes}'}</code>, <code style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12 }}>{'{#desconsiderados}'}</code>, <code style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12 }}>{'{#divergentes}'}</code>, <code style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12 }}>{'{#varios_cnpj}'}</code> e <code style={{ background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12 }}>{'{#alerta}'}</code>.
                </div>
              </div>
            </div>
          </div>
        )}

        {analise && (
          <section style={painelStyle}>
            <div style={{ borderLeft: `4px solid ${ACCENT}`, padding: '10px 0 10px 14px', marginBottom: 16 }}>
              <strong style={{ fontSize: 17, display: 'block' }}>{analise.guia.razao || 'Empresa não identificada no PDF'}</strong>
              <span style={{ color: MUTED, fontSize: 13.5 }}>
                CNPJ {analise.guia.cnpj || '—'} · competência {analise.competencia || '—'} · {Object.keys(analise.guia.pessoas).length} trabalhadores na guia
              </span>
            </div>

            {analise.paginasVazias.length > 0 && (
              <div style={{ background: '#fff8e6', border: `1px solid ${ACCENT}`, borderRadius: 8, padding: '12px 14px', fontSize: 13.5, marginBottom: 18 }}>
                <strong>Atenção: há páginas sem texto nos PDFs enviados.</strong><br />
                {analise.paginasVazias.map(d => (
                  <span key={d.id}>{d.arquivo} — página(s) {d.vazias.join(', ')} de {d.paginas}<br /></span>
                ))}
                São páginas em imagem (digitalizadas) e não puderam ser lidas. Quem aparecer só nelas
                será marcado como &quot;não consta&quot;. Confira à mão ou cole o texto dessas páginas.
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <Cartao n={falta.length} rotulo="não constam" cor={falta.length ? FALTA : OK} />
              <Cartao n={ok.length} rotulo="constam na guia" cor={OK} />
              <Cartao n={analise.resultado.length} rotulo="pessoas no Portal" />
              <Cartao n={fora.length} rotulo="desconsideradas" />
              <Cartao
                n={div.length}
                rotulo={varios ? `${analise.cnpjs.length} CNPJs na guia — verificar` : 'em CNPJ divergente'}
                cor={(div.length || varios) ? NEUTRO : undefined}
                destaque={varios}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, fontSize: 13, color: TEXT, cursor: 'pointer' }}>
              <input type="checkbox" checked={ocultarCpf} onChange={e => setOcultarCpf(e.target.checked)} />
              Ocultar parte do CPF na tela, na observação e no CSV
            </label>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {filtros.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  style={{
                    border: `1px solid ${filtro === f.key ? PRIMARY : BORDER}`,
                    background: filtro === f.key ? PRIMARY : '#fff',
                    color: filtro === f.key ? '#fff' : TEXT,
                    borderRadius: 16, padding: '5px 14px', fontSize: 13, cursor: 'pointer',
                  }}
                >{f.label}</button>
              ))}
            </div>

            {filtro === 'falta' && listaFiltrada.length === 0 ? (
              <div style={{ background: OK_BG, color: OK, borderRadius: 8, padding: 16, fontWeight: 600, textAlign: 'center' }}>
                Sem divergências: todas as pessoas avaliadas constam no detalhe da guia.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr>
                      {['Situação', 'Pessoa', 'CPF', 'Atividade', 'Vínculo', 'Admissão', 'Cadastro', 'Onde consta na guia'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '9px 8px', background: 'linear-gradient(to bottom, #FAFCFE, #F5F8FC)', borderBottom: `2px solid var(--border-soft)`, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.9px', color: 'var(--text-mute)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.length === 0 && (
                      <tr><td colSpan={8} style={{ color: MUTED, fontSize: 14, padding: '12px 0', textAlign: 'center' }}>Nenhuma pessoa nesta situação.</td></tr>
                    )}
                    {listaFiltrada.map((r, i) => {
                      const rowBg = r.situacao === 'falta' ? FALTA_BG : r.situacao === 'fora' ? '#f7f8fa' : undefined
                      const rowColor = r.situacao === 'fora' ? MUTED : undefined
                      const grifo = (campo: string): React.CSSProperties => r.campo === campo
                        ? { background: '#fdf1d6', boxShadow: `inset 0 0 0 2px ${ACCENT}`, borderRadius: 4, fontWeight: 600, color: NEUTRO }
                        : {}
                      const tdBase: React.CSSProperties = { padding: 8, borderBottom: `1px solid var(--border-soft)`, verticalAlign: 'top', background: rowBg, color: rowColor }
                      // admissão posterior ao cadastro: destaca as duas colunas, a admissão com mais força
                      const cadastroDestaque: React.CSSProperties = r.admissaoPosterior
                        ? { background: '#fdf1d6', boxShadow: `inset 0 0 0 2px ${ACCENT}`, borderRadius: 4, fontWeight: 600, color: NEUTRO }
                        : {}
                      const admissaoDestaque: React.CSSProperties = r.admissaoPosterior
                        ? { background: '#f0b13c', boxShadow: `inset 0 0 0 2px ${NEUTRO}`, borderRadius: 4, fontWeight: 700, color: '#4A3A12' }
                        : {}
                      return (
                        <tr key={i}>
                          <td style={tdBase}>
                            {r.situacao === 'ok' && <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 11, fontSize: 11.5, fontWeight: 600, background: OK_BG, color: OK }}>consta</span>}
                            {r.situacao === 'falta' && <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 11, fontSize: 11.5, fontWeight: 600, background: FALTA_BG, color: FALTA }}>não consta</span>}
                            {r.situacao === 'fora' && <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 11, fontSize: 11.5, fontWeight: 600, background: '#eceff4', color: MUTED }}>desconsiderado</span>}
                            {r.divergente && <span style={{ marginLeft: 4, display: 'inline-block', padding: '2px 8px', borderRadius: 11, fontSize: 11.5, fontWeight: 600, background: NEUTRO_BG, color: NEUTRO }}>CNPJ divergente</span>}
                            {r.motivo && <span style={{ fontSize: 12, color: NEUTRO, display: 'block', marginTop: 3 }}>{r.motivo}</span>}
                          </td>
                          <td style={tdBase}>
                            {r.dados.pessoa}
                            {r.dados.repeticoes > 1 && <span style={{ fontSize: 12, color: NEUTRO, display: 'block', marginTop: 3 }}>{r.dados.repeticoes} linhas no relatório, contada uma vez</span>}
                            {r.nota && <span style={{ fontSize: 12, color: NEUTRO, display: 'block', marginTop: 3 }}>{r.nota}</span>}
                          </td>
                          <td style={tdBase}>{cpfExibir(r.dados.cpf)}</td>
                          <td style={{ ...tdBase, ...grifo('atividade') }}>{r.dados.atividade || '—'}</td>
                          <td style={{ ...tdBase, ...grifo('vinculo') }}>{r.dados.vinculo || '—'}</td>
                          <td style={{ ...tdBase, ...admissaoDestaque }}>
                            {dataBr(r.dados.dataAdmissao) || r.dados.admissao || '—'}
                            {r.admissaoPosterior && <span style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginTop: 3 }}>posterior ao cadastro</span>}
                          </td>
                          <td style={{ ...tdBase, ...grifo('cadastro'), ...cadastroDestaque }}>{dataBr(r.dados.dataCad) || r.dados.cadastro}</td>
                          <td style={tdBase}>
                            {r.achado ? (
                              <>
                                {r.achado.estab || '—'}
                                {r.achado.tomador && <><br /><small style={{ color: MUTED }}>tomador {r.achado.tomador}</small></>}
                              </>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {precisaObservacao && (
              <>
                <h2 style={{ marginTop: 26, fontSize: 16, color: TEXT }}>Observação para envio</h2>
                <div
                  onClick={copiarObservacao}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copiarObservacao() } }}
                  tabIndex={0}
                  role="button"
                  aria-label="Clique para copiar a observação"
                  style={{
                    position: 'relative', background: '#fff', border: `1px solid ${BORDER}`, borderLeft: `4px solid ${ACCENT}`,
                    borderRadius: 8, padding: '16px 18px', whiteSpace: 'pre-wrap', fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  {observacao}
                  <span style={{ position: 'absolute', top: 10, right: 12, fontSize: 11.5, color: MUTED, background: '#f1f4f9', borderRadius: 11, padding: '2px 10px' }}>
                    {copiado ? 'copiado' : 'clique para copiar'}
                  </span>
                </div>
              </>
            )}

            <div style={{ marginTop: 12 }}>
              <button onClick={baixarCsv} style={botaoSecStyle}>Baixar resultado em CSV</button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
