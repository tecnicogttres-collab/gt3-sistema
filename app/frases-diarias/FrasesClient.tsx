'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '../lib/supabase'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const ACCENT = '#D1AE6E'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const SUCCESS = '#16A34A'
const SUCCESS_LIGHT = '#F0FFF4'
const DANGER = '#DC2626'

type Quote = { id: string; text: string; author: string; active: boolean; createdAt: string }
type PlaylistItem = { data: string; fraseId: string }
type FilterStatus = 'all' | 'active' | 'inactive'
type ModalState = { open: boolean; editId: string | null; text: string; author: string }

function todayStr() { return new Date().toISOString().slice(0, 10) }
function isWeekday(d = new Date()) { const day = d.getDay(); return day >= 1 && day <= 5 }
function formatDateLong(d = new Date()) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function rowToQuote(row: { id: string; texto: string; autor: string; ativo: boolean; created_at: string }): Quote {
  return { id: row.id, text: row.texto, author: row.autor, active: row.ativo, createdAt: row.created_at }
}

// Próximo dia útil após fromDate (exclusive)
function nextWeekday(fromDate: string): string {
  const [y, m, d] = fromDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 1)
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDatePlaylist(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

export default function FrasesClient() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quoteOfDay, setQuoteOfDay] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [modal, setModal] = useState<ModalState>({ open: false, editId: null, text: '', author: '' })
  const [toast, setToast] = useState({ msg: '', show: false })
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Playlist state
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([])
  const [activeTab, setActiveTab] = useState<'frases' | 'playlist'>('frases')
  const [addingToPlaylist, setAddingToPlaylist] = useState(false)
  const [playlistSelectId, setPlaylistSelectId] = useState('')
  const [settingTodayId, setSettingTodayId] = useState<string | null>(null)

  async function loadTodayQuote(allQuotes: Quote[]) {
    if (!isWeekday()) return
    try {
      const supabase = createClient()
      const today = todayStr()
      const { data: entry } = await supabase
        .from('frases_rotacao').select('frase_id').eq('data', today).maybeSingle()

      if (entry?.frase_id) {
        const found = allQuotes.find(q => q.id === entry.frase_id && q.active)
        if (found) { setQuoteOfDay(found); return }
      }

      const active = allQuotes.filter(q => q.active)
      if (!active.length) return

      const { data: recent } = await supabase
        .from('frases_rotacao').select('frase_id').order('data', { ascending: false }).limit(active.length)
      const usedIds = new Set((recent ?? []).map(r => r.frase_id))
      const pool = active.filter(f => !usedIds.has(f.id))
      const candidates = pool.length > 0 ? pool : shuffle(active)
      const picked = candidates[Math.floor(Math.random() * candidates.length)]

      await supabase.from('frases_rotacao').upsert(
        { data: today, frase_id: picked.id },
        { onConflict: 'data', ignoreDuplicates: true }
      )
      const { data: winner } = await supabase
        .from('frases_rotacao').select('frase_id').eq('data', today).maybeSingle()
      setQuoteOfDay(winner?.frase_id
        ? (allQuotes.find(q => q.id === winner.frase_id) ?? picked)
        : picked)
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient()
        const [{ data: frases }, { data: rotacaoFutura }] = await Promise.all([
          supabase.from('frases').select('id, texto, autor, ativo, created_at').order('created_at', { ascending: true }),
          supabase.from('frases_rotacao').select('data, frase_id').gt('data', todayStr()).order('data', { ascending: true }),
        ])
        const allQuotes = (frases ?? []).map(rowToQuote)
        setQuotes(allQuotes)
        setPlaylist((rotacaoFutura ?? []).map(r => ({ data: r.data, fraseId: r.frase_id })))
        await loadTodayQuote(allQuotes)
      } finally {
        setLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(msg: string) {
    if (toastRef.current) clearTimeout(toastRef.current)
    setToast({ msg, show: true })
    toastRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2400)
  }

  // ── Frase do dia manual ───────────────────────────────────────
  async function handleSetTodayFrase(q: Quote) {
    if (!q.active) return
    setSettingTodayId(q.id)
    const supabase = createClient()
    const { error } = await supabase.from('frases_rotacao')
      .upsert({ data: todayStr(), frase_id: q.id }, { onConflict: 'data' })
    if (!error) {
      setQuoteOfDay(q)
      showToast('⭐ Frase definida para hoje.')
    } else {
      showToast('Erro ao definir frase do dia.')
    }
    setSettingTodayId(null)
  }

  // ── Shuffle ───────────────────────────────────────────────────
  async function handleShuffle() {
    const supabase = createClient()
    const today = todayStr()
    const active = quotes.filter(q => q.active)
    if (!active.length) return
    const { data: recent } = await supabase
      .from('frases_rotacao').select('frase_id').order('data', { ascending: false }).limit(active.length + 1)
    const usedIds = new Set((recent ?? []).map(r => r.frase_id))
    const pool = active.filter(f => !usedIds.has(f.id) && f.id !== quoteOfDay?.id)
    const candidates = pool.length > 0 ? pool : active.filter(f => f.id !== quoteOfDay?.id)
    const picked = (candidates.length > 0 ? candidates : active)[Math.floor(Math.random() * (candidates.length || active.length))]
    await supabase.from('frases_rotacao').upsert({ data: today, frase_id: picked.id }, { onConflict: 'data' })
    setQuoteOfDay(picked)
    showToast('Nova frase sorteada.')
  }

  // ── Playlist — adicionar ──────────────────────────────────────
  async function handleAddToPlaylist() {
    if (!playlistSelectId) return
    setAddingToPlaylist(true)
    const lastDate = playlist.length > 0 ? playlist[playlist.length - 1].data : todayStr()
    const nextDate = nextWeekday(lastDate)
    const supabase = createClient()
    const { error } = await supabase.from('frases_rotacao')
      .upsert({ data: nextDate, frase_id: playlistSelectId }, { onConflict: 'data' })
    if (!error) {
      setPlaylist(prev => [...prev, { data: nextDate, fraseId: playlistSelectId }])
      setPlaylistSelectId('')
      showToast(`Programada para ${formatDatePlaylist(nextDate)}.`)
    } else {
      showToast('Erro ao adicionar à playlist.')
    }
    setAddingToPlaylist(false)
  }

  // ── Playlist — remover ────────────────────────────────────────
  async function handleRemoveFromPlaylist(data: string) {
    const supabase = createClient()
    const { error } = await supabase.from('frases_rotacao').delete().eq('data', data)
    if (!error) {
      setPlaylist(prev => prev.filter(p => p.data !== data))
      showToast('Removido da playlist.')
    }
  }

  // ── Playlist — reordenar (troca frase_ids, datas ficam fixas) ─
  async function handleMovePlaylistItem(idx: number, dir: 'up' | 'down') {
    const other = dir === 'up' ? idx - 1 : idx + 1
    if (other < 0 || other >= playlist.length) return
    const a = playlist[idx], b = playlist[other]
    const supabase = createClient()
    const [r1, r2] = await Promise.all([
      supabase.from('frases_rotacao').upsert({ data: a.data, frase_id: b.fraseId }, { onConflict: 'data' }),
      supabase.from('frases_rotacao').upsert({ data: b.data, frase_id: a.fraseId }, { onConflict: 'data' }),
    ])
    if (r1.error || r2.error) { showToast('Erro ao reordenar.'); return }
    const np = [...playlist]
    np[idx] = { ...a, fraseId: b.fraseId }
    np[other] = { ...b, fraseId: a.fraseId }
    setPlaylist(np)
  }

  // ── Modal ─────────────────────────────────────────────────────
  function openModal(q?: Quote) {
    setModal({ open: true, editId: q?.id ?? null, text: q?.text ?? '', author: q?.author ?? '' })
  }
  function closeModal() { setModal(m => ({ ...m, open: false })) }

  async function saveModal() {
    const text = modal.text.trim(), author = modal.author.trim()
    if (!text) { showToast('A frase não pode ficar vazia.'); return }
    const supabase = createClient()
    if (modal.editId) {
      const { error } = await supabase.from('frases').update({ texto: text, autor: author }).eq('id', modal.editId)
      if (error) { showToast('Erro ao salvar.'); return }
      setQuotes(qs => qs.map(q => q.id === modal.editId ? { ...q, text, author } : q))
      if (quoteOfDay?.id === modal.editId) setQuoteOfDay(q => q ? { ...q, text, author } : q)
      showToast('Frase atualizada.')
    } else {
      const { data, error } = await supabase.from('frases')
        .insert({ texto: text, autor: author }).select('id, texto, autor, ativo, created_at').single()
      if (error) { showToast('Erro ao adicionar.'); return }
      setQuotes(qs => [...qs, rowToQuote(data)])
      showToast('Frase adicionada.')
    }
    closeModal()
  }

  async function toggleActive(id: string) {
    const q = quotes.find(x => x.id === id)
    if (!q) return
    const supabase = createClient()
    const { error } = await supabase.from('frases').update({ ativo: !q.active }).eq('id', id)
    if (error) { showToast('Erro ao atualizar.'); return }
    setQuotes(qs => qs.map(x => x.id === id ? { ...x, active: !x.active } : x))
    showToast(q.active ? 'Frase inativada.' : 'Frase ativada.')
  }

  async function removeQuote(id: string) {
    const q = quotes.find(x => x.id === id)
    if (!confirm(`Excluir esta frase?\n\n"${(q?.text ?? '').slice(0, 80)}${(q?.text ?? '').length > 80 ? '…' : ''}"`)) return
    const supabase = createClient()
    const { error } = await supabase.from('frases').delete().eq('id', id)
    if (error) { showToast('Erro ao excluir.'); return }
    setQuotes(qs => qs.filter(x => x.id !== id))
    setPlaylist(pl => pl.filter(p => p.fraseId !== id))
    if (quoteOfDay?.id === id) setQuoteOfDay(null)
    showToast('Frase excluída.')
  }

  function handleExport() {
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), quotes }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `frases-gt3-${todayStr()}.json`
    a.click(); URL.revokeObjectURL(url)
    showToast('Arquivo exportado.')
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(parsed.quotes)) throw new Error('Formato inválido')
        const existingTexts = new Set(quotes.map(q => q.text))
        const toInsert = (parsed.quotes as Partial<Quote>[])
          .filter(q => q.text && !existingTexts.has(String(q.text).trim()))
          .map(q => ({ texto: String(q.text).trim(), autor: String(q.author || '').trim() }))
        if (!toInsert.length) { showToast('Nenhuma frase nova para importar.'); return }
        const supabase = createClient()
        const { data: inserted, error } = await supabase.from('frases')
          .insert(toInsert).select('id, texto, autor, ativo, created_at')
        if (error) { showToast('Erro ao importar.'); return }
        setQuotes(qs => [...qs, ...(inserted ?? []).map(rowToQuote)])
        showToast(`${inserted?.length ?? 0} frase(s) importada(s).`)
      } catch (err) {
        showToast('Erro ao importar: ' + (err as Error).message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const authors = useMemo(() => {
    const s = new Set(quotes.map(q => q.author).filter(Boolean))
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [quotes])

  const filtered = useMemo(() => {
    let list = [...quotes]
    if (filterAuthor) list = list.filter(q => q.author === filterAuthor)
    if (filterStatus === 'active') list = list.filter(q => q.active)
    if (filterStatus === 'inactive') list = list.filter(q => !q.active)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(q => q.text.toLowerCase().includes(s) || q.author.toLowerCase().includes(s))
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [quotes, filterAuthor, filterStatus, search])

  const stats = useMemo(() => ({
    total: quotes.length,
    active: quotes.filter(q => q.active).length,
    inactive: quotes.filter(q => !q.active).length,
    authors: authors.length,
  }), [quotes, authors])

  const activeQuotes = useMemo(() => quotes.filter(q => q.active), [quotes])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${BORDER}`,
    outline: 'none', fontSize: 13, fontFamily: 'inherit', color: INK, background: '#fff',
    boxSizing: 'border-box',
  }

  const btnSm: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`,
    background: '#fff', color: MUTED, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, padding: 0, flexShrink: 0,
  }

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: MUTED, fontSize: 14 }}>Carregando frases…</div>
  }

  return (
    <>
      {/* Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,20,37,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{modal.editId ? 'Editar frase' : 'Adicionar frase'}</span>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Frase
                <textarea autoFocus style={{ ...inputStyle, marginTop: 6, minHeight: 90, resize: 'vertical', lineHeight: 1.5 }}
                  value={modal.text} onChange={e => setModal(m => ({ ...m, text: e.target.value }))}
                  placeholder="Digite a frase…" />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Autor
                <input style={{ ...inputStyle, marginTop: 6 }} value={modal.author}
                  onChange={e => setModal(m => ({ ...m, author: e.target.value }))}
                  placeholder="Ex.: Peter Drucker" list="authors-datalist"
                  onKeyDown={e => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && void saveModal()} />
                <datalist id="authors-datalist">{authors.map(a => <option key={a} value={a} />)}</datalist>
                <span style={{ fontSize: 11, color: MUTED, marginTop: 4, display: 'block' }}>Deixe em branco se desconhecido. Ctrl+Enter para salvar.</span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 22px', borderTop: `1px solid ${BORDER}`, background: '#FAFBFD', borderRadius: '0 0 12px 12px' }}>
              <button onClick={closeModal} style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => void saveModal()} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) translateY(${toast.show ? 0 : 20}px)`,
        background: INK, color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14,
        opacity: toast.show ? 1 : 0, transition: 'all 0.2s', pointerEvents: 'none', zIndex: 2000,
      }}>{toast.msg}</div>

      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImport} />

      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid ${BORDER}`, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: 0 }}>Frases diárias</h1>
            <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Módulo de gestão — GT3 Consultoria</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleExport} style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              ↓ Exportar
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              ↑ Importar
            </button>
          </div>
        </div>

        {/* Quote of day */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>Frase do dia</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>{formatDateLong()}</span>
          </div>
          {!isWeekday() ? (
            <p style={{ fontSize: 16, color: '#94A3B8', fontStyle: 'italic', margin: '0 0 18px' }}>🌅 Bom fim de semana! As frases voltam na segunda-feira.</p>
          ) : quoteOfDay ? (
            <>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, lineHeight: 1.55, color: INK, margin: '0 0 12px' }}>&ldquo;{quoteOfDay.text}&rdquo;</p>
              {quoteOfDay.author && <p style={{ fontSize: 14, color: MUTED, margin: '0 0 18px' }}>— {quoteOfDay.author}</p>}
            </>
          ) : (
            <p style={{ fontSize: 16, color: '#94A3B8', fontStyle: 'italic', margin: '0 0 18px' }}>Nenhuma frase ativa cadastrada.</p>
          )}
          {isWeekday() && (
            <button onClick={() => void handleShuffle()} style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              ↻ Sortear outra
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total cadastradas', value: stats.total },
            { label: 'Ativas', value: stats.active },
            { label: 'Inativas', value: stats.inactive },
            { label: 'Autores', value: stats.authors },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontSize: 12, color: MUTED, margin: '0 0 4px' }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 600, color: INK, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${BORDER}`, marginBottom: 20 }}>
          {([
            { id: 'frases' as const, label: `📚 Frases (${stats.total})` },
            { id: 'playlist' as const, label: `📋 Playlist${playlist.length > 0 ? ` (${playlist.length})` : ''}` },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? PRIMARY : MUTED,
              borderBottom: `2px solid ${activeTab === tab.id ? PRIMARY : 'transparent'}`,
              marginBottom: -2, transition: 'all 0.15s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ TAB: FRASES ═══════════════════════════════════════════ */}
        {activeTab === 'frases' && (
          <>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => openModal()} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                + Adicionar frase
              </button>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por frase ou autor…"
                style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit', color: INK, outline: 'none' }} />
              <select value={filterAuthor} onChange={e => setFilterAuthor(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit', color: INK, background: '#fff', minWidth: 170, cursor: 'pointer' }}>
                <option value="">Todos os autores</option>
                {authors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit', color: INK, background: '#fff', minWidth: 130, cursor: 'pointer' }}>
                <option value="all">Todas</option>
                <option value="active">Apenas ativas</option>
                <option value="inactive">Apenas inativas</option>
              </select>
            </div>

            {/* List */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFD' }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: MUTED }}>Frases cadastradas</span>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{filtered.length} {filtered.length === 1 ? 'frase' : 'frases'}</span>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: MUTED, marginBottom: 6 }}>Nenhuma frase encontrada</div>
                  <div style={{ fontSize: 13 }}>Ajuste os filtros ou adicione uma nova frase.</div>
                </div>
              ) : (
                filtered.map((q, idx) => {
                  const isToday = quoteOfDay?.id === q.id
                  const isSettingToday = settingTodayId === q.id
                  return (
                    <div key={q.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px',
                      borderTop: idx > 0 ? `1px solid ${BORDER}` : undefined,
                      opacity: q.active ? 1 : 0.55,
                      background: isToday ? '#FFFDF5' : undefined,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 15, lineHeight: 1.55, margin: '0 0 6px', color: INK, wordBreak: 'break-word' }}>{q.text}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 500 }}>{q.author || <em style={{ fontStyle: 'italic', color: '#94A3B8' }}>Sem autor</em>}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: q.active ? SUCCESS_LIGHT : '#F1F5F9', color: q.active ? SUCCESS : MUTED }}>
                            {q.active ? 'Ativa' : 'Inativa'}
                          </span>
                          {isToday && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#FFFBEB', color: '#92400E' }}>
                              ⭐ frase do dia
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                        {/* ⭐ Tornar frase do dia */}
                        <button
                          title={isToday ? 'Frase do dia atual' : q.active ? 'Tornar frase do dia' : 'Ative a frase para defini-la como frase do dia'}
                          onClick={() => !isToday && q.active && void handleSetTodayFrase(q)}
                          disabled={isSettingToday}
                          style={{
                            ...btnSm,
                            border: isToday ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
                            background: isToday ? ACCENT : '#fff',
                            color: isToday ? '#fff' : q.active ? '#92400E' : MUTED,
                            cursor: isToday ? 'default' : q.active ? 'pointer' : 'not-allowed',
                            opacity: q.active ? 1 : 0.4,
                            fontSize: 14,
                          }}
                        >
                          {isSettingToday ? '…' : isToday ? '★' : '☆'}
                        </button>

                        {/* 🙈/👁 toggle */}
                        <button title={q.active ? 'Inativar' : 'Ativar'} onClick={() => void toggleActive(q.id)}
                          style={{ ...btnSm }}>
                          {q.active ? '🙈' : '👁'}
                        </button>

                        {/* ✎ edit */}
                        <button title="Editar" onClick={() => openModal(q)} style={{ ...btnSm }}>✎</button>

                        {/* 🗑 delete */}
                        <button title="Excluir" onClick={() => void removeQuote(q.id)}
                          style={{ ...btnSm, border: '1px solid #FECACA', background: '#FEF2F2', color: DANGER }}>
                          🗑
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* ═══ TAB: PLAYLIST ══════════════════════════════════════════ */}
        {activeTab === 'playlist' && (
          <div>
            {/* Adicionar à playlist */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: '0 0 12px' }}>Programar frase para o próximo dia útil disponível</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={playlistSelectId}
                  onChange={e => setPlaylistSelectId(e.target.value)}
                  style={{ flex: 1, minWidth: 260, padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit', color: playlistSelectId ? INK : MUTED, background: '#fff', cursor: 'pointer' }}
                >
                  <option value="">Selecione uma frase ativa…</option>
                  {activeQuotes.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text}
                      {q.author ? ` — ${q.author}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void handleAddToPlaylist()}
                  disabled={!playlistSelectId || addingToPlaylist}
                  style={{
                    padding: '9px 20px', borderRadius: 8, border: 'none',
                    background: playlistSelectId && !addingToPlaylist ? PRIMARY : '#E2E8F0',
                    color: playlistSelectId && !addingToPlaylist ? '#fff' : MUTED,
                    fontSize: 13, fontWeight: 600, cursor: playlistSelectId ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {addingToPlaylist ? '…' : '+ Adicionar'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: MUTED, margin: '10px 0 0' }}>
                A rotação automática usa esta playlist. Dias sem programação usam a rotação normal.
              </p>
            </div>

            {/* Lista de frases programadas */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFD' }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: MUTED }}>Frases programadas</span>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>
                  {playlist.length === 0 ? 'Nenhuma' : `${playlist.length} ${playlist.length === 1 ? 'dia programado' : 'dias programados'}`}
                </span>
              </div>

              {playlist.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: MUTED, marginBottom: 6 }}>Playlist vazia</div>
                  <div style={{ fontSize: 13 }}>Selecione frases acima para programar os próximos dias.</div>
                </div>
              ) : (
                playlist.map((item, idx) => {
                  const frase = quotes.find(q => q.id === item.fraseId)
                  return (
                    <div key={item.data} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px',
                      borderTop: idx > 0 ? `1px solid ${BORDER}` : undefined,
                    }}>
                      {/* Data badge */}
                      <div style={{
                        flexShrink: 0, background: PRIMARY_LIGHT, color: PRIMARY,
                        borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 90,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {formatDatePlaylist(item.data).split(',')[0]}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>
                          {item.data.slice(8, 10)}/{item.data.slice(5, 7)}/{item.data.slice(2, 4)}
                        </div>
                      </div>

                      {/* Frase */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {frase ? (
                          <>
                            <p style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 4px', color: INK, wordBreak: 'break-word' }}>
                              {frase.text.length > 120 ? frase.text.slice(0, 120) + '…' : frase.text}
                            </p>
                            <span style={{ fontSize: 12, color: MUTED }}>{frase.author || <em style={{ color: '#94A3B8' }}>Sem autor</em>}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>Frase não encontrada (pode ter sido excluída)</span>
                        )}
                      </div>

                      {/* Ações */}
                      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                        <button
                          title="Mover para cima"
                          onClick={() => void handleMovePlaylistItem(idx, 'up')}
                          disabled={idx === 0}
                          style={{ ...btnSm, opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'default' : 'pointer' }}
                        >▲</button>
                        <button
                          title="Mover para baixo"
                          onClick={() => void handleMovePlaylistItem(idx, 'down')}
                          disabled={idx === playlist.length - 1}
                          style={{ ...btnSm, opacity: idx === playlist.length - 1 ? 0.3 : 1, cursor: idx === playlist.length - 1 ? 'default' : 'pointer' }}
                        >▼</button>
                        <button
                          title="Remover da playlist"
                          onClick={() => void handleRemoveFromPlaylist(item.data)}
                          style={{ ...btnSm, border: '1px solid #FECACA', background: '#FEF2F2', color: DANGER }}
                        >×</button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 12 }}>
              ▲▼ reordenam trocando as frases entre as datas (as datas permanecem fixas).
              Remover um item não afeta frases já exibidas.
            </p>
          </div>
        )}

      </div>
    </>
  )
}
