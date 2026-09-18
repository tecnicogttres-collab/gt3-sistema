'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type TipoDoc, type DiagPagina, type DocParaBlocos, type Resultado,
  type Situacao, type Janela, type ConfigLeitura,
  normBusca, fmtCpf, fmtCpfMasc, chaveNome, soDigitos, dataBr, z2, dinheiroBr,
  diagnosticarPagina, textoUtil, palavrasLegiveis, pontuarDoc, classificarTipo, equilibrarDocs,
  lerRelatorio, prepararBlocos, comparar, ehHolerite, acharPorTokens, janelaPrazo, normalizarComp,
  preencherModelo, preencherItem, guardar, recuperar,
  MODELO_PADRAO, MODELO_ATRASO_PADRAO, ITEM_FALTA_PADRAO, ITEM_DESC_PADRAO, ITEM_ATRASO_PADRAO,
  ITEM_DIVERG_PADRAO, ITEM_TERCEIRO_PADRAO, VINCULOS_PADRAO, CARGOS_PADRAO,
  ROTULOS_DATA_PADRAO, ROTULOS_VALOR_PADRAO, SIMILAR_PADRAO, OCR_IDIOMA_PADRAO, OCR_ESCALA_PADRAO,
  OCR_MIN_PADRAO, DIAS_FIM_PADRAO, DIAS_UTEIS_PADRAO, listaCsv,
} from './lib'

// ─── Design tokens (copiados de app/comparativo-guia-fgts/ComparativoGuiaClient.tsx) ──

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

const PDF_LIB_URL        = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDF_WORKER_URL     = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
const TESSERACT_LIB_URL  = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js'

// ─── pdf.js / tesseract.js (carregados via CDN em runtime) ────────────────

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

// Evita `declare global` — o módulo irmão já aumenta `Window` com o seu próprio
// formato de pdfjsLib; duas declarações globais com formatos diferentes dão erro
// de compilação. Em vez disso, lê-se `window` via cast local.
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

// ─── Tipos de UI ────────────────────────────────────────────────────────────

type DocEntry = {
  id: string
  arquivo: string
  lendo: boolean
  status: string
  paginas: string[]
  texto: string
  totalPaginas: number
  vazias: number[]
  ocr: number[]
  diag: DiagPagina[]
  erroOcr: string
  tipo: TipoDoc
  manual: boolean
  pontos: { comprovantes: number; relatorio: number } | null
}

type Filtro = 'falta' | 'divergente' | 'terceiro' | 'atraso' | 'tolerancia' | 'ok' | 'fora' | 'todos'

type Analise = {
  resultado: Resultado[]
  competencia: string
  janela: Janela
  empresa: string
  totalComprovantes: number
  paginasVazias: DocEntry[]
  paginasOcr: DocEntry[]
}

// ─── OCR: leitura de páginas escaneadas via Tesseract.js ───────────────────

type OcrConfig = { idioma: string; escala: number; minChars: number }
type OcrState = { scheduler: TesseractScheduler | null; nucleos: number }

function pontuarTexto(t: string): number {
  if (!t) return 0
  let p = 0
  p += (t.match(/\d{2}\/\d{2}\/\d{2,4}/g) || []).length * 6
  p += (t.match(/\d{3}[.,]\d{3}[.,]\d{3}[-\s]?\d{2}/g) || []).length * 6
  p += (t.match(/R\$|VALOR|BANCO|PAGAMENTO|COMPROVANTE|TRANSFER|CPF|AG[EÊ]NCIA|CONTA|FAVORECIDO|BENEFICI|TOTAL|DATA/gi) || []).length * 3
  p += (t.match(/\b[A-Za-zÀ-ÿ]{4,}\b/g) || []).length
  return p
}

async function renderizarPagina(pdf: PdfDocumentProxy, n: number, escala: number, giro: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(n)
  const vp = page.getViewport({ scale: escala, rotation: ((page.rotate || 0) + giro) % 360 })
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.floor(vp.width))
  c.height = Math.max(1, Math.floor(vp.height))
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas 2D indisponível neste navegador')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  return c
}

async function obterScheduler(ocrState: OcrState, cfg: OcrConfig, aviso?: (msg: string) => void): Promise<TesseractScheduler> {
  if (ocrState.scheduler) return ocrState.scheduler
  const Tesseract = getTesseract()
  if (!Tesseract) throw new Error('biblioteca de OCR não carregou')
  const quantos = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1))
  if (aviso) aviso('preparando OCR (' + quantos + (quantos > 1 ? ' núcleos' : ' núcleo') + ')…')
  const sch = Tesseract.createScheduler()
  const workers = await Promise.all(
    Array.from({ length: quantos }, () => Tesseract.createWorker(cfg.idioma || 'por', 1, {}))
  )
  workers.forEach(w => sch.addWorker(w))
  ocrState.scheduler = sch
  ocrState.nucleos = workers.length
  return sch
}

type ResultadoOcr = { pontos: number; texto: string; angulo: number }

async function reconhecer(pdf: PdfDocumentProxy, n: number, cfg: OcrConfig, giro: number, scheduler: TesseractScheduler): Promise<ResultadoOcr> {
  const canvas = await renderizarPagina(pdf, n, cfg.escala, giro)
  try {
    const r = await scheduler.addJob('recognize', canvas)
    const texto = (r && r.data && r.data.text) || ''
    return { pontos: pontuarTexto(texto), texto, angulo: giro }
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

/** Compara o giro com o seu oposto; a orientação certa costuma pontuar o dobro. */
async function melhorGiro(pdf: PdfDocumentProxy, n: number, cfg: OcrConfig, ordem: number[], scheduler: TesseractScheduler): Promise<ResultadoOcr> {
  let resultados: ResultadoOcr[] = []
  async function par(a: number, b: number): Promise<ResultadoOcr | null> {
    const rs = await Promise.all([reconhecer(pdf, n, cfg, a, scheduler), reconhecer(pdf, n, cfg, b, scheduler)])
    resultados = resultados.concat(rs)
    const alto = rs[0].pontos >= rs[1].pontos ? rs[0] : rs[1]
    const baixo = rs[0].pontos >= rs[1].pontos ? rs[1] : rs[0]
    return (alto.pontos >= 40 && alto.pontos >= baixo.pontos * 2) ? alto : null
  }
  const r1 = await par(ordem[0], ordem[1])
  if (r1) return r1
  await par(ordem[2], ordem[3])
  return resultados.sort((x, y) => y.pontos - x.pontos)[0]
}

/** Executa várias páginas ao mesmo tempo, respeitando o número de núcleos. */
async function emParalelo<T>(itens: T[], limite: number, tarefa: (item: T) => Promise<void>, aoConcluir?: (feitos: number) => void): Promise<void> {
  let i = 0, ativos = 0, feitos = 0
  return new Promise(resolve => {
    function seguir() {
      if (i >= itens.length && ativos === 0) { resolve(); return }
      while (ativos < limite && i < itens.length) {
        const item = itens[i++]
        ativos++
        tarefa(item).catch(() => {}).then(() => {
          ativos--; feitos++
          if (aoConcluir) aoConcluir(feitos)
          seguir()
        })
      }
    }
    seguir()
  })
}

/** Lê por OCR as páginas sem texto aproveitável.
 *  1) descobre o giro numa amostra;  2) processa tudo em paralelo nesse giro;
 *  3) refaz, com comparação completa, as páginas que saíram fracas. */
async function ocrPaginas(
  pdf: PdfDocumentProxy, vazias: number[], paginas: string[], cfg: OcrConfig,
  aviso: ((msg: string) => void) | undefined, diag: DiagPagina[],
  scheduler: TesseractScheduler, nucleos: number,
): Promise<{ recuperadas: number[]; restantes: number[]; erro: string }> {
  const recuperadas: number[] = []
  const restantes: number[] = []
  let erro = '', inicio = 0, anguloDoc = 0
  const porNumero = (a: number, b: number) => a - b
  const anota = (n: number, dados: Partial<DiagPagina>) => {
    const d = diag[n - 1]
    if (d) Object.assign(d, dados)
  }
  const guardarResultado = (n: number, res: ResultadoOcr): boolean => {
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

  inicio = Date.now()
  if (aviso) aviso('descobrindo a orientação das páginas…')
  const amostra = vazias.slice(0, Math.min(3, vazias.length))
  const angulos = await Promise.all(amostra.map(async n => {
    try {
      const r = await melhorGiro(pdf, n, cfg, [0, 180, 90, 270], scheduler)
      guardarResultado(n, r)
      return r.angulo
    } catch { return null }
  }))
  const conta: Record<number, number> = {}
  angulos.forEach(a => { if (a !== null) conta[a] = (conta[a] || 0) + 1 })
  Object.keys(conta).forEach(a => { if (!conta[anguloDoc] || conta[+a] > conta[anguloDoc]) anguloDoc = parseInt(a, 10) })
  const pendentes = vazias.filter(n => amostra.indexOf(n) < 0)

  const fracas: number[] = []
  const total = pendentes.length
  inicio = Date.now()
  await emParalelo(pendentes, nucleos, async n => {
    try {
      const res = await reconhecer(pdf, n, cfg, anguloDoc, scheduler)
      if (res.pontos >= 40) guardarResultado(n, res)
      else fracas.push(n)
    } catch (e) {
      erro = erro || (e instanceof Error ? e.message : 'falha no OCR')
      anota(n, { origem: 'ocr-erro', detalhe: erro })
      restantes.push(n)
    }
  }, feitos => progresso(feitos, total))

  if (fracas.length) {
    if (aviso) aviso('revendo ' + fracas.length + ' página(s) em outras orientações…')
    const ordem = [anguloDoc, (anguloDoc + 180) % 360, (anguloDoc + 90) % 360, (anguloDoc + 270) % 360]
    await emParalelo(fracas, Math.max(1, Math.floor(nucleos / 2)), async n => {
      try {
        const res = await melhorGiro(pdf, n, cfg, ordem, scheduler)
        if (!guardarResultado(n, res)) restantes.push(n)
      } catch (e) {
        erro = erro || (e instanceof Error ? e.message : 'falha no OCR')
        anota(n, { origem: 'ocr-erro', detalhe: erro })
        restantes.push(n)
      }
    })
  }

  return { recuperadas: recuperadas.sort(porNumero), restantes: restantes.sort(porNumero), erro }
}

type LeituraCompleta = { paginas: string[]; diag: DiagPagina[]; vazias: number[]; ocr: number[]; totalPaginas: number; erroOcr: string }

/** Lê o PDF inteiro: primeiro via pdf.js (camada de texto), depois — para as
 *  páginas sem texto aproveitável — via OCR, se marcado e disponível. */
async function lerPdfCompleto(
  file: File, minChars: number, cfgOcr: OcrConfig, usarOcr: boolean, ocrState: OcrState,
  onStatus?: (msg: string) => void,
): Promise<LeituraCompleta> {
  const pdfjsLib = getPdfJsLib()
  if (!pdfjsLib) throw new Error('o leitor de PDF não está disponível')
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const paginas: string[] = []
  const diag: DiagPagina[] = []
  const vazias: number[] = []

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
    const dg = diagnosticarPagina(tx, minChars)
    diag.push({ n, chars: dg.chars, palavras: dg.palavras, itens: tc.items.length, origem: 'pdf', motivo: dg.motivo || undefined })
    if (dg.motivo) vazias.push(n)
    if (onStatus) onStatus(`lendo página ${n} de ${pdf.numPages}…`)
  }

  if (!vazias.length) return { paginas, diag, vazias: [], ocr: [], totalPaginas: pdf.numPages, erroOcr: '' }
  if (!usarOcr || !getTesseract()) {
    return {
      paginas, diag, vazias: vazias.slice(), ocr: [], totalPaginas: pdf.numPages,
      erroOcr: getTesseract() ? 'OCR desmarcado' : 'biblioteca de OCR não carregou',
    }
  }
  try {
    const scheduler = await obterScheduler(ocrState, cfgOcr, onStatus)
    const res = await ocrPaginas(pdf, vazias, paginas, cfgOcr, onStatus, diag, scheduler, ocrState.nucleos)
    return { paginas, diag, vazias: res.restantes, ocr: res.recuperadas, totalPaginas: pdf.numPages, erroOcr: res.erro }
  } catch (e) {
    return {
      paginas, diag, vazias: vazias.slice(), ocr: [], totalPaginas: pdf.numPages,
      erroOcr: e instanceof Error ? e.message : 'falha ao iniciar o OCR',
    }
  }
}

// ─── Modelos padrão / chaves de localStorage ────────────────────────────────

const LS = {
  modelo: 'gt3_comprovantes_modelo',
  modeloAtraso: 'gt3_comprovantes_modeloAtraso',
  itFalta: 'gt3_comprovantes_itFalta',
  itDesc: 'gt3_comprovantes_itDesc',
  itAtraso: 'gt3_comprovantes_itAtraso',
  itDiverg: 'gt3_comprovantes_itDiverg',
  itTerceiro: 'gt3_comprovantes_itTerceiro',
  diasFim: 'gt3_comprovantes_diasFim',
  diasUteis: 'gt3_comprovantes_diasUteis',
  feriados: 'gt3_comprovantes_feriados',
  vinculos: 'gt3_comprovantes_vinculos',
  cargos: 'gt3_comprovantes_cargos',
  rotulosData: 'gt3_comprovantes_rotulosData',
  rotulosValor: 'gt3_comprovantes_rotulosValor',
  similar: 'gt3_comprovantes_similar',
  ocrIdioma: 'gt3_comprovantes_ocrIdioma',
  ocrEscala: 'gt3_comprovantes_ocrEscala',
} as const

// ─── Estilos compartilhados (copiados do módulo irmão) ─────────────────────

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
const linhaCfgStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '230px 1fr', gap: 12, alignItems: 'center', marginBottom: 10 }
const labelCfgStyle: React.CSSProperties = { fontSize: 13, color: MUTED }
const campoTextoCfg: React.CSSProperties = { width: '100%', padding: '7px 9px', border: `1px solid ${BORDER}`, borderRadius: 6, fontFamily: 'Consolas,monospace', fontSize: 12.5, boxSizing: 'border-box' }
const codeStyle: React.CSSProperties = { background: '#eef1f7', color: PRIMARY, borderRadius: 4, padding: '1px 6px', fontFamily: 'Consolas,monospace', fontSize: 12, marginRight: 4 }

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

const TAG: Record<Situacao, { texto: string; bg: string; cor: string }> = {
  ok:         { texto: 'com comprovante', bg: OK_BG,      cor: OK },
  falta:      { texto: 'sem comprovante', bg: FALTA_BG,   cor: FALTA },
  divergente: { texto: 'valor divergente', bg: FALTA_BG,  cor: FALTA },
  terceiro:   { texto: 'pago a terceiro', bg: NEUTRO_BG,  cor: NEUTRO },
  atraso:     { texto: 'fora do prazo',   bg: NEUTRO_BG,  cor: NEUTRO },
  fora:       { texto: 'desconsiderado',  bg: '#eceff4',  cor: MUTED },
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function ComparadorComprovantesClient() {
  const [pdfReady, setPdfReady] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  const [ocrReady, setOcrReady] = useState(false)
  const [ocrError, setOcrError] = useState(false)
  const ocrStateRef = useRef<OcrState>({ scheduler: null, nucleos: 1 })

  const [docs, setDocs] = useState<DocEntry[]>([])
  const [dropAtivo, setDropAtivo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [usarOcr, setUsarOcr] = useState(true)

  const [competencia, setCompetencia] = useState('')
  const [fmt, setFmt] = useState<'auto' | 'mdy' | 'dmy'>('auto')
  const [rData, setRData] = useState(true)
  const [rVinculo, setRVinculo] = useState(true)
  const [rCargo, setRCargo] = useState(true)
  const [rPrazo, setRPrazo] = useState(true)
  const [ocultarCpf, setOcultarCpf] = useState(true)
  const cpfExibir = useCallback((c: string) => (ocultarCpf ? fmtCpfMasc(c) : fmtCpf(c)), [ocultarCpf])

  // ── Configurações (persistidas em localStorage do navegador) ────────────
  const [modalCfgAberto, setModalCfgAberto] = useState(false)
  const [abaCfg, setAbaCfg] = useState<'regras' | 'texto' | 'prazo' | 'excecoes' | 'leitura'>('regras')
  const [modelo, setModelo] = useState(() => recuperar(LS.modelo) || MODELO_PADRAO)
  const [modeloAtraso, setModeloAtraso] = useState(() => recuperar(LS.modeloAtraso) || MODELO_ATRASO_PADRAO)
  const [itFalta, setItFalta] = useState(() => recuperar(LS.itFalta) || ITEM_FALTA_PADRAO)
  const [itDesc, setItDesc] = useState(() => recuperar(LS.itDesc) || ITEM_DESC_PADRAO)
  const [itAtraso, setItAtraso] = useState(() => recuperar(LS.itAtraso) || ITEM_ATRASO_PADRAO)
  const [itDiverg, setItDiverg] = useState(() => recuperar(LS.itDiverg) || ITEM_DIVERG_PADRAO)
  const [itTerceiro, setItTerceiro] = useState(() => recuperar(LS.itTerceiro) || ITEM_TERCEIRO_PADRAO)
  const [cfgDiasFim, setCfgDiasFim] = useState(() => recuperar(LS.diasFim) || String(DIAS_FIM_PADRAO))
  const [cfgDiasUteis, setCfgDiasUteis] = useState(() => recuperar(LS.diasUteis) || String(DIAS_UTEIS_PADRAO))
  const [cfgFeriados, setCfgFeriados] = useState(() => recuperar(LS.feriados) || '')
  const [cfgVinculos, setCfgVinculos] = useState(() => recuperar(LS.vinculos) || VINCULOS_PADRAO)
  const [cfgCargos, setCfgCargos] = useState(() => recuperar(LS.cargos) || CARGOS_PADRAO)
  const [cfgRotDatas, setCfgRotDatas] = useState(() => recuperar(LS.rotulosData) || ROTULOS_DATA_PADRAO)
  const [cfgRotValor, setCfgRotValor] = useState(() => recuperar(LS.rotulosValor) || ROTULOS_VALOR_PADRAO)
  const [cfgSimilar, setCfgSimilar] = useState(() => recuperar(LS.similar) || String(SIMILAR_PADRAO))
  const [cfgOcrIdioma, setCfgOcrIdioma] = useState(() => recuperar(LS.ocrIdioma) || OCR_IDIOMA_PADRAO)
  const [cfgOcrEscala, setCfgOcrEscala] = useState(() => recuperar(LS.ocrEscala) || String(OCR_ESCALA_PADRAO))
  const [statusCfg, setStatusCfg] = useState('')

  const [analise, setAnalise] = useState<Analise | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('falta')
  const [copiadoObs, setCopiadoObs] = useState(false)
  const [copiadoAtraso, setCopiadoAtraso] = useState(false)
  const [avisoApagado, setAvisoApagado] = useState('')

  const [buscaTermo, setBuscaTermo] = useState('')
  const [buscaResultado, setBuscaResultado] = useState<{ arquivo: string; pagina: number; via: string; origem: string; classificacao: string; trecho: string }[] | null>(null)
  const [verDocId, setVerDocId] = useState('')
  const [verNumero, setVerNumero] = useState('')
  const [verSaida, setVerSaida] = useState('')

  // Carrega o leitor de PDF (pdf.js via CDN) — mesma técnica do comparativo-guia-fgts.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function marcarPronto() {
      const lib = getPdfJsLib()
      if (lib) { lib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL; setPdfReady(true) }
      else setPdfError(true)
    }
    if (getPdfJsLib()) { queueMicrotask(marcarPronto); return }
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

  // Carrega o leitor de OCR (tesseract.js via CDN), com a mesma técnica.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function marcarPronto() {
      if (getTesseract()) setOcrReady(true)
      else setOcrError(true)
    }
    if (getTesseract()) { queueMicrotask(marcarPronto); return }
    let script = document.getElementById('gt3-tesseract-lib') as HTMLScriptElement | null
    const onError = () => setOcrError(true)
    if (!script) {
      script = document.createElement('script')
      script.id = 'gt3-tesseract-lib'
      script.src = TESSERACT_LIB_URL
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

  // Efetivamente disponível para uso: marcado pelo usuário e sem falha de carregamento.
  const usarOcrEfetivo = usarOcr && !ocrError

  // Encerra os workers de OCR ao sair da tela — nada fica rodando em memória.
  useEffect(() => {
    const ocrState = ocrStateRef.current
    return () => {
      const sch = ocrState.scheduler
      if (sch && sch.terminate) { try { sch.terminate() } catch { /* ignora */ } }
      ocrState.scheduler = null
    }
  }, [])

  // ── Configuração atual (lida do estado, usada na leitura/comparação) ────

  const cfgLeitura = useMemo<ConfigLeitura>(() => ({
    rotulosData: listaCsv(cfgRotDatas),
    rotulosValor: listaCsv(cfgRotValor),
    similar: parseFloat(cfgSimilar) || SIMILAR_PADRAO,
  }), [cfgRotDatas, cfgRotValor, cfgSimilar])

  const cfgOcr = useMemo<OcrConfig>(() => ({
    idioma: (cfgOcrIdioma || OCR_IDIOMA_PADRAO).trim(),
    escala: parseFloat(cfgOcrEscala) || OCR_ESCALA_PADRAO,
    minChars: OCR_MIN_PADRAO,
  }), [cfgOcrIdioma, cfgOcrEscala])

  const cfgPrazo = useMemo(() => ({
    diasFim: parseInt(cfgDiasFim, 10) || DIAS_FIM_PADRAO,
    diasUteis: parseInt(cfgDiasUteis, 10) || DIAS_UTEIS_PADRAO,
    feriados: cfgFeriados,
  }), [cfgDiasFim, cfgDiasUteis, cfgFeriados])

  const janelaPreview = useMemo(() => janelaPrazo(normalizarComp(competencia), cfgPrazo), [competencia, cfgPrazo])

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
        id, arquivo: f.name, lendo: true, status: 'lendo…', paginas: [], texto: '', totalPaginas: 0,
        vazias: [], ocr: [], diag: [], erroOcr: '', tipo: 'comprovantes', manual: false, pontos: null,
      }
      setDocs(prev => [...prev, novo])
      const marcarStatus = (msg: string) => setDocs(prev => prev.map(d => d.id === id ? { ...d, status: msg } : d))
      lerPdfCompleto(f, OCR_MIN_PADRAO, cfgOcr, usarOcrEfetivo, ocrStateRef.current, marcarStatus).then(r => {
        const texto = r.paginas.join('\n')
        const pontos = pontuarDoc(texto)
        setDocs(prev => {
          const next = prev.map(d => d.id === id ? {
            ...d, paginas: r.paginas, texto, totalPaginas: r.totalPaginas, vazias: r.vazias,
            ocr: r.ocr, diag: r.diag, erroOcr: r.erroOcr, lendo: false, status: '',
            pontos, tipo: classificarTipo(pontos),
          } : d)
          return equilibrarDocs(next)
        })
      }).catch(err => {
        setDocs(prev => prev.map(d => d.id === id ? { ...d, lendo: false, status: '', tipo: 'comprovantes' } : d))
        alert('Não consegui ler ' + f.name + ': ' + (err instanceof Error ? err.message : String(err)))
      })
    })
  }, [pdfReady, usarOcrEfetivo, cfgOcr])

  function alterarTipo(id: string, tipo: TipoDoc) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, tipo, manual: true } : d))
    setAnalise(null)
  }
  function removerDoc(id: string) {
    setDocs(prev => prev.filter(d => d.id !== id))
    setAnalise(null)
  }

  function novaAnalise() {
    setDocs([])
    setAnalise(null)
    setFiltro('falta')
    setCompetencia('')
    setBuscaTermo('')
    setBuscaResultado(null)
    setVerSaida('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    const agora = new Date()
    setAvisoApagado(`Arquivos e dados desta análise apagados da memória às ${z2(agora.getHours())}:${z2(agora.getMinutes())}.`)
    setTimeout(() => setAvisoApagado(''), 8000)
  }

  // ── Processamento ─────────────────────────────────────────────────────

  function processar() {
    if (docs.some(d => d.lendo)) {
      alert('Ainda estou lendo um dos PDFs. Tente de novo em instantes.')
      return
    }
    const compNorm = normalizarComp(competencia)
    if (!compNorm) {
      alert('Informe a competência no formato mm/aaaa. Ela define o prazo dos depósitos e é obrigatória nesta conferência.')
      return
    }

    let textoRel = ''
    const paginasVazias: DocEntry[] = []
    const paginasOcr: DocEntry[] = []
    docs.forEach(d => {
      if (d.tipo === 'relatorio') textoRel += '\n' + d.texto
      if (d.vazias.length) paginasVazias.push(d)
      if (d.ocr.length) paginasOcr.push(d)
    })

    const docsParaBlocos: DocParaBlocos[] = docs.map(d => ({
      tipo: d.tipo, arquivo: d.arquivo, paginas: d.paginas, ocr: d.ocr, diag: d.diag,
    }))
    const blocos = prepararBlocos(docsParaBlocos)

    if (!textoRel.trim() || !blocos.length) {
      alert('Faltou um dos documentos: preciso do relatório do Portal e dos comprovantes de depósito.\n\n' +
        'Se os PDFs já estão na lista, confira o tipo indicado ao lado de cada um.')
      return
    }

    const { pessoas: lista, empresa } = lerRelatorio(textoRel, fmt)
    if (!lista.length) {
      alert('Nenhuma pessoa foi reconhecida no relatório do Portal. Confira se o documento marcado ' +
        'como "relatório do Portal" é o certo.')
      return
    }

    const janela = janelaPrazo(compNorm, cfgPrazo)
    if (!janela) {
      alert('Não consegui calcular o prazo para essa competência. Confira o valor informado.')
      return
    }

    const resultado = comparar(lista, blocos, {
      competencia: compNorm, janela,
      data: rData, vinculo: rVinculo, cargo: rCargo, prazo: rPrazo,
      vinculos: listaCsv(cfgVinculos), cargos: listaCsv(cfgCargos), leitura: cfgLeitura,
    })

    const ordem: Record<Situacao, number> = { falta: 0, divergente: 1, terceiro: 2, atraso: 3, ok: 4, fora: 5 }
    resultado.sort((a, b) => (ordem[a.situacao] - ordem[b.situacao]) || a.dados.pessoa.localeCompare(b.dados.pessoa, 'pt-BR'))

    setCompetencia(compNorm)
    setAnalise({ resultado, competencia: compNorm, janela, empresa, totalComprovantes: blocos.length, paginasVazias, paginasOcr })
    setFiltro('falta')
  }

  // ── Derivados da análise ──────────────────────────────────────────────

  const falta = useMemo(() => analise?.resultado.filter(r => r.situacao === 'falta') ?? [], [analise])
  const divergentes = useMemo(() => analise?.resultado.filter(r => r.situacao === 'divergente') ?? [], [analise])
  const terceiros = useMemo(() => analise?.resultado.filter(r => r.situacao === 'terceiro') ?? [], [analise])
  const atrasados = useMemo(() => analise?.resultado.filter(r => r.situacao === 'atraso') ?? [], [analise])
  const ok = useMemo(() => analise?.resultado.filter(r => r.situacao === 'ok') ?? [], [analise])
  const fora = useMemo(() => analise?.resultado.filter(r => r.situacao === 'fora') ?? [], [analise])
  const tolerantes = useMemo(() => analise?.resultado.filter(r => r.achado?.tolerancia) ?? [], [analise])

  const listaFiltrada = useMemo(() => {
    if (!analise) return []
    return analise.resultado.filter(r => {
      if (filtro === 'todos') return true
      if (filtro === 'tolerancia') return !!r.achado?.tolerancia
      return r.situacao === filtro
    })
  }, [analise, filtro])

  const camposDe = useCallback((r: Resultado): Record<string, string> => ({
    nome: r.dados.pessoa,
    cpf: cpfExibir(r.dados.cpf),
    cadastro: dataBr(r.dados.dataCad) || r.dados.cadastro,
    motivo: r.motivo,
    atividade: r.dados.atividade,
    vinculo: r.dados.vinculo,
    data_deposito: r.achado && r.achado.data ? dataBr(r.achado.data) : 'data não identificada',
    valor: r.achado && r.achado.valor ? r.achado.valor : '',
    valor_holerite: r.holerite && r.holerite.liquido !== null ? dinheiroBr(r.holerite.liquido) : '',
    favorecido: r.terceiro && r.terceiro.favorecido ? r.terceiro.favorecido : 'outra pessoa',
    dias_atraso: r.diasAtraso ? String(r.diasAtraso) : '',
  }), [cpfExibir])

  const dadosModelo = useMemo(() => {
    if (!analise) return null
    const agora = new Date()
    const dataTexto = dataBr(agora), horaTexto = `${z2(agora.getHours())}:${z2(agora.getMinutes())}`
    const avaliadas = analise.resultado.length - fora.length
    const dados: Record<string, string | number | boolean> = {
      data: dataTexto, hora: horaTexto, data_hora: dataTexto + ' ' + horaTexto,
      empresa: analise.empresa || 'empresa não identificada',
      competencia: analise.competencia,
      prazo_inicio: dataBr(analise.janela.inicio), prazo_final: dataBr(analise.janela.fim),
      avaliadas, contempladas: avaliadas - falta.length,
      qtd_faltantes: falta.length, qtd_desconsiderados: fora.length, qtd_atrasados: atrasados.length,
      qtd_divergencias: divergentes.length, qtd_terceiros: terceiros.length,
      divergencias: divergentes.map(r => preencherItem(itDiverg || ITEM_DIVERG_PADRAO, camposDe(r))).join('\n'),
      terceiros: terceiros.map(r => preencherItem(itTerceiro || ITEM_TERCEIRO_PADRAO, camposDe(r))).join('\n'),
      cond_divergencias: divergentes.length > 0,
      cond_terceiros: terceiros.length > 0,
      alerta: analise.paginasVazias.map(d => 'páginas sem texto em ' + d.arquivo + ': ' + d.vazias.join(', ')).join(' | '),
      faltantes: falta.map(r => preencherItem(itFalta || ITEM_FALTA_PADRAO, camposDe(r))).join('\n'),
      desconsiderados: fora.map(r => preencherItem(itDesc || ITEM_DESC_PADRAO, camposDe(r))).join('\n'),
      atrasados: atrasados.map(r => preencherItem(itAtraso || ITEM_ATRASO_PADRAO, camposDe(r))).join('\n'),
      cond_alerta: analise.paginasVazias.length > 0,
      cond_faltantes: falta.length > 0,
      cond_sem_faltantes: falta.length === 0,
      cond_desconsiderados: fora.length > 0,
      cond_atrasados: atrasados.length > 0,
    }
    return dados
  }, [analise, falta, fora, atrasados, divergentes, terceiros, itDiverg, itTerceiro, itFalta, itDesc, itAtraso, camposDe])

  const observacao = useMemo(() => dadosModelo ? preencherModelo(modelo || MODELO_PADRAO, dadosModelo) : '', [dadosModelo, modelo])
  const observacaoAtraso = useMemo(
    () => dadosModelo ? preencherModelo(modeloAtraso || MODELO_ATRASO_PADRAO, dadosModelo) : '',
    [dadosModelo, modeloAtraso]
  )

  // ── Config: salvar / restaurar ────────────────────────────────────────

  function salvarConfig() {
    const pares: [string, string][] = [
      [LS.modelo, modelo], [LS.modeloAtraso, modeloAtraso], [LS.itFalta, itFalta], [LS.itDesc, itDesc],
      [LS.itAtraso, itAtraso], [LS.itDiverg, itDiverg], [LS.itTerceiro, itTerceiro],
      [LS.diasFim, cfgDiasFim], [LS.diasUteis, cfgDiasUteis], [LS.feriados, cfgFeriados],
      [LS.vinculos, cfgVinculos], [LS.cargos, cfgCargos], [LS.rotulosData, cfgRotDatas],
      [LS.rotulosValor, cfgRotValor], [LS.similar, cfgSimilar], [LS.ocrIdioma, cfgOcrIdioma],
      [LS.ocrEscala, cfgOcrEscala],
    ]
    const ok2 = pares.every(([chave, valor]) => guardar(chave, valor))
    setStatusCfg(ok2 ? 'Configuração salva neste navegador.' : 'Não foi possível salvar aqui; vale só para esta sessão.')
    setTimeout(() => setStatusCfg(''), 4000)
  }
  function restaurarConfig() {
    setModelo(MODELO_PADRAO); setModeloAtraso(MODELO_ATRASO_PADRAO)
    setItFalta(ITEM_FALTA_PADRAO); setItDesc(ITEM_DESC_PADRAO); setItAtraso(ITEM_ATRASO_PADRAO)
    setItDiverg(ITEM_DIVERG_PADRAO); setItTerceiro(ITEM_TERCEIRO_PADRAO)
    setCfgDiasFim(String(DIAS_FIM_PADRAO)); setCfgDiasUteis(String(DIAS_UTEIS_PADRAO)); setCfgFeriados('')
    setCfgVinculos(VINCULOS_PADRAO); setCfgCargos(CARGOS_PADRAO)
    setCfgRotDatas(ROTULOS_DATA_PADRAO); setCfgRotValor(ROTULOS_VALOR_PADRAO); setCfgSimilar(String(SIMILAR_PADRAO))
    setCfgOcrIdioma(OCR_IDIOMA_PADRAO); setCfgOcrEscala(String(OCR_ESCALA_PADRAO))
  }

  // ── Cópia, CSV, busca livre, visualizar página ──────────────────────────

  function copiarTexto(texto: string, marcar: (v: boolean) => void) {
    const feito = () => { marcar(true); setTimeout(() => marcar(false), 1600) }
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
    const linhas: (string | number)[][] = [[
      'Situacao', 'Motivo', 'Pessoa', 'CPF', 'Atividade', 'Vinculo', 'Cadastro',
      'Data do deposito', 'Dias de atraso', 'Valor pago', 'Liquido do holerite',
      'Comprovante', 'Localizado por', 'Observacao',
    ]]
    const rotuloSituacao: Record<Situacao, string> = {
      ok: 'Com comprovante', falta: 'Sem comprovante', divergente: 'Valor divergente',
      terceiro: 'Pago a terceiro', atraso: 'Fora do prazo', fora: 'Desconsiderado',
    }
    analise.resultado.forEach(r => {
      linhas.push([
        rotuloSituacao[r.situacao], r.motivo, r.dados.pessoa, cpfExibir(r.dados.cpf), r.dados.atividade, r.dados.vinculo,
        dataBr(r.dados.dataCad) || r.dados.cadastro,
        r.achado && r.achado.data ? dataBr(r.achado.data) : '', r.diasAtraso || '',
        r.achado ? r.achado.valor : '',
        r.holerite && r.holerite.liquido !== null ? dinheiroBr(r.holerite.liquido) : '',
        r.achado ? r.achado.bloco : '', r.achado ? r.achado.via : '',
        r.nota,
      ])
    })
    const csv = '﻿' + linhas.map(l => l.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'conferencia-comprovantes.csv'
    a.click()
  }

  const JANELA_TOKENS_BUSCA = 180

  function buscarNoTexto() {
    const termo = buscaTermo.trim()
    if (!termo) { setBuscaResultado(null); return }
    const digitos = soDigitos(termo)
    const tokens = chaveNome(termo).split(' ').filter(Boolean)
    const termoNorm = normBusca(termo).replace(/\s+/g, ' ').trim()
    const achados: { arquivo: string; pagina: number; via: string; origem: string; classificacao: string; trecho: string }[] = []

    docs.forEach(d => {
      d.paginas.forEach((tx, i) => {
        if (achados.length >= 12) return
        const norm = normBusca(tx)
        let pos = -1, via = ''
        const direto = norm.replace(/\s+/g, ' ').indexOf(termoNorm)
        if (direto >= 0) { pos = norm.indexOf(termoNorm.split(' ')[0]); via = 'texto exato' }
        if (pos < 0 && digitos.length >= 6) {
          const apenas = norm.replace(/\D/g, '')
          if (apenas.indexOf(digitos) >= 0) { pos = 0; via = 'dígitos do CPF' }
        }
        if (pos < 0 && tokens.length) {
          const pt = acharPorTokens(norm, tokens, JANELA_TOKENS_BUSCA, 0.5)
          if (pt !== -1) { pos = pt.pos; via = pt.tolerante ? 'partes do nome, com tolerância' : 'partes do nome' }
        }
        if (pos >= 0 && achados.length < 12) {
          const ini = Math.max(0, pos - 90), fim = Math.min(norm.length, pos + 160)
          achados.push({
            arquivo: d.arquivo, pagina: i + 1, via,
            origem: d.ocr.indexOf(i + 1) >= 0 ? 'OCR' : 'texto do PDF',
            classificacao: ehHolerite(norm) ? 'holerite' : 'comprovante',
            trecho: tx.slice(ini, fim).replace(/\s+/g, ' '),
          })
        }
      })
    })
    setBuscaResultado(achados)
  }

  function verPagina() {
    const d = docs.find(x => x.id === verDocId)
    const n = parseInt(verNumero, 10)
    if (!d || !n || n < 1 || n > d.paginas.length) {
      setVerSaida('Escolha um arquivo e uma página válida.')
      return
    }
    const tx = (d.paginas[n - 1] || '').trim()
    const info = d.diag[n - 1]
    const cabec = `Página ${n} de ${d.totalPaginas}` +
      (info ? ` · origem: ${info.origem} · ${info.chars || 0} caracteres` + (info.angulo !== undefined ? ` · giro ${info.angulo}°` : '') : '') +
      '\n────────────────────────────────────────\n'
    setVerSaida(cabec + (tx ? tx.slice(0, 4000) : '(nenhum texto foi extraído desta página)'))
  }

  // ── Drag & drop ────────────────────────────────────────────────────────

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDropAtivo(false)
    if (analise) setAnalise(null)
    receber(Array.from(e.dataTransfer.files))
  }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (analise) setAnalise(null)
    receber(Array.from(e.target.files || []))
    e.target.value = ''
  }

  function resumoLeitura(d: DocEntry): string {
    if (!d.diag.length) return ''
    const porOcr = d.diag.filter(p => p.origem === 'ocr').length
    const falhou = d.diag.filter(p => p.origem === 'ocr-vazio' || p.origem === 'ocr-erro').length
    const semTexto = d.vazias.length
    const partes = [d.totalPaginas + ' pág.']
    if (porOcr) partes.push(porOcr + ' por OCR')
    if (falhou) partes.push(falhou + ' sem leitura')
    else if (semTexto) partes.push(semTexto + ' sem texto')
    return partes.join(' · ')
  }

  const semDocs = docs.length === 0
  const filtros: { key: Filtro; label: string }[] = [
    { key: 'falta', label: 'Sem comprovante' },
    { key: 'divergente', label: 'Valor divergente' },
    { key: 'terceiro', label: 'Pago a terceiro' },
    { key: 'atraso', label: 'Fora do prazo' },
    { key: 'tolerancia', label: 'Grafia diferente' },
    { key: 'ok', label: 'Com comprovante' },
    { key: 'fora', label: 'Desconsiderados' },
    { key: 'todos', label: 'Todos' },
  ]
  const precisaObservacao = analise ? (falta.length > 0 || divergentes.length > 0 || terceiros.length > 0 || analise.paginasVazias.length > 0) : false

  return (
    <div style={{ background: BG, minHeight: '100%', margin: '-24px', padding: '24px 20px 60px', fontFamily: '"Segoe UI",Roboto,Helvetica,Arial,sans-serif', fontSize: 15, lineHeight: 1.5, color: TEXT }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, maxWidth: 1180, margin: '0 auto 20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: PRIMARY_DARK }}>Conferência de Comprovantes de Depósito</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            Compara as pessoas do relatório do Portal GT3 com os comprovantes de depósito bancário e confere o prazo de pagamento.
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
            <strong>O OCR não está disponível nesta máquina.</strong> A biblioteca de reconhecimento óptico não
            carregou — normalmente é bloqueio de rede ou falta de internet. Páginas escaneadas, ou com fonte sem
            mapa de caracteres, não poderão ser lidas; o resto da conferência funciona normalmente.
          </div>
        )}

        <div style={{ margin: '0 0 18px', padding: '10px 14px', background: '#eef3fc', borderLeft: `3px solid ${PRIMARY}`, borderRadius: 6, fontSize: 12.5, color: MUTED }}>
          Os PDFs são lidos aqui mesmo, no seu navegador. Nenhum arquivo, nome ou CPF é enviado para servidor
          nenhum, e tudo é apagado da memória ao remover os arquivos ou fechar a aba.
        </div>

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
            <small style={{ color: MUTED }}>O relatório do Portal e os comprovantes são identificados pelo conteúdo</small>
            <input
              ref={fileInputRef} type="file" accept="application/pdf" multiple
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, fontSize: 13.5, cursor: ocrError ? 'not-allowed' : 'pointer', color: ocrError ? MUTED : TEXT }}>
            <input
              type="checkbox" checked={usarOcrEfetivo} disabled={ocrError || !ocrReady}
              onChange={e => setUsarOcr(e.target.checked)} style={{ marginTop: 2 }}
            />
            Ler com OCR as páginas escaneadas (comprovante fotografado ou digitalizado)
            {!ocrReady && !ocrError && <span style={{ color: MUTED }}> (carregando o leitor de OCR…)</span>}
          </label>

          {docs.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: `1px solid ${BORDER}`, marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, color: MUTED }}>Arquivos anexados</span>
                <button
                  onClick={novaAnalise}
                  title="Remover todos os PDFs e apagar os dados"
                  aria-label="Remover todos os PDFs e apagar os dados"
                  style={{ cursor: 'pointer', color: FALTA, border: `1px solid ${FALTA}`, background: FALTA_BG, borderRadius: '50%', width: 26, height: 26, fontSize: 15, lineHeight: 1 }}
                >×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docs.map(d => (
                  <div key={d.id}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${BORDER}`,
                      borderRadius: 8, padding: '9px 12px', fontSize: 13.5, background: '#fff',
                    }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {d.arquivo}</span>
                      {d.lendo ? <small style={{ color: NEUTRO, whiteSpace: 'nowrap' }}>{d.status || 'lendo…'}</small> : (
                        <>
                          <small style={{ color: MUTED, whiteSpace: 'nowrap' }}>{resumoLeitura(d)}</small>
                          <select
                            value={d.tipo}
                            onChange={e => alterarTipo(d.id, e.target.value as TipoDoc)}
                            style={{ padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}
                          >
                            <option value="comprovantes">comprovantes de depósito</option>
                            <option value="relatorio">relatório do Portal</option>
                          </select>
                        </>
                      )}
                      <button
                        onClick={() => removerDoc(d.id)}
                        title="remover"
                        style={{ cursor: 'pointer', color: MUTED, border: 0, background: 'none', fontSize: 17, lineHeight: 1 }}
                      >×</button>
                    </div>
                    {!d.lendo && d.diag.length > 0 && (
                      <details style={{ margin: '-2px 0 0' }}>
                        <summary style={{ fontSize: 12.5, padding: '4px 12px', color: PRIMARY, cursor: 'pointer' }}>ver leitura de cada página</summary>
                        {d.erroOcr && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: FALTA }}>OCR: {d.erroOcr}</p>}
                        <table style={{ margin: '6px 0 10px', fontSize: 12.5, width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {['Pág.', 'Origem', 'Texto obtido', 'Detalhe'].map(h => (
                                <th key={h} style={{ padding: '5px 8px', fontSize: 11.5, textAlign: 'left', color: MUTED, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {d.diag.map(p => {
                              const rotulos: Record<string, string> = { pdf: 'texto do PDF', ocr: 'OCR', 'ocr-vazio': 'OCR não extraiu texto', 'ocr-erro': 'erro no OCR' }
                              const extra: string[] = []
                              if (p.origem === 'ocr' || p.origem === 'ocr-vazio') {
                                extra.push('giro ' + (p.angulo || 0) + '°')
                                if (p.pontos !== undefined) extra.push(p.pontos + ' pts')
                              }
                              if (p.origem === 'pdf' && p.motivo) extra.push(p.motivo)
                              if (p.classificacao) extra.push('classificada como ' + p.classificacao)
                              if (p.palavras !== undefined) extra.push(p.palavras + ' palavras')
                              if (p.detalhe) extra.push(p.detalhe)
                              return (
                                <tr key={p.n}>
                                  <td style={{ padding: '4px 8px' }}>{p.n}</td>
                                  <td style={{ padding: '4px 8px' }}>{rotulos[p.origem] || p.origem}</td>
                                  <td style={{ padding: '4px 8px' }}>{p.chars || 0} caracteres</td>
                                  <td style={{ padding: '4px 8px' }}>{extra.join(' · ')}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {avisoApagado && (
            <div style={{ background: OK_BG, color: OK, borderRadius: 8, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, marginTop: 14 }}>{avisoApagado}</div>
          )}

          {!semDocs && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 16,
              borderTop: `1px solid ${BORDER}`, flexWrap: 'wrap',
            }}>
              <div style={{ background: NEUTRO_BG, border: `2px solid ${ACCENT}`, borderRadius: 8, padding: '10px 14px' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: TEXT, display: 'block', marginBottom: 4 }} htmlFor="comp">
                  Competência <span style={{ color: FALTA }}>obrigatória</span>
                </label>
                <input
                  id="comp" value={competencia} onChange={e => setCompetencia(e.target.value)}
                  placeholder="08/2026 ou 082026" size={12}
                  style={{ fontSize: 19, fontWeight: 700, padding: '8px 12px', border: `2px solid ${ACCENT}`, borderRadius: 6, textAlign: 'center', letterSpacing: 0.5, minWidth: 150, color: PRIMARY_DARK }}
                />
              </div>
              <span style={{ flex: '1 1 320px', minWidth: 200, fontSize: 13.5, color: MUTED }}>
                {janelaPreview
                  ? <>Competência <b>{janelaPreview.competencia}</b>: depósitos esperados entre <b>{dataBr(janelaPreview.inicio)}</b> e <b>{dataBr(janelaPreview.fim)}</b> ({cfgPrazo.diasUteis}º dia útil do mês seguinte, já descontados sábados, domingos e feriados).</>
                  : 'Informe a competência (mm/aaaa) para ver o prazo de depósito aplicado.'}
              </span>
              <button onClick={processar} style={{ ...botaoStyle, padding: '20px 54px', fontSize: 19, borderRadius: 8, marginLeft: 'auto' }}>Comparar</button>
            </div>
          )}

          {!semDocs && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 13, color: PRIMARY, cursor: 'pointer' }}>Procurar um nome ou CPF no texto lido dos PDFs</summary>
              <div style={{ display: 'flex', gap: 8, margin: '10px 0', flexWrap: 'wrap' }}>
                <input
                  value={buscaTermo} onChange={e => setBuscaTermo(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarNoTexto() } }}
                  placeholder="Ex.: Joseane Padilha  ou  123.456.789-00"
                  style={{ flex: '1 1 280px', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 14 }}
                />
                <button onClick={buscarNoTexto} style={botaoSecStyle}>Procurar</button>
              </div>
              {buscaResultado && (
                buscaResultado.length === 0 ? (
                  <p style={{ fontSize: 13, color: FALTA, padding: '6px 0' }}>
                    Não encontrei esse termo em nenhuma página lida.
                    {docs.reduce((s, d) => s + d.vazias.length, 0) > 0
                      ? ' Há página(s) que não puderam ser lidas — é bem provável que a pessoa esteja em uma delas.'
                      : ' O texto foi lido, mas o termo não aparece exatamente assim nos PDFs.'}
                  </p>
                ) : buscaResultado.map((a, i) => (
                  <div key={i} style={{ border: `1px solid ${BORDER}`, borderLeft: `3px solid ${OK}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontSize: 12.5 }}>
                    <b style={{ color: PRIMARY }}>{a.arquivo} · pág. {a.pagina}</b> — {a.origem}, classificada como {a.classificacao}, achado por {a.via}
                    <span style={{ display: 'block', marginTop: 4, fontFamily: 'Consolas,monospace', color: MUTED }}>{a.trecho}</span>
                  </div>
                ))
              )}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                <strong style={{ fontSize: 13 }}>Ver o texto que foi lido de uma página</strong>
                <div style={{ display: 'flex', gap: 8, margin: '10px 0', flexWrap: 'wrap' }}>
                  <select value={verDocId} onChange={e => setVerDocId(e.target.value)} style={{ padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13.5, flex: '1 1 220px' }}>
                    <option value="">selecione o arquivo</option>
                    {docs.map(d => <option key={d.id} value={d.id}>{d.arquivo}</option>)}
                  </select>
                  <input
                    type="number" min={1} value={verNumero} onChange={e => setVerNumero(e.target.value)}
                    placeholder="página" style={{ flex: '0 0 110px', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13.5 }}
                  />
                  <button onClick={verPagina} style={botaoSecStyle}>Ver texto</button>
                </div>
                {verSaida && (
                  <pre style={{ background: '#f7f9fc', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, fontSize: 12, maxHeight: 340, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{verSaida}</pre>
                )}
              </div>
            </details>
          )}
        </section>

        {modalCfgAberto && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setModalCfgAberto(false) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,45,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 1200, overflow: 'auto' }}
          >
            <div style={{ background: '#fff', borderRadius: 10, maxWidth: 860, width: '100%', boxShadow: '0 18px 50px rgba(20,28,45,.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
                <h2 style={{ margin: 0, fontSize: 16, color: PRIMARY }}>Configurações</h2>
                <button onClick={() => setModalCfgAberto(false)} aria-label="Fechar" style={{ border: 0, background: 'none', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: MUTED }}>×</button>
              </div>
              <div style={{ padding: '18px 20px 22px' }}>
                <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${BORDER}`, marginBottom: 16, flexWrap: 'wrap' }}>
                  {([
                    ['regras', 'Regras'], ['texto', 'Texto'], ['prazo', 'Prazo'], ['excecoes', 'Exceções'], ['leitura', 'Leitura dos comprovantes'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setAbaCfg(key)}
                      style={{
                        border: 0, background: 'none', padding: '9px 14px', cursor: 'pointer', fontSize: 13.5,
                        color: abaCfg === key ? PRIMARY : MUTED, fontWeight: abaCfg === key ? 600 : 400,
                        borderBottom: `3px solid ${abaCfg === key ? PRIMARY : 'transparent'}`,
                      }}
                    >{label}</button>
                  ))}
                </div>

                {abaCfg === 'regras' && (
                  <div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="fmt">Formato das datas do relatório</label>
                      <select id="fmt" value={fmt} onChange={e => setFmt(e.target.value as 'auto' | 'mdy' | 'dmy')} style={inputStyle}>
                        <option value="auto">Detectar automaticamente</option>
                        <option value="mdy">MM/DD/AAAA</option>
                        <option value="dmy">DD/MM/AAAA</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, marginTop: 14 }}>
                      <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={rData} onChange={e => setRData(e.target.checked)} />
                        Desconsiderar cadastro posterior à competência
                      </label>
                      <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={rVinculo} onChange={e => setRVinculo(e.target.checked)} />
                        Desconsiderar os vínculos configurados
                      </label>
                      <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={rCargo} onChange={e => setRCargo(e.target.checked)} />
                        Desconsiderar os cargos configurados
                      </label>
                      <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={rPrazo} onChange={e => setRPrazo(e.target.checked)} />
                        Conferir a data do depósito contra o prazo
                      </label>
                      <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={ocultarCpf} onChange={e => setOcultarCpf(e.target.checked)} />
                        Mostrar o CPF parcialmente oculto (***.456.789-**)
                      </label>
                    </div>
                    <div style={{ fontSize: 12.5, color: MUTED, marginTop: 12 }}>
                      Quais vínculos e cargos entram nessas regras fica na aba &quot;Exceções&quot;; a janela de
                      datas considerada fica na aba &quot;Prazo&quot;.
                    </div>
                  </div>
                )}

                {abaCfg === 'texto' && (
                  <div>
                    <strong style={{ fontSize: 13.5, color: TEXT, display: 'block', marginBottom: 4 }}>Texto da observação</strong>
                    <textarea value={modelo} onChange={e => setModelo(e.target.value)} style={{ ...campoTextoCfg, minHeight: 200, resize: 'vertical' }} />
                    <div style={{ marginTop: 12 }}>
                      {[
                        ['Cada pessoa sem comprovante', itFalta, setItFalta],
                        ['Cada pessoa desconsiderada', itDesc, setItDesc],
                        ['Cada divergência de valor', itDiverg, setItDiverg],
                        ['Cada crédito a terceiro', itTerceiro, setItTerceiro],
                      ].map(([label, value, set]) => (
                        <div key={label as string} style={linhaCfgStyle}>
                          <label style={labelCfgStyle}>{label as string}</label>
                          <input
                            value={value as string}
                            onChange={e => (set as (v: string) => void)(e.target.value)}
                            style={campoTextoCfg}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.8, marginTop: 10 }}>
                      {['{data}', '{hora}', '{data_hora}', '{competencia}', '{empresa}', '{avaliadas}', '{contempladas}', '{qtd_faltantes}', '{qtd_desconsiderados}', '{qtd_atrasados}', '{prazo_inicio}', '{prazo_final}'].map(t => (
                        <code key={t} style={codeStyle}>{t}</code>
                      ))}
                      <br />
                      Listas: {['{faltantes}', '{desconsiderados}', '{atrasados}'].map(t => <code key={t} style={codeStyle}>{t}</code>)}
                      {' '}— nos itens valem {['{nome}', '{cpf}', '{cadastro}', '{motivo}', '{atividade}', '{vinculo}', '{data_deposito}', '{valor}', '{valor_holerite}', '{favorecido}', '{dias_atraso}'].map(t => (
                        <code key={t} style={codeStyle}>{t}</code>
                      ))}.<br />
                      Listas de holerite: <code style={codeStyle}>{'{divergencias}'}</code> e <code style={codeStyle}>{'{terceiros}'}</code>.<br />
                      Condicionais: {['{#faltantes}…{/faltantes}', '{#sem_faltantes}', '{#desconsiderados}', '{#atrasados}', '{#divergencias}', '{#terceiros}', '{#alerta}'].map(t => (
                        <code key={t} style={codeStyle}>{t}</code>
                      ))}
                    </div>

                    <strong style={{ fontSize: 13.5, color: TEXT, display: 'block', margin: '20px 0 4px' }}>Frase de atraso</strong>
                    <label style={{ fontSize: 13, color: MUTED }}>
                      Gerada em campo separado quando houver depósito fora do prazo
                    </label>
                    <textarea value={modeloAtraso} onChange={e => setModeloAtraso(e.target.value)} style={{ ...campoTextoCfg, minHeight: 150, resize: 'vertical' }} />
                    <div style={{ marginTop: 12 }}>
                      <div style={linhaCfgStyle}>
                        <label style={labelCfgStyle}>Cada pessoa em atraso</label>
                        <input value={itAtraso} onChange={e => setItAtraso(e.target.value)} style={campoTextoCfg} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>Valem os mesmos campos acima.</div>
                  </div>
                )}

                {abaCfg === 'prazo' && (
                  <div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgDiasFim">Dias no fim do mês da competência</label>
                      <input id="cfgDiasFim" type="number" min={0} max={31} value={cfgDiasFim} onChange={e => setCfgDiasFim(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgDiasUteis">Dias úteis no mês seguinte</label>
                      <input id="cfgDiasUteis" type="number" min={1} max={20} value={cfgDiasUteis} onChange={e => setCfgDiasUteis(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgFeriados">Feriados adicionais (dd/mm/aaaa, separados por vírgula)</label>
                      <input id="cfgFeriados" value={cfgFeriados} onChange={e => setCfgFeriados(e.target.value)} placeholder="20/09/2026, 03/09/2026" style={inputStyle} />
                    </div>
                    <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>
                      Os feriados nacionais já entram sozinhos, inclusive os móveis (Carnaval, Sexta-feira Santa e
                      Corpus Christi). Use o campo acima para os municipais e estaduais.
                    </div>
                  </div>
                )}

                {abaCfg === 'excecoes' && (
                  <div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgVinculos">Vínculos desconsiderados</label>
                      <input id="cfgVinculos" value={cfgVinculos} onChange={e => setCfgVinculos(e.target.value)} placeholder="ASSOCIADO, PJ" style={inputStyle} />
                    </div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgCargos">Cargos desconsiderados</label>
                      <input id="cfgCargos" value={cfgCargos} onChange={e => setCfgCargos(e.target.value)} placeholder="SOCIO, ESTAGIARIO, DIRETOR" style={inputStyle} />
                    </div>
                    <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>
                      Separe por vírgula. A comparação ignora acentos e maiúsculas, e basta que o termo apareça
                      dentro do texto do campo.
                    </div>
                  </div>
                )}

                {abaCfg === 'leitura' && (
                  <div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgRotDatas">Rótulos que indicam a data do pagamento</label>
                      <input id="cfgRotDatas" value={cfgRotDatas} onChange={e => setCfgRotDatas(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgRotValor">Rótulos que indicam o valor</label>
                      <input id="cfgRotValor" value={cfgRotValor} onChange={e => setCfgRotValor(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgSimilar">Semelhança mínima do nome (0 a 1)</label>
                      <input id="cfgSimilar" type="number" step={0.01} min={0.5} max={1} value={cfgSimilar} onChange={e => setCfgSimilar(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgOcrIdioma">Idioma do OCR</label>
                      <input id="cfgOcrIdioma" value={cfgOcrIdioma} onChange={e => setCfgOcrIdioma(e.target.value)} placeholder="por" style={inputStyle} />
                    </div>
                    <div style={linhaCfgStyle}>
                      <label style={labelCfgStyle} htmlFor="cfgOcrEscala">Ampliação da página no OCR</label>
                      <input id="cfgOcrEscala" type="number" step={0.1} min={1} max={4} value={cfgOcrEscala} onChange={e => setCfgOcrEscala(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8, lineHeight: 1.7 }}>
                      Cada comprovante é lido pelo bloco de texto da página. A pessoa é localizada pelo nome ou
                      pelo CPF, inclusive quando o banco mascara o CPF (***.456.789-**). A data escolhida é a mais
                      próxima do nome, dando preferência à que vier depois de um dos rótulos acima.<br /><br />
                      <strong style={{ color: TEXT }}>OCR</strong> — páginas sem camada de texto são convertidas em
                      imagem e lidas por reconhecimento óptico. A ampliação maior melhora a leitura de letras
                      pequenas e deixa o processo mais lento. Na primeira execução o navegador baixa o idioma
                      (cerca de 10&nbsp;MB) e guarda em cache. Quem for localizado numa página de OCR sai marcado
                      para conferência, porque o reconhecimento pode trocar caracteres.
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={salvarConfig} style={botaoSecStyle}>Salvar como padrão</button>
                  <button onClick={restaurarConfig} style={botaoSecStyle}>Restaurar o original</button>
                  {statusCfg && <span style={{ fontSize: 13, color: OK }}>{statusCfg}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {analise && (
          <section style={painelStyle}>
            <div style={{ borderLeft: `4px solid ${ACCENT}`, padding: '10px 0 10px 14px', marginBottom: 16 }}>
              <strong style={{ fontSize: 17, display: 'block' }}>{analise.empresa || 'Empresa não identificada no relatório'}</strong>
              <span style={{ color: MUTED, fontSize: 13.5 }}>
                competência {analise.competencia} · prazo de {dataBr(analise.janela.inicio)} a {dataBr(analise.janela.fim)} · {analise.totalComprovantes} comprovante(s) lido(s)
              </span>
            </div>

            {(analise.paginasOcr.length > 0 || analise.paginasVazias.length > 0) && (
              <div style={{ background: '#fff8e6', border: `1px solid ${ACCENT}`, borderRadius: 8, padding: '12px 14px', fontSize: 13.5, marginBottom: 18 }}>
                {analise.paginasOcr.length > 0 && (
                  <div style={{ marginBottom: analise.paginasVazias.length > 0 ? 10 : 0 }}>
                    <strong>Páginas escaneadas lidas por OCR.</strong><br />
                    {analise.paginasOcr.map(d => <span key={d.id}>{d.arquivo} — página(s) {d.ocr.join(', ')}<br /></span>)}
                    O reconhecimento pode trocar caracteres: confira os nomes e as datas dessas páginas antes de enviar a observação.
                  </div>
                )}
                {analise.paginasVazias.length > 0 && (
                  <div>
                    <strong>Páginas que não puderam ser lidas.</strong><br />
                    {analise.paginasVazias.map(d => <span key={d.id}>{d.arquivo} — página(s) {d.vazias.join(', ')} de {d.totalPaginas}<br /></span>)}
                    {usarOcrEfetivo ? 'Nem o OCR conseguiu extrair texto dessas páginas. Confira-as à mão.' : 'Marque a opção de OCR na área de documentos para tentar lê-las.'}
                    {' '}Quem aparecer só nelas será marcado como sem comprovante.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <Cartao n={falta.length} rotulo="sem comprovante" cor={falta.length ? FALTA : OK} />
              <Cartao n={divergentes.length} rotulo="valor divergente" cor={divergentes.length ? FALTA : undefined} destaque={divergentes.length > 0} />
              <Cartao n={terceiros.length} rotulo="pago a terceiro" cor={terceiros.length ? NEUTRO : undefined} destaque={terceiros.length > 0} />
              <Cartao n={atrasados.length} rotulo="fora do prazo" cor={atrasados.length ? NEUTRO : undefined} destaque={atrasados.length > 0} />
              <Cartao n={tolerantes.length} rotulo="grafia diferente" cor={tolerantes.length ? NEUTRO : undefined} destaque={tolerantes.length > 0} />
              <Cartao n={ok.length} rotulo="com comprovante" cor={OK} />
              <Cartao n={fora.length} rotulo="desconsideradas" />
            </div>

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
                Sem divergências: todas as pessoas avaliadas têm comprovante de depósito.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr>
                      {['Situação', 'Pessoa', 'CPF', 'Atividade', 'Vínculo', 'Cadastro'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '9px 8px', background: '#eef1f7', borderBottom: `2px solid ${BORDER}`, fontWeight: 600, fontSize: 12.5, color: PRIMARY }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.length === 0 && (
                      <tr><td colSpan={6} style={{ color: MUTED, fontSize: 14, padding: '12px 0', textAlign: 'center' }}>Nenhuma pessoa nesta situação.</td></tr>
                    )}
                    {listaFiltrada.map((r, i) => {
                      const rowBg = r.situacao === 'falta' ? FALTA_BG : r.situacao === 'fora' ? '#f7f8fa' : r.situacao === 'atraso' ? NEUTRO_BG : undefined
                      const rowColor = r.situacao === 'fora' ? MUTED : undefined
                      const tdBase: React.CSSProperties = { padding: 8, borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top', background: rowBg, color: rowColor }
                      const grifo = (campo: string): React.CSSProperties => r.campo === campo
                        ? { background: '#fdf1d6', boxShadow: `inset 0 0 0 2px ${ACCENT}`, borderRadius: 4, fontWeight: 600, color: NEUTRO }
                        : {}
                      const tag = TAG[r.situacao]
                      return (
                        <tr key={i}>
                          <td style={tdBase}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 11, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', background: tag.bg, color: tag.cor }}>{tag.texto}</span>
                            {r.motivo && <span style={{ fontSize: 12, color: NEUTRO, display: 'block', marginTop: 3 }}>{r.motivo}</span>}
                          </td>
                          <td style={tdBase}>
                            {r.dados.pessoa}
                            {r.dados.repeticoes > 1 && <span style={{ fontSize: 12, color: NEUTRO, display: 'block', marginTop: 3 }}>{r.dados.repeticoes} linhas no relatório, contada uma vez</span>}
                            {r.nota && <span style={{ fontSize: 12, color: NEUTRO, display: 'block', marginTop: 3 }}>{r.nota}</span>}
                            {r.achado?.tolerancia && r.achado.detalhesTolerancia.length > 0 && (
                              <span style={{ fontSize: 12, color: NEUTRO, display: 'block', marginTop: 3 }}>
                                grafia diferente: Portal <code style={{ background: '#fdf1d6', padding: '1px 5px', borderRadius: 3 }}>{r.achado.detalhesTolerancia.map(d => d.portal).join(', ')}</code>
                                {' '}· comprovante <code style={{ background: '#fdf1d6', padding: '1px 5px', borderRadius: 3 }}>{r.achado.detalhesTolerancia.map(d => d.comprovante).join(', ')}</code>
                              </span>
                            )}
                          </td>
                          <td style={tdBase}>{cpfExibir(r.dados.cpf)}</td>
                          <td style={{ ...tdBase, ...grifo('atividade') }}>{r.dados.atividade || '—'}</td>
                          <td style={{ ...tdBase, ...grifo('vinculo') }}>{r.dados.vinculo || '—'}</td>
                          <td style={{ ...tdBase, ...grifo('cadastro') }}>{dataBr(r.dados.dataCad) || r.dados.cadastro}</td>
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
                  onClick={() => copiarTexto(observacao, setCopiadoObs)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copiarTexto(observacao, setCopiadoObs) } }}
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
                    {copiadoObs ? 'copiado' : 'clique para copiar'}
                  </span>
                </div>
              </>
            )}

            {atrasados.length > 0 && (
              <>
                <h2 style={{ marginTop: 26, fontSize: 16, color: TEXT }}>Orientação sobre prazo de depósito</h2>
                <div
                  onClick={() => copiarTexto(observacaoAtraso, setCopiadoAtraso)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copiarTexto(observacaoAtraso, setCopiadoAtraso) } }}
                  tabIndex={0}
                  role="button"
                  aria-label="Clique para copiar a orientação"
                  style={{
                    position: 'relative', background: '#fff', border: `1px solid ${BORDER}`, borderLeft: `4px solid ${ACCENT}`,
                    borderRadius: 8, padding: '16px 18px', whiteSpace: 'pre-wrap', fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  {observacaoAtraso}
                  <span style={{ position: 'absolute', top: 10, right: 12, fontSize: 11.5, color: MUTED, background: '#f1f4f9', borderRadius: 11, padding: '2px 10px' }}>
                    {copiadoAtraso ? 'copiado' : 'clique para copiar'}
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
