// Modelo do módulo Cronogramas: tipos, cálculo de status/período/atraso e as operações
// de edição da árvore de etapas. Tudo puro (sem React) — as operações recebem uma cópia
// da lista de itens e devolvem a nova lista.

export type Resp = 'C' | 'GT3'
export type StKey = 'pendente' | 'andamento' | 'aguardando' | 'concluido'
export type Vis = StKey | 'bloqueado'
export type Hist = { d: string; u: string; t: string }

export type Item = {
  id: string
  parent: string | null
  t: string
  det?: string
  resp: Resp[]
  ini?: string
  fim?: string
  st?: StKey
  obs: string
  deps: string[]
  hist: Hist[]
}

/** Cronograma de uma contratante ou, quando `modelo` é true, um modelo reutilizável
 *  (nesse caso `cliente` guarda o nome do modelo e `projeto` o nome de projeto sugerido). */
export type Cronograma = {
  id: string
  cliente: string
  projeto: string
  modelo: boolean
  itens: Item[]
  created_at: string
  updated_at: string
}

export const CRONO_SELECT = 'id, cliente, projeto, modelo, itens, created_at, updated_at'
export const PROJETO_PADRAO = 'Implantação Portal de Terceiros'

export const ST: Record<StKey, { l: string; k: string }> = {
  pendente:   { l: 'Pendente',           k: '1' },
  andamento:  { l: 'Em andamento',       k: '2' },
  aguardando: { l: 'Aguardando cliente', k: '3' },
  concluido:  { l: 'Concluído',          k: '4' },
}

// ─── Datas ───────────────────────────────────────────────────────────────────

export const DAY = 864e5
export const D = (s: string) => new Date(s + 'T00:00:00')
export const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export const addDays = (s: string, n: number) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d) }
export const days = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / DAY)
export const fmt = (s: string | undefined | null, y = true) => {
  if (!s) return '—'
  const [a, m, d] = s.split('-')
  return y ? `${d}/${m}/${a.slice(2)}` : `${d}/${m}`
}
export const fmtDT = (x: string) => {
  const d = new Date(x)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

export const MNF = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const MN = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

// ─── Consultas sobre a árvore ────────────────────────────────────────────────

export type Span = [string | undefined, string | undefined]

/** `modelo`: datas de um modelo são só referência de prazos — nada nele fica "atrasado". */
export function makeModel(itens: Item[], today: Date, opts: { modelo?: boolean } = {}) {
  const byId = new Map(itens.map(i => [i.id, i]))
  const kidsMap = new Map<string | null, Item[]>()
  itens.forEach(i => {
    const k = i.parent && byId.has(i.parent) ? i.parent : null
    kidsMap.set(k, [...(kidsMap.get(k) ?? []), i])
  })

  const find = (id: string) => byId.get(id)
  const kids = (id: string | null) => kidsMap.get(id) ?? []
  const isGrp = (it: Item) => kids(it.id).length > 0
  const tops = () => kids(null)
  const leaves = () => itens.filter(i => !isGrp(i))
  const desc = (id: string): Item[] => kids(id).flatMap(k => [k, ...desc(k.id)])
  const depth = (it: Item) => { let d = 0, p = it.parent; while (p) { d++; p = find(p)?.parent ?? null } return d }
  const flatAll = (list: Item[] = tops()): Item[] => list.flatMap(it => [it, ...flatAll(kids(it.id))])

  function status(it: Item): StKey {
    if (isGrp(it)) {
      const ss = kids(it.id).map(status)
      if (ss.every(s => s === 'concluido')) return 'concluido'
      if (ss.some(s => s !== 'pendente')) return 'andamento'
      return 'pendente'
    }
    return it.st ?? 'pendente'
  }
  function span(it: Item): Span {
    if (!isGrp(it)) return [it.ini, it.fim]
    const k = kids(it.id).map(span)
    const a = k.map(x => x[0]).filter(Boolean).sort() as string[]
    const b = k.map(x => x[1]).filter(Boolean).sort() as string[]
    return [a[0], b[b.length - 1]]
  }
  const openDeps = (it: Item) => (it.deps ?? []).filter(d => { const o = find(d); return o && status(o) !== 'concluido' })
  const blocked = (it: Item) => !isGrp(it) && it.st === 'pendente' && openDeps(it).length > 0
  const late = (it: Item) => { const f = span(it)[1]; return !opts.modelo && status(it) !== 'concluido' && !!f && D(f) < today }
  const vis = (it: Item): Vis => blocked(it) ? 'bloqueado' : status(it)
  const visLabel = (it: Item) => blocked(it) ? 'Bloqueado' : ST[status(it)].l
  const leafPct = (it: Item) => {
    const l = isGrp(it) ? desc(it.id).filter(x => !isGrp(x)) : [it]
    return l.length ? l.filter(x => x.st === 'concluido').length / l.length : 0
  }

  function stats() {
    const L = leaves(), n = L.length
    const c: Record<StKey, number> = { concluido: 0, andamento: 0, aguardando: 0, pendente: 0 }
    L.forEach(i => { c[status(i)]++ })
    const pct = n ? (c.concluido + c.andamento * .5 + c.aguardando * .5) / n : 0
    const all = tops().map(span)
    const ini = all.map(x => x[0]).filter(Boolean).sort()[0]
    const fim = all.map(x => x[1]).filter(Boolean).sort().pop()
    const next = L.filter(i => status(i) !== 'concluido' && i.fim && D(i.fim) >= today)
      .sort((a, b) => a.fim!.localeCompare(b.fim!))[0]
    return { n, c, pct, ini, fim, next, late: L.filter(late).length, blk: L.filter(blocked).length }
  }
  const currentEtapa = () => tops().find(t => status(t) !== 'concluido') ?? tops()[tops().length - 1]

  /** Menor e maior data de todo o cronograma (ou undefined se nenhum item tem data). */
  function bounds(): [string, string] | null {
    const sp = flatAll().flatMap(span).filter(Boolean).sort() as string[]
    return sp.length ? [sp[0], sp[sp.length - 1]] : null
  }
  function projMonths() {
    const b = bounds()
    if (!b) return []
    const s = D(b[0]), e = D(b[1]), out: { lab: string; a: Date; b: Date }[] = []
    for (let m = new Date(s.getFullYear(), s.getMonth(), 1); m <= e; m = new Date(m.getFullYear(), m.getMonth() + 1, 1))
      out.push({ lab: MN[m.getMonth()] + String(m.getFullYear()).slice(2), a: new Date(m), b: new Date(m.getFullYear(), m.getMonth() + 1, 0) })
    return out
  }

  return { itens, find, kids, isGrp, tops, leaves, desc, depth, flatAll, status, span, openDeps, blocked, late, vis, visLabel, leafPct, stats, currentEtapa, bounds, projMonths }
}
export type Model = ReturnType<typeof makeModel>

// ─── Operações de edição (recebem uma cópia mutável e devolvem a nova lista) ──

export type OpResult = { arr: Item[]; msg?: string; focus?: string }

export function log(it: Item, t: string, user: string) {
  it.hist = it.hist ?? []
  it.hist.push({ d: new Date().toISOString(), u: user, t })
}

export function setStatus(arr: Item[], id: string, st: StKey, user: string, today: Date): OpResult {
  const it = arr.find(i => i.id === id)
  if (!it || it.st === st) return { arr }
  const waiting = arr.filter(o => (o.deps ?? []).includes(id))
  log(it, `Status: ${ST[it.st ?? 'pendente'].l} → ${ST[st].l}`, user)
  it.st = st
  if (st === 'concluido') {
    const m = makeModel(arr, today)
    const freed = waiting.filter(o => !m.blocked(o) && o.st === 'pendente').map(o => o.id)
    return { arr, msg: freed.length ? `Item ${id} concluído. Liberado: ${freed.join(', ')}` : `Item ${id} concluído` }
  }
  return { arr, msg: `Item ${id}: ${ST[st].l}` }
}

function insertAfterBranch(arr: Item[], parentId: string, newItems: Item[]) {
  const m = makeModel(arr, startOfToday())
  const branch = [m.find(parentId)!, ...m.desc(parentId)]
  const at = Math.max(...branch.map(b => arr.indexOf(b))) + 1
  arr.splice(at, 0, ...newItems)
}
function nextChildId(m: Model, pid: string) {
  const k = m.kids(pid)
  return `${pid}.${k.length ? Math.max(...k.map(x => +x.id.split('.').pop()!)) + 1 : 1}`
}

export function splitItem(arr: Item[], id: string, n: number, user: string, today: Date): OpResult {
  const m = makeModel(arr, today)
  const it = m.find(id)
  if (!it || m.isGrp(it)) return { arr }
  const a = it.ini || iso(today), b = it.fim || a, tot = Math.max(days(a, b) + 1, n)
  const parts: Item[] = []
  for (let k = 0; k < n; k++) {
    const s = addDays(a, Math.floor(tot * k / n))
    const e = addDays(a, Math.max(Math.floor(tot * (k + 1) / n) - 1, Math.floor(tot * k / n)))
    parts.push({
      id: `${id}.${k + 1}`, parent: id, t: `${it.t} – parte ${k + 1}`, resp: [...(it.resp ?? [])], ini: s, fim: e,
      st: k === 0 ? it.st : 'pendente', obs: '', deps: k === 0 ? [...(it.deps ?? [])] : [],
      hist: [{ d: new Date().toISOString(), u: user, t: `Criado ao dividir o item ${id}` }],
    })
  }
  it.deps = []
  log(it, `Etapa dividida em ${n} partes`, user)
  arr.splice(arr.indexOf(it) + 1, 0, ...parts)
  return { arr, msg: `Item ${id} dividido em ${n} partes — clique duas vezes no nome para renomear`, focus: parts[0].id }
}

export function addSub(arr: Item[], pid: string, user: string, today: Date): OpResult {
  const m = makeModel(arr, today)
  const p = m.find(pid)
  if (!p) return { arr }
  if (!m.isGrp(p)) return splitItem(arr, pid, 1, user, today)
  const [, b] = m.span(p)
  const nid = nextChildId(m, pid)
  const s = b ? addDays(b, 1) : iso(today)
  const it: Item = { id: nid, parent: pid, t: 'Nova subetapa', resp: [...(p.resp ?? ['GT3'])], ini: s, fim: addDays(s, 4), st: 'pendente', obs: '', deps: [], hist: [] }
  log(it, 'Subetapa criada', user)
  insertAfterBranch(arr, pid, [it])
  return { arr, msg: `Subetapa ${nid} criada`, focus: nid }
}

export function mergeItem(arr: Item[], id: string, user: string, today: Date): OpResult {
  const m = makeModel(arr, today)
  const it = m.find(id)
  if (!it || !m.isGrp(it)) return { arr }
  const [a, b] = m.span(it), st = m.status(it), n = m.desc(id)
  it.ini = a; it.fim = b; it.st = st
  const gone = new Set(n.map(x => x.id))
  const next = arr.filter(x => !gone.has(x.id))
  next.forEach(o => { o.deps = (o.deps ?? []).filter(d => !gone.has(d)) })
  log(it, `Subetapas juntadas (${n.length}) em uma etapa única`, user)
  return { arr: next, msg: `Item ${id} voltou a ser uma etapa única` }
}

export function removeItem(arr: Item[], id: string, today: Date): OpResult {
  const m = makeModel(arr, today)
  const gone = new Set([id, ...m.desc(id).map(x => x.id)])
  const next = arr.filter(o => !gone.has(o.id))
  next.forEach(o => { o.deps = (o.deps ?? []).filter(d => !gone.has(d)) })
  return { arr: next, msg: `Item ${id} excluído` }
}

export function addEtapa(arr: Item[], user: string, today: Date): OpResult {
  const m = makeModel(arr, today)
  const id = String(Math.max(0, ...m.tops().map(t => parseInt(t.id) || 0)) + 1)
  const ends = m.flatAll().map(x => m.span(x)[1]).filter(Boolean).sort() as string[]
  const s = ends.length ? addDays(ends.pop()!, 1) : iso(today)
  const it: Item = { id, parent: null, t: 'Nova etapa', resp: ['GT3'], ini: s, fim: addDays(s, 6), st: 'pendente', obs: '', deps: [], hist: [] }
  log(it, 'Etapa criada', user)
  arr.push(it)
  return { arr, msg: `Etapa ${id} criada — digite o nome`, focus: id }
}

// ─── Modelos de cronograma ───────────────────────────────────────────────────
// Um modelo é uma árvore de etapas; as datas são opcionais (normalmente só o item 1 leva uma,
// como âncora). Ao criar um cronograma a partir dele, as datas que existirem são deslocadas para
// que a primeira caia no início escolhido, o status volta a "pendente", o histórico é zerado e
// `{cliente}` nos textos vira o nome da contratante.

export const TOKEN_CLIENTE = '{cliente}'

const primeiraData = (itens: Item[]) =>
  (itens.flatMap(i => [i.ini, i.fim]).filter(Boolean) as string[]).sort()[0]

/** Dias a somar às datas do modelo para que a primeira delas caia em `inicio`. */
export function deslocamento(itens: Item[], inicio: string): number {
  const a = primeiraData(itens)
  return a ? days(a, inicio) : 0
}

/** Data em que o primeiro item começará ao usar o modelo com `inicio` (ou null se o modelo não tem datas). */
export function inicioResultante(itens: Item[], inicio: string): string | null {
  const a = primeiraData(itens)
  return a ? addDays(a, deslocamento(itens, inicio)) : null
}

const trocar = (s: string, de: RegExp, por: string) => s.replace(de, () => por)

export function instanciarModelo(itens: Item[], cliente: string, inicio: string): Item[] {
  const delta = deslocamento(itens, inicio)
  const re = /\{cliente\}/gi
  return itens.map(i => {
    const c: Item = structuredClone(i)
    c.t = trocar(c.t, re, cliente)
    c.obs = trocar(c.obs ?? '', re, cliente)
    if (c.det !== undefined) c.det = trocar(c.det, re, cliente)
    if (c.ini) c.ini = addDays(c.ini, delta)
    if (c.fim) c.fim = addDays(c.fim, delta)
    if (c.st) c.st = 'pendente'
    c.hist = []
    return c
  })
}

/** Transforma um cronograma em modelo: zera status/histórico e troca o nome da contratante por `{cliente}`. */
export function paraModelo(itens: Item[], cliente?: string): Item[] {
  const nome = cliente?.trim()
  const re = nome ? new RegExp(nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : null
  const tok = (s: string) => re ? trocar(s, re, TOKEN_CLIENTE) : s
  return itens.map(i => {
    const c: Item = structuredClone(i)
    c.t = tok(c.t)
    c.obs = tok(c.obs ?? '')
    if (c.det !== undefined) c.det = tok(c.det)
    if (c.st) c.st = 'pendente'
    c.hist = []
    return c
  })
}
