'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '../components/UserContext'
import { createClient } from '../lib/supabase'
import AtasEditor, { PrintView, type AtaEditorData, type Participante, type Topico } from '../atas/AtasEditor'

// ─── Types ────────────────────────────────────────────────────────────────────

type Ata = {
  id: string
  titulo: string | null
  conteudo: string
  data: string
  status: 'Rascunho' | 'Aguardando Validação' | 'Validada'
  autor_id: string
  autor: { nome: string } | null
  created_at: string
  updated_at: string
  cliente: string | null
  local_reuniao: string | null
  numero_ata: string | null
  participantes: string | null
}

type Leitura = { user_id: string; nome: string; lido_em?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const STATUS_COLORS: Record<string, string> = {
  'Rascunho': '#94A3B8',
  'Aguardando Validação': '#F59E0B',
  'Validada': '#10B981',
}
const STATUS_OPTIONS = ['Rascunho', 'Aguardando Validação', 'Validada']

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function ataLabel(a: { titulo: string | null; data: string }) {
  return a.titulo?.trim() || `Ata de ${fmtDate(a.data)}`
}

function getSnippet(text: string, query: string, maxLen = 130): string {
  if (!text) return ''
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '')
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

type YearEntry   = { year: number; months: { month: number; atas: Ata[] }[] }
type ClientEntry = { cliente: string; years: YearEntry[] }
type Tree        = ClientEntry[]

function parseParticipantes(val: string): Participante[] {
  if (!val?.trim()) return []
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p } catch {}
  return val.split(/[,;]/).map(s => ({ nome: s.trim(), empresa: '' })).filter(p => p.nome)
}

function parseTopicos(val: string): Topico[] {
  if (!val?.trim()) return []
  try { const t = JSON.parse(val); if (Array.isArray(t)) return t } catch {}
  return []
}

function getConteudoText(val: string): string {
  if (!val?.trim()) return ''
  try { const t = JSON.parse(val); if (Array.isArray(t)) return (t as Topico[]).map(x => `${x.titulo} ${x.descricao}`).join(' ') } catch {}
  return val.replace(/<[^>]+>/g, ' ')
}

function buildTree(atas: Ata[]): Tree {
  const cMap = new Map<string, Map<number, Map<number, Ata[]>>>()
  for (const a of atas) {
    const c = a.cliente?.trim() || '(Sem cliente)'
    const [y, m] = a.data.split('-').map(Number)
    if (!cMap.has(c)) cMap.set(c, new Map())
    const yMap = cMap.get(c)!
    if (!yMap.has(y)) yMap.set(y, new Map())
    const mMap = yMap.get(y)!
    if (!mMap.has(m)) mMap.set(m, [])
    mMap.get(m)!.push(a)
  }
  return [...cMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([cliente, yMap]) => ({
      cliente,
      years: [...yMap.entries()]
        .sort(([a], [b]) => b - a)
        .map(([year, mMap]) => ({
          year,
          months: [...mMap.entries()]
            .sort(([a], [b]) => b - a)
            .map(([month, atas]) => ({ month, atas })),
        })),
    }))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AtasContratantesClient() {
  const { profile } = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [atas, setAtas] = useState<Ata[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Ata | null>(null)
  const [loadingAta, setLoadingAta] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingAta, setEditingAta] = useState<Ata | null>(null)
  const [copyingAta, setCopyingAta] = useState<Ata | null>(null)
  const [openClientes, setOpenClientes] = useState<Set<string>>(new Set())
  const [openYears, setOpenYears] = useState<Set<string>>(new Set())
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [leituras, setLeituras] = useState<{ leram: Leitura[]; naoLeram: Leitura[] } | null>(null)
  const [leiturasOpen, setLeiturasOpen] = useState(false)
  const [leiturasLoading, setLeiturasLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Ata[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [allUsers, setAllUsers] = useState<{ id: string; nome: string }[]>([])

  const papel = profile?.papel ?? ''
  const isGestorOrAdmin = papel === 'gestor' || papel === 'admin'

  // ── Fetch list ──────────────────────────────────────────────────────────────

  const fetchAtas = useCallback(async () => {
    try {
      const res = await fetch('/api/atas-contratantes')
      if (!res.ok) return
      const data: Ata[] = await res.json()
      setAtas(data)
      if (data.length > 0) {
        const first = data[0]
        const c = first.cliente?.trim() || '(Sem cliente)'
        const [y, m] = first.data.split('-').map(Number)
        setOpenClientes(new Set([c]))
        setOpenYears(new Set([`${c}|${y}`]))
        setOpenMonths(new Set([`${c}|${y}-${m}`]))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAtas() }, [fetchAtas])

  useEffect(() => {
    if (!isGestorOrAdmin) return
    fetch('/api/usuarios')
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; nome: string }[]) => setAllUsers(data))
      .catch(() => {})
  }, [isGestorOrAdmin])

  // ── Deep-link via ?ata= ─────────────────────────────────────────────────────

  useEffect(() => {
    const ataId = searchParams.get('ata')
    if (ataId) selectAta(ataId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── Search ──────────────────────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setSearchResults(null); return }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/atas-contratantes?q=${encodeURIComponent(value.trim())}`)
        if (res.ok) setSearchResults(await res.json())
      } finally {
        setSearchLoading(false)
      }
    }, 320)
  }

  function clearSearch() {
    setSearchQuery('')
    setSearchResults(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  // ── Select & fetch detail ───────────────────────────────────────────────────

  async function selectAta(id: string) {
    if (selectedId === id) return
    setSelectedId(id)
    setSelected(null)
    setLeituras(null)
    setLeiturasOpen(false)
    setLoadingAta(true)
    try {
      const res = await fetch(`/api/atas-contratantes/${id}`)
      if (!res.ok) return
      const ata: Ata = await res.json()
      setSelected(ata)
      const c = ata.cliente?.trim() || '(Sem cliente)'
      const [y, m] = ata.data.split('-').map(Number)
      setOpenClientes(prev => new Set([...prev, c]))
      setOpenYears(prev => new Set([...prev, `${c}|${y}`]))
      setOpenMonths(prev => new Set([...prev, `${c}|${y}-${m}`]))
    } finally {
      setLoadingAta(false)
    }
  }

  // ── Leituras panel ──────────────────────────────────────────────────────────

  const fetchLeituras = useCallback(async (ataId: string) => {
    setLeiturasLoading(true)
    try {
      const res = await fetch(`/api/atas-contratantes/${ataId}/leituras`)
      if (!res.ok) return
      setLeituras(await res.json())
    } finally {
      setLeiturasLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selected || !isGestorOrAdmin || selected.status !== 'Validada') return
    const supabase = createClient()
    const ch = supabase
      .channel(`atas-contratantes-leituras-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'atas_contratantes_leituras' }, () => {
        fetchLeituras(selected.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selected, isGestorOrAdmin, fetchLeituras])

  function toggleLeituras() {
    if (!selected) return
    if (!leiturasOpen && !leituras) fetchLeituras(selected.id)
    setLeiturasOpen(v => !v)
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  function toPayload(form: AtaEditorData) {
    return {
      titulo: form.titulo,
      data: form.data,
      status: form.status,
      conteudo: form.conteudo,
      cliente: form.cliente,
      local_reuniao: form.localReuniao,
      numero_ata: form.numeroAta,
      participantes: form.participantes,
    }
  }

  async function sendNotifications(ataId: string, userIds: string[]) {
    if (!userIds.length) return
    await fetch(`/api/atas-contratantes/${ataId}/notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds }),
    }).catch(() => {})
  }

  async function handleCreate(form: AtaEditorData) {
    const res = await fetch('/api/atas-contratantes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(form)),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
    const nova: Ata = await res.json()
    if (form.notifyUserIds?.length) await sendNotifications(nova.id, form.notifyUserIds)
    setAtas(prev => [nova, ...prev])
    setShowEditor(false)
    selectAta(nova.id)
  }

  async function handleEdit(form: AtaEditorData) {
    if (!editingAta) return
    const res = await fetch(`/api/atas-contratantes/${editingAta.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(form)),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
    const updated: Ata = await res.json()
    if (form.notifyUserIds?.length) await sendNotifications(updated.id, form.notifyUserIds)
    setAtas(prev => prev.map(a => a.id === updated.id ? updated : a))
    setSelected(updated)
    setEditingAta(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta ata?')) return
    const res = await fetch(`/api/atas-contratantes/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setAtas(prev => prev.filter(a => a.id !== id))
    if (selectedId === id) { setSelectedId(null); setSelected(null) }
    router.replace('/atas-contratantes')
  }

  async function handleStatusChange(newStatus: string) {
    if (!selected) return
    const res = await fetch(`/api/atas-contratantes/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) return
    const updated: Ata = await res.json()
    setAtas(prev => prev.map(a => a.id === updated.id ? updated : a))
    setSelected(updated)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const tree = buildTree(atas)
  const isSearchActive = searchQuery.trim().length > 0
  const partsList = selected ? parseParticipantes(selected.participantes ?? '') : []
  const topicosList = selected ? parseTopicos(selected.conteudo ?? '') : []
  const isLegacyContent = topicosList.length === 0 && !!selected?.conteudo?.trim()

  const rowStyle = (id: string): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '6px 16px 6px 40px',
    border: 'none', background: selectedId === id ? '#EBF0FB' : 'none',
    cursor: 'pointer', fontSize: 12, color: selectedId === id ? '#2A4F96' : '#334155',
    borderLeft: selectedId === id ? '3px solid #5B8DEF' : '3px solid transparent',
  })

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: 0 }}>

      {/* ── Tree / Search Sidebar ── */}
      <div style={{
        width: 300, flexShrink: 0, background: '#fff', borderRadius: 12,
        border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', marginRight: 20,
      }}>
        {/* Header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F0F4FA', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1A2340' }}>Atas Contratantes</span>
            {isGestorOrAdmin && (
              <button
                onClick={() => setShowEditor(true)}
                style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#5B8DEF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                + Nova
              </button>
            )}
          </div>
          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Buscar nas atas…"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              style={{
                width: '100%', padding: '7px 32px 7px 10px', border: '1px solid #CBD5E0',
                borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none',
                backgroundColor: '#F8FAFC',
              }}
            />
            {isSearchActive && (
              <button
                onClick={clearSearch}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
                  color: '#94A3B8', lineHeight: 1, padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* List body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

          {/* ── Search results ── */}
          {isSearchActive && (
            <>
              {searchLoading && <p style={{ padding: '12px 16px', fontSize: 13, color: '#94A3B8' }}>Buscando…</p>}
              {!searchLoading && searchResults && searchResults.length === 0 && (
                <p style={{ padding: '12px 16px', fontSize: 13, color: '#94A3B8' }}>Nenhum resultado.</p>
              )}
              {!searchLoading && searchResults && searchResults.map(a => (
                <button
                  key={a.id}
                  onClick={() => { selectAta(a.id); router.replace(`/atas-contratantes?ata=${a.id}`) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    border: 'none', borderBottom: '1px solid #F0F4FA',
                    background: selectedId === a.id ? '#EBF0FB' : 'none',
                    cursor: 'pointer', display: 'block',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: selectedId === a.id ? '#2A4F96' : '#1A2340', marginBottom: 2 }}>
                    {ataLabel(a)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#6B7A99' }}>{fmtDate(a.data)}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLORS[a.status] }}>{a.status}</span>
                  </div>
                  {a.conteudo && (
                    <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>
                      {getSnippet(getConteudoText(a.conteudo), searchQuery)}
                    </div>
                  )}
                </button>
              ))}
            </>
          )}

          {/* ── Tree ── */}
          {!isSearchActive && (
            <>
              {loading && <p style={{ padding: 16, fontSize: 13, color: '#94A3B8' }}>Carregando…</p>}
              {!loading && atas.length === 0 && <p style={{ padding: 16, fontSize: 13, color: '#94A3B8' }}>Nenhuma ata.</p>}
              {tree.map(({ cliente, years }) => (
                <div key={cliente}>
                  {/* ── Cliente folder ── */}
                  <button
                    onClick={() => setOpenClientes(prev => { const s = new Set(prev); s.has(cliente) ? s.delete(cliente) : s.add(cliente); return s })}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 16px', border: 'none', background: openClientes.has(cliente) ? '#F0F4FA' : 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#1A2340', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #F0F4FA' }}
                  >
                    <span style={{ fontSize: 9 }}>{openClientes.has(cliente) ? '▼' : '▶'}</span>
                    <span style={{ fontSize: 14, marginRight: 4 }}>📁</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente}</span>
                    <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400, flexShrink: 0 }}>
                      {years.reduce((acc, y) => acc + y.months.reduce((a2, m) => a2 + m.atas.length, 0), 0)}
                    </span>
                  </button>
                  {openClientes.has(cliente) && years.map(({ year, months }) => (
                    <div key={year}>
                      {/* ── Ano ── */}
                      <button
                        onClick={() => setOpenYears(prev => { const k = `${cliente}|${year}`; const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s })}
                        style={{ width: '100%', textAlign: 'left', padding: '5px 16px 5px 30px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#2A4F96', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span style={{ fontSize: 9 }}>{openYears.has(`${cliente}|${year}`) ? '▼' : '▶'}</span>
                        {year}
                      </button>
                      {openYears.has(`${cliente}|${year}`) && months.map(({ month, atas: mAtas }) => (
                        <div key={month}>
                          {/* ── Mês ── */}
                          <button
                            onClick={() => setOpenMonths(prev => { const k = `${cliente}|${year}-${month}`; const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s })}
                            style={{ width: '100%', textAlign: 'left', padding: '4px 16px 4px 44px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#5B8DEF', display: 'flex', alignItems: 'center', gap: 5 }}
                          >
                            <span style={{ fontSize: 9 }}>{openMonths.has(`${cliente}|${year}-${month}`) ? '▼' : '▶'}</span>
                            {MESES[month - 1]}
                            <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400 }}>({mAtas.length})</span>
                          </button>
                          {openMonths.has(`${cliente}|${year}-${month}`) && mAtas.map(a => (
                            <button
                              key={a.id}
                              onClick={() => { selectAta(a.id); router.replace(`/atas-contratantes?ata=${a.id}`) }}
                              style={{ ...rowStyle(a.id), padding: '6px 16px 6px 56px' }}
                            >
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ataLabel(a)}</div>
                              <div style={{ fontSize: 10, color: STATUS_COLORS[a.status], marginTop: 1 }}>{a.status}</div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected && !loadingAta && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>
            Selecione uma ata na lista
          </div>
        )}
        {loadingAta && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>
            Carregando…
          </div>
        )}
        {selected && !loadingAta && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #F0F4FA', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 20, color: '#1A2340', fontWeight: 700 }}>{ataLabel(selected)}</h2>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: '#6B7A99' }}>{fmtDate(selected.data)}</span>
                    {selected.numero_ata && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: '#D1AE6E', color: '#fff' }}>{selected.numero_ata}</span>}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, backgroundColor: `${STATUS_COLORS[selected.status]}22`, color: STATUS_COLORS[selected.status] }}>
                      {selected.status}
                    </span>
                    {selected.autor && <span style={{ fontSize: 12, color: '#94A3B8' }}>por {selected.autor.nome}</span>}
                  </div>
                  {(selected.cliente || selected.local_reuniao || partsList.length > 0) && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                      {selected.cliente && <span style={{ fontSize: 12, color: '#334155' }}><span style={{ color: '#94A3B8' }}>Contratante:</span> {selected.cliente}</span>}
                      {selected.local_reuniao && <span style={{ fontSize: 12, color: '#334155' }}><span style={{ color: '#94A3B8' }}>Local:</span> {selected.local_reuniao}</span>}
                      {partsList.length > 0 && (
                        <span style={{ fontSize: 12, color: '#334155' }}>
                          <span style={{ color: '#94A3B8' }}>Participantes:</span>{' '}
                          {partsList.map(p => p.empresa ? `${p.nome} (${p.empresa})` : p.nome).join(' · ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => window.print()} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #CBD5E0', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }}>
                    🖨 PDF
                  </button>
                  {isGestorOrAdmin && (
                    <>
                      <select
                        value={selected.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 12, cursor: 'pointer', color: '#334155' }}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => setCopyingAta(selected)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #10B981', background: '#fff', color: '#10B981', fontSize: 13, cursor: 'pointer' }} title="Criar nova ata usando esta como base">
                        ⊕ Nova a partir desta
                      </button>
                      <button onClick={() => { setEditingAta(selected) }} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #5B8DEF', background: '#fff', color: '#5B8DEF', fontSize: 13, cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button onClick={() => handleDelete(selected.id)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #EF4444', background: '#fff', color: '#EF4444', fontSize: 13, cursor: 'pointer' }}>
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', background: '#F0F3F9' }}>
              <div style={{ maxWidth: 880, margin: '0 auto', background: '#fff', borderRadius: 14, border: '1px solid rgba(42,79,150,0.10)', boxShadow: '0 4px 20px rgba(42,79,150,0.08)', overflow: 'hidden' }}>
                <div style={{ height: 4, background: 'linear-gradient(90deg, #2A4F96, #5B8DEF)' }} />
                <div style={{ padding: '32px 40px' }}>

                  {/* Participantes */}
                  {partsList.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(42,79,150,0.10)' }}>
                        Participantes
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                        {partsList.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid rgba(42,79,150,0.10)' }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#EEF2FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#2A4F96', flexShrink: 0 }}>
                              {p.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e' }}>{p.nome}</div>
                              {p.empresa && <div style={{ fontSize: 11, color: '#6B7A99' }}>{p.empresa}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tópicos */}
                  {topicosList.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(42,79,150,0.10)' }}>
                        Pontos discutidos
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                        {topicosList.map((t, idx) => (
                          <div key={t.id || idx} style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid rgba(42,79,150,0.10)', borderLeft: `3px solid ${t.cor ?? '#2A4F96'}` }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: t.cor ?? '#2A4F96', marginBottom: t.descricao ? 6 : 0 }}>
                              {idx + 1}. {t.titulo || '(Sem título)'}
                            </div>
                            {t.descricao && (
                              <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.65, marginBottom: (t.contratante || t.prazo || t.responsavel) ? 10 : 0, whiteSpace: 'pre-wrap' }}>
                                {t.descricao}
                              </div>
                            )}
                            {(t.contratante || t.prazo || t.responsavel) && (
                              <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#6B7A99', paddingTop: 8, borderTop: '1px solid rgba(42,79,150,0.08)', flexWrap: 'wrap' as const }}>
                                {t.contratante && <span><span style={{ color: '#94A3B8' }}>Contratante:</span> {t.contratante}</span>}
                                {t.prazo && <span><span style={{ color: '#94A3B8' }}>Prazo:</span> {new Date(t.prazo + 'T12:00').toLocaleDateString('pt-BR')}</span>}
                                {t.responsavel && <span><span style={{ color: '#94A3B8' }}>Responsável:</span> {t.responsavel}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : isLegacyContent ? (
                    <div dangerouslySetInnerHTML={{ __html: selected.conteudo }} style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.65 }} />
                  ) : (
                    <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>Sem conteúdo registrado.</p>
                  )}

                </div>
              </div>
            </div>

            {isGestorOrAdmin && selected.status === 'Validada' && (
              <div style={{ borderTop: '1px solid #F0F4FA', flexShrink: 0 }}>
                <button
                  onClick={toggleLeituras}
                  style={{ width: '100%', padding: '12px 28px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#5B8DEF', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span>{leiturasOpen ? '▼' : '▶'}</span>
                  👁 Leituras
                  {leituras && (
                    <span style={{ fontWeight: 400, color: '#6B7A99' }}>
                      — {leituras.leram.length} leram · {leituras.naoLeram.length} pendentes
                    </span>
                  )}
                  {leiturasLoading && <span style={{ color: '#94A3B8', fontWeight: 400 }}> carregando…</span>}
                </button>

                {leiturasOpen && leituras && (
                  <div style={{ padding: '0 28px 20px', display: 'flex', gap: 32 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 8, marginTop: 0 }}>Leram ({leituras.leram.length})</p>
                      {leituras.leram.length === 0
                        ? <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Ninguém ainda.</p>
                        : leituras.leram.map(l => (
                          <div key={l.user_id} style={{ fontSize: 13, color: '#334155', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{l.nome}</span>
                            {l.lido_em && <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(l.lido_em).toLocaleString('pt-BR')}</span>}
                          </div>
                        ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', marginBottom: 8, marginTop: 0 }}>Ainda não leram ({leituras.naoLeram.length})</p>
                      {leituras.naoLeram.length === 0
                        ? <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Todos leram!</p>
                        : leituras.naoLeram.map(l => (
                          <div key={l.user_id} style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>{l.nome}</div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showEditor && (
        <AtasEditor
          onSave={handleCreate}
          onClose={() => setShowEditor(false)}
          enableNotifModal
          availableUsers={allUsers}
        />
      )}
      {editingAta && (
        <AtasEditor
          initial={{
            titulo: editingAta.titulo ?? '',
            data: editingAta.data,
            status: editingAta.status,
            conteudo: editingAta.conteudo,
            cliente: editingAta.cliente ?? '',
            localReuniao: editingAta.local_reuniao ?? '',
            numeroAta: editingAta.numero_ata ?? '',
            participantes: editingAta.participantes ?? '',
          }}
          onSave={handleEdit}
          onClose={() => setEditingAta(null)}
          enableNotifModal
          availableUsers={allUsers}
        />
      )}
      {copyingAta && (
        <AtasEditor
          initial={{
            titulo: copyingAta.titulo ? `${copyingAta.titulo} (cópia)` : '',
            data: new Date().toISOString().slice(0, 10),
            status: 'Rascunho',
            conteudo: copyingAta.conteudo,
            cliente: copyingAta.cliente ?? '',
            localReuniao: copyingAta.local_reuniao ?? '',
            numeroAta: '',
            participantes: copyingAta.participantes ?? '',
          }}
          onSave={async (form) => { await handleCreate(form); setCopyingAta(null) }}
          onClose={() => setCopyingAta(null)}
        />
      )}

      {/* ── Print styles + hidden area for detail view PDF ── */}
      <style>{`
        @media screen { #gt3-detail-print { display: none !important; } }
        @media print {
          body * { visibility: hidden !important; }
          #gt3-detail-print { visibility: visible !important; display: block !important; position: absolute; top: 0; left: 0; width: 100%; }
          #gt3-detail-print * { visibility: visible !important; }
        }
      `}</style>
      {selected && (
        <div id="gt3-detail-print">
          <PrintView
            titulo={selected.titulo ?? ''}
            dataVal={selected.data}
            cliente={selected.cliente ?? ''}
            local={selected.local_reuniao ?? ''}
            numAta={selected.numero_ata ?? ''}
            status={selected.status}
            participantes={partsList}
            topicos={topicosList}
          />
        </div>
      )}
    </div>
  )
}
