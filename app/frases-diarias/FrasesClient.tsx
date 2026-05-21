'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const ACCENT = '#D1AE6E'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const SUCCESS = '#16A34A'
const SUCCESS_LIGHT = '#F0FFF4'
const DANGER = '#DC2626'

const STORAGE_KEY = 'gt3_frases_diarias_v1'
const ROTATION_KEY = 'gt3_frases_rotation_v1'

type Quote = { id: string; text: string; author: string; active: boolean; createdAt: string }
type Rotation = { pool: string[]; currentId: string | null; currentDate: string | null }

const SEEDS: Omit<Quote, 'id' | 'createdAt'>[] = [
  { text: 'O que pode ser medido pode ser melhorado.', author: 'Peter Drucker', active: true },
  { text: 'Cultura come estratégia no café da manhã.', author: 'Peter Drucker', active: true },
  { text: 'A qualidade nunca é um acidente; é sempre o resultado de esforço inteligente.', author: 'John Ruskin', active: true },
  { text: 'Não basta fazer o seu melhor: você deve saber o que fazer, e então fazer o seu melhor.', author: 'W. Edwards Deming', active: true },
]

function uid() { return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8) }
function todayStr() { return new Date().toISOString().slice(0, 10) }
function formatDateLong(d = new Date()) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function loadData(): { quotes: Quote[]; rotation: Rotation } {
  try {
    const q = localStorage.getItem(STORAGE_KEY)
    const r = localStorage.getItem(ROTATION_KEY)
    const quotes: Quote[] = q ? JSON.parse(q) : []
    const rotation: Rotation = r ? JSON.parse(r) : { pool: [], currentId: null, currentDate: null }
    if (quotes.length === 0) {
      const seeded = SEEDS.map(s => ({ ...s, id: uid(), createdAt: new Date().toISOString() }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return { quotes: seeded, rotation }
    }
    return { quotes, rotation }
  } catch {
    return { quotes: [], rotation: { pool: [], currentId: null, currentDate: null } }
  }
}

function saveQuotes(quotes: Quote[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes)) } catch { /* ignore */ }
}

function saveRotation(rotation: Rotation) {
  try { localStorage.setItem(ROTATION_KEY, JSON.stringify(rotation)) } catch { /* ignore */ }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function drawQuote(quotes: Quote[], rotation: Rotation, forceNew = false): { quote: Quote | null; rotation: Rotation } {
  const today = todayStr()
  if (!forceNew && rotation.currentDate === today && rotation.currentId) {
    const q = quotes.find(x => x.id === rotation.currentId && x.active)
    if (q) return { quote: q, rotation }
  }
  const activeIds = quotes.filter(q => q.active).map(q => q.id)
  if (activeIds.length === 0) return { quote: null, rotation: { ...rotation, currentId: null, currentDate: today } }

  let pool = rotation.pool.filter(id => activeIds.includes(id))
  if (forceNew && rotation.currentId) pool = pool.filter(id => id !== rotation.currentId)
  if (pool.length === 0) pool = shuffle(activeIds.filter(id => id !== (forceNew ? rotation.currentId : undefined)))
  if (pool.length === 0) return { quote: null, rotation: { ...rotation, currentId: null, currentDate: today } }

  const [nextId, ...rest] = pool
  const newRotation: Rotation = { pool: rest, currentId: nextId, currentDate: today }
  saveRotation(newRotation)
  return { quote: quotes.find(x => x.id === nextId) || null, rotation: newRotation }
}

type FilterStatus = 'all' | 'active' | 'inactive'
type ModalState = { open: boolean; editId: string | null; text: string; author: string }

export default function FrasesClient() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [rotation, setRotation] = useState<Rotation>({ pool: [], currentId: null, currentDate: null })
  const [quoteOfDay, setQuoteOfDay] = useState<Quote | null>(null)
  const [search, setSearch] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [modal, setModal] = useState<ModalState>({ open: false, editId: null, text: '', author: '' })
  const [toast, setToast] = useState({ msg: '', show: false })
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const { quotes: q, rotation: r } = loadData()
    setQuotes(q)
    const { quote, rotation: newR } = drawQuote(q, r)
    setQuoteOfDay(quote)
    setRotation(newR)
  }, [])

  function showToast(msg: string) {
    if (toastRef.current) clearTimeout(toastRef.current)
    setToast({ msg, show: true })
    toastRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2200)
  }

  function persistQuotes(q: Quote[]) { setQuotes(q); saveQuotes(q) }

  function handleShuffle() {
    const { quote, rotation: r } = drawQuote(quotes, rotation, true)
    setQuoteOfDay(quote)
    setRotation(r)
    showToast('Nova frase sorteada.')
  }

  function openModal(q?: Quote) {
    setModal({ open: true, editId: q?.id ?? null, text: q?.text ?? '', author: q?.author ?? '' })
  }

  function closeModal() { setModal(m => ({ ...m, open: false })) }

  function saveModal() {
    const text = modal.text.trim()
    const author = modal.author.trim()
    if (!text) { showToast('A frase não pode ficar vazia.'); return }
    if (modal.editId) {
      const updated = quotes.map(q => q.id === modal.editId ? { ...q, text, author } : q)
      persistQuotes(updated)
      showToast('Frase atualizada.')
    } else {
      const newQ: Quote = { id: uid(), text, author, active: true, createdAt: new Date().toISOString() }
      persistQuotes([...quotes, newQ])
      showToast('Frase adicionada.')
    }
    closeModal()
  }

  function toggleActive(id: string) {
    const q = quotes.find(x => x.id === id)
    const updated = quotes.map(x => x.id === id ? { ...x, active: !x.active } : x)
    persistQuotes(updated)
    showToast(q?.active ? 'Frase inativada.' : 'Frase ativada.')
  }

  function removeQuote(id: string) {
    const q = quotes.find(x => x.id === id)
    if (!confirm(`Excluir esta frase?\n\n"${(q?.text ?? '').slice(0, 80)}${(q?.text ?? '').length > 80 ? '…' : ''}"`)) return
    const updated = quotes.filter(x => x.id !== id)
    const newRot = { ...rotation, pool: rotation.pool.filter(x => x !== id), currentId: rotation.currentId === id ? null : rotation.currentId }
    persistQuotes(updated)
    setRotation(newRot)
    saveRotation(newRot)
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
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(data.quotes)) throw new Error('Formato inválido')
        const existingIds = new Set(quotes.map(q => q.id))
        let added = 0
        const newQ = [...quotes]
        data.quotes.forEach((q: Partial<Quote>) => {
          if (!q.text) return
          newQ.push({
            id: q.id && !existingIds.has(q.id) ? q.id : uid(),
            text: String(q.text).trim(),
            author: String(q.author || '').trim(),
            active: q.active !== false,
            createdAt: q.createdAt || new Date().toISOString(),
          })
          added++
        })
        persistQuotes(newQ)
        showToast(`${added} frase(s) importada(s).`)
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${BORDER}`,
    outline: 'none', fontSize: 13, fontFamily: 'inherit', color: INK, background: '#fff',
    boxSizing: 'border-box',
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
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: MUTED, lineHeight: 1 }}>×</button>
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
                  placeholder="Ex.: Peter Drucker"
                  list="authors-datalist"
                  onKeyDown={e => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && saveModal()} />
                <datalist id="authors-datalist">
                  {authors.map(a => <option key={a} value={a} />)}
                </datalist>
                <span style={{ fontSize: 11, color: MUTED, marginTop: 4, display: 'block' }}>Deixe em branco se desconhecido. Ctrl+Enter para salvar.</span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 22px', borderTop: `1px solid ${BORDER}`, background: '#FAFBFD', borderRadius: '0 0 12px 12px' }}>
              <button onClick={closeModal} style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={saveModal} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Salvar
              </button>
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
            <button onClick={handleExport} style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              ↓ Exportar
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
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
          {quoteOfDay ? (
            <>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, lineHeight: 1.55, color: INK, margin: '0 0 12px' }}>
                &ldquo;{quoteOfDay.text}&rdquo;
              </p>
              {quoteOfDay.author && (
                <p style={{ fontSize: 14, color: MUTED, margin: '0 0 18px' }}>— {quoteOfDay.author}</p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 16, color: '#94A3B8', fontStyle: 'italic', margin: '0 0 18px' }}>Nenhuma frase ativa cadastrada.</p>
          )}
          <button onClick={handleShuffle} style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ↻ Sortear outra
          </button>
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
            filtered.map((q, idx) => (
              <div key={q.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px',
                borderTop: idx > 0 ? `1px solid ${BORDER}` : undefined,
                opacity: q.active ? 1 : 0.55,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, lineHeight: 1.55, margin: '0 0 6px', color: INK, wordBreak: 'break-word' }}>{q.text}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500 }}>{q.author || <em style={{ fontStyle: 'italic', color: '#94A3B8' }}>Sem autor</em>}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: q.active ? SUCCESS_LIGHT : '#F1F5F9',
                      color: q.active ? SUCCESS : MUTED,
                    }}>
                      {q.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button title={q.active ? 'Inativar' : 'Ativar'} onClick={() => toggleActive(q.id)}
                    style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                    {q.active ? '🙈' : '👁'}
                  </button>
                  <button title="Editar" onClick={() => openModal(q)}
                    style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                    ✎
                  </button>
                  <button title="Excluir" onClick={() => removeQuote(q.id)}
                    style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: DANGER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
