'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUser, displayName } from '../components/UserContext'
import {
  type Guia, type Situacao, type Resultado, type DiagPagina, type OcrConfig,
  OCR_CFG, pontuarTexto, emParalelo, textoUtil, palavrasLegiveis, diagnosticarPagina,
  normNome, fmtCpf, fmtCpfMasc, dataBr, pontuar, lerRelatorio, lerGuia, comparar,
} from './lib'

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
const TESSERACT_LIB_URL   = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js'
/** Cópia local (public/tesseract.min.js, mesma versão 6.0.1) — usada se o CDN for bloqueado. */
const TESSERACT_LOCAL_URL = '/tesseract.min.js'

// ─── pdf.js / tesseract.js (carregados via CDN em runtime — ver useEffect mais abaixo) ─

type PdfTextItem = { str: string; transform: number[] }
type PdfTextContent = { items: PdfTextItem[] }
type PdfViewport = { width: number; height: number }
type PdfRenderTask = { promise: Promise<void> }
type PdfPageProxy = {
  rotate?: number
  getTextContent: () => Promise<PdfTextContent>
  getViewport: (opts: { scale: number; rotation?: number }) => PdfViewport
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => PdfRenderTask
}
type PdfDocumentProxy = { numPages: number; getPage: (n: number) => Promise<PdfPageProxy> }
type PdfJsLib = {
  getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfDocumentProxy> }
  GlobalWorkerOptions: { workerSrc: string }
}

type TesseractRecognizeResult = { data: { text: string } }
type TesseractWorker = Record<string, unknown>
type TesseractScheduler = {
  addWorker: (w: TesseractWorker) => void
  addJob: (action: string, image: unknown) => Promise<TesseractRecognizeResult>
  terminate?: () => Promise<void>
}
type TesseractLib = {
  createScheduler: () => TesseractScheduler
  createWorker: (lang?: string, oem?: number, options?: Record<string, unknown>) => Promise<TesseractWorker>
}

// Sem `declare global`: o comparador de comprovantes usa outro formato para as mesmas
// globais — lê-se `window` via cast local, igual a ele.
function getPdfJsLib(): PdfJsLib | undefined {
  return (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib
}
function getTesseract(): TesseractLib | undefined {
  return (window as unknown as { Tesseract?: TesseractLib }).Tesseract
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
  /** Progresso da leitura ("OCR 5 de 18 páginas · ~1 min restantes…") */
  status: string
  /** Texto de cada página — apagado (sobrescrito com '') ao remover o documento. */
  paginas: string[]
  texto: string
  totalPaginas: number
  /** Páginas que não puderam ser lidas (nem por OCR) */
  vazias: number[]
  /** Páginas lidas por OCR */
  ocr: number[]
  diag: DiagPagina[]
  erroOcr: string
  tipo: TipoDoc
  manual: boolean
  pontos: { guia: number; relatorio: number } | null
}

type Analise = {
  guia: Guia
  competencia: string
  cnpjs: string[]
  paginasVazias: DocEntry[]
  paginasOcr: DocEntry[]
  resultado: Resultado[]
}

type Filtro = 'falta' | 'ok' | 'aprox' | 'fora' | 'todos'

// ─── OCR (igual ao comparador de comprovantes) ─────────────────────────────

type OcrState = { scheduler: TesseractScheduler | null; nucleos: number }

/** Vários workers em paralelo: cada um ocupa um núcleo do processador. */
async function obterScheduler(ocrState: OcrState, cfg: OcrConfig, aviso?: (msg: string) => void): Promise<TesseractScheduler> {
  if (ocrState.scheduler) return ocrState.scheduler
  const Tesseract = getTesseract()
  if (!Tesseract) throw new Error('biblioteca de OCR não carregou')
  let quantos = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1))
  if (cfg.nucleos) quantos = Math.min(8, Math.max(1, cfg.nucleos))
  if (aviso) aviso('preparando OCR (' + quantos + (quantos > 1 ? ' núcleos' : ' núcleo') + ')…')

  const opcoes: Record<string, unknown> = {}
  if (cfg.workerPath) opcoes.workerPath = cfg.workerPath
  if (cfg.corePath) opcoes.corePath = cfg.corePath
  if (cfg.langPath) opcoes.langPath = cfg.langPath

  const sch = Tesseract.createScheduler()
  const workers = await Promise.all(
    Array.from({ length: quantos }, () => Tesseract.createWorker(cfg.idioma || 'por', 1, opcoes)),
  )
  workers.forEach(w => sch.addWorker(w))
  ocrState.scheduler = sch
  ocrState.nucleos = workers.length
  return sch
}

async function renderizarPagina(pdf: PdfDocumentProxy, n: number, escala: number, giro: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(n)
  const vp = page.getViewport({ scale: escala, rotation: ((page.rotate || 0) + (giro || 0)) % 360 })
  const c = document.createElement('canvas')
  c.width = Math.floor(vp.width)
  c.height = Math.floor(vp.height)
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas 2D indisponível neste navegador')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  return c
}

type ResultadoOcr = { pontos: number; texto: string; angulo: number }

/** Lê uma página num giro e pontua o resultado. O canvas é descartado logo depois —
 *  com centenas de páginas, a memória pesa. */
async function reconhecer(pdf: PdfDocumentProxy, n: number, cfg: OcrConfig, giro: number, ocrState: OcrState): Promise<ResultadoOcr> {
  const canvas = await renderizarPagina(pdf, n, cfg.escala, giro)
  try {
    // Lido na hora: se "Remover todos" encerrou o OCR no meio, a página falha em vez de
    // usar um scheduler já terminado.
    const sch = ocrState.scheduler
    if (!sch) throw new Error('OCR encerrado')
    const r = await sch.addJob('recognize', canvas)
    const t = (r && r.data && r.data.text) ? r.data.text : ''
    return { pontos: pontuarTexto(t), texto: t, angulo: giro }
  } finally {
    canvas.width = 0; canvas.height = 0
  }
}

/** Compara o giro com o seu oposto; a orientação certa costuma pontuar o dobro. */
async function melhorGiro(pdf: PdfDocumentProxy, n: number, cfg: OcrConfig, ordem: number[], ocrState: OcrState): Promise<ResultadoOcr> {
  let resultados: ResultadoOcr[] = []
  async function par(a: number, b: number): Promise<ResultadoOcr | null> {
    const rs = await Promise.all([reconhecer(pdf, n, cfg, a, ocrState), reconhecer(pdf, n, cfg, b, ocrState)])
    resultados = resultados.concat(rs)
    const alto = rs[0].pontos >= rs[1].pontos ? rs[0] : rs[1]
    const baixo = rs[0].pontos >= rs[1].pontos ? rs[1] : rs[0]
    return (alto.pontos >= 40 && alto.pontos >= baixo.pontos * 2) ? alto : null
  }
  const r = await par(ordem[0], ordem[1])
  if (r) return r
  await par(ordem[2], ordem[3])
  return resultados.sort((x, y) => y.pontos - x.pontos)[0]
}

/** Lê por OCR as páginas sem texto aproveitável.
 *  1) descobre o giro numa amostra;  2) processa tudo em paralelo nesse giro;
 *  3) refaz, com comparação completa, as páginas que saíram fracas. */
async function ocrPaginas(
  pdf: PdfDocumentProxy, vazias: number[], paginas: string[], cfg: OcrConfig,
  aviso: ((msg: string) => void) | undefined, diag: DiagPagina[], ocrState: OcrState,
): Promise<{ recuperadas: number[]; restantes: number[]; erro: string }> {
  const recuperadas: number[] = [], restantes: number[] = []
  let erro = '', inicio = 0, anguloDoc = 0
  const porNumero = (a: number, b: number) => a - b
  const anota = (n: number, dados: Partial<DiagPagina>) => {
    const d = diag && diag[n - 1]
    if (d) Object.assign(d, dados)
  }
  const guardar = (n: number, res: ResultadoOcr): boolean => {
    const txt = (res.texto || '').replace(/[ \t]+/g, ' ').trim()
    if (textoUtil(txt) >= 20) {
      paginas[n - 1] = txt
      if (recuperadas.indexOf(n) < 0) recuperadas.push(n)
      anota(n, { origem: 'ocr', angulo: res.angulo, pontos: res.pontos, chars: textoUtil(txt), palavras: palavrasLegiveis(txt) })
      return true
    }
    anota(n, { origem: 'ocr-vazio', angulo: res.angulo, pontos: res.pontos, chars: textoUtil(res.texto || ''), palavras: palavrasLegiveis(res.texto || '') })
    return false
  }
  const progresso = (feitos: number, total: number) => {
    if (!aviso) return
    let msg = 'OCR ' + feitos + ' de ' + total + ' páginas'
    if (feitos >= 2 && inicio) {
      const faltam = Math.round((Date.now() - inicio) / feitos * (total - feitos) / 60000)
      msg += faltam >= 1 ? ' · ~' + faltam + ' min restantes' : ' · quase lá'
    }
    aviso(msg + '…')
  }
  const msgErro = (e: unknown) => (e instanceof Error && e.message ? e.message : 'falha no OCR')

  try {
    await obterScheduler(ocrState, cfg, aviso)
    inicio = Date.now()
    if (aviso) aviso('descobrindo a orientação das páginas…')
    const amostra = vazias.slice(0, Math.min(3, vazias.length))
    const angulos = await Promise.all(amostra.map(n =>
      melhorGiro(pdf, n, cfg, [0, 180, 90, 270], ocrState).then(r => { guardar(n, r); return r.angulo }).catch(() => null),
    ))
    const conta: Record<number, number> = {}
    angulos.forEach(a => { if (a !== null) conta[a] = (conta[a] || 0) + 1 })
    Object.keys(conta).forEach(k => {
      const a = parseInt(k, 10)
      if (!conta[anguloDoc] || conta[a] > conta[anguloDoc]) anguloDoc = a
    })
    const pendentes = vazias.filter(n => amostra.indexOf(n) < 0)

    const fracas: number[] = [], total = pendentes.length
    inicio = Date.now()
    await emParalelo(pendentes, ocrState.nucleos, n =>
      reconhecer(pdf, n, cfg, anguloDoc, ocrState).then(res => {
        if (res.pontos >= 40) guardar(n, res)
        else fracas.push(n)
      }).catch(e => {
        erro = erro || msgErro(e)
        anota(n, { origem: 'ocr-erro', detalhe: erro })
        restantes.push(n)
      }),
    feitos => progresso(feitos, total))

    if (fracas.length) {
      if (aviso) aviso('revendo ' + fracas.length + ' página(s) em outras orientações…')
      const ordem = [anguloDoc, (anguloDoc + 180) % 360, (anguloDoc + 90) % 360, (anguloDoc + 270) % 360]
      await emParalelo(fracas, Math.max(1, Math.floor(ocrState.nucleos / 2)), n =>
        melhorGiro(pdf, n, cfg, ordem, ocrState).then(res => {
          if (!guardar(n, res)) restantes.push(n)
        }).catch(e => {
          erro = erro || msgErro(e)
          anota(n, { origem: 'ocr-erro', detalhe: erro })
          restantes.push(n)
        }))
    }
    /* o paralelismo termina cada página numa ordem diferente da numérica;
       ordena antes de exibir, senão o diagnóstico parece aleatório */
    return { recuperadas: recuperadas.sort(porNumero), restantes: restantes.sort(porNumero), erro }
  } catch (e) {
    return {
      recuperadas: recuperadas.sort(porNumero),
      restantes: vazias.filter(n => recuperadas.indexOf(n) < 0).sort(porNumero),
      erro: e instanceof Error && e.message ? e.message : 'falha ao iniciar o OCR',
    }
  }
}

// ─── Leitura de PDF ──────────────────────────────────────────────────────────

type LeituraPdf = {
  paginas: string[]; texto: string; totalPaginas: number
  vazias: number[]; ocr: number[]; erroOcr: string; diag: DiagPagina[]
}

/** Lê o texto digital de cada página; a página só vai para OCR se tiver menos de
 *  OCR_CFG.minChars caracteres úteis ou menos de 5 palavras legíveis. */
async function lerPdf(file: File, aviso: (msg: string) => void, usarOcr: boolean, ocrState: OcrState): Promise<LeituraPdf> {
  const pdfjsLib = getPdfJsLib() as PdfJsLib
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const paginas: string[] = [], vazias: number[] = [], diag: DiagPagina[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const tc = await page.getTextContent()
    const mapa: Record<number, { x: number; s: string }[]> = {}
    const seq: string[] = []
    tc.items.forEach(it => {
      const y = Math.round(it.transform[5])
      if (!mapa[y]) mapa[y] = []
      mapa[y].push({ x: it.transform[4], s: it.str })
      seq.push(it.str)
    })
    const linhas: string[] = []
    Object.keys(mapa).map(Number).sort((a, b) => b - a).forEach(y => {
      const t = mapa[y].sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim()
      if (t) linhas.push(t)
    })
    const tx = linhas.join('\n') + '\n' + seq.join(' ').replace(/\s+/g, ' ')
    paginas.push(tx)
    const dg = diagnosticarPagina(tx, OCR_CFG.minChars)
    diag.push({ n, chars: dg.chars, palavras: dg.palavras, itens: tc.items.length, origem: 'pdf', motivo: dg.motivo })
    if (dg.motivo) vazias.push(n)
  }

  let res: { recuperadas: number[]; restantes: number[]; erro: string }
  if (!vazias.length) res = { recuperadas: [], restantes: [], erro: '' }
  else if (!usarOcr || !getTesseract()) {
    res = { recuperadas: [], restantes: vazias.slice(), erro: getTesseract() ? 'OCR desmarcado na tela' : 'biblioteca de OCR não carregou' }
  } else {
    res = await ocrPaginas(pdf, vazias, paginas, OCR_CFG, aviso, diag, ocrState)
  }
  return {
    paginas, texto: paginas.join('\n'), totalPaginas: pdf.numPages,
    vazias: res.restantes, ocr: res.recuperadas, erroOcr: res.erro || '', diag,
  }
}

/** "18 pág. · 18 por OCR" */
function resumoLeitura(d: DocEntry): string {
  if (!d.diag || !d.diag.length) return ''
  const porOcr = d.diag.filter(p => p.origem === 'ocr').length
  const semLeitura = (d.vazias || []).length
  const partes = [d.totalPaginas + ' pág.']
  if (porOcr) partes.push(porOcr + ' por OCR')
  if (semLeitura) partes.push(semLeitura + ' sem leitura')
  return partes.join(' · ')
}
/** Diagnóstico por página (tooltip do resumo): origem, caracteres, palavras e giro. */
function diagTexto(d: DocEntry): string {
  return d.diag.map(p => {
    const origem = p.origem === 'pdf' ? (p.motivo ? 'texto digital (' + p.motivo + ')' : 'texto digital')
      : p.origem === 'ocr' ? 'OCR' + (p.angulo ? ' · girada ' + p.angulo + '°' : '')
      : p.origem === 'ocr-vazio' ? 'OCR sem texto aproveitável' : 'erro no OCR' + (p.detalhe ? ': ' + p.detalhe : '')
    return 'pág. ' + p.n + ' — ' + origem + ' · ' + p.chars + ' caract. · ' + p.palavras + ' palavras'
  }).join('\n') + (d.erroOcr ? '\n' + d.erroOcr : '')
}

/** Apaga da memória o texto do PDF: sobrescreve cada página e zera o que veio dele. */
function apagarDoc(d: DocEntry | undefined) {
  if (!d) return
  if (d.paginas) for (let i = 0; i < d.paginas.length; i++) d.paginas[i] = ''
  d.paginas = []; d.texto = ''; d.diag = []; d.vazias = []; d.ocr = []; d.status = ''; d.pontos = null
}

function classificarDoc(doc: DocEntry): DocEntry {
  const pontos = pontuar(doc.texto)
  return { ...doc, pontos, tipo: pontos.guia >= pontos.relatorio ? 'guia' : 'relatorio' }
}
/** Se todos os documentos caírem no mesmo lado, o de menor margem migra para o outro.
 *  Só entram na conta os arquivos já lidos — com OCR a leitura demora, e um PDF ainda
 *  sendo lido não pode ser "puxado" para o outro lado. */
function equilibrarDocs(docs: DocEntry[]): DocEntry[] {
  const prontos = docs.filter(d => d.pontos && !d.lendo && !d.manual)
  if (prontos.length < 2 || docs.some(d => d.manual)) return docs
  const rel = prontos.filter(d => d.tipo === 'relatorio')
  const gui = prontos.filter(d => d.tipo === 'guia')
  const margem = (d: DocEntry) => d.pontos!.guia - d.pontos!.relatorio
  let flipId: string | null = null, novoTipo: TipoDoc | null = null
  if (!rel.length && gui.length > 1) {
    const alvo = [...gui].sort((a, b) => margem(a) - margem(b))[0]
    flipId = alvo.id; novoTipo = 'relatorio'
  } else if (!gui.length && rel.length > 1) {
    const alvo = [...rel].sort((a, b) => margem(b) - margem(a))[0]
    flipId = alvo.id; novoTipo = 'guia'
  }
  if (!flipId) return docs
  return docs.map(d => d.id === flipId ? { ...d, tipo: novoTipo! } : d)
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
  const [ocrReady, setOcrReady] = useState(false)
  const [ocrError, setOcrError] = useState(false)
  const [usarOcr, setUsarOcr] = useState(true)
  const ocrStateRef = useRef<OcrState>({ scheduler: null, nucleos: 1 })

  const [docs, setDocs] = useState<DocEntry[]>([])
  // Espelho de `docs` para apagar o texto no beforeunload/desmontagem.
  const docsRef = useRef<DocEntry[]>([])
  useEffect(() => { docsRef.current = docs }, [docs])
  // Ids ainda na lista — a leitura com OCR pode levar minutos; se o PDF for removido nesse
  // meio-tempo, o texto que chegar depois é descartado.
  const vivosRef = useRef<Set<string>>(new Set())
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
      const lib = getPdfJsLib()
      if (lib) { lib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL; setPdfReady(true) }
      else setPdfError(true)
    }
    if (getPdfJsLib()) {
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

  // Carrega o OCR (tesseract.js 6.0.1 via jsdelivr, versão fixa). Se o CDN for bloqueado,
  // tenta a cópia local; se nenhuma carregar, avisa e desabilita o checkbox.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (getTesseract()) { queueMicrotask(() => setOcrReady(true)); return }
    function novoScript(id: string, src: string): HTMLScriptElement {
      const s = document.createElement('script')
      s.id = id
      s.src = src
      s.async = true
      s.crossOrigin = 'anonymous'
      s.referrerPolicy = 'no-referrer'
      document.body.appendChild(s)
      return s
    }
    let vivo = true
    const marcarPronto = () => { if (vivo) { if (getTesseract()) setOcrReady(true); else setOcrError(true) } }
    const tentarLocal = () => {
      if (!vivo) return
      if (getTesseract()) { setOcrReady(true); return }
      const local = (document.getElementById('gt3-tesseract-local') as HTMLScriptElement | null)
        ?? novoScript('gt3-tesseract-local', TESSERACT_LOCAL_URL)
      local.addEventListener('load', marcarPronto)
      local.addEventListener('error', () => { if (vivo) setOcrError(true) })
    }
    // Mesmo id do comparador de comprovantes: se ele já carregou a biblioteca, reaproveita.
    const script = (document.getElementById('gt3-tesseract-lib') as HTMLScriptElement | null)
      ?? novoScript('gt3-tesseract-lib', TESSERACT_LIB_URL)
    script.addEventListener('load', marcarPronto)
    script.addEventListener('error', tentarLocal)
    return () => {
      vivo = false
      script.removeEventListener('load', marcarPronto)
      script.removeEventListener('error', tentarLocal)
    }
  }, [])

  const usarOcrEfetivo = usarOcr && !ocrError

  /** Termina o scheduler e os workers do Tesseract — nada fica rodando em memória. */
  const encerrarOcr = useCallback(() => {
    const st = ocrStateRef.current
    const sch = st.scheduler
    if (sch && sch.terminate) { try { void sch.terminate() } catch { /* ignora */ } }
    st.scheduler = null
    st.nucleos = 1
  }, [])

  // Ao fechar/recarregar a aba ou sair do módulo: apaga o texto lido e encerra o OCR.
  useEffect(() => {
    const limpar = () => { docsRef.current.forEach(apagarDoc); encerrarOcr() }
    window.addEventListener('beforeunload', limpar)
    return () => { window.removeEventListener('beforeunload', limpar); limpar() }
  }, [encerrarOcr])

  // ── Documentos ────────────────────────────────────────────────────────

  /** Qualquer mudança nos arquivos invalida a análise: os nomes saem da tela e da memória. */
  function limparResultado() {
    setAnalise(null)
    setFiltro('falta')
  }

  function receber(lista: File[]) {
    if (analise) limparResultado()
    const pdfs = lista.filter(f => /\.pdf$/i.test(f.name))
    pdfs.forEach(f => {
      if (!pdfReady) {
        alert('O leitor de PDF não está disponível. Recarregue a página com internet.')
        return
      }
      const id = novoId()
      const novo: DocEntry = {
        id, arquivo: f.name, lendo: true, status: 'lendo…', paginas: [], texto: '', totalPaginas: 0,
        vazias: [], ocr: [], diag: [], erroOcr: '', tipo: 'guia', manual: false, pontos: null,
      }
      vivosRef.current.add(id)
      setDocs(prev => [...prev, novo])
      const aviso = (msg: string) => setDocs(prev => prev.map(d => d.id === id ? { ...d, status: msg } : d))
      lerPdf(f, aviso, usarOcrEfetivo, ocrStateRef.current).then(r => {
        // Removido enquanto era lido: descarta o texto em vez de guardá-lo.
        if (!vivosRef.current.has(id)) {
          for (let i = 0; i < r.paginas.length; i++) r.paginas[i] = ''
          r.texto = ''
          return
        }
        setDocs(prev => equilibrarDocs(prev.map(d => d.id === id
          ? classificarDoc({
            ...d, paginas: r.paginas, texto: r.texto, totalPaginas: r.totalPaginas, vazias: r.vazias,
            ocr: r.ocr, diag: r.diag, erroOcr: r.erroOcr, lendo: false, status: '',
          })
          : d)))
      }).catch(err => {
        setDocs(prev => prev.map(d => d.id === id ? { ...d, lendo: false, status: '', tipo: 'guia' } : d))
        alert('Não consegui ler ' + f.name + ': ' + (err?.message || err))
      })
    })
  }

  function alterarTipo(id: string, tipo: TipoDoc) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, tipo, manual: true } : d))
  }
  function removerDoc(id: string) {
    vivosRef.current.delete(id)
    apagarDoc(docs.find(d => d.id === id))
    setDocs(prev => prev.filter(d => d.id !== id))
    limparResultado()
  }

  function novaAnalise() {
    docs.forEach(apagarDoc)
    vivosRef.current.clear()
    setDocs([])
    encerrarOcr()
    limparResultado()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Processamento ─────────────────────────────────────────────────────

  function processar() {
    if (docs.some(d => d.lendo)) {
      alert('Ainda estou lendo um dos PDFs. Tente de novo em instantes.')
      return
    }
    let textoRel = '', textoGuia = ''
    const paginasVazias: DocEntry[] = [], paginasOcr: DocEntry[] = []
    docs.forEach(d => {
      if (d.tipo === 'relatorio') textoRel += '\n' + d.texto; else textoGuia += '\n' + d.texto
      if (d.vazias && d.vazias.length) paginasVazias.push(d)
      if (d.ocr && d.ocr.length) paginasOcr.push(d)
    })

    // PDF sem nenhum texto (nem por OCR) — vem antes de "Faltou um dos documentos", que
    // nesse caso confundiria: o arquivo está lá, só não foi lido.
    const semTexto = docs.filter(d => !(d.texto || '').replace(/\s/g, ''))
    if (semTexto.length) {
      alert('Não consegui extrair texto de ' + semTexto.map(d => d.arquivo).join(', ') + '. ' +
        'Esse PDF não tem texto digital (é digitalizado ou foi gerado por “Imprimir em PDF”). ' +
        (getTesseract() && usarOcrEfetivo
          ? 'O OCR também não conseguiu ler as páginas — confira a qualidade do arquivo.'
          : 'Marque a opção “Ler com OCR…” e anexe o arquivo de novo.'))
      return
    }

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

    let resultado = comparar(lista, guia, { competencia, textoNorm: normNome(textoGuia), data: rData, vinculo: rVinculo, cargo: rCargo })
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

    setAnalise({ guia, competencia, cnpjs, paginasVazias, paginasOcr, resultado })
    setFiltro('falta')
  }

  // ── Derivados da análise ──────────────────────────────────────────────

  const falta = useMemo(() => analise?.resultado.filter(r => r.situacao === 'falta') ?? [], [analise])
  const ok = useMemo(() => analise?.resultado.filter(r => r.situacao === 'ok') ?? [], [analise])
  const fora = useMemo(() => analise?.resultado.filter(r => r.situacao === 'fora') ?? [], [analise])
  const div = useMemo(() => analise?.resultado.filter(r => r.divergente) ?? [], [analise])
  const aprox = useMemo(() => analise?.resultado.filter(r => r.aprox) ?? [], [analise])
  const lidosGuia = analise ? Object.keys(analise.guia.pessoas).length : 0
  const faltaramNaGuia = analise && analise.guia.qtd > lidosGuia ? analise.guia.qtd - lidosGuia : 0
  const varios = (analise?.cnpjs.length ?? 0) > 1
  // Só vale gerar observação para copiar quando há algo a reportar — se está tudo ok
  // (ninguém faltando, sem CNPJ divergente e sem página ilegível), não há o que enviar.
  const precisaObservacao = falta.length > 0 || div.length > 0 || (analise?.paginasVazias.length ?? 0) > 0

  const listaFiltrada = useMemo(() => {
    if (!analise) return []
    return analise.resultado.filter(r => filtro === 'todos' || (filtro === 'aprox' ? r.aprox : r.situacao === filtro))
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
    { key: 'aprox', label: 'Leitura aproximada' },
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
        {pdfReady && ocrError && (
          <div style={{ background: '#fff8e6', border: `1px solid ${ACCENT}`, borderRadius: 8, padding: '12px 14px', fontSize: 13.5, marginBottom: 18 }}>
            <strong>O OCR não está disponível nesta máquina.</strong> A biblioteca de reconhecimento óptico
            não carregou — normalmente é bloqueio de rede ou de segurança (CSP). PDFs sem camada de texto
            (digitalizados ou gerados por “Imprimir em PDF”) não poderão ser lidos; os demais funcionam normalmente.
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

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, fontSize: 13.5, cursor: ocrError ? 'not-allowed' : 'pointer', color: ocrError ? MUTED : TEXT }}>
            <input
              id="usarOcr" type="checkbox" checked={usarOcrEfetivo} disabled={ocrError}
              onChange={e => setUsarOcr(e.target.checked)} style={{ marginTop: 2 }}
            />
            <span>
              Ler com OCR as páginas sem texto (PDF digitalizado ou gerado por “Imprimir em PDF”)
              {!ocrReady && !ocrError && <span style={{ color: MUTED }}> (carregando o leitor de OCR…)</span>}
            </span>
          </label>

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
                  {d.lendo ? <small style={{ fontSize: 12.5, color: NEUTRO, whiteSpace: 'nowrap' }}>{d.status || 'lendo…'}</small> : (<>
                    <small title={diagTexto(d)} style={{ color: MUTED, whiteSpace: 'nowrap', cursor: 'help' }}>{resumoLeitura(d)}</small>
                    <select
                      value={d.tipo}
                      onChange={e => alterarTipo(d.id, e.target.value as TipoDoc)}
                      style={{ padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}
                    >
                      <option value="guia">detalhe da guia</option>
                      <option value="relatorio">relatório do Portal</option>
                    </select>
                  </>)}
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
                CNPJ {analise.guia.cnpj || '—'} · competência {analise.competencia || '—'} · {lidosGuia} trabalhadores lidos na guia
                {analise.guia.qtd ? ` (a guia informa ${analise.guia.qtd})` : ''}
              </span>
            </div>

            {(analise.paginasOcr.length > 0 || analise.paginasVazias.length > 0 || faltaramNaGuia > 0) && (
              <div style={{ background: '#fff8e6', border: `1px solid ${ACCENT}`, borderRadius: 8, padding: '12px 14px', fontSize: 13.5, marginBottom: 18 }}>
                {[
                  analise.paginasOcr.length > 0 && (
                    <div key="ocr">
                      <strong>Páginas lidas por OCR.</strong><br />
                      {analise.paginasOcr.map(d => (
                        <span key={d.id}>{d.arquivo} — página(s) {d.ocr.join(', ')}<br /></span>
                      ))}
                      O reconhecimento pode trocar caracteres: quem aparecer em “Leitura aproximada” ou em “Não constam”
                      merece uma conferência na guia antes de enviar a observação.
                    </div>
                  ),
                  analise.paginasVazias.length > 0 && (
                    <div key="vazias">
                      <strong>Páginas que não puderam ser lidas.</strong><br />
                      {analise.paginasVazias.map(d => (
                        <span key={d.id}>{d.arquivo} — página(s) {d.vazias.join(', ')} de {d.totalPaginas}<br /></span>
                      ))}
                      Quem aparecer só nelas será marcado como “não consta”. Confira à mão.
                    </div>
                  ),
                  faltaramNaGuia > 0 && (
                    <div key="qtd">
                      <strong>Contagem da guia.</strong> A guia informa {analise.guia.qtd} trabalhadores e foram lidos {lidosGuia}.
                      {' '}Faltaram {faltaramNaGuia} — se o PDF veio por OCR, parte das linhas pode ter ficado ilegível.
                    </div>
                  ),
                ].filter(Boolean).map((bloco, i) => (
                  <div key={i} style={i ? { borderTop: `1px solid ${ACCENT}`, marginTop: 10, paddingTop: 10 } : undefined}>{bloco}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <Cartao n={falta.length} rotulo="não constam" cor={falta.length ? FALTA : OK} />
              <Cartao n={ok.length} rotulo="constam na guia" cor={OK} />
              <Cartao n={analise.resultado.length} rotulo="pessoas no Portal" />
              <Cartao n={fora.length} rotulo="desconsideradas" />
              <Cartao n={aprox.length} rotulo="leitura aproximada" cor={aprox.length ? NEUTRO : undefined} destaque={aprox.length > 0} />
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
                            {r.aprox && <span style={{ marginLeft: 4, display: 'inline-block', padding: '2px 8px', borderRadius: 11, fontSize: 11.5, fontWeight: 600, background: NEUTRO_BG, color: NEUTRO }}>leitura aproximada</span>}
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
