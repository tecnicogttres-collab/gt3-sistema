'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { CATEGORIES, type Category, type Column, type Card } from './data'
import { useUser } from '../components/UserContext'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const ACCENT = '#D1AE6E'
const ACCENT_DARK = '#B8922A'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const BG_CARD = '#FFFFFF'
const BG_PAGE = '#F4F6FA'

// ─── Extended types ────────────────────────────────────────────────────────────

type CardUI = Card & { _id?: string; _source: 'static' | 'db'; _imagem_url?: string }
type ColumnUI = Omit<Column, 'cards'> & { cards: CardUI[] }

type DbObservacao = {
  id: string
  categoria: string
  subtab: string
  coluna: string
  motivo: string
  parecer: string
  group_name: string | null
  imagem_url: string | null
  criado_por: string | null
  editado_por: string | null
  created_at: string
  updated_at: string
}

type ModalState = {
  open: boolean
  mode: 'create' | 'edit'
  coluna: string
  subtabKey: string
  editingId: string | null
  motivo: string
  parecerBody: string
  imagemUrl: string
  imagemFile: File | null
  imagemPreview: string
  saving: boolean
}

type ConfirmState =
  | { open: false }
  | { open: true; type: 'edit'; id: string; motivo: string; parecer: string; imagemUrl: string | null }
  | { open: true; type: 'delete'; id: string }

type DbSubtab = {
  id: string
  categoria: string
  subtab: string
  criado_por: string | null
  created_at: string
}

type SubtabModal = { open: boolean; name: string; saving: boolean; error: string }

const MODAL_INIT: ModalState = {
  open: false, mode: 'create', coluna: '', subtabKey: '',
  editingId: null, motivo: '', parecerBody: '',
  imagemUrl: '', imagemFile: null, imagemPreview: '',
  saving: false,
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function cardId(catKey: string, subtabKey: string, colTitle: string, idx: number) {
  return `${catKey}|${subtabKey}|${colTitle}|${idx}`
}

function matchesSearch(card: CardUI, term: string): boolean {
  if (!term) return true
  const t = term.toLowerCase()
  return card.motivo.toLowerCase().includes(t) || card.parecer.toLowerCase().includes(t)
}

function highlight(text: string, term: string): React.ReactNode {
  if (!term) return text
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#FFF3CD', color: INK, borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  )
}

function buildColumnUI(col: Column, dbRows: DbObservacao[]): ColumnUI {
  const staticCards: CardUI[] = col.cards.map(c => ({ ...c, _source: 'static' as const }))
  const dbCards: CardUI[] = dbRows
    .filter(o => o.coluna === col.title)
    .map(o => ({
      motivo: o.motivo, parecer: o.parecer,
      group: o.group_name ?? undefined,
      _id: o.id, _source: 'db' as const,
      _imagem_url: o.imagem_url ?? undefined,
    }))
  return { ...col, cards: [...staticCards, ...dbCards] }
}

// ─── Card Component ────────────────────────────────────────────────────────────

function ObsCard({
  card, id, isCopied, onCopy, search, canManage, onEdit, onDelete, isFixed,
}: {
  card: CardUI
  id: string
  isCopied: boolean
  onCopy: (id: string, text: string) => void
  search: string
  canManage?: boolean
  onEdit?: () => void
  onDelete?: () => void
  isFixed?: boolean
}) {
  const accentColor = isFixed ? ACCENT : PRIMARY
  const tagBg = isFixed ? 'rgba(209,174,110,0.15)' : 'rgba(42,79,150,0.08)'
  const borderColor = isCopied ? '#22C55E' : accentColor

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onCopy(id, card.parecer)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onCopy(id, card.parecer)}
      style={{
        background: BG_CARD,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.15s, transform 0.1s',
        boxShadow: isCopied
          ? '0 0 0 3px rgba(34,197,94,0.15)'
          : isFixed
            ? '0 1px 3px rgba(209,174,110,0.12)'
            : '0 1px 3px rgba(42,79,150,0.08)',
        transform: isCopied ? 'scale(0.99)' : undefined,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: 8, right: 10, fontSize: 11, fontWeight: 600,
        color: isCopied ? '#16A34A' : MUTED, transition: 'color 0.2s', letterSpacing: 0.3,
      }}>
        {isCopied ? '✓ Copiado' : '⧉'}
      </div>

      <div style={{
        display: 'inline-block', fontSize: 12, fontWeight: 700, color: accentColor,
        background: tagBg, borderRadius: 4, padding: '2px 7px',
        marginBottom: 6, lineHeight: 1.4, maxWidth: 'calc(100% - 52px)',
      }}>
        {highlight(card.motivo, search)}
      </div>
      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {highlight(card.parecer, search)}
      </div>

      {card._imagem_url && (
        <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
          <img
            src={card._imagem_url}
            alt=""
            style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 6, border: `1px solid ${BORDER}`, display: 'block' }}
          />
        </div>
      )}

      {canManage && card._source === 'db' && (
        <div
          style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${BORDER}` }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onEdit}
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 5, border: `1px solid ${BORDER}`,
              background: '#F0F4FA', color: PRIMARY, cursor: 'pointer', fontWeight: 600,
            }}
          >
            ✎ Editar
          </button>
          <button
            onClick={onDelete}
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid #FCA5A5',
              background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontWeight: 600,
            }}
          >
            🗑 Excluir
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Column Component ──────────────────────────────────────────────────────────

function ObsColumn({
  col, catKey, subtabKey, search, copiedId, onCopy,
  papel, onAdd, onEdit, onDelete,
}: {
  col: ColumnUI
  catKey: string
  subtabKey: string
  search: string
  copiedId: string | null
  onCopy: (id: string, text: string) => void
  papel: string
  onAdd: (coluna: string, subtabKey: string) => void
  onEdit: (id: string, motivo: string, parecer: string, coluna: string, subtabKey: string, imagemUrl: string) => void
  onDelete: (id: string) => void
}) {
  const { ungrouped, groups } = useMemo(() => {
    const ungrouped: { card: CardUI; idx: number }[] = []
    const groups: Map<string, { card: CardUI; idx: number }[]> = new Map()

    col.cards.forEach((card, idx) => {
      if (!matchesSearch(card, search)) return
      if (card.group) {
        const existing = groups.get(card.group) ?? []
        existing.push({ card, idx })
        groups.set(card.group, existing)
      } else {
        ungrouped.push({ card, idx })
      }
    })
    return { ungrouped, groups }
  }, [col.cards, search])

  const totalVisible = ungrouped.length + Array.from(groups.values()).reduce((s, g) => s + g.length, 0)
  const canManage = ['gestor', 'admin'].includes(papel)
  const canAdd = ['colaborador', 'gestor', 'admin'].includes(papel)

  if (totalVisible === 0 && search) return null

  const headerBg = col.isFixed
    ? `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`
    : `linear-gradient(135deg, ${PRIMARY} 0%, #1E3A6E 100%)`

  return (
    <div style={{
      background: BG_CARD,
      border: `2px solid ${col.isFixed ? ACCENT : PRIMARY}`,
      borderRadius: 10,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: col.isFixed
        ? '0 2px 8px rgba(209,174,110,0.18)'
        : '0 2px 8px rgba(42,79,150,0.10)',
      overflow: 'visible',
    }}>
      {/* Header */}
      <div style={{
        background: headerBg, padding: '10px 14px',
        borderRadius: '8px 8px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.2 }}>
            {col.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
            background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 20, padding: '1px 8px', fontVariantNumeric: 'tabular-nums',
          }}>
            {totalVisible}
          </span>
          {canAdd && (
            <button
              onClick={() => onAdd(col.title, subtabKey)}
              title="Nova observação"
              style={{
                fontSize: 15, lineHeight: 1, fontWeight: 700,
                color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.35)', borderRadius: 6,
                width: 24, height: 24, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              ＋
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ungrouped.map(({ card, idx }) => {
          const id = cardId(catKey, subtabKey, col.title, idx)
          return (
            <ObsCard
              key={card._id ?? id}
              card={card}
              id={id}
              isCopied={copiedId === id}
              onCopy={onCopy}
              search={search}
              canManage={canManage}
              isFixed={col.isFixed}
              onEdit={() => card._id && onEdit(card._id, card.motivo, card.parecer, col.title, subtabKey, card._imagem_url ?? '')}
              onDelete={() => card._id && onDelete(card._id)}
            />
          )
        })}

        {Array.from(groups.entries()).map(([groupName, items]) => (
          <div key={groupName}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase',
              letterSpacing: '0.08em', padding: '4px 0 4px', borderBottom: `1px solid ${BORDER}`,
              marginBottom: 6,
            }}>
              {groupName}
            </div>
            {items.map(({ card, idx }) => {
              const id = cardId(catKey, subtabKey, col.title, idx)
              return (
                <ObsCard
                  key={card._id ?? id}
                  card={card}
                  id={id}
                  isCopied={copiedId === id}
                  onCopy={onCopy}
                  search={search}
                  canManage={canManage}
                  isFixed={col.isFixed}
                  onEdit={() => card._id && onEdit(card._id, card.motivo, card.parecer, col.title, subtabKey, card._imagem_url ?? '')}
                  onDelete={() => card._id && onDelete(card._id)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Modal Components ──────────────────────────────────────────────────────────

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(30,37,61,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      {children}
    </div>
  )
}

// ─── Main Client Component ─────────────────────────────────────────────────────

export default function ObservacoesClient() {
  const { profile } = useUser()
  const papel = profile?.papel ?? 'colaborador'

  const [activeCatKey, setActiveCatKey] = useState<string>(CATEGORIES[0]?.key ?? '')
  const [activeSubtabKey, setActiveSubtabKey] = useState<string>(CATEGORIES[0]?.subtabs[0]?.key ?? '')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const colScrollRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const phantomRef = useRef<HTMLDivElement>(null)
  const scrollSyncRef = useRef(false)

  const [dbObs, setDbObs] = useState<DbObservacao[]>([])
  const [dbSubtabs, setDbSubtabs] = useState<DbSubtab[]>([])
  const [modal, setModal] = useState<ModalState>(MODAL_INIT)
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false })
  const [subtabModal, setSubtabModal] = useState<SubtabModal>({ open: false, name: '', saving: false, error: '' })

  // Fetch DB observations and dynamic subtabs whenever category changes
  useEffect(() => {
    if (!activeCatKey) return
    const cat = encodeURIComponent(activeCatKey)
    fetch(`/api/observacoes?categoria=${cat}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setDbObs(data))
      .catch(() => {})
    fetch(`/api/observacoes/subtabs?categoria=${cat}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setDbSubtabs(data))
      .catch(() => {})
  }, [activeCatKey])

  // Sync top scroll mirror ↔ column scroll body
  useEffect(() => {
    const top = topScrollRef.current
    const body = colScrollRef.current
    if (!top || !body) return
    const onTop = () => {
      if (scrollSyncRef.current) return
      scrollSyncRef.current = true
      body.scrollLeft = top.scrollLeft
      scrollSyncRef.current = false
    }
    const onBody = () => {
      if (scrollSyncRef.current) return
      scrollSyncRef.current = true
      top.scrollLeft = body.scrollLeft
      scrollSyncRef.current = false
    }
    top.addEventListener('scroll', onTop, { passive: true })
    body.addEventListener('scroll', onBody, { passive: true })
    return () => {
      top.removeEventListener('scroll', onTop)
      body.removeEventListener('scroll', onBody)
    }
  }, [])

  const activeCategory = useMemo<Category | undefined>(
    () => CATEGORIES.find(c => c.key === activeCatKey),
    [activeCatKey]
  )

  const allSubtabs = useMemo(() => {
    const staticSubs = activeCategory?.subtabs ?? []
    const staticKeys = new Set(staticSubs.map(s => s.key))
    const dynSubs = dbSubtabs
      .filter(ds => !staticKeys.has(ds.subtab))
      .map(ds => ({ key: ds.subtab, columns: [{ title: ds.subtab, cards: [] as Card[], isFixed: false }] }))
    return [...staticSubs, ...dynSubs]
  }, [activeCategory, dbSubtabs])

  const activeSubtab = useMemo(
    () => allSubtabs.find(s => s.key === activeSubtabKey) ?? allSubtabs[0],
    [allSubtabs, activeSubtabKey]
  )

  const mainCols = useMemo(
    () => activeSubtab?.columns.filter(c => !c.isFixed) ?? [],
    [activeSubtab]
  )
  const fixedCols = useMemo(
    () => activeSubtab?.columns.filter(c => c.isFixed) ?? [],
    [activeSubtab]
  )

  const dbObsForSubtab = useMemo(
    () => dbObs.filter(o => o.subtab === (activeSubtab?.key ?? '')),
    [dbObs, activeSubtab]
  )

  const mergedMainCols = useMemo(
    () => mainCols.map(col => buildColumnUI(col, dbObsForSubtab)),
    [mainCols, dbObsForSubtab]
  )
  const mergedFixedCols = useMemo(
    () => fixedCols.map(col => buildColumnUI(col, dbObsForSubtab)),
    [fixedCols, dbObsForSubtab]
  )

  const totalResults = useMemo(() => {
    if (!search) return null
    return [...mergedMainCols, ...mergedFixedCols].reduce(
      (sum, col) => sum + col.cards.filter(c => matchesSearch(c, search)).length, 0
    )
  }, [mergedMainCols, mergedFixedCols, search])

  // Keep phantom width in sync with actual scroll width (after mergedCols are computed)
  useEffect(() => {
    const body = colScrollRef.current
    const phantom = phantomRef.current
    if (!body || !phantom) return
    const id = requestAnimationFrame(() => {
      phantom.style.width = body.scrollWidth + 'px'
    })
    return () => cancelAnimationFrame(id)
  }, [mergedMainCols, mergedFixedCols, activeSubtabKey])

  const handleCatChange = useCallback((key: string) => {
    const cat = CATEGORIES.find(c => c.key === key)
    setActiveCatKey(key)
    setActiveSubtabKey(cat?.subtabs[0]?.key ?? '')
    setDbSubtabs([])
    setSearch('')
  }, [])

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
    setCopiedId(id)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 1600)
  }, [])

  useEffect(() => {
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current) }
  }, [])

  // ── CRUD handlers ─────────────────────────────────────────────────────────────

  const handleAdd = useCallback((coluna: string, subtabKey: string) => {
    setModal({ ...MODAL_INIT, open: true, mode: 'create', coluna, subtabKey })
  }, [])

  const handleEditOpen = useCallback((id: string, motivo: string, parecer: string, coluna: string, subtabKey: string, imagemUrl: string) => {
    if (modal.imagemPreview.startsWith('blob:')) URL.revokeObjectURL(modal.imagemPreview)
    setModal({ open: true, mode: 'edit', coluna, subtabKey, editingId: id, motivo, parecerBody: parecer, imagemUrl, imagemFile: null, imagemPreview: imagemUrl, saving: false })
  }, [modal.imagemPreview])

  const handleDeleteRequest = useCallback((id: string) => {
    setConfirm({ open: true, type: 'delete', id })
  }, [])

  function buildParecer(): string {
    return papel === 'colaborador'
      ? 'Favor rever: ' + modal.parecerBody
      : modal.parecerBody
  }

  function closeModal() {
    if (modal.imagemPreview.startsWith('blob:')) URL.revokeObjectURL(modal.imagemPreview)
    setModal(MODAL_INIT)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (modal.imagemPreview.startsWith('blob:')) URL.revokeObjectURL(modal.imagemPreview)
    const preview = URL.createObjectURL(file)
    setModal(m => ({ ...m, imagemFile: file, imagemPreview: preview, imagemUrl: '' }))
    e.target.value = ''
  }

  function handleRemoveImage() {
    if (modal.imagemPreview.startsWith('blob:')) URL.revokeObjectURL(modal.imagemPreview)
    setModal(m => ({ ...m, imagemFile: null, imagemPreview: '', imagemUrl: '' }))
  }

  async function uploadImageIfNeeded(): Promise<string | null> {
    if (!modal.imagemFile) return modal.imagemUrl || null
    const fd = new FormData()
    fd.append('file', modal.imagemFile)
    const res = await fetch('/api/observacoes/upload', { method: 'POST', body: fd })
    if (!res.ok) return null
    const { url } = await res.json()
    return url as string
  }

  async function handleSave() {
    if (!modal.motivo.trim() || !modal.parecerBody.trim()) return

    if (modal.mode === 'edit') {
      setModal(m => ({ ...m, saving: true }))
      const imagemUrl = await uploadImageIfNeeded()
      setModal(m => ({ ...m, saving: false }))
      setConfirm({ open: true, type: 'edit', id: modal.editingId!, motivo: modal.motivo.trim(), parecer: buildParecer(), imagemUrl })
      return
    }

    setModal(m => ({ ...m, saving: true }))
    const imagemUrl = await uploadImageIfNeeded()
    const res = await fetch('/api/observacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoria: activeCatKey,
        subtab: modal.subtabKey,
        coluna: modal.coluna,
        motivo: modal.motivo.trim(),
        parecer: buildParecer(),
        imagem_url: imagemUrl,
      }),
    })
    if (res.ok) {
      const created: DbObservacao = await res.json()
      setDbObs(prev => [...prev, created])
      closeModal()
    } else {
      setModal(m => ({ ...m, saving: false }))
    }
  }

  async function doConfirmEdit() {
    if (!confirm.open || confirm.type !== 'edit') return
    const { id, motivo, parecer, imagemUrl } = confirm
    setConfirm({ open: false })
    setModal(m => ({ ...m, saving: true }))
    const res = await fetch(`/api/observacoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo, parecer, imagem_url: imagemUrl }),
    })
    if (res.ok) {
      const updated: DbObservacao = await res.json()
      setDbObs(prev => prev.map(o => o.id === updated.id ? updated : o))
      closeModal()
    } else {
      setModal(m => ({ ...m, saving: false }))
    }
  }

  async function doConfirmDelete() {
    if (!confirm.open || confirm.type !== 'delete') return
    const { id } = confirm
    setConfirm({ open: false })
    const res = await fetch(`/api/observacoes/${id}`, { method: 'DELETE' })
    if (res.ok) setDbObs(prev => prev.filter(o => o.id !== id))
  }

  const canManageSubtabs = ['gestor', 'admin'].includes(papel)
  const hasSubtabs = allSubtabs.length > 1 || canManageSubtabs

  async function handleCreateSubtab() {
    const name = subtabModal.name.trim()
    if (!name) return
    setSubtabModal(s => ({ ...s, saving: true, error: '' }))
    const res = await fetch('/api/observacoes/subtabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: activeCatKey, subtab: name }),
    })
    if (res.ok) {
      const created: DbSubtab = await res.json()
      setDbSubtabs(prev => [...prev, created])
      setActiveSubtabKey(created.subtab)
      setSubtabModal({ open: false, name: '', saving: false, error: '' })
    } else {
      const body = await res.json().catch(() => ({}))
      setSubtabModal(s => ({ ...s, saving: false, error: body.error ?? 'Erro ao criar subcategoria' }))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Create / Edit Modal ─────────────────────────── */}
      {modal.open && (
        <Backdrop>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
            boxShadow: '0 20px 60px rgba(30,37,61,0.2)', overflow: 'hidden',
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${PRIMARY} 0%, #1E3A6E 100%)`,
              padding: '16px 20px',
            }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                {modal.mode === 'create' ? '＋ Nova Observação' : '✎ Editar Observação'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                {modal.coluna}
              </p>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: 'block', marginBottom: 6 }}>
                  Imagem (opcional)
                </label>
                {modal.imagemPreview ? (
                  <div>
                    <img
                      src={modal.imagemPreview}
                      alt=""
                      style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 8, border: `1px solid ${BORDER}`, display: 'block', marginBottom: 6 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <label style={{
                        padding: '4px 10px', borderRadius: 6, border: `1px solid ${BORDER}`,
                        background: '#F0F4FA', color: INK, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                      }}>
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
                        Trocar
                      </label>
                      <button
                        onClick={handleRemoveImage}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5',
                          background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '16px 12px', border: `2px dashed ${BORDER}`, borderRadius: 8,
                    cursor: 'pointer', color: MUTED, fontSize: 12, transition: 'border-color 0.15s',
                  }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
                    <span style={{ fontSize: 22 }}>🖼</span>
                    <span>Clique para adicionar uma imagem</span>
                  </label>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: 'block', marginBottom: 6 }}>
                  Tag / Motivo
                </label>
                <input
                  type="text"
                  value={modal.motivo}
                  onChange={e => setModal(m => ({ ...m, motivo: e.target.value }))}
                  placeholder="Ex: Outro coordenador"
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                    border: `1.5px solid ${BORDER}`, outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'inherit', color: INK,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: 'block', marginBottom: 6 }}>
                  Observação
                </label>
                {papel === 'colaborador' ? (
                  <div style={{
                    border: `1.5px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden',
                    background: '#fff',
                  }}>
                    <div style={{
                      padding: '8px 12px 4px', fontSize: 12, fontWeight: 700,
                      color: PRIMARY, background: PRIMARY_LIGHT, borderBottom: `1px solid ${BORDER}`,
                    }}>
                      Favor rever:
                    </div>
                    <textarea
                      value={modal.parecerBody}
                      onChange={e => setModal(m => ({ ...m, parecerBody: e.target.value }))}
                      placeholder="Continue aqui…"
                      rows={4}
                      style={{
                        width: '100%', padding: '8px 12px', border: 'none', outline: 'none',
                        fontSize: 13, resize: 'vertical', fontFamily: 'inherit', color: INK,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ) : (
                  <textarea
                    value={modal.parecerBody}
                    onChange={e => setModal(m => ({ ...m, parecerBody: e.target.value }))}
                    placeholder="Texto da observação…"
                    rows={4}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                      border: `1.5px solid ${BORDER}`, outline: 'none', resize: 'vertical',
                      fontFamily: 'inherit', color: INK, boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            </div>

            <div style={{
              padding: '12px 20px', borderTop: `1px solid ${BORDER}`,
              display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${BORDER}`,
                  background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={modal.saving || !modal.motivo.trim() || !modal.parecerBody.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: modal.saving ? MUTED : PRIMARY, color: '#fff',
                  fontSize: 13, cursor: modal.saving ? 'not-allowed' : 'pointer', fontWeight: 700,
                  opacity: (!modal.motivo.trim() || !modal.parecerBody.trim()) ? 0.5 : 1,
                }}
              >
                {modal.saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </Backdrop>
      )}

      {/* ── Confirm Dialog ──────────────────────────────── */}
      {confirm.open && (
        <Backdrop>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 380,
            boxShadow: '0 20px 60px rgba(30,37,61,0.2)', padding: 24,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>
                {confirm.type === 'delete' ? 'Confirmar exclusão' : 'Confirmar edição'}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                {confirm.type === 'delete'
                  ? 'Esta ação não pode ser desfeita. Confirma a exclusão?'
                  : 'Tem certeza que deseja editar esta observação?'}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setConfirm({ open: false })}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${BORDER}`,
                  background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirm.type === 'delete' ? doConfirmDelete : doConfirmEdit}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: confirm.type === 'delete' ? '#DC2626' : PRIMARY,
                  color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700,
                }}
              >
                {confirm.type === 'delete' ? 'Excluir' : 'Confirmar'}
              </button>
            </div>
          </div>
        </Backdrop>
      )}

      {/* ── Subtab Creation Modal ──────────────────────── */}
      {subtabModal.open && (
        <Backdrop>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 400,
            boxShadow: '0 20px 60px rgba(30,37,61,0.2)', overflow: 'hidden',
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${PRIMARY} 0%, #1E3A6E 100%)`,
              padding: '16px 20px',
            }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                ＋ Nova Subcategoria
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                {activeCatKey}
              </p>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: 'block', marginBottom: 6 }}>
                  Nome da subcategoria
                </label>
                <input
                  type="text"
                  value={subtabModal.name}
                  onChange={e => setSubtabModal(s => ({ ...s, name: e.target.value, error: '' }))}
                  onKeyDown={e => e.key === 'Enter' && handleCreateSubtab()}
                  placeholder="Ex: Contrato de Experiência"
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                    border: `1.5px solid ${subtabModal.error ? '#EF4444' : BORDER}`,
                    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: INK,
                  }}
                />
                {subtabModal.error && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#DC2626' }}>{subtabModal.error}</p>
                )}
              </div>
            </div>
            <div style={{
              padding: '12px 20px', borderTop: `1px solid ${BORDER}`,
              display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button
                onClick={() => setSubtabModal({ open: false, name: '', saving: false, error: '' })}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${BORDER}`,
                  background: '#fff', color: INK, fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateSubtab}
                disabled={subtabModal.saving || !subtabModal.name.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: subtabModal.saving ? MUTED : PRIMARY, color: '#fff',
                  fontSize: 13, cursor: subtabModal.saving ? 'not-allowed' : 'pointer', fontWeight: 700,
                  opacity: !subtabModal.name.trim() ? 0.5 : 1,
                }}
              >
                {subtabModal.saving ? 'Criando…' : 'Criar'}
              </button>
            </div>
          </div>
        </Backdrop>
      )}

      {/* ── Main layout ─────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0,
        minHeight: 'calc(100vh - 140px)', borderRadius: 10, overflow: 'clip',
        border: `1px solid ${BORDER}`, boxShadow: '0 1px 6px rgba(30,37,61,0.06)',
      }}>
        {/* ── Internal category nav ──────────────────────── */}
        <nav style={{
          background: '#fff', borderRight: `1px solid ${BORDER}`,
          padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase',
            letterSpacing: '0.12em', padding: '0 10px 10px',
          }}>
            Categorias
          </div>

          {CATEGORIES.map(cat => {
            const isActive = cat.key === activeCatKey
            return (
              <button
                key={cat.key}
                onClick={() => handleCatChange(cat.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px',
                  borderRadius: 8, border: 'none',
                  background: isActive ? PRIMARY_LIGHT : 'transparent',
                  color: isActive ? PRIMARY : INK, fontSize: 13,
                  fontWeight: isActive ? 700 : 400, cursor: 'pointer',
                  textAlign: 'left', width: '100%', transition: 'background 0.15s, color 0.15s',
                  borderLeft: `3px solid ${isActive ? PRIMARY : 'transparent'}`, position: 'relative',
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{cat.icon}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                  {cat.label}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                  background: isActive ? PRIMARY : '#F0F4FA',
                  color: isActive ? '#fff' : MUTED,
                  border: `1px solid ${isActive ? PRIMARY : BORDER}`,
                  flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                }}>
                  {cat.totalCards}
                </span>
              </button>
            )
          })}
        </nav>

        {/* ── Content area ───────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: BG_PAGE, minWidth: 0 }}>

          {/* Subtabs bar */}
          {hasSubtabs && (
            <div style={{
              background: '#fff', borderBottom: `1px solid ${BORDER}`,
              padding: '10px 20px', display: 'flex', gap: 6, flexWrap: 'wrap',
              alignItems: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 6 }}>
                Subcat.:
              </span>
              {allSubtabs.map(st => {
                const isActive = st.key === (activeSubtab?.key ?? '')
                const isDynamic = !activeCategory?.subtabs.find(s => s.key === st.key)
                return (
                  <button
                    key={st.key}
                    onClick={() => setActiveSubtabKey(st.key)}
                    style={{
                      padding: '6px 14px', borderRadius: 20,
                      border: `1.5px solid ${isActive ? PRIMARY : isDynamic ? ACCENT : BORDER}`,
                      background: isActive ? PRIMARY : '#fff',
                      color: isActive ? '#fff' : isDynamic ? ACCENT_DARK : MUTED, fontSize: 12,
                      fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                      transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                  >
                    {st.key}
                  </button>
                )
              })}
              {canManageSubtabs && (
                <button
                  onClick={() => setSubtabModal({ open: true, name: '', saving: false, error: '' })}
                  style={{
                    padding: '6px 12px', borderRadius: 20,
                    border: `1.5px dashed ${BORDER}`,
                    background: 'transparent', color: MUTED, fontSize: 12,
                    fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                >
                  ＋ Nova subcategoria
                </button>
              )}
            </div>
          )}

          {/* Search + stat bar */}
          <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: MUTED, fontSize: 14, pointerEvents: 'none',
              }}>🔍</span>
              <input
                type="text"
                placeholder="Buscar observações…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '9px 14px 9px 36px', background: '#fff',
                  border: `1.5px solid ${search ? PRIMARY : BORDER}`, borderRadius: 8,
                  fontSize: 13, color: INK, outline: 'none',
                  boxShadow: search ? `0 0 0 3px ${PRIMARY_LIGHT}` : '0 1px 3px rgba(30,37,61,0.05)',
                  transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: '#F0F4FA', border: `1px solid ${BORDER}`, borderRadius: 5,
                    width: 20, height: 20, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', fontSize: 10, color: MUTED, fontWeight: 700,
                  }}
                >✕</button>
              )}
            </div>
            {search && totalResults !== null && (
              <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                <strong style={{ color: PRIMARY }}>{totalResults}</strong> resultado{totalResults !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Columns grid */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* Top scroll mirror — scrollbar appears above column headers */}
            <div
              ref={topScrollRef}
              style={{ overflowX: 'auto', overflowY: 'hidden', height: 10, flexShrink: 0 }}
            >
              <div ref={phantomRef} style={{ height: 1 }} />
            </div>

            {/* Actual columns scroll container */}
            <div ref={colScrollRef} style={{ overflowX: 'auto', flex: 1, padding: '0 0 32px' }}>
              {activeSubtab ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '0 20px' }}>
                  {mergedMainCols.map(col => (
                    <div key={`${activeSubtab.key}|${col.title}`} style={{ flex: '1 0 280px' }}>
                      <ObsColumn
                        col={col}
                        catKey={activeCatKey}
                        subtabKey={activeSubtab.key}
                        search={search}
                        copiedId={copiedId}
                        onCopy={handleCopy}
                        papel={papel}
                        onAdd={handleAdd}
                        onEdit={handleEditOpen}
                        onDelete={handleDeleteRequest}
                      />
                    </div>
                  ))}
                  {mergedFixedCols.map(col => (
                    <div
                      key={`${activeSubtab.key}|${col.title}`}
                      style={{
                        flex: '0 0 280px',
                        position: 'sticky',
                        right: 0,
                        zIndex: 10,
                        background: BG_CARD,
                        paddingLeft: 4,
                        boxShadow: '-6px 0 18px rgba(30,37,61,0.08)',
                      }}
                    >
                      <ObsColumn
                        col={col}
                        catKey={activeCatKey}
                        subtabKey={activeSubtab.key}
                        search={search}
                        copiedId={copiedId}
                        onCopy={handleCopy}
                        papel={papel}
                        onAdd={handleAdd}
                        onEdit={handleEditOpen}
                        onDelete={handleDeleteRequest}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: MUTED, fontSize: 14, padding: 32, textAlign: 'center' }}>
                  Selecione uma categoria.
                </div>
              )}

              {search && totalResults === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: MUTED }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>
                    Nenhum resultado para "{search}"
                  </div>
                  <div style={{ fontSize: 13 }}>Tente outros termos ou limpe a busca.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
