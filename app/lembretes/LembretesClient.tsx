'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser } from '../components/UserContext'
import { createClient } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

const PERIODS = ['unico', 'diario', 'semanal', 'mensal', 'trimestral', 'semestral', 'anual'] as const
type Period = typeof PERIODS[number]

const PERIOD_LABEL: Record<Period, string> = {
  unico: 'Único', diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal',
  trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

type Visibilidade = 'todos' | 'proprio' | 'selecionados'

type Lembrete = {
  id: string
  titulo: string
  descricao: string | null
  periodo: Period
  data_inicio: string
  concluido: boolean
  criado_por: string | null
  created_at: string
  visibilidade: Visibilidade
  destinatarios: string[] | null
}

type UserOption = { id: string; nome: string | null; usuario: string | null; papel: string | null }

type HistoricoRow = {
  id: string
  lembrete_id: string
  lembrete_titulo: string
  usuario_id: string
  usuario_nome: string
  usuario_login: string
  mes_referencia: string
  created_at: string
}

type Filter = 'pendentes' | 'todos' | 'hoje' | 'atrasados' | 'concluidos'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function fmtDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtBR(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function mesReferenciaAtual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function formatDatetime(iso: string): string {
  const dt = new Date(iso)
  const date = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${date} às ${time}`
}

function findMonthOccurrence(r: Lembrete, year: number, month: number): string | null {
  const mStart = new Date(year, month, 1)
  const mEnd = new Date(year, month + 1, 0)
  const start = parseDate(r.data_inicio)

  if (r.periodo === 'unico') {
    if (start.getFullYear() === year && start.getMonth() === month) return fmtDateStr(start)
    return null
  }
  if (r.periodo === 'diario') {
    const day = start > mStart ? start : new Date(mStart)
    return day <= mEnd ? fmtDateStr(day) : null
  }

  let cur = new Date(start)
  while (cur < mStart) {
    if (r.periodo === 'semanal')      cur.setDate(cur.getDate() + 7)
    else if (r.periodo === 'mensal')       cur.setMonth(cur.getMonth() + 1)
    else if (r.periodo === 'trimestral')   cur.setMonth(cur.getMonth() + 3)
    else if (r.periodo === 'semestral')    cur.setMonth(cur.getMonth() + 6)
    else if (r.periodo === 'anual')        cur.setFullYear(cur.getFullYear() + 1)
    else break
  }
  return cur <= mEnd ? fmtDateStr(cur) : null
}

function currentMonthOccurrence(r: Lembrete): Date | null {
  const now = new Date()
  const ds = findMonthOccurrence(r, now.getFullYear(), now.getMonth())
  return ds ? parseDate(ds) : null
}

// ─── Component ────────────────────────────────────────────────────────────────

const emptyForm = { titulo: '', descricao: '', periodo: 'unico' as Period, data_inicio: fmtDateStr(new Date()), visibilidade: 'todos' as Visibilidade, destinatarios: [] as string[] }

export default function LembretesClient() {
  const { profile } = useUser()

  const [lembretes, setLembretes] = useState<Lembrete[]>([])
  const [historico, setHistorico] = useState<HistoricoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pendentes')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [confirmandoIds, setConfirmandoIds] = useState<Set<string>>(new Set())
  const [histExpanded, setHistExpanded] = useState(true)
  const [calHistorico, setCalHistorico] = useState<HistoricoRow[]>([])
  const [calHistoricoLoading, setCalHistoricoLoading] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])
  const [userSearch, setUserSearch] = useState('')

  // ── Lembretes de outros (gestor/admin) ─────────────────────────────────────
  const papel = profile?.papel ?? ''
  const isGestorOrAdmin = papel === 'gestor' || papel === 'admin'

  const [outrosOpen, setOutrosOpen] = useState(false)
  const [outrosUserId, setOutrosUserId] = useState<string | null>(null)
  const [outrosData, setOutrosData] = useState<{ lembretes: (Lembrete & { confirmado: boolean })[]; historico: { lembrete_id: string; created_at: string }[] } | null>(null)
  const [outrosLoading, setOutrosLoading] = useState(false)
  const [outrosUserSearch, setOutrosUserSearch] = useState('')

  // ── Confirmados neste mês (por qualquer usuário) ───────────────────────────

  const confirmedIds = useMemo(() => {
    return new Set(historico.map(h => h.lembrete_id))
  }, [historico])

  function isDone(r: Lembrete) { return confirmedIds.has(r.id) }

  function isOverdue(r: Lembrete) {
    if (isDone(r)) return false
    const occ = currentMonthOccurrence(r)
    if (!occ) return false
    return occ < todayLocal()
  }

  function isToday(r: Lembrete) {
    if (isDone(r)) return false
    const occ = currentMonthOccurrence(r)
    if (!occ) return false
    return fmtDateStr(occ) === fmtDateStr(todayLocal())
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const mesRef = mesReferenciaAtual()
      const [lembretesRes, { data: histData }] = await Promise.all([
        fetch('/api/lembretes'),
        supabase
          .from('lembretes_historico')
          .select('id, lembrete_id, lembrete_titulo, usuario_id, usuario_nome, usuario_login, mes_referencia, created_at')
          .eq('mes_referencia', mesRef)
          .order('created_at', { ascending: false }),
      ])
      if (lembretesRes.ok) setLembretes(await lembretesRes.json())
      const hist = histData ?? []
      setHistorico(hist)
      setCalHistorico(hist)
    } catch { /* noop */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const today = new Date()
    if (calYear === today.getFullYear() && calMonth === today.getMonth()) {
      setCalHistorico(historico)
      return
    }
    setCalHistoricoLoading(true)
    const mesRef = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`
    const supabase = createClient()
    supabase
      .from('lembretes_historico')
      .select('id, lembrete_id, lembrete_titulo, usuario_id, usuario_nome, usuario_login, mes_referencia, created_at')
      .eq('mes_referencia', mesRef)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCalHistorico(data ?? [])
        setCalHistoricoLoading(false)
      })
  }, [calYear, calMonth, historico])

  // ── Mês atual ──────────────────────────────────────────────────────────────

  const now = useMemo(() => new Date(), [])

  const currentMonthLembretes = useMemo(() =>
    lembretes.filter(r => findMonthOccurrence(r, now.getFullYear(), now.getMonth()) !== null),
    [lembretes, now]
  )

  // ── Stats ──────────────────────────────────────────────────────────────────

  const total      = currentMonthLembretes.length
  const atrasados  = currentMonthLembretes.filter(r => isOverdue(r)).length
  const hoje       = currentMonthLembretes.filter(r => isToday(r)).length
  const concluidos = currentMonthLembretes.filter(r => isDone(r)).length

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = currentMonthLembretes
    .filter(r => {
      if (search) {
        const q = search.toLowerCase()
        if (!r.titulo.toLowerCase().includes(q) && !(r.descricao ?? '').toLowerCase().includes(q)) return false
      }
      if (filter === 'pendentes')  return !isDone(r)
      if (filter === 'hoje')       return isToday(r)
      if (filter === 'atrasados')  return isOverdue(r)
      if (filter === 'concluidos') return isDone(r)
      return true
    })
    .sort((a, b) => {
      const ao = isOverdue(a), bo = isOverdue(b)
      const at = isToday(a),   bt = isToday(b)
      const ad = isDone(a),    bd = isDone(b)
      if (ao && !bo) return -1; if (!ao && bo) return 1
      if (at && !bt) return -1; if (!at && bt) return 1
      if (ad && !bd) return 1;  if (!ad && bd) return -1
      const aOcc = currentMonthOccurrence(a)
      const bOcc = currentMonthOccurrence(b)
      return (aOcc?.getTime() ?? 0) - (bOcc?.getTime() ?? 0)
    })

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/lembretes/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: form.titulo, descricao: form.descricao, periodo: form.periodo, data_inicio: form.data_inicio, visibilidade: form.visibilidade, destinatarios: form.visibilidade === 'selecionados' ? form.destinatarios : null }),
        })
        if (res.ok) {
          const updated: Lembrete = await res.json()
          setLembretes(prev => prev.map(r => r.id === editingId ? updated : r))
        }
      } else {
        const res = await fetch('/api/lembretes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: form.titulo, descricao: form.descricao, periodo: form.periodo, data_inicio: form.data_inicio, visibilidade: form.visibilidade, destinatarios: form.visibilidade === 'selecionados' ? form.destinatarios : null }),
        })
        if (res.ok) {
          const created: Lembrete = await res.json()
          setLembretes(prev => [...prev, created])
        }
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Confirmar (OK) ─────────────────────────────────────────────────────────

  async function handleConfirm(r: Lembrete) {
    if (!profile) return
    if (confirmandoIds.has(r.id)) return
    setConfirmandoIds(prev => new Set([...prev, r.id]))
    try {
      const supabase = createClient()
      const mesRef = mesReferenciaAtual()
      const { error } = await supabase
        .from('lembretes_historico')
        .insert({
          lembrete_id: r.id,
          lembrete_titulo: r.titulo,
          usuario_id: profile.id,
          usuario_nome: profile.nome ?? profile.usuario ?? 'Usuário',
          usuario_login: profile.usuario ?? profile.email ?? profile.nome ?? 'Usuário',
          mes_referencia: mesRef,
        })

      if (error) return

      const novaEntrada: HistoricoRow = {
        id: crypto.randomUUID(),
        lembrete_id: r.id,
        lembrete_titulo: r.titulo,
        usuario_id: profile.id,
        usuario_nome: profile.nome ?? profile.usuario ?? 'Usuário',
        usuario_login: profile.usuario ?? profile.email ?? 'Usuário',
        mes_referencia: mesRef,
        created_at: new Date().toISOString(),
      }
      setHistorico(prev => [novaEntrada, ...prev])
      setFilter(f => f === 'todos' ? 'pendentes' : f)
      setHistExpanded(true)
    } finally {
      setConfirmandoIds(prev => { const n = new Set(prev); n.delete(r.id); return n })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lembrete?')) return
    const res = await fetch(`/api/lembretes/${id}`, { method: 'DELETE' })
    if (res.ok) setLembretes(prev => prev.filter(r => r.id !== id))
  }

  async function loadUsers() {
    if (users.length > 0) return
    try {
      const res = await fetch('/api/lembretes/usuarios')
      if (res.ok) setUsers(await res.json())
    } catch { /* noop */ }
  }

  function openNew() {
    setEditingId(null)
    setForm({ ...emptyForm, data_inicio: fmtDateStr(new Date()) })
    setUserSearch('')
    setModalOpen(true)
    void loadUsers()
  }

  function openEdit(r: Lembrete) {
    setEditingId(r.id)
    setForm({ titulo: r.titulo, descricao: r.descricao ?? '', periodo: r.periodo, data_inicio: r.data_inicio, visibilidade: r.visibilidade ?? 'todos', destinatarios: r.destinatarios ?? [] })
    setUserSearch('')
    setModalOpen(true)
    void loadUsers()
  }

  // ── Outros: carregar ao selecionar usuário ─────────────────────────────────

  async function loadOutros(userId: string) {
    setOutrosUserId(userId)
    setOutrosData(null)
    setOutrosLoading(true)
    try {
      const res = await fetch(`/api/lembretes/outros?userId=${userId}`)
      if (res.ok) setOutrosData(await res.json())
    } finally {
      setOutrosLoading(false)
    }
  }

  async function openOutros() {
    setOutrosOpen(true)
    setOutrosUserId(null)
    setOutrosData(null)
    setOutrosUserSearch('')
    if (users.length === 0) {
      try {
        const res = await fetch('/api/lembretes/usuarios')
        if (res.ok) setUsers(await res.json())
      } catch { /* noop */ }
    }
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  const calDayMap = useMemo(() => {
    const map = new Map<string, Lembrete[]>()
    for (const r of lembretes) {
      const ds = findMonthOccurrence(r, calYear, calMonth)
      if (ds) {
        const arr = map.get(ds) ?? []
        arr.push(r)
        map.set(ds, arr)
      }
    }
    return map
  }, [lembretes, calYear, calMonth])

  const calFirstDay  = new Date(calYear, calMonth, 1).getDay()
  const calTotalDays = new Date(calYear, calMonth + 1, 0).getDate()
  const todayStr     = fmtDateStr(todayLocal())

  function calDateStr(d: number): string {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // ── Colors ─────────────────────────────────────────────────────────────────

  const INK      = '#2A4F96'
  const WARN     = '#B85C1A'
  const GOLD     = '#D1AE6E'
  const OK_GREEN = '#22C55E'
  const OK_TEXT  = '#15803D'
  const BORDER   = '#E0DDD6'
  const TEXT     = '#1C1B18'
  const TEXT_MID   = '#5C5A54'
  const TEXT_FAINT = '#A8A59D'
  const SURFACE2   = '#EFEFEB'

  function cardBorderColor(r: Lembrete): string {
    if (isDone(r)) return OK_GREEN
    if (isOverdue(r)) return WARN
    if (isToday(r)) return GOLD
    return INK
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', paddingTop: 48, textAlign: 'center', color: TEXT_FAINT, fontSize: 14 }}>
        Carregando lembretes...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        paddingBottom: 20, borderBottom: `1.5px solid ${BORDER}`, marginBottom: 24,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK }}>
            GT3 Consultoria
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: -0.5, lineHeight: 1, marginTop: 4 }}>
            Lembretes
          </div>
          <div style={{ fontSize: 12, color: TEXT_FAINT, marginTop: 4 }}>
            {MONTHS[now.getMonth()]} {now.getFullYear()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isGestorOrAdmin && (
            <button
              onClick={openOutros}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#fff', color: INK, border: `1.5px solid ${INK}`, borderRadius: 6,
                padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EBF0FA' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
                <path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.87"/>
              </svg>
              Lembretes demais colaboradores
            </button>
          )}
          <button
            onClick={openNew}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: INK, color: '#fff', border: 'none', borderRadius: 6,
              padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#4A6DB5' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = INK }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Novo lembrete
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Este mês',   value: total,      highlight: false },
          { label: 'Atrasados',  value: atrasados,  highlight: atrasados > 0 },
          { label: 'Hoje',       value: hoje,        highlight: false },
          { label: 'Confirmados',value: concluidos,  highlight: false },
        ].map(s => (
          <div key={s.label} style={{
            background: s.highlight ? '#FBF0E8' : '#fff',
            border: `1px solid ${s.highlight ? WARN : BORDER}`,
            borderRadius: 10, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: s.highlight ? WARN : TEXT_FAINT }}>
              {s.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.highlight ? '#7A3A0E' : TEXT, lineHeight: 1, marginTop: 4 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['pendentes','todos','hoje','atrasados','concluidos'] as Filter[]).map(f => {
          const labels: Record<Filter, string> = { pendentes: 'Pendentes', todos: 'Todos', hoje: 'Hoje', atrasados: 'Atrasados', concluidos: 'Confirmados' }
          const active = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 14px', borderRadius: 100,
              border: `1px solid ${active ? INK : '#C8C5BC'}`,
              background: active ? INK : '#fff',
              color: active ? '#fff' : TEXT_MID,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              {labels[f]}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEXT_FAINT} strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar lembrete..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '6px 12px 6px 32px', border: `1px solid ${BORDER}`, borderRadius: 100,
              fontSize: 13, background: '#fff', color: TEXT, outline: 'none', width: 200,
            }}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = INK }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = BORDER }}
          />
        </div>
      </div>

      {/* ── List ── */}
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT_FAINT, marginBottom: 10 }}>
        {filtered.length} lembrete{filtered.length !== 1 ? 's' : ''}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: TEXT_FAINT, fontSize: 14 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C8C5BC" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 12px' }}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
            </svg>
            {filter === 'pendentes' && concluidos > 0
              ? `Todos os ${concluidos} lembrete${concluidos !== 1 ? 's' : ''} deste mês já foram confirmados. ✓`
              : lembretes.length > 0
                ? 'Nenhum lembrete programado para este mês.'
                : 'Nenhum lembrete encontrado.'}
          </div>
        ) : filtered.map(r => {
          const done     = isDone(r)
          const overdue  = isOverdue(r)
          const todayFlag = isToday(r)
          const occDate  = currentMonthOccurrence(r)
          const occStr   = occDate ? fmtDateStr(occDate) : r.data_inicio
          const confirmando = confirmandoIds.has(r.id)

          // Quem confirmou (o primeiro registro do histórico para este lembrete)
          const cnf = historico.find(h => h.lembrete_id === r.id)

          return (
            <div key={r.id} style={{
              background: done ? '#F0FDF4' : '#fff',
              border: `1px solid ${done ? '#86EFAC' : BORDER}`,
              borderLeft: `3px solid ${cardBorderColor(r)}`,
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 14,
              transition: 'background 0.2s, border-color 0.2s',
            }}>
              {/* Body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: done ? 2 : 4 }}>
                  {done && <span style={{ fontSize: 16, lineHeight: 1 }}>✅</span>}
                  <span style={{ fontSize: 15, fontWeight: 600, color: TEXT, lineHeight: 1.3 }}>
                    {r.titulo}
                  </span>
                </div>

                {done && cnf && (
                  <div style={{ fontSize: 11, color: '#4B7C5A', marginBottom: 6, lineHeight: 1.4 }}>
                    Confirmado por <strong>{cnf.usuario_login}</strong> em {formatDatetime(cnf.created_at)}
                  </div>
                )}

                {r.descricao && (
                  <div style={{ fontSize: 13, color: TEXT_MID, lineHeight: 1.5, marginBottom: 8 }}>
                    {r.descricao}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 9px', borderRadius: 100, background: '#EBF0FA', color: '#1A3266', fontSize: 11, fontWeight: 500 }}>
                    {PERIOD_LABEL[r.periodo]}
                  </span>
                  {(r.visibilidade === 'proprio') && (
                    <span style={{ padding: '2px 9px', borderRadius: 100, background: '#F5F0FF', color: '#5B21B6', fontSize: 11, fontWeight: 500 }}>
                      Só para mim
                    </span>
                  )}
                  {(r.visibilidade === 'selecionados') && (
                    <span style={{ padding: '2px 9px', borderRadius: 100, background: '#F0F9FF', color: '#0369A1', fontSize: 11, fontWeight: 500 }}>
                      Grupo selecionado
                    </span>
                  )}
                  {done ? (
                    <span style={{ padding: '2px 9px', borderRadius: 100, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 500 }}>
                      Confirmado
                    </span>
                  ) : overdue ? (
                    <span style={{ padding: '2px 9px', borderRadius: 100, background: '#FBF0E8', color: '#7A3A0E', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                      Atrasado · {fmtBR(occStr)}
                    </span>
                  ) : todayFlag ? (
                    <span style={{ padding: '2px 9px', borderRadius: 100, background: '#FAF4E8', color: '#7A5A1E', fontSize: 11, fontWeight: 500 }}>
                      Hoje
                    </span>
                  ) : (
                    <span style={{ padding: '2px 9px', borderRadius: 100, background: SURFACE2, color: TEXT_MID, fontSize: 11, fontWeight: 500 }}>
                      {fmtBR(occStr)}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                {!done ? (
                  <button
                    onClick={() => void handleConfirm(r)}
                    disabled={confirmando}
                    style={{
                      padding: '4px 14px', borderRadius: 6,
                      border: `1.5px solid ${OK_GREEN}`,
                      background: '#F0FDF4', color: OK_TEXT,
                      fontSize: 12, fontWeight: 700,
                      cursor: confirmando ? 'default' : 'pointer',
                      opacity: confirmando ? 0.6 : 1,
                      minWidth: 46,
                    }}
                  >
                    {confirmando ? '…' : 'OK'}
                  </button>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: OK_TEXT, padding: '4px 2px', whiteSpace: 'nowrap' }}>
                    Concluído ✓
                  </span>
                )}
                <IconBtn onClick={() => openEdit(r)} title="Editar" danger={false}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </IconBtn>
                <IconBtn onClick={() => void handleDelete(r.id)} title="Excluir" danger>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                  </svg>
                </IconBtn>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Histórico deste mês ── */}
      <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, marginBottom: 24 }} />

      <div style={{ marginBottom: 32 }}>
        {/* cabeçalho colapsável */}
        <button
          onClick={() => setHistExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            marginBottom: histExpanded ? 16 : 0, width: '100%',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
            Histórico — {MONTHS[calMonth]} {calYear}
          </span>
          <span style={{ fontSize: 12, color: TEXT_FAINT, marginLeft: 4 }}>
            ({calHistorico.length} confirmação{calHistorico.length !== 1 ? 'ões' : ''})
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 14, color: TEXT_FAINT }}>
            {histExpanded ? '▲' : '▼'}
          </span>
        </button>

        {histExpanded && (
          calHistoricoLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: TEXT_FAINT, fontSize: 13 }}>
              Carregando histórico...
            </div>
          ) : calHistorico.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: TEXT_FAINT, fontSize: 13 }}>
              Nenhuma confirmação registrada em {MONTHS[calMonth]} {calYear}.
            </div>
          ) : (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 160px 180px',
                background: SURFACE2, padding: '8px 16px',
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: TEXT_FAINT,
              }}>
                <span>Lembrete</span>
                <span>Usuário (login)</span>
                <span>Data / hora</span>
              </div>

              {calHistorico.map((h, i) => (
                <div key={h.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px 180px',
                  padding: '10px 16px', alignItems: 'center',
                  background: i % 2 === 0 ? '#fff' : '#FAFAF8',
                  borderTop: `1px solid ${BORDER}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>✅</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
                      {h.lembrete_titulo}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: INK, fontWeight: 600 }}>
                    {h.usuario_login}
                  </div>
                  <div style={{ fontSize: 12, color: TEXT_MID }}>
                    {formatDatetime(h.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Calendar ── */}
      <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, marginBottom: 28 }} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
            style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: TEXT_MID }}>
            ←
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, color: TEXT, minWidth: 180 }}>
            {MONTHS[calMonth]} {calYear}
          </span>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
            style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: TEXT_MID }}>
            →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: TEXT_FAINT, padding: '6px 0' }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {Array.from({ length: calFirstDay }).map((_, i) => (
            <div key={`e${i}`} style={{ minHeight: 72 }} />
          ))}
          {Array.from({ length: calTotalDays }, (_, i) => i + 1).map(d => {
            const ds   = calDateStr(d)
            const isT  = ds === todayStr
            const hits = calDayMap.get(ds) ?? []
            return (
              <div key={d} style={{
                minHeight: 72,
                background: '#fff',
                border: `${isT ? 2 : 1}px solid ${isT ? GOLD : hits.length > 0 ? '#4A6DB5' : BORDER}`,
                borderRadius: 6, padding: 6, fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: isT ? '#7A5A1E' : TEXT_FAINT, marginBottom: 3 }}>
                  {d}
                </div>
                {hits.slice(0, 5).map((r, idx) => {
                  const confirmed = confirmedIds.has(r.id)
                  const over = parseDate(ds) < todayLocal() && !confirmed
                  return (
                    <div key={idx} style={{
                      fontSize: 10, borderRadius: 3, padding: '1px 4px', marginBottom: 2,
                      background: confirmed ? '#DCFCE7' : over ? '#FBF0E8' : '#EBF0FA',
                      color: confirmed ? '#166534' : over ? '#7A3A0E' : '#1A3266',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {confirmed ? '✓ ' : ''}{r.titulo}
                    </div>
                  )
                })}
                {hits.length > 5 && (
                  <div style={{ fontSize: 10, color: TEXT_FAINT, padding: '1px 4px', opacity: 0.5 }}>
                    +{hits.length - 5}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modal lembretes de outros ── */}
      {outrosOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOutrosOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,24,0.55)', zIndex: 300, display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '2rem 1rem' }}
        >
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 60px rgba(0,0,0,0.18)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>Lembretes demais colaboradores</div>
                <div style={{ fontSize: 12, color: TEXT_FAINT, marginTop: 2 }}>
                  {papel === 'gestor' ? 'Você pode ver lembretes de colaboradores e trainees.' : 'Você pode ver lembretes de todos os usuários.'}
                </div>
              </div>
              <button onClick={() => setOutrosOpen(false)} style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${BORDER}`, background: 'none', cursor: 'pointer', fontSize: 18, color: TEXT_MID, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Body — dois painéis */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {/* Lista de usuários */}
              <div style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                  <input
                    type="text"
                    placeholder="Buscar colaborador..."
                    value={outrosUserSearch}
                    onChange={e => setOutrosUserSearch(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, color: TEXT, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#FAFAF8' }}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = INK }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = BORDER }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {users
                    .filter(u => u.id !== profile?.id)
                    .filter(u => papel === 'gestor' ? ['colaborador', 'trainee'].includes(u.papel ?? '') : true)
                    .filter(u => {
                      if (!outrosUserSearch) return true
                      const q = outrosUserSearch.toLowerCase()
                      return (u.nome ?? '').toLowerCase().includes(q) || (u.usuario ?? '').toLowerCase().includes(q)
                    })
                    .map(u => {
                      const active = outrosUserId === u.id
                      const displayN = u.nome?.trim() || u.usuario?.trim() || 'Usuário'
                      return (
                        <button
                          key={u.id}
                          onClick={() => void loadOutros(u.id)}
                          style={{
                            width: '100%', textAlign: 'left', padding: '10px 14px',
                            border: 'none', borderBottom: `1px solid ${BORDER}`,
                            background: active ? '#EBF0FA' : '#fff', cursor: 'pointer',
                            borderLeft: `3px solid ${active ? INK : 'transparent'}`,
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: active ? INK : TEXT }}>{displayN}</div>
                          {u.usuario && u.nome?.trim() && (
                            <div style={{ fontSize: 11, color: TEXT_FAINT }}>{u.usuario}</div>
                          )}
                          <div style={{ fontSize: 10, color: TEXT_FAINT, marginTop: 2, textTransform: 'capitalize' }}>{u.papel ?? ''}</div>
                        </button>
                      )
                    })}
                </div>
              </div>

              {/* Lembretes do usuário selecionado */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {!outrosUserId && (
                  <div style={{ textAlign: 'center', paddingTop: 60, color: TEXT_FAINT, fontSize: 14 }}>
                    Selecione um colaborador para ver seus lembretes deste mês.
                  </div>
                )}
                {outrosUserId && outrosLoading && (
                  <div style={{ textAlign: 'center', paddingTop: 60, color: TEXT_FAINT, fontSize: 14 }}>Carregando…</div>
                )}
                {outrosUserId && !outrosLoading && outrosData && (() => {
                  const selectedUser = users.find(u => u.id === outrosUserId)
                  const userName = selectedUser?.nome?.trim() || selectedUser?.usuario?.trim() || 'Usuário'
                  const nowD = new Date()
                  const thisMonthLembretes = outrosData.lembretes.filter(r => findMonthOccurrence(r, nowD.getFullYear(), nowD.getMonth()) !== null)
                  const confirmedSet = new Set(outrosData.historico.map(h => h.lembrete_id))

                  return (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 14 }}>
                        {userName} — {MONTHS[nowD.getMonth()]} {nowD.getFullYear()}
                        <span style={{ fontWeight: 400, color: TEXT_FAINT, marginLeft: 8 }}>
                          {thisMonthLembretes.length} lembrete{thisMonthLembretes.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {thisMonthLembretes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: TEXT_FAINT, fontSize: 13 }}>
                          Nenhum lembrete programado para este mês.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {thisMonthLembretes
                            .sort((a, b) => {
                              const ad = confirmedSet.has(a.id), bd = confirmedSet.has(b.id)
                              if (!ad && bd) return -1; if (ad && !bd) return 1
                              const ao = currentMonthOccurrence(a), bo = currentMonthOccurrence(b)
                              return (ao?.getTime() ?? 0) - (bo?.getTime() ?? 0)
                            })
                            .map(r => {
                              const done = confirmedSet.has(r.id)
                              const occ = currentMonthOccurrence(r)
                              const occStr = occ ? fmtDateStr(occ) : r.data_inicio
                              const overdue = !done && occ ? occ < todayLocal() : false
                              const todayFlag = !done && occ ? fmtDateStr(occ) === fmtDateStr(todayLocal()) : false
                              return (
                                <div key={r.id} style={{
                                  background: done ? '#F0FDF4' : '#fff',
                                  border: `1px solid ${done ? '#86EFAC' : BORDER}`,
                                  borderLeft: `3px solid ${done ? OK_GREEN : overdue ? WARN : todayFlag ? GOLD : INK}`,
                                  borderRadius: 8, padding: '12px 14px',
                                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                                }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>
                                      {done && <span style={{ marginRight: 6 }}>✅</span>}{r.titulo}
                                    </div>
                                    {r.descricao && (
                                      <div style={{ fontSize: 12, color: TEXT_MID, marginBottom: 6 }}>{r.descricao}</div>
                                    )}
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      <span style={{ padding: '2px 8px', borderRadius: 100, background: '#EBF0FA', color: '#1A3266', fontSize: 11 }}>
                                        {PERIOD_LABEL[r.periodo]}
                                      </span>
                                      {done ? (
                                        <span style={{ padding: '2px 8px', borderRadius: 100, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>
                                          Confirmado
                                        </span>
                                      ) : overdue ? (
                                        <span style={{ padding: '2px 8px', borderRadius: 100, background: '#FBF0E8', color: '#7A3A0E', fontSize: 11, fontWeight: 600 }}>
                                          Atrasado · {fmtBR(occStr)}
                                        </span>
                                      ) : todayFlag ? (
                                        <span style={{ padding: '2px 8px', borderRadius: 100, background: '#FAF4E8', color: '#7A5A1E', fontSize: 11, fontWeight: 600 }}>
                                          Hoje
                                        </span>
                                      ) : (
                                        <span style={{ padding: '2px 8px', borderRadius: 100, background: SURFACE2, color: TEXT_MID, fontSize: 11 }}>
                                          {fmtBR(occStr)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Modal edição ── */}
      {modalOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,24,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div style={{ background: '#fff', borderRadius: 14, width: 500, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: TEXT, letterSpacing: -0.3, margin: 0 }}>
                {editingId ? 'Editar lembrete' : 'Novo lembrete'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${BORDER}`, background: 'none', cursor: 'pointer', fontSize: 18, color: TEXT_MID, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ×
              </button>
            </div>

            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Título">
                <input
                  type="text" maxLength={100} autoFocus
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
                  placeholder="Ex: Verificar vencimento dos contratos"
                  style={inputStyle}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = INK; (e.target as HTMLInputElement).style.boxShadow = `0 0 0 3px #EBF0FA` }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = BORDER; (e.target as HTMLInputElement).style.boxShadow = 'none' }}
                />
              </Field>

              <Field label="Descrição / Observação">
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Detalhe o que deve ser verificado ou feito..."
                  style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.5 }}
                  onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = INK; (e.target as HTMLTextAreaElement).style.boxShadow = `0 0 0 3px #EBF0FA` }}
                  onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BORDER; (e.target as HTMLTextAreaElement).style.boxShadow = 'none' }}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Periodicidade">
                  <select
                    value={form.periodo}
                    onChange={e => setForm(f => ({ ...f, periodo: e.target.value as Period }))}
                    style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A8A59D' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, appearance: 'none' }}
                    onFocus={e => { (e.target as HTMLSelectElement).style.borderColor = INK }}
                    onBlur={e => { (e.target as HTMLSelectElement).style.borderColor = BORDER }}
                  >
                    {PERIODS.map(p => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
                  </select>
                </Field>
                <Field label="Data de início">
                  <input
                    type="date"
                    value={form.data_inicio}
                    onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                    style={inputStyle}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = INK }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = BORDER }}
                  />
                </Field>
              </div>

              {form.periodo !== 'unico' && (
                <div style={{ background: SURFACE2, borderRadius: 6, padding: 12, fontSize: 13, color: TEXT_MID }}>
                  {form.periodo === 'diario'      && 'O lembrete aparecerá todos os dias a partir da data de início.'}
                  {form.periodo === 'semanal'     && 'O lembrete será repetido semanalmente na mesma data de início.'}
                  {form.periodo === 'mensal'      && 'O lembrete será repetido mensalmente na mesma data de início.'}
                  {form.periodo === 'trimestral'  && 'O lembrete será repetido a cada 3 meses.'}
                  {form.periodo === 'semestral'   && 'O lembrete será repetido a cada 6 meses.'}
                  {form.periodo === 'anual'       && 'O lembrete será repetido anualmente na mesma data de início.'}
                </div>
              )}

              <Field label="Visibilidade">
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['todos', 'proprio', 'selecionados'] as Visibilidade[]).map(v => {
                    const labels: Record<Visibilidade, string> = { todos: 'Para todos', proprio: 'Só para mim', selecionados: 'Grupo selecionado' }
                    const active = form.visibilidade === v
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, visibilidade: v }))}
                        style={{
                          flex: 1, padding: '8px 6px', borderRadius: 6,
                          border: `1.5px solid ${active ? INK : BORDER}`,
                          background: active ? '#EBF0FA' : '#fff',
                          color: active ? INK : TEXT_MID,
                          fontSize: 12, fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {labels[v]}
                      </button>
                    )
                  })}
                </div>
                {form.visibilidade === 'proprio' && (
                  <div style={{ fontSize: 12, color: TEXT_MID, marginTop: 4 }}>
                    Somente você verá este lembrete.
                  </div>
                )}
              </Field>

              {form.visibilidade === 'selecionados' && (
                <Field label={`Selecionar logins${form.destinatarios.length > 0 ? ` (${form.destinatarios.length} + você)` : ''}`}>
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
                    <input
                      type="text"
                      placeholder="Filtrar por nome ou login..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px',
                        border: 'none', borderBottom: `1px solid ${BORDER}`,
                        fontSize: 13, background: '#FAFAF8', color: TEXT,
                        outline: 'none', boxSizing: 'border-box',
                        fontFamily: 'inherit',
                      }}
                    />
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {users
                        .filter(u => u.id !== profile?.id)
                        .filter(u => {
                          if (!userSearch) return true
                          const q = userSearch.toLowerCase()
                          return (u.nome ?? '').toLowerCase().includes(q) || (u.usuario ?? '').toLowerCase().includes(q)
                        })
                        .map(u => {
                          const checked = form.destinatarios.includes(u.id)
                          const displayN = u.nome?.trim() || u.usuario?.trim() || 'Usuário'
                          return (
                            <label key={u.id} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 12px', cursor: 'pointer',
                              background: checked ? '#EBF0FA' : '#fff',
                              borderTop: `1px solid ${BORDER}`,
                            }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setForm(f => ({
                                  ...f,
                                  destinatarios: checked
                                    ? f.destinatarios.filter(id => id !== u.id)
                                    : [...f.destinatarios, u.id],
                                }))}
                                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: INK }}
                              />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{displayN}</div>
                                {u.usuario && u.nome?.trim() && (
                                  <div style={{ fontSize: 11, color: TEXT_FAINT }}>{u.usuario}</div>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      {users.filter(u => u.id !== profile?.id).length === 0 && (
                        <div style={{ padding: '12px 16px', fontSize: 13, color: TEXT_FAINT, textAlign: 'center' }}>
                          Nenhum usuário encontrado.
                        </div>
                      )}
                    </div>
                  </div>
                </Field>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                <button onClick={() => setModalOpen(false)} style={{ padding: '9px 18px', border: `1px solid #C8C5BC`, borderRadius: 6, background: '#fff', color: TEXT_MID, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={() => void handleSave()} disabled={saving || !form.titulo.trim()} style={{ padding: '9px 22px', border: 'none', borderRadius: 6, background: saving ? '#C8C5BC' : INK, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? 'Salvando...' : 'Salvar lembrete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  border: '1px solid #E0DDD6', borderRadius: 6, padding: '10px 12px',
  fontSize: 14, background: '#fff', color: '#1C1B18',
  outline: 'none', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5C5A54' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function IconBtn({ onClick, title, danger, children }: { onClick: () => void; title: string; danger: boolean; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  const INK  = '#2A4F96'
  const WARN = '#B85C1A'
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${hov ? (danger ? WARN : INK) : '#E0DDD6'}`,
        background: hov ? (danger ? '#FBF0E8' : '#EBF0FA') : '#fff',
        color: hov ? (danger ? WARN : INK) : '#A8A59D',
      }}
    >
      {children}
    </button>
  )
}
