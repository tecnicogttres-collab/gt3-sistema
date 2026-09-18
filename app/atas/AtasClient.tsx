'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '../components/UserContext'
import { createClient } from '../lib/supabase'
import { markAtaNotifVista } from '../components/AppShell'
import AtaTextoEditor, { type AtaEditorData } from './AtaTextoEditor'

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

// Atas antigas guardam HTML estruturado; as novas são texto livre.
function isHtml(s: string): boolean {
  return /<(div|p|table|br|span|h[1-6]|ul|ol|li)[\s>]/i.test(s)
}

function getSnippet(text: string, query: string, maxLen = 130): string {
  if (!text) return ''
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '')
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

type YearEntry = { year: number; months: { month: number; atas: Ata[] }[] }
type Tree      = YearEntry[]

function buildTree(atas: Ata[]): Tree {
  const yMap = new Map<number, Map<number, Ata[]>>()
  for (const a of atas) {
    const [y, m] = a.data.split('-').map(Number)
    if (!yMap.has(y)) yMap.set(y, new Map())
    const mMap = yMap.get(y)!
    if (!mMap.has(m)) mMap.set(m, [])
    mMap.get(m)!.push(a)
  }
  return [...yMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, mMap]) => ({
      year,
      months: [...mMap.entries()]
        .sort(([a], [b]) => b - a)
        .map(([month, atas]) => ({ month, atas })),
    }))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AtasClient() {
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
  const [openYears, setOpenYears] = useState<Set<string>>(new Set())
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [leituras, setLeituras] = useState<{ leram: Leitura[]; naoLeram: Leitura[] } | null>(null)
  const [leiturasOpen, setLeiturasOpen] = useState(false)
  const [leiturasLoading, setLeiturasLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Ata[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const readingRegistered = useRef<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ataCache = useRef<Map<string, Ata>>(new Map())

  const papel = profile?.papel ?? ''
  const isGestorOrAdmin = papel === 'gestor' || papel === 'admin'
  const isColabOrTrainee = papel === 'colaborador' || papel === 'trainee'

  // ── Fetch list ──────────────────────────────────────────────────────────────

  const fetchAtas = useCallback(async () => {
    try {
      const res = await fetch('/api/atas')
      if (!res.ok) return
      const data: Ata[] = await res.json()
      setAtas(data)
      if (data.length > 0) {
        const [y, m] = data[0].data.split('-').map(Number)
        setOpenYears(new Set([`${y}`]))
        setOpenMonths(new Set([`${y}-${m}`]))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAtas() }, [fetchAtas])

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
        const res = await fetch(`/api/atas?q=${encodeURIComponent(value.trim())}`)
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
    setLeituras(null)
    setLeiturasOpen(false)

    // serve from cache instantly
    if (ataCache.current.has(id)) {
      setSelected(ataCache.current.get(id)!)
      setLoadingAta(false)
      return
    }

    // show partial data from list while loading full conteudo
    const partial = atas.find(a => a.id === id)
    if (partial) { setSelected(partial); setLoadingAta(false) }
    else { setSelected(null); setLoadingAta(true) }

    try {
      const res = await fetch(`/api/atas/${id}`)
      if (!res.ok) return
      const ata: Ata = await res.json()
      ataCache.current.set(id, ata)
      setSelected(ata)
      setLoadingAta(false)
      const [y, m] = ata.data.split('-').map(Number)
      setOpenYears(prev => new Set([...prev, `${y}`]))
      setOpenMonths(prev => new Set([...prev, `${y}-${m}`]))
      if (isColabOrTrainee && ata.status === 'Validada' && !readingRegistered.current.has(id)) {
        readingRegistered.current.add(id)
        fetch(`/api/atas/${id}/leitura`, { method: 'POST' }).catch(() => {})
        if (profile?.id) void markAtaNotifVista(id, profile.id)
      }
    } finally {
      setLoadingAta(false)
    }
  }

  // ── Leituras panel ──────────────────────────────────────────────────────────

  const fetchLeituras = useCallback(async (ataId: string) => {
    setLeiturasLoading(true)
    try {
      const res = await fetch(`/api/atas/${ataId}/leituras`)
      if (!res.ok) return
      setLeituras(await res.json())
    } finally {
      setLeiturasLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selected || !isGestorOrAdmin || selected.status !== 'Validada') return
    const supabase = createClient()
    const topic = `atas-leituras-${selected.id}`
    // supabase.removeChannel() é assíncrono; em dev o React pode remontar o efeito
    // antes da remoção anterior terminar, deixando um canal com o mesmo tópico já
    // inscrito. Remover qualquer canal remanescente antes de recriar evita o erro
    // "cannot add postgres_changes callbacks ... after subscribe()".
    const stale = supabase.getChannels().find(c => c.topic === `realtime:${topic}`)
    if (stale) supabase.removeChannel(stale)
    const ch = supabase
      .channel(topic)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'atas_leituras' }, () => {
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
    }
  }

  async function handleCreate(form: AtaEditorData) {
    const res = await fetch('/api/atas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(form)),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
    const nova: Ata = await res.json()
    setAtas(prev => [nova, ...prev])
    setShowEditor(false)
    selectAta(nova.id)
  }

  async function handleEdit(form: AtaEditorData) {
    if (!editingAta) return
    const res = await fetch(`/api/atas/${editingAta.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(form)),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
    const updated: Ata = await res.json()
    ataCache.current.set(updated.id, updated)
    setAtas(prev => prev.map(a => a.id === updated.id ? updated : a))
    setSelected(updated)
    setEditingAta(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta ata?')) return
    const res = await fetch(`/api/atas/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    ataCache.current.delete(id)
    setAtas(prev => prev.filter(a => a.id !== id))
    if (selectedId === id) { setSelectedId(null); setSelected(null) }
    router.replace('/atas')
  }

  async function handleStatusChange(newStatus: string) {
    if (!selected) return
    // Mark as seen before PATCH so Realtime doesn't trigger own popup
    if (newStatus === 'Validada' && profile?.id) {
      void markAtaNotifVista(selected.id, profile.id)
    }
    const res = await fetch(`/api/atas/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) return
    const updated: Ata = await res.json()
    ataCache.current.set(updated.id, updated)
    setAtas(prev => prev.map(a => a.id === updated.id ? updated : a))
    setSelected(updated)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const tree = buildTree(atas)
  const isSearchActive = searchQuery.trim().length > 0

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
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1A2340' }}>Atas GT3</span>
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
                  onClick={() => { selectAta(a.id); router.replace(`/atas?ata=${a.id}`) }}
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
                      {getSnippet(a.conteudo, searchQuery)}
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
              {tree.map(({ year, months }) => (
                <div key={year}>
                  {/* ── Ano ── */}
                  <button
                    onClick={() => setOpenYears(prev => { const k = `${year}`; const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s })}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 16px', border: 'none', background: openYears.has(`${year}`) ? '#F0F4FA' : 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#1A2340', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #F0F4FA' }}
                  >
                    <span style={{ fontSize: 9 }}>{openYears.has(`${year}`) ? '▼' : '▶'}</span>
                    <span style={{ fontSize: 14, marginRight: 4 }}>📁</span>
                    <span style={{ flex: 1 }}>{year}</span>
                    <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400, flexShrink: 0 }}>
                      {months.reduce((acc, m) => acc + m.atas.length, 0)}
                    </span>
                  </button>
                  {openYears.has(`${year}`) && months.map(({ month, atas: mAtas }) => (
                    <div key={month}>
                      {/* ── Mês ── */}
                      <button
                        onClick={() => setOpenMonths(prev => { const k = `${year}-${month}`; const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s })}
                        style={{ width: '100%', textAlign: 'left', padding: '5px 16px 5px 30px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#5B8DEF', display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <span style={{ fontSize: 9 }}>{openMonths.has(`${year}-${month}`) ? '▼' : '▶'}</span>
                        {MESES[month - 1]}
                        <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400 }}>({mAtas.length})</span>
                      </button>
                      {openMonths.has(`${year}-${month}`) && mAtas.map(a => (
                        <button
                          key={a.id}
                          onClick={() => { selectAta(a.id); router.replace(`/atas?ata=${a.id}`) }}
                          style={{ ...rowStyle(a.id), padding: '6px 16px 6px 44px' }}
                        >
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ataLabel(a)}</div>
                          <div style={{ fontSize: 10, color: STATUS_COLORS[a.status], marginTop: 1 }}>{a.status}</div>
                        </button>
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
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, backgroundColor: `${STATUS_COLORS[selected.status]}22`, color: STATUS_COLORS[selected.status] }}>
                      {selected.status}
                    </span>
                    {selected.autor && <span style={{ fontSize: 12, color: '#94A3B8' }}>por {selected.autor.nome}</span>}
                  </div>
                </div>
                {isGestorOrAdmin && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', background: '#F0F3F9' }}>
              {selected.conteudo ? (
                <div style={{ maxWidth: 880, margin: '0 auto', background: '#fff', borderRadius: 14, border: '1px solid rgba(42,79,150,0.10)', boxShadow: '0 4px 20px rgba(42,79,150,0.08)', padding: '36px 44px', borderTop: '3px solid #2A4F96' }}>
                  {isHtml(selected.conteudo) ? (
                    <div
                      className="ata-view-content"
                      dangerouslySetInnerHTML={{ __html: selected.conteudo }}
                    />
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#1a1f2e', lineHeight: 1.75, wordBreak: 'break-word' }}>
                      {selected.conteudo}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: '#94A3B8', fontSize: 14, padding: 24 }}>Sem conteúdo registrado.</p>
              )}
            </div>
            <style>{`
              .ata-view-content { font-size:13.5px; color:#334155; line-height:1.65; }
              .ata-view-content .ata-section { margin-bottom: 22px; }
              .ata-view-content .ata-bh2 { font-size:11px; font-weight:700; color:#2A4F96; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid rgba(42,79,150,.12); }
              .ata-view-content .ata-section-body { font-size:13.5px; line-height:1.75; color:#1a1f2e; white-space:pre-wrap; }
              .ata-view-content .ata-btable-wrap { overflow-x:auto; margin:0; }
              .ata-view-content .ata-btable { width:100%; border-collapse:collapse; font-size:13px; }
              .ata-view-content .ata-btable th, .ata-view-content .ata-btable td { border:1px solid rgba(42,79,150,.14); padding:9px 11px; text-align:left; vertical-align:top; }
              .ata-view-content .ata-btable th { background:#2A4F96; color:#fff; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; }
              .ata-view-content .ata-btable tr:nth-child(even) td { background:#f8f9fb; }
              .ata-view-content .ata-btable-part th { background:#4a5568; }
              .ata-view-content .ata-assuntos .col-num { width:36px; text-align:center; font-weight:700; color:#2A4F96; }
              .ata-view-content .ata-assuntos .col-desc { }
              .ata-view-content .ata-assuntos .col-right { width:130px; white-space:normal; }
              .ata-view-content .ata-assuntos .col-status { font-weight:600; }
            `}</style>

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
        <AtaTextoEditor
          onSave={handleCreate}
          onClose={() => setShowEditor(false)}
        />
      )}
      {editingAta && (
        <AtaTextoEditor
          initial={{
            titulo: editingAta.titulo ?? '',
            data: editingAta.data,
            status: editingAta.status,
            conteudo: editingAta.conteudo,
          }}
          onSave={handleEdit}
          onClose={() => setEditingAta(null)}
        />
      )}
      {copyingAta && (
        <AtaTextoEditor
          initial={{
            titulo: copyingAta.titulo ? `${copyingAta.titulo} (cópia)` : '',
            data: new Date().toISOString().slice(0, 10),
            status: 'Rascunho',
            conteudo: copyingAta.conteudo,
          }}
          onSave={async (form) => { await handleCreate(form); setCopyingAta(null) }}
          onClose={() => setCopyingAta(null)}
        />
      )}
    </div>
  )
}
