'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useUser } from '../components/UserContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tipo = string

type Aba = { id: string; label: string; ordem: number }

type Categoria = { id: string; nome: string; cor: string; ordem: number }

type Modelo = {
  id: string
  nome: string
  categoria: string
  tipo: Tipo
  filename: string
  mime_type: string
  size_bytes: number
  criado_por_nome: string
  created_at: string
  updated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Paleta das categorias — a categoria guarda só a chave (ex.: 'verde')
const CAT_PALETTE: Record<string, { bg: string; color: string; label: string }> = {
  verde:    { bg: '#E1F5EE', color: '#0F6E56', label: 'Verde' },
  azul:     { bg: '#E6F1FB', color: '#185FA5', label: 'Azul' },
  roxo:     { bg: '#EEEDFE', color: '#534AB7', label: 'Roxo' },
  laranja:  { bg: '#FAEEDA', color: '#854F0B', label: 'Laranja' },
  vermelho: { bg: '#FCEBEB', color: '#A32D2D', label: 'Vermelho' },
  rosa:     { bg: '#FCE7F3', color: '#9D174D', label: 'Rosa' },
  amarelo:  { bg: '#FEF9C3', color: '#854D0E', label: 'Amarelo' },
  cinza:    { bg: '#F1EFE8', color: '#5F5E5A', label: 'Cinza' },
}
const PALETTE_KEYS = Object.keys(CAT_PALETTE)

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
  html: { bg: '#FDF0DA', color: '#9A5B0C' },
  htm:  { bg: '#FDF0DA', color: '#9A5B0C' },
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

// Ícone da aba no switch — abas criadas em Configurações usam o de pasta
function AbaIcon({ id }: { id: string }) {
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (id === 'empresas') return (
    <svg {...p}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></svg>
  )
  if (id === 'funcionarios') return (
    <svg {...p}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
  )
  if (id === 'gt3') return (
    <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  )
  return (
    <svg {...p}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
  )
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

  const [tipoSel, setTipoSel]     = useState<Tipo>('empresas')
  const [abas, setAbas]           = useState<Aba[]>([])
  const [todos, setTodos]         = useState<Modelo[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [activeCat, setActiveCat] = useState('Todos')

  const [modalOpen, setModalOpen]   = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [form, setForm]             = useState({ nome: '', categoria: 'SST', tipo: 'empresas' })
  const [file, setFile]             = useState<File | null>(null)
  const [dragging, setDragging]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  const [downloading, setDownloading] = useState<string | null>(null)
  const [toast, setToast]             = useState<string | null>(null)

  // Troca rápida do arquivo pelo card — um input escondido só, id-alvo na ref
  const swapInputRef = useRef<HTMLInputElement>(null)
  const swapTargetId = useRef<string | null>(null)
  const [swappingId, setSwappingId] = useState<string | null>(null)

  // Configurações (abas)
  const [configOpen, setConfigOpen]   = useState(false)
  const [novaAba, setNovaAba]         = useState('')
  const [abaEditId, setAbaEditId]     = useState<string | null>(null)
  const [abaEditLabel, setAbaEditLabel] = useState('')
  const [abaBusy, setAbaBusy]         = useState(false)
  const [abaErr, setAbaErr]           = useState('')

  // Configurações (categorias)
  const [categorias, setCategorias]   = useState<Categoria[]>([])
  const [novaCat, setNovaCat]         = useState('')
  const [novaCatCor, setNovaCatCor]   = useState('azul')
  const [catEditId, setCatEditId]     = useState<string | null>(null)
  const [catEditNome, setCatEditNome] = useState('')
  const [catBusy, setCatBusy]         = useState(false)
  const [catErr, setCatErr]           = useState('')

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/repositorio-modelos/abas').then(r => r.ok ? r.json() as Promise<Aba[]> : null),
      fetch('/api/repositorio-modelos').then(r => r.ok ? r.json() as Promise<Modelo[]> : null),
      fetch('/api/repositorio-modelos/categorias').then(r => r.ok ? r.json() as Promise<Categoria[]> : null),
    ]).then(([a, m, c]) => {
      if (cancelled) return
      if (a) setAbas(a)
      if (m) setTodos(m)
      if (c) setCategorias(c)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const catColors = (nome: string) => CAT_PALETTE[categorias.find(c => c.nome === nome)?.cor ?? 'cinza'] ?? CAT_PALETTE.cinza
  const catPadrao = categorias[0]?.nome ?? 'Outros'

  // Se a aba escolhida sumir (excluída em Configurações), cai na primeira
  const tipo = abas.some(a => a.id === tipoSel) ? tipoSel : (abas[0]?.id ?? tipoSel)

  function selectTipo(id: Tipo) {
    setTipoSel(id)
    setActiveCat('Todos')
  }

  const modelos = useMemo(() => todos.filter(m => m.tipo === tipo), [todos, tipo])
  const abaLabel = (id: string) => abas.find(a => a.id === id)?.label ?? id

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
    setForm({ nome: '', categoria: catPadrao, tipo })
    setFile(null)
    setErr('')
    setModalOpen(true)
  }

  function openEdit(m: Modelo) {
    setEditingId(m.id)
    setForm({ nome: m.nome, categoria: m.categoria, tipo: m.tipo })
    setFile(null)
    setErr('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nome.trim()) { setErr('Nome é obrigatório'); return }
    if (!editingId && !file) { setErr('Selecione um arquivo'); return }
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      if (file) fd.append('file', file)
      fd.append('nome', form.nome.trim())
      fd.append('categoria', form.categoria)
      fd.append('tipo', form.tipo)
      if (editingId) {
        const res = await fetch(`/api/repositorio-modelos/${editingId}`, { method: 'PATCH', body: fd })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
        const updated: Modelo = await res.json()
        setTodos(prev => prev.map(m => m.id === updated.id ? updated : m))
        setToast(updated.tipo !== tipo ? `Arquivo movido para ${abaLabel(updated.tipo)}` : 'Arquivo atualizado')
      } else {
        const res = await fetch('/api/repositorio-modelos', { method: 'POST', body: fd })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
        const created: Modelo = await res.json()
        setTodos(prev => [created, ...prev])
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
      setTodos(prev => prev.filter(m => m.id !== id))
      setToast('Arquivo removido')
    }
  }

  function requestSwap(id: string) {
    swapTargetId.current = id
    swapInputRef.current?.click()
  }

  async function handleSwapChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    const id = swapTargetId.current
    e.target.value = ''
    if (!f || !id) return
    setSwappingId(id)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch(`/api/repositorio-modelos/${id}`, { method: 'PATCH', body: fd })
      if (!res.ok) { setToast('Erro ao trocar arquivo'); return }
      const updated: Modelo = await res.json()
      setTodos(prev => prev.map(m => m.id === updated.id ? updated : m))
      setToast('Arquivo substituído')
    } finally {
      setSwappingId(null)
    }
  }

  // ── Configurações: abas ────────────────────────────────────────────────────

  async function abaRequest(url: string, init: RequestInit): Promise<boolean> {
    setAbaBusy(true); setAbaErr('')
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
      if (!res.ok) { setAbaErr((await res.json().catch(() => ({}))).error ?? 'Erro'); return false }
      const r = await fetch('/api/repositorio-modelos/abas')
      if (r.ok) setAbas(await r.json())
      return true
    } finally {
      setAbaBusy(false)
    }
  }

  async function criarAba() {
    const label = novaAba.trim()
    if (!label) return
    if (await abaRequest('/api/repositorio-modelos/abas', { method: 'POST', body: JSON.stringify({ label }) })) {
      setNovaAba('')
      setToast(`Aba "${label}" criada`)
    }
  }

  async function renomearAba(id: string) {
    const label = abaEditLabel.trim()
    if (!label) return
    if (await abaRequest(`/api/repositorio-modelos/abas/${id}`, { method: 'PATCH', body: JSON.stringify({ label }) })) {
      setAbaEditId(null)
    }
  }

  async function excluirAba(a: Aba) {
    if (!confirm(`Excluir a aba "${a.label}"?`)) return
    if (await abaRequest(`/api/repositorio-modelos/abas/${a.id}`, { method: 'DELETE' })) setToast('Aba excluída')
  }

  async function moverAba(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= abas.length) return
    const nova = [...abas]
    ;[nova[idx], nova[j]] = [nova[j], nova[idx]]
    setAbas(nova)
    await abaRequest('/api/repositorio-modelos/abas', { method: 'PUT', body: JSON.stringify({ ordem: nova.map(a => a.id) }) })
  }

  // ── Configurações: categorias ──────────────────────────────────────────────

  async function catRequest(url: string, init: RequestInit): Promise<boolean> {
    setCatBusy(true); setCatErr('')
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
      if (!res.ok) { setCatErr((await res.json().catch(() => ({}))).error ?? 'Erro'); return false }
      const r = await fetch('/api/repositorio-modelos/categorias')
      if (r.ok) setCategorias(await r.json())
      return true
    } finally {
      setCatBusy(false)
    }
  }

  async function criarCategoria() {
    const nome = novaCat.trim()
    if (!nome) return
    if (await catRequest('/api/repositorio-modelos/categorias', { method: 'POST', body: JSON.stringify({ nome, cor: novaCatCor }) })) {
      setNovaCat('')
      setToast(`Categoria "${nome}" criada`)
    }
  }

  async function renomearCategoria(c: Categoria) {
    const nome = catEditNome.trim()
    if (!nome || nome === c.nome) { setCatEditId(null); return }
    if (await catRequest(`/api/repositorio-modelos/categorias/${c.id}`, { method: 'PATCH', body: JSON.stringify({ nome }) })) {
      // Os arquivos da categoria foram renomeados junto no servidor
      setTodos(prev => prev.map(m => m.categoria === c.nome ? { ...m, categoria: nome } : m))
      if (activeCat === c.nome) setActiveCat(nome)
      setCatEditId(null)
    }
  }

  async function trocarCorCategoria(c: Categoria, cor: string) {
    setCategorias(prev => prev.map(x => x.id === c.id ? { ...x, cor } : x))
    await catRequest(`/api/repositorio-modelos/categorias/${c.id}`, { method: 'PATCH', body: JSON.stringify({ cor }) })
  }

  async function excluirCategoria(c: Categoria) {
    if (!confirm(`Excluir a categoria "${c.nome}"?`)) return
    if (await catRequest(`/api/repositorio-modelos/categorias/${c.id}`, { method: 'DELETE' })) setToast('Categoria excluída')
  }

  async function moverCategoria(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= categorias.length) return
    const nova = [...categorias]
    ;[nova[idx], nova[j]] = [nova[j], nova[idx]]
    setCategorias(nova)
    await catRequest('/api/repositorio-modelos/categorias', { method: 'PUT', body: JSON.stringify({ ordem: nova.map(c => c.id) }) })
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

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 20, borderBottom: `1.5px solid ${BORDER}`, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: PRIMARY }}>GT3 Consultoria</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: -0.5, lineHeight: 1, marginTop: 4 }}>Repositório de Modelos</div>
          <div style={{ fontSize: 12, color: TEXT_FAINT, marginTop: 4 }}>Arquivos modelo para uso interno e contratantes</div>
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
              onClick={() => { setAbaErr(''); setAbaEditId(null); setCatErr(''); setCatEditId(null); setConfigOpen(true) }}
              title="Gerenciar abas e categorias"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: TEXT_MID, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLElement).style.color = PRIMARY }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = TEXT_MID }}
            >
              ⚙ Configurações
            </button>
          )}
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

      {/* ── Switch de abas (Empresas / Funcionários / GT3 / …) ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT_MID, marginBottom: 8 }}>
          Escolha o grupo de modelos
        </div>
        <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, background: '#EBF0FA', border: `1.5px solid #C9D6EF`, borderRadius: 12, padding: 5, width: 'fit-content', maxWidth: '100%' }}>
          {abas.map(a => {
            const ativo = tipo === a.id
            const qtd = todos.filter(m => m.tipo === a.id).length
            return (
              <button
                key={a.id}
                role="tab"
                aria-selected={ativo}
                onClick={() => selectTipo(a.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700,
                  background: ativo ? PRIMARY : 'transparent',
                  color: ativo ? '#fff' : PRIMARY,
                  boxShadow: ativo ? '0 2px 8px rgba(42,79,150,0.30)' : 'none',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (!ativo) (e.currentTarget as HTMLElement).style.background = '#DCE5F6' }}
                onMouseLeave={e => { if (!ativo) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <AbaIcon id={a.id} />
                {a.label}
                <span style={{
                  fontSize: 11, fontWeight: 700, minWidth: 20, padding: '1px 7px', borderRadius: 20,
                  background: ativo ? 'rgba(255,255,255,0.22)' : '#fff',
                  color: ativo ? '#fff' : PRIMARY,
                }}>
                  {qtd}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total de arquivos', value: modelos.length,                                 sub: 'modelos disponíveis' },
          { label: 'Categorias',        value: new Set(modelos.map(m => m.categoria)).size,     sub: 'áreas cobertas' },
          { label: 'Adicionados',       value: thisMonth,                                       sub: 'este mês' },
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
        {loading ? 'Carregando…' : `${filtered.length} arquivo${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {/* ── Grid ── */}
      {loading ? null : filtered.length === 0 ? (
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
            const ext  = extOf(m.filename)
            const em   = EXT_META[ext] ?? { bg: '#F1EFE8', color: '#5F5E5A' }
            const cc   = catColors(m.categoria)
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
                        onClick={() => requestSwap(m.id)}
                        disabled={swappingId === m.id}
                        title="Substituir o arquivo (mantém nome e categoria)"
                        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', cursor: swappingId === m.id ? 'default' : 'pointer', color: TEXT_FAINT }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLElement).style.color = PRIMARY }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = TEXT_FAINT }}
                      >
                        {swappingId === m.id ? '⏳' : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                          </svg>
                        )}
                      </button>
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
          className="gt3-overlay-fade"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div className="gt3-drop-in" style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>
                {editingId ? 'Editar arquivo' : `Adicionar em ${abaLabel(tipo)}`}
              </h2>
              <button onClick={() => setModalOpen(false)} className="gt3-close-btn" style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${BORDER}`, background: 'none', cursor: 'pointer', fontSize: 18, color: TEXT_MID, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
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
                  {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  {form.categoria && !categorias.some(c => c.nome === form.categoria) && (
                    <option value={form.categoria}>{form.categoria}</option>
                  )}
                </select>
              </div>

              {/* Aba — no modo editar permite mover o arquivo para outra aba */}
              {editingId && (
                <div>
                  <label style={lbl}>Aba</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    style={{ ...inp, cursor: 'pointer' }}
                    onFocus={e => { (e.target as HTMLSelectElement).style.borderColor = PRIMARY }}
                    onBlur={e => { (e.target as HTMLSelectElement).style.borderColor = BORDER }}
                  >
                    {abas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
              )}

              {/* Arquivo — obrigatório ao criar; opcional ao editar (substitui o atual) */}
              <div>
                <label style={lbl}>{editingId ? 'Substituir arquivo (opcional)' : 'Arquivo'}</label>
                {editingId && !file && (
                  <div style={{ fontSize: 12, color: TEXT_MID, marginBottom: 6 }}>
                    Atual: <strong>{todos.find(m => m.id === editingId)?.filename}</strong>
                  </div>
                )}
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
                      <div style={{ fontSize: 11, color: TEXT_FAINT, marginTop: 4 }}>DOCX, XLS, XLSX, PDF, JPG, HTML e outros</div>
                    </>
                  )}
                </div>
                <input
                  id="rm-file-input"
                  type="file"
                  accept=".docx,.doc,.xls,.xlsx,.pdf,.jpg,.jpeg,.png,.pptx,.ppt,.html,.htm"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
                />
              </div>

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

      {/* Input escondido — troca rápida de arquivo direto pelo card */}
      <input
        ref={swapInputRef}
        type="file"
        accept=".docx,.doc,.xls,.xlsx,.pdf,.jpg,.jpeg,.png,.pptx,.ppt,.html,.htm"
        style={{ display: 'none' }}
        onChange={e => void handleSwapChange(e)}
      />

      {/* ── Modal Configurações (abas) ── */}
      {configOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setConfigOpen(false) }}
          className="gt3-overlay-fade"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div className="gt3-drop-in" style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Configurações</h2>
              <button onClick={() => setConfigOpen(false)} className="gt3-close-btn" style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${BORDER}`, background: 'none', cursor: 'pointer', fontSize: 18, color: TEXT_MID, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Abas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {abas.map((a, i) => {
                  const qtd = todos.filter(m => m.tipo === a.id).length
                  const editando = abaEditId === a.id
                  const btn: React.CSSProperties = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', color: TEXT_MID, fontSize: 12, flexShrink: 0 }
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                      <span style={{ color: PRIMARY, display: 'flex' }}><AbaIcon id={a.id} /></span>
                      {editando ? (
                        <input
                          autoFocus
                          value={abaEditLabel}
                          onChange={e => setAbaEditLabel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void renomearAba(a.id); if (e.key === 'Escape') setAbaEditId(null) }}
                          style={{ ...inp, padding: '5px 8px', flex: 1 }}
                        />
                      ) : (
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>
                          {a.label}
                          <span style={{ fontWeight: 400, color: TEXT_FAINT, marginLeft: 6 }}>{qtd} arquivo{qtd !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {editando ? (
                        <>
                          <button disabled={abaBusy} onClick={() => void renomearAba(a.id)} title="Salvar" style={{ ...btn, color: '#16A34A' }}>✓</button>
                          <button onClick={() => setAbaEditId(null)} title="Cancelar" style={btn}>×</button>
                        </>
                      ) : (
                        <>
                          <button disabled={abaBusy || i === 0} onClick={() => void moverAba(i, -1)} title="Mover para cima" style={{ ...btn, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                          <button disabled={abaBusy || i === abas.length - 1} onClick={() => void moverAba(i, 1)} title="Mover para baixo" style={{ ...btn, opacity: i === abas.length - 1 ? 0.4 : 1 }}>↓</button>
                          <button onClick={() => { setAbaEditId(a.id); setAbaEditLabel(a.label); setAbaErr('') }} title="Renomear" style={btn}>✎</button>
                          <button
                            disabled={abaBusy || qtd > 0}
                            onClick={() => void excluirAba(a)}
                            title={qtd > 0 ? 'Mova ou exclua os arquivos da aba antes de excluí-la' : 'Excluir aba'}
                            style={{ ...btn, border: '1px solid #FCA5A5', color: '#EF4444', opacity: qtd > 0 ? 0.4 : 1, cursor: qtd > 0 ? 'not-allowed' : 'pointer' }}
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              <div>
                <label style={lbl}>Nova aba</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={novaAba}
                    onChange={e => setNovaAba(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void criarAba() }}
                    placeholder="Ex: Terceiras"
                    style={inp}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = PRIMARY }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = BORDER }}
                  />
                  <button
                    onClick={() => void criarAba()}
                    disabled={abaBusy || !novaAba.trim()}
                    style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: abaBusy || !novaAba.trim() ? '#C8C5BC' : PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: abaBusy || !novaAba.trim() ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                    + Criar aba
                  </button>
                </div>
              </div>

              {abaErr && <div style={{ fontSize: 12, color: '#EF4444' }}>{abaErr}</div>}

              <div style={{ fontSize: 11, color: TEXT_FAINT, lineHeight: 1.5 }}>
                Para excluir uma aba ela precisa estar vazia — mova os arquivos para outra aba pelo botão de editar (✎) de cada card.
              </div>

              {/* ── Categorias ── */}
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>Categorias</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {categorias.map((c, i) => {
                  const qtd = todos.filter(m => m.categoria === c.nome).length
                  const editando = catEditId === c.id
                  const pal = CAT_PALETTE[c.cor] ?? CAT_PALETTE.cinza
                  const btn: React.CSSProperties = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', color: TEXT_MID, fontSize: 12, flexShrink: 0 }
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                      <select
                        value={c.cor}
                        disabled={catBusy}
                        onChange={e => void trocarCorCategoria(c, e.target.value)}
                        title="Cor da categoria"
                        style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${pal.color}`, background: pal.bg, color: 'transparent', cursor: 'pointer', appearance: 'none', padding: 0, flexShrink: 0 }}
                      >
                        {PALETTE_KEYS.map(k => <option key={k} value={k} style={{ color: TEXT }}>{CAT_PALETTE[k].label}</option>)}
                      </select>
                      {editando ? (
                        <input
                          autoFocus
                          value={catEditNome}
                          onChange={e => setCatEditNome(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void renomearCategoria(c); if (e.key === 'Escape') setCatEditId(null) }}
                          style={{ ...inp, padding: '5px 8px', flex: 1 }}
                        />
                      ) : (
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                          <span style={{ display: 'inline-block', fontWeight: 500, padding: '2px 9px', borderRadius: 20, background: pal.bg, color: pal.color }}>{c.nome}</span>
                          <span style={{ color: TEXT_FAINT, marginLeft: 6 }}>{qtd} arquivo{qtd !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {editando ? (
                        <>
                          <button disabled={catBusy} onClick={() => void renomearCategoria(c)} title="Salvar" style={{ ...btn, color: '#16A34A' }}>✓</button>
                          <button onClick={() => setCatEditId(null)} title="Cancelar" style={btn}>×</button>
                        </>
                      ) : (
                        <>
                          <button disabled={catBusy || i === 0} onClick={() => void moverCategoria(i, -1)} title="Mover para cima" style={{ ...btn, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                          <button disabled={catBusy || i === categorias.length - 1} onClick={() => void moverCategoria(i, 1)} title="Mover para baixo" style={{ ...btn, opacity: i === categorias.length - 1 ? 0.4 : 1 }}>↓</button>
                          <button onClick={() => { setCatEditId(c.id); setCatEditNome(c.nome); setCatErr('') }} title="Renomear (os arquivos acompanham)" style={btn}>✎</button>
                          <button
                            disabled={catBusy || qtd > 0}
                            onClick={() => void excluirCategoria(c)}
                            title={qtd > 0 ? 'Troque a categoria dos arquivos antes de excluí-la' : 'Excluir categoria'}
                            style={{ ...btn, border: '1px solid #FCA5A5', color: '#EF4444', opacity: qtd > 0 ? 0.4 : 1, cursor: qtd > 0 ? 'not-allowed' : 'pointer' }}
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              <div>
                <label style={lbl}>Nova categoria</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={novaCatCor}
                    onChange={e => setNovaCatCor(e.target.value)}
                    title="Cor"
                    style={{ ...inp, width: 110, cursor: 'pointer', background: CAT_PALETTE[novaCatCor].bg, color: CAT_PALETTE[novaCatCor].color, fontWeight: 600 }}
                  >
                    {PALETTE_KEYS.map(k => <option key={k} value={k} style={{ color: TEXT, background: '#fff' }}>{CAT_PALETTE[k].label}</option>)}
                  </select>
                  <input
                    value={novaCat}
                    onChange={e => setNovaCat(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void criarCategoria() }}
                    placeholder="Ex: Contratos"
                    style={inp}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = PRIMARY }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = BORDER }}
                  />
                  <button
                    onClick={() => void criarCategoria()}
                    disabled={catBusy || !novaCat.trim()}
                    style={{ padding: '9px 14px', border: 'none', borderRadius: 8, background: catBusy || !novaCat.trim() ? '#C8C5BC' : PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: catBusy || !novaCat.trim() ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                    + Criar
                  </button>
                </div>
              </div>

              {catErr && <div style={{ fontSize: 12, color: '#EF4444' }}>{catErr}</div>}

              <div style={{ fontSize: 11, color: TEXT_FAINT, lineHeight: 1.5 }}>
                Renomear uma categoria atualiza todos os arquivos dela. Para excluir, ela precisa estar sem arquivos — troque a categoria deles pelo botão de editar (✎) de cada card.
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
