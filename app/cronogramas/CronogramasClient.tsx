'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { displayName, useUser } from '../components/UserContext'
import { CSS as STYLES } from './styles'
import {
  type Cronograma, type Item, type Model, type OpResult, type Resp, type StKey,
  PROJETO_PADRAO, ST, DAY, D, MNF, addDays, days, fmt, fmtDT, inicioResultante, iso, makeModel, startOfToday,
  addEtapa, addSub, log, mergeItem, removeItem, setStatus, splitItem,
} from './model'
import { exportPdf, exportXls, reportHtml, respName, snapshot } from './exporters'

// ─── Ícones ──────────────────────────────────────────────────────────────────

const svgp = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const
const I_SC = <svg {...svgp}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12" /></svg>
const I_PL = <svg {...svgp}><path d="M12 5v14M5 12h14" /></svg>
const I_MG = <svg {...svgp}><path d="M4 7h16M4 17h16M12 7v10" /></svg>
const I_OP = <svg {...svgp}><path d="M4 4h16v16H4zM14 4v16" /></svg>
const I_DOTS = <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
const I_CAM = <svg {...svgp}><path d="M3 8h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13" r="4" /></svg>
const I_LOCK = <svg {...svgp}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
const I_EDIT = <svg {...svgp}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>

// ─── Tipos locais ────────────────────────────────────────────────────────────

type Rect = { top: number; bottom: number; left: number; right: number }
type MenuKind = 'st' | 'act' | 'more' | 'moreDel' | 'export'
type Layer =
  | { k: 'status' }
  | { k: 'drawer'; id: string }
  | { k: 'menu'; m: MenuKind; id?: string; rect: Rect }
  | { k: 'config' }
  | { k: 'form'; kind: FormKind; base?: string; from?: 'config' }
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Drag = { id: string; mode: 'm' | 'l' | 'r'; x0: number; ini: string; fim: string; dx: number; moved: boolean; a?: string; b?: string }

const EMPTY: Item[] = []
/** Etapas com subetapas começam recolhidas, como no HTML de referência. */
const groupIds = (itens: Item[]) => new Set(itens.filter(i => itens.some(o => o.parent === i.id)).map(i => i.id))

const COUNT_LABEL: Record<string, string> = { concluido: 'Concluídos', andamento: 'Em andamento', aguardando: 'Aguardando cliente', bloqueado: 'Bloqueados', atrasado: 'Atrasados' }
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const RESPS: Resp[] = ['C', 'GT3']

// ─── Peças pequenas ──────────────────────────────────────────────────────────

function Ring({ p, sz = 22, sw = 3.5 }: { p: number; sz?: number; sw?: number }) {
  const r = (sz - sw) / 2, c = 2 * Math.PI * r
  return (
    <svg className="ring" viewBox={`0 0 ${sz} ${sz}`} style={{ width: sz, height: sz }}>
      <circle cx={sz / 2} cy={sz / 2} r={r} stroke="#E4E8F0" style={{ strokeWidth: sw }} />
      <circle cx={sz / 2} cy={sz / 2} r={r} stroke="#2A4F96" style={{ strokeWidth: sw }} strokeDasharray={`${c * p} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${sz / 2} ${sz / 2})`} />
    </svg>
  )
}

/** Posiciona o menu ao lado do botão que o abriu, sem sair da tela (mede o próprio tamanho). */
function Menu({ rect, children }: { rect: Rect; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - el.offsetHeight - 8)) + 'px'
    el.style.left = Math.max(8, Math.min(rect.right - el.offsetWidth, window.innerWidth - el.offsetWidth - 8)) + 'px'
  }, [rect])
  return <div ref={ref} className="menu" role="menu" style={{ top: 0, left: 0 }}>{children}</div>
}

/** Campo de renomear direto na linha do tempo (duplo clique no nome). */
function RenameInput({ initial, onDone }: { initial: string; onDone: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  const fin = (ok: boolean) => { if (done.current) return; done.current = true; onDone(ok ? (ref.current?.value.trim() ?? '') : null) }
  return (
    <input ref={ref} className="tt-ed" defaultValue={initial}
      onBlur={() => fin(true)}
      onKeyDown={e => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false) }} />
  )
}

type FormKind = 'cron-new' | 'cron-edit' | 'mod-new' | 'mod-edit'
type FormPayload = { cliente: string; projeto: string; base_id: string; inicio: string }

const FORM_TXT: Record<FormKind, { eyebrow: string; title: string; nome: string; ok: string }> = {
  'cron-new':  { eyebrow: 'Cronograma', title: 'Novo cronograma',        nome: 'Contratante',     ok: 'Criar' },
  'cron-edit': { eyebrow: 'Cronograma', title: 'Editar cronograma',      nome: 'Contratante',     ok: 'Salvar' },
  'mod-new':   { eyebrow: 'Modelo',     title: 'Novo modelo',            nome: 'Nome do modelo',  ok: 'Criar modelo' },
  'mod-edit':  { eyebrow: 'Modelo',     title: 'Editar modelo',          nome: 'Nome do modelo',  ok: 'Salvar' },
}

/** Formulário de cronograma/modelo: criar (opcionalmente a partir de um modelo) ou editar nome e projeto. */
function FormModal({ kind, initial, contratantes, modelos, cronogramas, hoje, onSubmit, onClose }: {
  kind: FormKind
  initial: { cliente: string; projeto: string; base_id: string }
  contratantes: string[]
  modelos: Cronograma[]
  cronogramas: Cronograma[]
  hoje: string
  onSubmit: (p: FormPayload) => Promise<string | null>
  onClose: () => void
}) {
  const [cliente, setCliente] = useState(initial.cliente)
  const [projeto, setProjeto] = useState(initial.projeto)
  const [baseId, setBaseId] = useState(initial.base_id)
  const [inicio, setInicio] = useState(hoje)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const t = FORM_TXT[kind]
  const isNew = kind === 'cron-new' || kind === 'mod-new'
  const modeloBase = kind === 'cron-new' ? modelos.find(x => x.id === baseId) : undefined
  const comeco = modeloBase && inicio ? inicioResultante(modeloBase.itens, inicio) : null

  function pickBase(id: string) {
    setBaseId(id)
    const md = modelos.find(x => x.id === id)
    if (kind === 'cron-new' && md) setProjeto(md.projeto)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!cliente.trim()) { setErr(kind.startsWith('mod') ? 'Informe o nome do modelo' : 'Informe o contratante'); return }
    setBusy(true); setErr('')
    const msg = await onSubmit({ cliente: cliente.trim(), projeto: projeto.trim() || PROJETO_PADRAO, base_id: baseId, inicio })
    setBusy(false)
    if (msg) setErr(msg)
  }
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <form className="drawer modal" role="dialog" aria-label={t.title} onSubmit={submit}>
        <header><div style={{ flex: 1 }}><div className="n">{t.eyebrow}</div><h3>{t.title}</h3></div><button type="button" className="x" onClick={onClose} aria-label="Fechar">✕</button></header>
        <div className="body">
          {kind === 'cron-new' && (
            <div className="f"><label className="lbl" htmlFor="cmB">Modelo</label>
              <select id="cmB" className="sel plain" value={baseId} onChange={e => pickBase(e.target.value)}>
                <option value="">Em branco (sem etapas)</option>
                {modelos.map(x => <option key={x.id} value={x.id}>{x.cliente}</option>)}
              </select></div>
          )}
          <div className="f"><label className="lbl" htmlFor="cmC">{t.nome}</label>
            <input type="text" id="cmC" list={kind.startsWith('cron') ? 'cmCL' : undefined} value={cliente} onChange={e => setCliente(e.target.value)} autoFocus
              placeholder={kind.startsWith('cron') ? 'Ex.: Soprano' : 'Ex.: Portal de Terceiros — padrão'} />
            <datalist id="cmCL">{contratantes.map(c => <option key={c} value={c} />)}</datalist></div>
          <div className="f"><label className="lbl" htmlFor="cmP">{kind.startsWith('mod') ? 'Projeto (nome sugerido ao usar o modelo)' : 'Projeto'}</label>
            <input type="text" id="cmP" value={projeto} onChange={e => setProjeto(e.target.value)} placeholder={PROJETO_PADRAO} /></div>
          {kind === 'mod-new' && (
            <div className="f"><label className="lbl" htmlFor="cmB">Começar de</label>
              <select id="cmB" className="sel plain" value={baseId} onChange={e => pickBase(e.target.value)}>
                <option value="">Em branco</option>
                {modelos.length > 0 && <optgroup label="Modelos">{modelos.map(x => <option key={x.id} value={x.id}>{x.cliente}</option>)}</optgroup>}
                {cronogramas.length > 0 && <optgroup label="Cronogramas">{cronogramas.map(x => <option key={x.id} value={x.id}>{x.cliente}{cronogramas.filter(y => y.cliente === x.cliente).length > 1 ? ` · ${x.projeto}` : ''}</option>)}</optgroup>}
              </select>
              <span className="fhint">Copia as etapas, prazos e dependências. Status e histórico não vão para o modelo.</span></div>
          )}
          {kind === 'cron-new' && modeloBase && (comeco
            ? <div className="f"><label className="lbl" htmlFor="cmI">Início do projeto</label>
              <input type="date" id="cmI" value={inicio} onChange={e => setInicio(e.target.value)} />
              <span className="fhint">O prazo do modelo que já tem data passa a começar em <b>{fmt(comeco)}</b> ({WD[D(comeco).getDay()]}). Os demais prazos você define no cronograma.</span></div>
            : <div className="fhint">Este modelo não tem datas — as etapas são copiadas sem prazo e você define os prazos no cronograma.</div>
          )}
          {kind === 'cron-new' && !modeloBase && <div className="fhint">O cronograma começa vazio. Use o botão &quot;Etapa&quot; para montar as etapas e depois divida em subetapas.</div>}
          {isNew && kind === 'mod-new' && !baseId && <div className="fhint">O modelo começa vazio; monte as etapas na tela seguinte.</div>}
          {err && <div className="ferr">{err}</div>}
        </div>
        <footer><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" className="btn pri" disabled={busy}>{busy ? 'Salvando…' : t.ok}</button></footer>
      </form>
    </>
  )
}

// ─── Módulo ──────────────────────────────────────────────────────────────────

export default function CronogramasClient() {
  const { profile } = useUser()
  const user = displayName(profile, 'Usuário')

  const [cronos, setCronos] = useState<Cronograma[] | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [curId, setCurId] = useState<string | null>(null)
  const [fResp, setFResp] = useState<'todos' | Resp>('todos')
  const [fOpen, setFOpen] = useState(false)
  const [fQ, setFQ] = useState('')
  const [fCount, setFCount] = useState<string | null>(null)
  const [etapaSel, setEtapaSel] = useState<string | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [layer, setLayer] = useState<Layer | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [dragView, setDragView] = useState<{ id: string; a: string; b: string } | null>(null)
  const [toast, setToast] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [tlW, setTlW] = useState(0)
  const [narrow, setNarrow] = useState(false)
  const [contratantes, setContratantes] = useState<string[]>([])
  const [armDel, setArmDel] = useState(false)
  const [cmt, setCmt] = useState('')
  const [today] = useState(startOfToday)
  /** 'cron' = cronogramas das contratantes; 'mod' = editando os modelos (mesma tela, mesma linha do tempo). */
  const [modo, setModo] = useState<'cron' | 'mod'>('cron')
  const [cfgDel, setCfgDel] = useState<string | null>(null)
  const backId = useRef<string | null>(null)

  const tlRef = useRef<HTMLDivElement>(null)
  const needScroll = useRef(true)
  const clickT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const pending = useRef(new Map<string, Item[]>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const cur = useMemo(() => cronos?.find(c => c.id === curId) ?? null, [cronos, curId])
  const isModelo = !!cur?.modelo
  const m: Model = useMemo(() => makeModel(cur?.itens ?? EMPTY, today, { modelo: isModelo }), [cur?.itens, today, isModelo])
  const cronList = useMemo(() => (cronos ?? []).filter(c => !c.modelo), [cronos])
  const modList = useMemo(() => (cronos ?? []).filter(c => c.modelo), [cronos])
  const list = modo === 'mod' ? modList : cronList

  // ── toasts ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, ms = 2800) => {
    if (toastT.current) clearTimeout(toastT.current)
    setToast(msg)
    toastT.current = setTimeout(() => setToast(''), ms)
  }, [])
  useEffect(() => () => { if (toastT.current) clearTimeout(toastT.current) }, [])

  // ── carga ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    fetch('/api/cronogramas')
      .then(async r => r.ok ? r.json() as Promise<Cronograma[]> : Promise.reject((await r.json().catch(() => ({}))).error ?? 'Erro ao carregar'))
      .then(list => {
        if (!alive) return
        setCronos(list)
        const first = list.find(c => !c.modelo)
        if (first) { setCurId(first.id); setClosed(groupIds(first.itens)) }
      })
      .catch(e => { if (alive) setLoadErr(String(e)) })
    return () => { alive = false }
  }, [])

  // ── salvamento (debounce por cronograma; grava a lista completa de etapas) ──
  const flush = useCallback(async (id: string) => {
    const t = timers.current.get(id)
    if (t) { clearTimeout(t); timers.current.delete(id) }
    const itens = pending.current.get(id)
    if (!itens) return
    pending.current.delete(id)
    try {
      const res = await fetch(`/api/cronogramas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Erro ao salvar')
      if (pending.current.size === 0) setSaveState('saved')
    } catch (e) {
      setSaveState('error')
      showToast(`Não foi possível salvar: ${e instanceof Error ? e.message : 'erro'}`, 5000)
    }
  }, [showToast])

  const queueSave = useCallback((id: string, itens: Item[]) => {
    pending.current.set(id, itens)
    setSaveState('saving')
    const old = timers.current.get(id)
    if (old) clearTimeout(old)
    timers.current.set(id, setTimeout(() => { void flush(id) }, 600))
  }, [flush])

  // Grava o que estiver pendente ao sair da aba do navegador ou fechar o módulo.
  useEffect(() => {
    const pend = pending.current
    const send = () => {
      pend.forEach((itens, id) => {
        void fetch(`/api/cronogramas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens }), keepalive: true })
      })
      pend.clear()
    }
    const onHide = () => { if (document.visibilityState === 'hidden') send() }
    document.addEventListener('visibilitychange', onHide)
    return () => { document.removeEventListener('visibilitychange', onHide); send() }
  }, [])

  /** Aplica uma edição à cópia da lista de etapas do cronograma atual e agenda o salvamento. */
  const mutate = useCallback((fn: (arr: Item[]) => OpResult | null): OpResult | null => {
    if (!cur) return null
    const res = fn(structuredClone(cur.itens))
    if (!res) return null
    const id = cur.id
    setCronos(prev => prev ? prev.map(c => c.id === id ? { ...c, itens: res.arr } : c) : prev)
    queueSave(id, res.arr)
    if (res.msg) showToast(res.msg)
    return res
  }, [cur, queueSave, showToast])

  // ── medidas da linha do tempo ───────────────────────────────────────────────
  useEffect(() => {
    const el = tlRef.current
    if (!el) return
    // O ResizeObserver dispara ao começar a observar e também quando a aba deixa de estar oculta.
    const ro = new ResizeObserver(() => { setTlW(el.clientWidth); setNarrow(window.innerWidth <= 760) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [cur?.id])

  const G = useMemo(() => {
    const b = m.bounds()
    let s = b ? D(b[0]) : new Date(today), e = b ? D(b[1]) : new Date(today)
    s = new Date(s.getFullYear(), s.getMonth(), 1); e = new Date(e.getFullYear(), e.getMonth() + 2, 0)
    const nd = Math.round((e.getTime() - s.getTime()) / DAY) + 1
    const lw = narrow ? 230 : 410
    const px = Math.max(12, (tlW - lw - 2) / nd)
    return { s, e, nd, px, lw, W: Math.round(nd * px) }
  }, [m, today, tlW, narrow])
  const X = (d: string) => ((D(d).getTime() - G.s.getTime()) / DAY) * G.px
  const XD = (d: Date) => ((d.getTime() - G.s.getTime()) / DAY) * G.px
  const todayLeft = () => today < G.s || today > G.e ? 0 : Math.max(0, XD(today) - G.px * 10)
  const scrollToToday = () => tlRef.current?.scrollTo({ left: todayLeft(), behavior: 'smooth' })

  // Primeira exibição de cada cronograma: rola até a data de hoje (só quando a largura já é conhecida).
  useEffect(() => {
    if (!needScroll.current || tlW <= 0 || !cur) return
    needScroll.current = false
    const px = G.px, t = today < G.s || today > G.e ? 0 : Math.max(0, ((today.getTime() - G.s.getTime()) / DAY) * px - px * 10)
    tlRef.current?.scrollTo({ left: t })
  }, [tlW, cur, G, today])

  // ── camadas (menus, painéis, gaveta): Escape fecha, teclas 1–4 mudam o status ─
  useEffect(() => {
    if (!layer) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { setLayer(null); return }
      if (layer.k === 'menu' && layer.m === 'st' && layer.id) {
        const hit = (Object.entries(ST) as [StKey, { l: string; k: string }][]).find(([, v]) => v.k === ev.key)
        if (hit) { const id = layer.id; setLayer(null); mutate(arr => setStatus(arr, id, hit[0], user, today)) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layer, mutate, user, today])

  // ── filtros e linhas visíveis ───────────────────────────────────────────────
  const passFilter = (it: Item) => {
    if (fResp !== 'todos' && !(it.resp || []).includes(fResp)) return false
    if (fOpen && m.status(it) === 'concluido') return false
    if (fCount) {
      if (fCount === 'atrasado' && !m.late(it)) return false
      if (fCount === 'bloqueado' && !m.blocked(it)) return false
      if (['concluido', 'andamento', 'aguardando'].includes(fCount) && m.status(it) !== fCount) return false
    }
    if (fQ) { const q = fQ.toLowerCase(); if (!`${it.id} ${it.t} ${it.obs || ''} ${it.det || ''}`.toLowerCase().includes(q)) return false }
    return true
  }
  const visibleRows = (list: Item[] = m.tops()): Item[] => {
    const out: Item[] = []
    list.forEach(it => {
      if (m.isGrp(it)) {
        const sub = visibleRows(m.kids(it.id))
        if (sub.length) { out.push(it); if (!closed.has(it.id)) out.push(...sub) }
      } else if (passFilter(it)) out.push(it)
    })
    return out
  }

  // ── ações ───────────────────────────────────────────────────────────────────
  const rectOf = (el: Element): Rect => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right } }
  const openMenu = (kind: MenuKind, el: Element, id?: string) => setLayer({ k: 'menu', m: kind, id, rect: rectOf(el) })
  const openDrawer = (id: string) => { setArmDel(false); setCmt(''); setLayer({ k: 'drawer', id }) }
  const openStatus = () => setLayer({ k: 'status' })
  const unfold = (id: string) => setClosed(prev => { const n = new Set(prev); n.delete(id); return n })
  const foldAll = (itens: Item[]) => setClosed(groupIds(itens))

  const afterOp = (res: OpResult | null, parent?: string) => {
    if (!res?.focus) return
    if (parent) unfold(parent)
    setRenameId(res.focus)
  }
  const doSplit = (id: string, n: number) => afterOp(mutate(arr => splitItem(arr, id, n, user, today)), id)
  const doSub = (id: string) => afterOp(mutate(arr => addSub(arr, id, user, today)), id)
  const doMerge = (id: string) => mutate(arr => mergeItem(arr, id, user, today))
  const doRemove = (id: string) => mutate(arr => removeItem(arr, id, today))
  /** Dá um prazo inicial (1 semana a partir de hoje) a um item que ainda não tem datas. */
  const setPrazo = (id: string) => editItem(id, x => {
    const ini = x.ini || iso(today)
    const fim = x.fim && x.fim >= ini ? x.fim : addDays(ini, 6)
    x.ini = ini; x.fim = fim
    return `Prazo definido: ${fmt(ini)} → ${fmt(fim)}`
  })
  const doStatus = (id: string, st: StKey) => mutate(arr => setStatus(arr, id, st, user, today))
  const doNew = () => {
    const res = mutate(arr => addEtapa(arr, user, today))
    if (!res?.focus) return
    setRenameId(res.focus)
    const id = res.focus
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const tl = tlRef.current
      if (!tl) return
      tl.scrollTop = tl.scrollHeight
      tl.querySelector(`[data-bar="${CSS.escape(id)}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' })
    }))
  }
  const finishRename = (id: string, v: string | null) => {
    setRenameId(null)
    if (v === null) return
    mutate(arr => {
      const it = arr.find(i => i.id === id)
      if (!it || !v || v === it.t) return null
      log(it, `Renomeado: "${it.t}" → "${v}"`, user)
      it.t = v
      return { arr }
    })
  }
  /** Altera um campo do item, registrando no histórico; ignora se o valor não mudou. */
  const editItem = (id: string, fn: (it: Item) => string | null | undefined) =>
    mutate(arr => {
      const it = arr.find(i => i.id === id)
      if (!it) return null
      const before = JSON.stringify(it)
      const label = fn(it)
      if (JSON.stringify(it) === before && !label) return null
      if (label) log(it, label, user)
      return { arr }
    })

  /** Mostra outro cronograma/modelo: limpa filtros, recolhe as etapas e volta à data de hoje. */
  const showItem = (c: Cronograma | undefined) => {
    setCurId(c?.id ?? null); setEtapaSel(null); setFCount(null); setRenameId(null)
    foldAll(c?.itens ?? [])
    needScroll.current = true
    if (tlRef.current) tlRef.current.scrollTop = 0
  }
  const selectCrono = (id: string) => showItem(cronos?.find(x => x.id === id))

  /** Entra na edição dos modelos (mesma tela); lembra o cronograma aberto para voltar a ele. */
  const enterModelos = (id?: string) => {
    if (modo === 'cron') backId.current = curId
    setModo('mod'); setFOpen(false); setFQ(''); setFResp('todos')
    showItem(modList.find(x => x.id === id) ?? modList[0])
    setLayer(null)
  }
  const exitModelos = () => {
    setModo('cron'); setFOpen(false); setFQ(''); setFResp('todos')
    showItem(cronList.find(x => x.id === backId.current) ?? cronList[0])
    setLayer(null)
  }

  async function loadContratantes() {
    if (contratantes.length) return
    try {
      const r = await fetch('/api/terceiras/contratantes')
      if (!r.ok) return
      const rows = await r.json() as { nome: string }[]
      setContratantes(rows.map(x => x.nome))
    } catch { /* datalist é só sugestão */ }
  }
  const openForm = (kind: FormKind, opts: { base?: string; from?: 'config' } = {}) => {
    if (kind.startsWith('cron')) void loadContratantes()
    setLayer({ k: 'form', kind, ...opts })
  }
  const closeForm = () => setLayer(layer?.k === 'form' && layer.from === 'config' ? { k: 'config' } : null)

  async function submitForm(kind: FormKind, p: FormPayload, from?: 'config', editId?: string): Promise<string | null> {
    const headers = { 'Content-Type': 'application/json' }
    try {
      let res: Response
      if (kind === 'cron-edit' || kind === 'mod-edit') {
        res = await fetch(`/api/cronogramas/${editId ?? cur?.id}`, { method: 'PATCH', headers, body: JSON.stringify({ cliente: p.cliente, projeto: p.projeto }) })
      } else {
        res = await fetch('/api/cronogramas', { method: 'POST', headers, body: JSON.stringify({
          cliente: p.cliente, projeto: p.projeto, modelo: kind === 'mod-new',
          base_id: p.base_id || undefined, inicio: kind === 'cron-new' ? p.inicio : undefined,
        }) })
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return data.error ?? 'Erro ao salvar'
      const row = data as Cronograma
      if (kind === 'cron-edit' || kind === 'mod-edit') {
        setCronos(prev => prev ? prev.map(c => c.id === row.id ? { ...c, cliente: row.cliente, projeto: row.projeto, updated_at: row.updated_at } : c) : prev)
        showToast(row.modelo ? 'Modelo atualizado' : 'Cronograma atualizado')
        setLayer(from === 'config' ? { k: 'config' } : null)
      } else {
        const next = [...(cronos ?? []), row].sort((a, b) => a.cliente.localeCompare(b.cliente))
        setCronos(next)
        if (kind === 'cron-new') {
          showItem(row)
          showToast(p.base_id ? `Cronograma de ${row.cliente} criado a partir do modelo` : `Cronograma de ${row.cliente} criado`)
          setLayer(null)
        } else if (from === 'config' || modo === 'mod') {
          // Modelo novo: já abre para montar/ajustar as etapas
          if (modo === 'cron') backId.current = curId
          setModo('mod'); showItem(row)
          showToast(`Modelo “${row.cliente}” criado`)
          setLayer(null)
        } else {
          showToast(`Modelo “${row.cliente}” criado — veja em Modelos`)
          setLayer(null)
        }
      }
      return null
    } catch { return 'Erro de conexão' }
  }

  /** Exclui um cronograma ou modelo (o aberto ou qualquer um da lista de configurações). */
  async function deleteRow(row: Cronograma) {
    const res = await fetch(`/api/cronogramas/${row.id}`, { method: 'DELETE' })
    if (!res.ok) { showToast(row.modelo ? 'Erro ao excluir o modelo' : 'Erro ao excluir o cronograma'); return }
    pending.current.delete(row.id)
    const t = timers.current.get(row.id)
    if (t) { clearTimeout(t); timers.current.delete(row.id) }
    const rest = (cronos ?? []).filter(c => c.id !== row.id)
    setCronos(rest)
    if (row.id === curId) showItem(rest.find(c => c.modelo === row.modelo))
    showToast(row.modelo ? `Modelo “${row.cliente}” excluído` : `Cronograma de ${row.cliente} excluído`)
  }

  async function doSnap() {
    if (!cur) return
    const html = reportHtml(m, cur, user, today)
    if (!html) { showToast('Não há itens com data para gerar o print'); return }
    try {
      const r = await snapshot(html, cur)
      showToast(r === 'copiado' ? 'Print do cronograma baixado e copiado — cole direto no e-mail ou WhatsApp' : 'Print do cronograma baixado')
    } catch { showToast('Não foi possível gerar o print (a biblioteca de captura precisa de internet)') }
  }
  async function doExport(kind: 'xls' | 'pdf') {
    if (!cur) return
    try {
      if (kind === 'xls') await exportXls(m, cur, user)
      else await exportPdf(m, cur, user)
      showToast(kind === 'xls' ? 'Excel gerado' : 'PDF gerado')
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erro ao exportar') }
  }

  // ── arrastar barras ─────────────────────────────────────────────────────────
  function onBarDown(e: ReactPointerEvent<HTMLDivElement>, it: Item) {
    if (e.button !== 0 || !it.ini || !it.fim) return
    const bar = e.currentTarget
    const pid = e.pointerId
    const h = (e.target as HTMLElement).dataset.h
    const d: Drag = { id: it.id, mode: h === 'l' || h === 'r' ? h : 'm', x0: e.clientX, ini: it.ini, fim: it.fim, dx: 0, moved: false }
    dragRef.current = d
    bar.setPointerCapture(pid)
    e.preventDefault()
    const px = G.px

    const move = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - d.x0) / px)
      if (Math.abs(ev.clientX - d.x0) > 3) d.moved = true
      if (!d.moved || dx === d.dx) return
      d.dx = dx
      let a = d.ini, b = d.fim
      if (d.mode === 'm') { a = addDays(a, dx); b = addDays(b, dx) }
      else if (d.mode === 'l') { a = addDays(a, dx); if (a > b) a = b }
      else { b = addDays(b, dx); if (b < a) b = a }
      d.a = a; d.b = b
      setDragView({ id: d.id, a, b })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      dragRef.current = null
      setDragView(null)
      if (!d.moved) { openDrawer(d.id); return }
      if (d.a && d.b && (d.a !== d.ini || d.b !== d.fim)) {
        const na = d.a, nb = d.b
        mutate(arr => {
          const t = arr.find(i => i.id === d.id)
          if (!t) return null
          log(t, `Datas: ${fmt(d.ini)}–${fmt(d.fim)} → ${fmt(na)}–${fmt(nb)}`, user)
          t.ini = na; t.fim = nb
          return { arr, msg: `Item ${d.id}: ${fmt(na, false)} → ${fmt(nb, false)}` }
        })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // ── apresentação ────────────────────────────────────────────────────────────
  const rn = (r: string) => !cur ? r : cur.modelo && r === 'C' ? 'CONTRATANTE' : respName(cur, r)
  const resps = (it: Item) => (
    <span className="resp">{(it.resp || []).map(r => <span key={r} className={r === 'GT3' ? 'gt3' : ''} title={rn(r)}>{rn(r)}</span>)}</span>
  )
  const chip = (it: Item) => <span className={`chip st-${m.vis(it)}`}><i className="dot" /><span>{m.visLabel(it)}</span></span>
  const dep = (it: Item) => {
    const o = m.openDeps(it)
    return o.length && m.status(it) !== 'concluido' ? <span className="dep">{I_LOCK}aguarda {o.join(', ')}</span> : null
  }

  // ── linha do tempo ──────────────────────────────────────────────────────────
  const grid = useMemo(() => {
    const { s, e, px } = G
    const xd = (d: Date) => ((d.getTime() - s.getTime()) / DAY) * px
    const months: Date[] = []
    for (let d = new Date(s); d <= e; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(new Date(d))
    const we: ReactNode[] = [], wl: ReactNode[] = [], wk: ReactNode[] = []
    const every = px >= 20
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const dw = d.getDay(), isT = d.getTime() === today.getTime(), dd = String(d.getDate()).padStart(2, '0'), k = d.getTime()
      const x = xd(d)
      if (dw === 6) we.push(<i key={k} className="we" style={{ left: x, width: px * 2 }} />)
      if (dw === 1) wl.push(<i key={k} className="vl" style={{ left: x }} />)
      if (isT) wk.push(<span key={k} className="w tod" style={{ left: x + px / 2 }} title="Hoje">{dd}</span>)
      else if (dw === 1) wk.push(<span key={k} className="w mon" style={{ left: x + px / 2 }}>{dd}</span>)
      else if (every && dw !== 0 && dw !== 6) wk.push(<span key={k} className="w" style={{ left: x + px / 2 }}>{dd}</span>)
    }
    return { months, we, wl, wk }
  }, [G, today])

  function renderTimeline() {
    const rows = visibleRows()
    if (!rows.length) return <div className="empty-state">{m.itens.length ? 'Nenhum item com esses filtros.' : 'Este cronograma ainda não tem etapas. Use o botão “Etapa” para começar.'}</div>
    const { lw, W, px } = G
    const mEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const tIn = today >= G.s && today <= G.e, tx = XD(today) + px / 2
    return (
      <div className="tl-in" style={{ width: lw + W }}>
        <div className="row hd" style={{ width: lw + W }}>
          <div className="lc"><span className="lbl">Etapas</span></div>
          <div className="tc" style={{ width: W }}>
            {grid.months.map(mo => <div key={mo.getTime()} className={`m ${mo.getFullYear() === today.getFullYear() && mo.getMonth() === today.getMonth() ? 'now' : ''}`} style={{ left: XD(mo), width: XD(mEnd(mo)) - XD(mo) }}>{MNF[mo.getMonth()]}<small>{mo.getFullYear()}</small></div>)}
            {grid.wk}
            {dragView && <>
              <span className="hmk a" style={{ left: X(dragView.a) }}>{fmt(dragView.a, false)}<small>{WD[D(dragView.a).getDay()]}</small></span>
              <span className="hmk b" style={{ left: X(dragView.b) + px }}>{fmt(dragView.b, false)}<small>{WD[D(dragView.b).getDay()]}</small></span>
            </>}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div className="ov" style={{ left: lw, width: W }}>
            {grid.months.map(mo => <i key={mo.getTime()} className="ml" style={{ left: XD(mo) }} />)}
            {grid.we}{grid.wl}
            {tIn && <i className="today" style={{ left: tx - 1 }} />}
            {dragView && <div className="hl" style={{ left: X(dragView.a), width: X(dragView.b) + px - X(dragView.a) }} />}
          </div>
          {rows.map(it => renderRow(it))}
        </div>
      </div>
    )
  }

  function renderRow(it: Item) {
    const { lw, W, px } = G
    const g = m.isGrp(it), dp = m.depth(it), v = m.vis(it), lt = m.late(it)
    const dv = dragView?.id === it.id ? dragView : null
    const [a0, b0] = m.span(it)
    const a = dv?.a ?? a0, b = dv?.b ?? b0
    const nLeaves = g ? m.desc(it.id).filter(x => !m.isGrp(x)).length : 0
    const isClosed = closed.has(it.id)

    let bar: ReactNode = null
    if (a && b) {
      const L = X(a), Wd = Math.max((days(a, b) + 1) * px, px)
      const tip = `${it.t} · ${fmt(a)} → ${fmt(b)} · ${m.visLabel(it)} · ${(it.resp || []).map(rn).join(' / ')}`
      const nd = days(a, b) + 1, per = `${fmt(a, false)} – ${fmt(b, false)}`
      const dur = <small>{nd} {nd > 1 ? 'dias' : 'dia'}</small>
      if (g) {
        bar = (
          <button className="gg" onClick={() => openDrawer(it.id)} style={{ left: L, width: Wd }} title={tip}>
            <span className="fill" style={{ width: `${m.leafPct(it) * 100}%` }} />
            <span className="in num">{per}{dur}</span>
          </button>
        )
      } else {
        const out = Wd < 104
        bar = (
          <div className={`gb b-${v} ${lt ? 'is-late' : ''} ${out ? 'out' : ''} ${dv ? 'drag' : ''}`} data-bar={it.id} style={{ left: L, width: Wd }} title={tip}
            onPointerDown={e => onBarDown(e, it)}>
            <span className="h l" data-h="l" />
            <span className="in num">{dv ? per : <>{per}{out || Wd >= 165 ? dur : null}</>}</span>
            <span className="h r" data-h="r" />
            {dv && <span className="gtip">{days(a, b) + 1} {days(a, b) ? 'dias' : 'dia'}</span>}
          </div>
        )
      }
    }

    if (!(a && b) && !g) {
      // Item sem prazo (comum em modelos): atalho para dar um prazo inicial e ajustar arrastando a barra
      const left = Math.max(4, Math.min(X(iso(today)), Math.max(4, W - 130)))
      bar = <button className="gd" style={{ left }} title="Definir um prazo de 1 semana a partir de hoje (depois é só arrastar a barra)" onClick={() => setPrazo(it.id)}>+ definir prazo</button>
    }

    const sd = g ? <span className="pc">{Math.round(m.leafPct(it) * 100)}%</span>
      : m.blocked(it)
        ? <button className={`sd ${lt ? 'is-late' : ''}`} onClick={e => openMenu('st', e.currentTarget, it.id)} title={`Bloqueado — aguarda ${m.openDeps(it).join(', ')}`}>{I_LOCK}</button>
        : <button className={`sd ${lt ? 'is-late' : ''}`} onClick={e => openMenu('st', e.currentTarget, it.id)} title={`${m.visLabel(it)}${lt ? ' · atrasado' : ''} — clique para alterar`}><i className={`d-${m.status(it)}`} /></button>

    return (
      <div key={it.id} className={`row dr d${dp} ${g ? 'grp' : ''} ${g && isClosed ? 'fold' : ''}`} style={{ width: lw + W }}>
        <div className="lc" style={{ paddingLeft: 12 + dp * 18 }}>
          {g
            ? <button className={`cv ${isClosed ? 'closed' : ''}`} aria-label="Recolher/expandir" onClick={() => setClosed(prev => { const n = new Set(prev); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n })}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg></button>
            : <span className="cvs" />}
          <span className="id">{it.id}</span>
          {renameId === it.id
            ? <RenameInput initial={it.t} onDone={v => finishRename(it.id, v)} />
            : <button className="tt" title={`${it.t} — clique para detalhes, duplo clique para renomear`}
              onClick={() => { if (clickT.current) clearTimeout(clickT.current); clickT.current = setTimeout(() => openDrawer(it.id), 230) }}
              onDoubleClick={() => { if (clickT.current) clearTimeout(clickT.current); setRenameId(it.id) }}>{it.t}</button>}
          {g && isClosed && <span className="kc" title={`${nLeaves} itens recolhidos`}>{nLeaves}</span>}
          <button className="act" title={g ? 'Subetapas' : 'Dividir etapa'} onClick={e => openMenu('act', e.currentTarget, it.id)}>{g ? I_DOTS : I_SC}</button>
          {sd}
        </div>
        <div className="tc" style={{ width: W }}>{bar}</div>
      </div>
    )
  }

  // ── painel de status ────────────────────────────────────────────────────────
  function renderStatusPanel() {
    const s = m.stats(), tops = m.tops(), curE = m.currentEtapa()
    const pick = etapaSel && m.find(etapaSel) && !m.find(etapaSel)?.parent ? etapaSel : curE?.id ?? null
    const cards: [string, string, number, string][] = [['concluido', 'Concluídos', s.c.concluido, 'var(--ok)'], ['andamento', 'Em andamento', s.c.andamento, 'var(--run)'], ['aguardando', 'Aguardando cliente', s.c.aguardando, 'var(--gold)'], ['bloqueado', 'Bloqueados', s.blk, '#B4BDCC'], ['atrasado', 'Atrasados', s.late, 'var(--late)']]
    const r = 28, c = 2 * Math.PI * r
    const e = pick ? m.find(pick) : null
    return (
      <>
        <div className="scrim clear" onClick={() => setLayer(null)} />
        <section className="sp-panel" role="dialog" aria-label="Status do cronograma">
          <div className="sp-h">
            <div className="bigring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r={r} stroke="#E4E8F0" /><circle cx="32" cy="32" r={r} stroke="#2A4F96" strokeDasharray={`${c * s.pct} ${c}`} strokeLinecap="round" transform="rotate(-90 32 32)" /></svg><b>{Math.round(s.pct * 100)}%</b></div>
            <div className="info"><strong>{s.c.concluido} de {s.n} itens concluídos</strong>
              <div className="meta"><span>Início <b className="num">{fmt(s.ini)}</b></span><span>Término previsto <b className="num">{fmt(s.fim)}</b></span>{s.next && <span>Próximo prazo <b className="num">{fmt(s.next.fim, false)}</b> · item {s.next.id}</span>}</div></div>
            <button className="x" onClick={() => setLayer(null)} aria-label="Fechar">✕</button>
          </div>
          <div className="counts">{cards.map(([k, l, v, col]) => (
            <button key={k} className={`count ${v ? '' : 'zero'}`} title="Mostrar na linha do tempo" onClick={() => { setFCount(k); setLayer(null) }}><i className="dot" style={{ background: col }} /><strong>{v}</strong>{l}</button>
          ))}</div>
          <div className="sp-b">
            <div className="elist">{tops.map(t => {
              const [a, b] = m.span(t), st = m.status(t), p = m.leafPct(t)
              return (
                <button key={t.id} className={`eitem s-${st} ${t.id === curE?.id ? 'cur' : ''} ${t.id === pick ? 'pick' : ''}`} onClick={() => setEtapaSel(t.id)}>
                  <span className="n">{st === 'concluido' ? '✓' : t.id}</span><span className="t">{t.t}</span>
                  <span className="r"><span className="num">{fmt(a, false)} – {fmt(b, false)}</span><span className="mb"><i style={{ width: `${p * 100}%` }} /></span>{m.late(t) && <span className="late">atrasada</span>}</span>
                </button>
              )
            })}</div>
            <div className="snapwrap">
              <div className="snapbar"><span className="lbl">Detalhe da etapa</span><button className="btn gold" onClick={() => void doSnap()}>{I_CAM}Print do cronograma</button></div>
              {e ? renderFocus(e, curE?.id === e.id) : <div className="empty-state">Nenhuma etapa cadastrada.</div>}
            </div>
          </div>
        </section>
      </>
    )
  }

  function renderFocus(e: Item, isCur: boolean) {
    const [a, b] = m.span(e), sub = m.isGrp(e) ? m.kids(e.id) : [e]
    const done = sub.filter(i => m.status(i) === 'concluido').length, now = new Date()
    return (
      <div className="focus">
        <div className="focus-h">
          <div className="t"><span className="lbl">{isCur ? 'Etapa em andamento' : 'Etapa'} · {cur?.cliente}</span><h2>{e.id}. {e.t}</h2></div>
          <span className="rng num">{fmt(a)} → {fmt(b)}</span>{resps(e)} {chip(e)} {m.late(e) && <span className="late">Atrasada</span>}
          <span className="rng">{done}/{sub.length} concluídos</span>
        </div>
        <div className="focus-b">{sub.map(i => {
          const [, ib] = m.span(i)
          return (
            <div key={i.id} className="fitem">
              <span className="n">{i.id}</span>
              <div className="d"><b>{i.t}</b>{i.obs && <p>{i.obs}</p>}{m.isGrp(i) && <p style={{ color: 'var(--ink-3)' }}>{m.kids(i.id).map(k => `${k.id} ${k.t} — ${m.visLabel(k)}`).join(' · ')}</p>}</div>
              <div className="r">{chip(i)}<span className="num">prazo {fmt(ib)} {m.late(i) && <span className="late">atrasado</span>}</span>{dep(i)}</div>
            </div>
          )
        })}</div>
        <div className="focus-f"><span>GT3 Consultoria · {cur?.projeto} · {cur?.cliente}</span><span className="num">Situação em {now.toLocaleDateString('pt-BR')} {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
      </div>
    )
  }

  // ── gaveta do item ──────────────────────────────────────────────────────────
  function renderDrawer(id: string) {
    const it = m.find(id)
    if (!it) return null
    const g = m.isGrp(it), [a, b] = m.span(it)
    const fam = new Set([id, ...m.desc(id).map(x => x.id)])
    let p = it.parent
    while (p) { fam.add(p); p = m.find(p)?.parent ?? null }
    const others = m.flatAll().filter(o => !fam.has(o.id))
    const hist = [...(it.hist || [])].reverse()
    const toggle = (list: string[], v: string) => list.includes(v) ? list.filter(x => x !== v) : [...list, v]
    return (
      <>
        <div className="scrim" onClick={() => setLayer(null)} />
        <aside className="drawer" role="dialog" aria-label={`Item ${id}`}>
          <header><div style={{ flex: 1 }}><div className="n">{g ? 'Etapa' : 'Item'} {it.id}</div><h3>{it.t}</h3></div><button className="x" onClick={() => setLayer(null)} aria-label="Fechar">✕</button></header>
          <div className="body">
            <div className="f"><label className="lbl" htmlFor="dT">Descrição</label>
              <input type="text" id="dT" key={it.t} defaultValue={it.t}
                onBlur={e => { const v = e.target.value.trim() || it.t; if (v !== it.t) editItem(id, x => { x.t = v; return 'Descrição alterada' }) }} /></div>
            {g ? <>
              <div className="f"><span className="lbl">Período e status (calculados pelas subetapas)</span><div className="ro"><span className="num">{fmt(a)} → {fmt(b)}</span> · {chip(it)} · {Math.round(m.leafPct(it) * 100)}% concluído</div></div>
              <div className="splitbox"><span>{m.kids(id).length} subetapas: {m.kids(id).map(k => k.id).join(', ')}</span>
                <button className="btn sm" onClick={() => { setLayer(null); doSub(id) }}>{I_PL}Subetapa</button>
                <button className="btn sm" onClick={() => { setLayer(null); doMerge(id) }}>{I_MG}Juntar</button></div>
            </> : <>
              {!isModelo && <div className="f"><span className="lbl">Status</span>
                <div className="pills st">{(Object.entries(ST) as [StKey, { l: string }][]).map(([k, v]) => (
                  <button key={k} className={`st-${k} ${it.st === k ? 'on' : ''}`} onClick={() => doStatus(id, k)}>{v.l}</button>
                ))}</div>
                {m.blocked(it) && <span className="dep">{I_LOCK}Bloqueado até concluir {m.openDeps(it).join(', ')}</span>}</div>}
              <div className="row2">
                <div className="f"><label className="lbl" htmlFor="dIni">Início</label>
                  <input type="date" id="dIni" key={it.ini} defaultValue={it.ini || ''}
                    onChange={e => { const v = e.target.value; editItem(id, x => { if ((x.ini || '') === v) return null; const old = x.ini; x.ini = v; return `Início: ${fmt(old)} → ${fmt(v)}` }) }} /></div>
                <div className="f"><label className="lbl" htmlFor="dFim">Prazo</label>
                  <input type="date" id="dFim" key={it.fim} defaultValue={it.fim || ''}
                    onChange={e => { const v = e.target.value; editItem(id, x => { if ((x.fim || '') === v) return null; const old = x.fim; x.fim = v; return `Prazo: ${fmt(old)} → ${fmt(v)}` }) }} /></div>
              </div>
              <div className="splitbox"><span>Dividir esta etapa em partes com o período repartido</span>
                <button className="btn sm" onClick={() => { setLayer(null); doSplit(id, 2) }}>{I_SC}2</button>
                <button className="btn sm" onClick={() => { setLayer(null); doSplit(id, 3) }}>3</button>
                <button className="btn sm" onClick={() => { setLayer(null); doSplit(id, 4) }}>4</button></div>
            </>}
            <div className="f"><label className="lbl" htmlFor="dDet">Detalhamento</label>
              <textarea id="dDet" key={it.det ?? ''} placeholder="Informações fixas do item" defaultValue={it.det || ''}
                onBlur={e => { const v = e.target.value; if ((it.det || '') !== v) editItem(id, x => { x.det = v; return null }) }} /></div>
            <div className="f"><span className="lbl">Responsável</span>
              <div className="pills">{RESPS.map(r => (
                <button key={r} className={(it.resp || []).includes(r) ? 'on' : ''} onClick={() => editItem(id, x => { const s = toggle(x.resp, r) as Resp[]; x.resp = RESPS.filter(q => s.includes(q)); return null })}>{rn(r)}</button>
              ))}</div></div>
            {!g && <div className="f"><span className="lbl">Depende de</span>
              <div className="pills">{others.map(o => (
                <button key={o.id} className={(it.deps || []).includes(o.id) ? 'on' : ''} title={o.t} onClick={() => editItem(id, x => { x.deps = toggle(x.deps ?? [], o.id); return null })}>{o.id}</button>
              ))}</div></div>}
            <div className="f"><label className="lbl" htmlFor="dObs">Observação / situação atual</label>
              <textarea id="dObs" key={it.obs} defaultValue={it.obs || ''}
                onBlur={e => { const v = e.target.value; if ((it.obs || '') !== v) editItem(id, x => { x.obs = v; return 'Observação: ' + v }) }} /></div>
            {!isModelo && <div className="f"><span className="lbl">Histórico</span>
              <form className="cmt" onSubmit={e => { e.preventDefault(); const v = cmt.trim(); if (!v) return; editItem(id, () => v); setCmt(''); showToast('Andamento registrado') }}>
                <input value={cmt} onChange={e => setCmt(e.target.value)} placeholder="Registrar andamento (ex.: e-mail enviado ao cliente)" /><button className="btn pri" type="submit">Registrar</button></form>
              <div className="hist" style={{ marginTop: 8 }}>{hist.length
                ? hist.map((h, i) => <div key={i}>{h.t}<small>{fmtDT(h.d)} · {h.u}</small></div>)
                : <div style={{ color: 'var(--ink-3)' }}>Sem registros ainda.</div>}</div></div>}
          </div>
          <footer>
            <button className={`btn danger ${armDel ? 'arm' : ''}`} onClick={() => { if (!armDel) { setArmDel(true); return } setLayer(null); doRemove(id) }}>{armDel ? 'Confirmar exclusão' : `Excluir ${g ? 'etapa e subetapas' : 'item'}`}</button>
            <button className="btn pri" onClick={() => setLayer(null)}>Fechar</button>
          </footer>
        </aside>
      </>
    )
  }

  // ── menus ───────────────────────────────────────────────────────────────────
  function renderMenu(l: Extract<Layer, { k: 'menu' }>) {
    const id = l.id, it = id ? m.find(id) : undefined
    const pick = (fn: () => void) => () => { setLayer(null); fn() }
    let body: ReactNode = null
    if (l.m === 'st' && it && id) {
      body = <>
        <div className="mh">Item {id}</div>
        {(Object.entries(ST) as [StKey, { l: string; k: string }][]).map(([k, v]) => (
          <button key={k} className={it.st === k ? 'on' : ''} onClick={pick(() => doStatus(id, k))}>
            <span className={`chip st-${k}`} style={{ padding: 0, background: 'none' }}><i className="dot" /></span>{v.l}<kbd>{v.k}</kbd>
          </button>
        ))}
        {m.blocked(it) && <><hr /><div className="mh" style={{ textTransform: 'none', letterSpacing: 0 }}>Aguarda {m.openDeps(it).join(', ')}</div></>}
      </>
    } else if (l.m === 'act' && it && id) {
      const g = m.isGrp(it)
      body = g ? <>
        <div className="mh">Etapa {id}</div>
        <button onClick={pick(() => doSub(id))}>{I_PL}Adicionar subetapa</button>
        <button onClick={pick(() => doMerge(id))}>{I_MG}Juntar subetapas em uma só</button><hr />
        <button onClick={pick(() => openDrawer(id))}>{I_OP}Abrir detalhes</button>
      </> : <>
        <div className="mh">Dividir {id} em</div>
        {[2, 3, 4].map(n => <button key={n} onClick={pick(() => doSplit(id, n))}>{I_SC}{n} partes</button>)}
        <button onClick={pick(() => doSub(id))}>{I_PL}Criar subetapa (mantém a atual)</button><hr />
        <button onClick={pick(() => openDrawer(id))}>{I_OP}Abrir detalhes</button>
      </>
    } else if (l.m === 'export') {
      body = <>
        <button onClick={pick(() => void doExport('xls'))}><svg {...svgp}><path d="M4 3h11l5 5v13H4z" /><path d="M8 11l6 7M14 11l-6 7" /></svg>Excel (.xlsx)</button>
        <button onClick={pick(() => void doExport('pdf'))}><svg {...svgp}><path d="M4 3h11l5 5v13H4z" /><path d="M8 13h8M8 17h5" /></svg>PDF</button>
      </>
    } else if (l.m === 'more' || l.m === 'moreDel') {
      if (!cur) return null
      const anyOpen = m.itens.some(i => m.isGrp(i) && !closed.has(i.id))
      const del = l.m === 'moreDel'
      body = <>
        {!isModelo && <button onClick={pick(() => setFOpen(v => !v))}>Só pendências{fOpen && <span className="ck">✓</span>}</button>}
        <button onClick={pick(() => { if (anyOpen) foldAll(m.itens); else setClosed(new Set()) })}>{anyOpen ? 'Recolher todas as etapas' : 'Expandir todas as etapas'}</button><hr />
        <button onClick={pick(() => showToast('Arraste a barra para mover · puxe as pontas para mudar datas · tesoura divide · duplo clique renomeia', 6000))}>Como editar na linha do tempo</button>
        <button onClick={pick(() => openForm(isModelo ? 'mod-edit' : 'cron-edit'))}>{I_EDIT}{isModelo ? 'Editar nome / projeto do modelo' : 'Editar contratante / projeto'}</button>
        {!isModelo && <button onClick={pick(() => openForm('mod-new', { base: cur.id }))}>{I_MG}Salvar como modelo…</button>}
        <button className="danger" onClick={del ? pick(() => void deleteRow(cur)) : () => setLayer({ ...l, m: 'moreDel' })}>
          {del ? `Confirmar: excluir ${isModelo ? 'este modelo' : 'este cronograma'}` : `Excluir ${isModelo ? 'este modelo' : 'este cronograma'}`}</button>
      </>
    }
    return <><div className="scrim clear" onClick={() => setLayer(null)} /><Menu rect={l.rect}>{body}</Menu></>
  }

  // ── configurações: modelos ──────────────────────────────────────────────────
  function renderConfig() {
    const close = () => { setLayer(null); setCfgDel(null) }
    return (
      <>
        <div className="scrim" onClick={close} />
        <aside className="drawer modal wide" role="dialog" aria-label="Configurações dos cronogramas">
          <header><div style={{ flex: 1 }}><div className="n">Configurações</div><h3>Modelos de cronograma</h3></div><button className="x" onClick={close} aria-label="Fechar">✕</button></header>
          <div className="body">
            <p className="fhint" style={{ margin: 0 }}>Um modelo é um cronograma pronto para reaproveitar. Ao criar o cronograma de uma nova contratante, escolha o modelo e o início do projeto: etapas, prazos e dependências já vêm montados, com todos os itens pendentes.</p>
            {modList.length === 0
              ? <div className="empty-state">Nenhum modelo ainda.</div>
              : <div className="mlist">{modList.map(md => {
                const folhas = md.itens.filter(i => !md.itens.some(o => o.parent === i.id)).length
                const etapas = md.itens.filter(i => !i.parent).length
                return (
                  <div key={md.id} className="mrow">
                    <div className="mi"><b>{md.cliente}</b><span>{md.projeto} · {etapas} {etapas === 1 ? 'etapa' : 'etapas'} · {folhas} {folhas === 1 ? 'item' : 'itens'}</span></div>
                    <div className="ma">
                      <button className="btn sm" onClick={() => { setCfgDel(null); enterModelos(md.id) }}>Editar etapas</button>
                      <button className="btn sm ic" title="Renomear" aria-label={`Renomear ${md.cliente}`} onClick={() => { setCfgDel(null); openForm('mod-edit', { base: md.id, from: 'config' }) }}>{I_EDIT}</button>
                      <button className={`btn sm danger ${cfgDel === md.id ? 'arm' : ''}`} onClick={() => { if (cfgDel !== md.id) { setCfgDel(md.id); return } setCfgDel(null); void deleteRow(md) }}>{cfgDel === md.id ? 'Confirmar' : 'Excluir'}</button>
                    </div>
                  </div>
                )
              })}</div>}
          </div>
          <footer><button className="btn" onClick={() => { setCfgDel(null); openForm('mod-new', { from: 'config' }) }}>{I_PL}Novo modelo</button><button className="btn pri" onClick={close}>Fechar</button></footer>
        </aside>
      </>
    )
  }

  function renderForm(l: Extract<Layer, { k: 'form' }>) {
    const edit = l.kind === 'cron-edit' || l.kind === 'mod-edit'
    let initial = { cliente: '', projeto: PROJETO_PADRAO, base_id: '' }
    if (edit) {
      const t = l.base ? cronos?.find(x => x.id === l.base) : cur
      if (t) initial = { cliente: t.cliente, projeto: t.projeto, base_id: '' }
    } else if (l.kind === 'cron-new') {
      const md = modList.find(x => x.id === l.base) ?? modList[0]
      initial = { cliente: '', projeto: md?.projeto ?? PROJETO_PADRAO, base_id: md?.id ?? '' }
    } else if (l.base) {
      const b = cronos?.find(x => x.id === l.base)
      if (b) initial = { cliente: b.modelo ? `${b.cliente} (cópia)` : `Modelo ${b.cliente}`, projeto: b.projeto, base_id: b.id }
    }
    return (
      <FormModal key={`${l.kind}-${l.base ?? ''}`} kind={l.kind} initial={initial} contratantes={contratantes}
        modelos={modList} cronogramas={cronList} hoje={iso(today)}
        onSubmit={p => submitForm(l.kind, p, l.from, l.base)} onClose={closeForm} />
    )
  }

  // ── render ──────────────────────────────────────────────────────────────────
  const stats = m.stats()
  const dupCliente = (c: Cronograma) => list.filter(x => x.cliente.toLowerCase() === c.cliente.toLowerCase()).length > 1

  let content: ReactNode
  if (loadErr) {
    content = <div className="blank"><b>Não foi possível abrir os cronogramas</b><span>{loadErr}</span></div>
  } else if (!cronos) {
    content = <div className="blank">Carregando cronogramas…</div>
  } else if (!cur && modo === 'mod') {
    content = (
      <div className="blank">
        <b>Nenhum modelo cadastrado</b>
        <span>Crie um modelo em branco ou a partir de um cronograma existente.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn pri" onClick={() => openForm('mod-new')}>{I_PL}Novo modelo</button>
          <button className="btn" onClick={exitModelos}>Voltar aos cronogramas</button>
        </div>
      </div>
    )
  } else if (!cur) {
    content = (
      <div className="blank">
        <b>Nenhum cronograma cadastrado</b>
        <span>Crie o primeiro cronograma de implantação de uma contratante{modList.length ? ' — você pode partir de um modelo pronto' : ''}.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn pri" onClick={() => openForm('cron-new')}>{I_PL}Novo cronograma</button>
          <button className="btn" onClick={() => setLayer({ k: 'config' })}>{I_MG}Modelos</button>
        </div>
      </div>
    )
  } else {
    content = (
      <>
        <header className="top">
          <div className="ttl">
            <div className="crumb">{isModelo ? 'Modelos' : 'Cronogramas'} › <b>{cur.cliente}</b></div>
            <h1>{cur.projeto}{isModelo && <span className="tag-modelo">Modelo</span>}</h1>
          </div>
          <div className="actions">
            <span className={`savest ${saveState === 'error' ? 'err' : ''}`} aria-live="polite">{saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? 'Salvo' : saveState === 'error' ? 'Erro ao salvar' : ''}</span>
            <select className="sel" aria-label={isModelo ? 'Modelo' : 'Contratante'} value={cur.id} onChange={e => selectCrono(e.target.value)}>
              {list.map(c => <option key={c.id} value={c.id}>{dupCliente(c) ? `${c.cliente} · ${c.projeto}` : c.cliente}</option>)}
            </select>
            <button className="btn ic" title={isModelo ? 'Novo modelo' : 'Novo cronograma'} aria-label={isModelo ? 'Novo modelo' : 'Novo cronograma'} onClick={() => openForm(isModelo ? 'mod-new' : 'cron-new')}>{I_PL}</button>
            {isModelo ? (
              <button className="btn pri" onClick={exitModelos}>← Voltar aos cronogramas</button>
            ) : (
              <>
                <button className="btn" title="Modelos de cronograma" onClick={() => setLayer({ k: 'config' })}>{I_MG}<span className="hide-sm">Modelos</span></button>
                <button className={`btn ${layer?.k === 'status' ? 'on' : ''}`} aria-haspopup="dialog" onClick={() => layer?.k === 'status' ? setLayer(null) : openStatus()}>
                  <Ring p={stats.pct} /><span>Status</span><span className="num" style={{ color: 'var(--pri)', fontWeight: 600 }}>{Math.round(stats.pct * 100)}%</span>
                  {stats.late > 0 && <span className="badge" title={`${stats.late} atrasado(s)`}>{stats.late}</span>}
                </button>
                <button className="btn" aria-haspopup="menu" onClick={e => openMenu('export', e.currentTarget)}>
                  <svg {...svgp}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg><span className="hide-sm">Exportar</span></button>
                <button className="btn gold" title="Gera uma imagem do cronograma completo (baixa e copia)" onClick={() => void doSnap()}>{I_CAM}<span className="hide-sm">Print do cronograma</span></button>
              </>
            )}
          </div>
        </header>

        {isModelo && (
          <div className="mbanner">
            Você está editando um <b>modelo</b>. Datas são opcionais — normalmente só o item 1 leva uma, como início do projeto. Ao criar um cronograma a partir dele, essa data segue o início escolhido, os itens voltam a <b>Pendente</b> e <code>{'{cliente}'}</code> nos textos vira o nome da contratante.
          </div>
        )}

        <section className="board">
          <div className="tools">
            <div className="seg">
              {(['todos', 'C', 'GT3'] as const).map(r => <button key={r} className={fResp === r ? 'on' : ''} onClick={() => setFResp(r)}>{r === 'todos' ? 'Todos' : r === 'C' ? rn('C') : 'GT3'}</button>)}
            </div>
            <label className="search"><svg {...svgp}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <input type="search" placeholder="Buscar" value={fQ} onChange={e => setFQ(e.target.value)} /></label>
            <span>
              {fCount && <span className="fpill">{COUNT_LABEL[fCount]}<button aria-label="Limpar filtro" onClick={() => setFCount(null)}>✕</button></span>}
              {fOpen && <span className="fpill">Só pendências<button aria-label="Limpar filtro" onClick={() => setFOpen(false)}>✕</button></span>}
            </span>
            <span className="sp" />
            <button className="btn" onClick={doNew}>{I_PL}<span className="hide-sm">Etapa</span></button>
            {!isModelo && <button className="btn" title="Ir para hoje" onClick={() => scrollToToday()}>Hoje</button>}
            <button className="btn ic" title="Mais opções" aria-haspopup="menu" onClick={e => openMenu('more', e.currentTarget)}>{I_DOTS}</button>
          </div>
          <div className="tl" ref={tlRef}>{renderTimeline()}</div>
          <div className="legend"><span><i className="b-concluido" />Concluído</span><span><i className="b-andamento" />Em andamento</span><span><i className="b-aguardando" />Aguardando cliente</span><span><i className="b-pendente" />Pendente</span><span><i className="b-bloqueado" />Bloqueado</span>{!isModelo && <span><i style={{ boxShadow: '0 0 0 2px var(--late)', background: '#fff' }} />Atrasado</span>}</div>
        </section>
      </>
    )
  }

  return (
    <div className="crm" style={{ '--lw': `${G.lw}px` } as React.CSSProperties}>
      <style>{STYLES}</style>
      {content}

      {layer?.k === 'status' && cur && renderStatusPanel()}
      {layer?.k === 'drawer' && cur && renderDrawer(layer.id)}
      {layer?.k === 'menu' && cur && renderMenu(layer)}
      {layer?.k === 'config' && renderConfig()}
      {layer?.k === 'form' && renderForm(layer)}
      {toast && <div className="toast" role="status"><i />{toast}</div>}
    </div>
  )
}
