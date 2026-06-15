'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser } from '../components/UserContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Modelo = {
  id: string
  nome: string
  categoria: string
  filename: string
  mime_type: string
  size_bytes: number
  criado_por_nome: string
  created_at: string
  updated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATS = ['SST', 'Fiscal', 'Jurídico', 'RH', 'Outros'] as const

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  'SST':      { bg: '#E1F5EE', color: '#0F6E56' },
  'Fiscal':   { bg: '#E6F1FB', color: '#185FA5' },
  'Jurídico': { bg: '#EEEDFE', color: '#534AB7' },
  'RH':       { bg: '#FAEEDA', color: '#854F0B' },
  'Outros':   { bg: '#F1EFE8', color: '#5F5E5A' },
}

const EXT_META: Record<string, { bg: string; color: string }> = {
  pdf:  { bg: '#FCEBEB', color: '#A32D2D' },
  docx: { bg: '#E6F1FB', color: '#185FA5' },
  doc:  { bg: '#E6F1FB', color: '#185FA5' },
  xlsx: { bg: '#EAF3DE', color: '#3B6D11' },
  xls:  { bg: '#EAF3DE', color: '#3B6D11' },
  pptx: { bg: '#FEF0E6', color: '#8B3A0E' },
  ppt:  { bg: '#FEF0E6', color: '#8B3A0E' },
  jpg:  { bg: '#FAEEDA', color: '#854F0B' },
  jpeg: { bg: '#FAEEDA', color: '#854F0B' },
  png:  { bg: '#FAEEDA', color: '#854F0B' },
}

const PRIMARY    = '#2A4F96'
const BORDER     = '#E2E8F0'
const TEXT       = '#1A2340'
const TEXT_MID   = '#5a6178'
const TEXT_FAINT = '#94A3B8'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function formatSize(bytes: number): string {
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB'
  return Math.round(bytes / 1024) + ' KB'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: TEXT_MID, display: 'block', marginBottom: 6,
}
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`,
  borderRadius: 8, fontSize: 13, color: TEXT, outline: 'none',
  background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RepositorioClient() {
  const { profile } = useUser()
  const papel = profile?.papel ?? ''
  const canManage = papel === 'gestor' || papel === 'admin'

  const [modelos, setModelos]     = useState<Modelo[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [activeCat, setActiveCat] = useState('Todos')

  const [modalOpen, setModalOpen]   = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [form, setForm]             = useState({ nome: '', categoria: 'SST' })
  const [file, setFile]             = useState<File | null>(null)
  const [dragging, setDragging]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  const [downloading, setDownloading] = useState<string | null>(null)
  const [toast, setToast]             = useState<string | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/repositorio-modelos')
      if (res.ok) setModelos(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  // ── Derived ────────────────────────────────────────────────────────────────

  const allCats = useMemo(() => {
    const cats = [...new Set(modelos.map(m => m.categoria))]
    return ['Todos', ...cats]
  }, [modelos])

  const filtered = useMemo(() => modelos.filter(m => {
    const catOk = activeCat === 'Todos' || m.categoria === activeCat
    const q = search.toLowerCase()
    const qOk = !q || m.nome.toLowerCase().includes(q) || m.categoria.toLowerCase().includes(q) || extOf(m.filename).includes(q)
    return catOk && qOk
  }), [modelos, activeCat, search])

  const thisMonth = useMemo(() => {
    const now = new Date()
    return modelos.filter(m => {
      const d = new Date(m.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [modelos])

  // ── CRUD ───────────────────────────────────────────────────────────────────

  function openNew() {
    setEditingId(null)
    setForm({ nome: '', categoria: 'SST' })
    setFile(null)
    setErr('')
    setModalOpen(true)
  }

  function openEdit(m: Modelo) {
    setEditingId(m.id)
    setForm({ nome: m.nome, categoria: m.categoria })
    setFile(null)
    setErr('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nome.trim()) { setErr('Nome é obrigatório'); return }
    if (!editingId && !file) { setErr('Selecione um arquivo'); return }
    setSaving(true); setErr('')
    try {
      if (editingId) {
        const res = await fetch(`/api/repositorio-modelos/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: form.nome.trim(), categoria: form.categoria }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
        const updated: Modelo = await res.json()
        setModelos(prev => prev.map(m => m.id === updated.id ? updated : m))
        setToast('Arquivo atualizado')
      } else {
        const fd = new FormData()
        fd.append('file', file!)
        fd.append('nome', form.nome.trim())
        fd.append('categoria', form.categoria)
        const res = await fetch('/api/repositorio-modelos', { method: 'POST', body: fd })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
        const created: Modelo = await res.json()
        setModelos(prev => [created, ...prev])
        setToast('Arquivo adicionado')
      }
      setModalOpen(false)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este arquivo do repositório?')) return
    const res = await fetch(`/api/repositorio-modelos/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setModelos(prev => prev.filter(m => m.id !== id))
      setToast('Arquivo removido')
    }
  }

  async function handleDownload(m: Modelo) {
    setDownloading(m.id)
    try {
      const res = await fetch(`/api/repositorio-modelos/${m.id}/download`)
      if (!res.ok) return
      const { url } = await res.json() as { url: string }
      const a = document.createElement('a')
      a.href = url
      a.download = m.filename
      a.click()
    } finally {
      setDownloading(null)
    }
  }

  function pickFile(f: File) {
    setFile(f)
    if (!form.nome) setForm(prev => ({ ...prev, nome: f.name.replace(/\.[^.]+$/, '') }))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 60, textAlign: 'center', color: TEXT_FAINT, fontSize: 14 }}>
        Carregando repositório…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 20, borderBottom: `1.5px solid ${BORDER}`, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: PRIMARY }}>GT3 Consultoria</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: -0.5, lineHeight: 1, marginTop: 4 }}>Repositório de Modelos</div>
          <div style={{ fontSize: 12, color: TEXT_FAINT, marginTop: 4 }}>Arquivos modelo para as empresas contratantes</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEXT_FAINT} strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome ou categoria…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inp, padding: '7px 12px 7px 32px', width: 240 }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = PRIMARY }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = BORDER }}
            />
          </div>
          {canManage && (
            <button
              onClick={openNew}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#4A6DB5' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = PRIMARY }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Novo arquivo
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total de arquivos', value: modelos.length,                                    sub: 'modelos disponíveis' },
          { label: 'Categorias',        value: new Set(modelos.map(m => m.categoria)).size,        sub: 'áreas cobertas' },
          { label: 'Adicionados',       value: thisMonth,                                          sub: 'este mês' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT_FAINT }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: TEXT, lineHeight: 1, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: TEXT_FAINT, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Category pills ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {allCats.map(c => (
          <button
            key={c}
            onClick={() => setActiveCat(c)}
            style={{
              padding: '5px 14px', borderRadius: 100,
              border: `1px solid ${activeCat === c ? PRIMARY : '#C8C5BC'}`,
              background: activeCat === c ? PRIMARY : '#fff',
              color: activeCat === c ? '#fff' : TEXT_MID,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ── Count ── */}
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT_FAINT, marginBottom: 12 }}>
        {filtered.length} arquivo{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: TEXT_FAINT, fontSize: 14 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 12px' }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Nenhum arquivo encontrado.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 32 }}>
          {filtered.map(m => {
            const ext = extOf(m.filename)
            const em  = EXT_META[ext] ?? { bg: '#F1EFE8', color: '#5F5E5A' }
            const cc  = CAT_COLORS[m.categoria] ?? { bg: '#F1EFE8', color: '#5F5E5A' }
            const isDl = downloading === m.id
            return (
              <div key={m.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow .15s', boxShadow: '0 1px 4px rgba(42,79,150,0.05)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(42,79,150,0.10)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(42,79,150,0.05)' }}
              >
                {/* Top */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 8, background: em.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: em.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {ext.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, lineHeight: 1.3, wordBreak: 'break-word' }}>{m.nome}</div>
                    <div style={{ fontSize: 11, color: TEXT_FAINT, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      {ext} · {formatSize(m.size_bytes)}
                    </div>
                  </div>
                </div>

                {/* Badge */}
                <div>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: cc.bg, color: cc.color }}>
                    {m.categoria}
                  </span>
                </div>

                {/* Footer */}
                <div style={{ fontSize: 11, color: TEXT_FAINT, paddingTop: 6, borderTop: `0.5px solid ${BORDER}` }}>
                  Enviado por <strong style={{ color: TEXT_MID }}>{m.criado_por_nome}</strong> · {fmtDate(m.created_at)}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => void handleDownload(m)}
                    disabled={isDl}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 4px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 12, color: isDl ? TEXT_FAINT : TEXT_MID, cursor: isDl ? 'default' : 'pointer' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {isDl ? 'Baixando…' : 'Baixar'}
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => openEdit(m)}
                        title="Editar"
                        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', color: TEXT_FAINT }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLElement).style.color = PRIMARY }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = TEXT_FAINT }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => void handleDelete(m.id)}
                        title="Excluir"
                        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid #FCA5A5', background: '#fff', cursor: 'pointer', color: '#EF4444' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FFF5F5' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>
                {editingId ? 'Editar arquivo' : 'Adicionar arquivo'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${BORDER}`, background: 'none', cursor: 'pointer', fontSize: 18, color: TEXT_MID, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Nome */}
              <div>
                <label style={lbl}>Nome do modelo</label>
                <input
                  type="text" autoFocus
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
                  placeholder="Ex: Contrato de Prestação de Serviços"
                  style={inp}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = PRIMARY }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = BORDER }}
                />
              </div>

              {/* Categoria */}
              <div>
                <label style={lbl}>Categoria</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  style={{ ...inp, cursor: 'pointer' }}
                  onFocus={e => { (e.target as HTMLSelectElement).style.borderColor = PRIMARY }}
                  onBlur={e => { (e.target as HTMLSelectElement).style.borderColor = BORDER }}
                >
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Arquivo — só no modo criar */}
              {!editingId && (
                <div>
                  <label style={lbl}>Arquivo</label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f) }}
                    onClick={() => document.getElementById('rm-file-input')?.click()}
                    style={{
                      border: `1.5px dashed ${dragging ? PRIMARY : BORDER}`,
                      borderRadius: 8, padding: '1.5rem 1rem',
                      textAlign: 'center', cursor: 'pointer',
                      background: dragging ? '#EBF0FA' : '#FAFAF8',
                      color: TEXT_MID, fontSize: 13,
                    }}
                  >
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={TEXT_FAINT} strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 8px' }}>
                      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
                    </svg>
                    {file ? (
                      <span style={{ color: PRIMARY, fontWeight: 600, fontSize: 12 }}>✓ {file.name}</span>
                    ) : (
                      <>
                        Clique ou arraste o arquivo aqui
                        <div style={{ fontSize: 11, color: TEXT_FAINT, marginTop: 4 }}>DOCX, XLS, XLSX, PDF, JPG e outros</div>
                      </>
                    )}
                  </div>
                  <input
                    id="rm-file-input"
                    type="file"
                    accept=".docx,.doc,.xls,.xlsx,.pdf,.jpg,.jpeg,.png,.pptx,.ppt"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
                  />
                </div>
              )}

              {err && <div style={{ fontSize: 12, color: '#EF4444' }}>{err}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button onClick={() => setModalOpen(false)} style={{ padding: '9px 18px', border: `1px solid #C8C5BC`, borderRadius: 8, background: '#fff', color: TEXT_MID, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  style={{ padding: '9px 22px', border: 'none', borderRadius: 8, background: saving ? '#C8C5BC' : PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1A2340', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, zIndex: 400, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          <span style={{ color: '#4ade80' }}>✓</span> {toast}
        </div>
      )}
    </div>
  )
}
