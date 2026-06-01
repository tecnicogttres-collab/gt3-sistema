'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { CATEGORIES, type Category, type Card } from './data'
import { useUser } from '../components/UserContext'
import { ObsColumn, matchesSearch, cardId } from './ObsCardGrid'
import type { CardUI, ColumnUI } from './ObsCardGrid'
import { ObsImageModal } from './ObsImageModal'

// Remove todos os diacríticos e normaliza para ASCII comparável
function _ascii(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}
// Colunas/subtabs que são repositório puro de imagem — comparação sem acentos
const _IMAGE_ONLY_ASCII = [
  ...new Set([
    ...CATEGORIES.flatMap(cat =>
      cat.subtabs.flatMap(s => s.columns.filter(c => c.imageOnly).map(c => _ascii(c.title)))
    ),
    'informacoes nr', 'referencias nr', // fallback explícito
  ])
]
function isImageOnlyColuna(coluna: string): boolean {
  return _IMAGE_ONLY_ASCII.includes(_ascii(coluna))
}

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const ACCENT = '#D1AE6E'
const ACCENT_DARK = '#B8922A'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const BG_CARD = '#FFFFFF'
const BG_PAGE = '#F4F6FA'

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
  atualizado_por: string | null
  atualizado_em: string | null
  status_edicao: 'original' | 'pendente_validacao' | 'validado' | null
  atualizado_por_profile: { nome: string } | null
  created_at: string
  updated_at: string
}

function buildColumnUI(col: { title: string; isFixed?: boolean; imageOnly?: boolean; cards: Card[] }, dbRows: DbObservacao[]): ColumnUI {
  const colDbRows = dbRows.filter(o => o.coluna === col.title)

  function toCardUI(o: DbObservacao, staticFallback?: Card): CardUI {
    return {
      motivo: o.motivo,
      parecer: o.parecer,
      group: o.group_name ?? staticFallback?.group ?? undefined,
      _id: o.id,
      _source: 'db' as const,
      _imagem_url: o.imagem_url ?? undefined,
      _atualizado_por: o.atualizado_por,
      _atualizado_em: o.atualizado_em,
      _status_edicao: o.status_edicao,
      _atualizado_por_nome: o.atualizado_por_profile?.nome ?? null,
    }
  }

  const dbByMotivo = new Map<string, DbObservacao>()
  const dbOrphan: DbObservacao[] = []
  for (const row of colDbRows) {
    if (col.cards.some(c => c.motivo === row.motivo)) {
      dbByMotivo.set(row.motivo, row)
    } else {
      dbOrphan.push(row)
    }
  }

  const cards: CardUI[] = col.cards.map(c => {
    const override = dbByMotivo.get(c.motivo)
    return override ? toCardUI(override, c) : { ...c, _source: 'static' as const, _imagem_url: c.imagem_url }
  })

  for (const row of dbOrphan) {
    cards.push(toCardUI(row))
  }

  return { ...col, cards }
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
  imageOnly: boolean
  uploadError: string
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
  imageOnly: false, uploadError: '', saving: false,
}

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

export default function ObservacoesClient() {
  const { profile } = useUser()
  const papel = profile?.papel ?? 'colaborador'

  const [activeCatKey, setActiveCatKey] = useState<string>(CATEGORIES[0]?.key ?? '')
  const [activeSubtabKey, setActiveSubtabKey] = useState<string>(CATEGORIES[0]?.subtabs[0]?.key ?? '')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const colsScrollRef = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)

  const [dbObs, setDbObs] = useState<DbObservacao[]>([])
  const [dbSubtabs, setDbSubtabs] = useState<DbSubtab[]>([])
  const [modal, setModal] = useState<ModalState>(MODAL_INIT)
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false })
  const [subtabModal, setSubtabModal] = useState<SubtabModal>({ open: false, name: '', saving: false, error: '' })

  useEffect(() => {
    if (!activeCatKey) return
    let cancelled = false
    const cat = encodeURIComponent(activeCatKey)
    fetch(`/api/observacoes?categoria=${cat}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setDbObs(data) })
      .catch(() => {})
    fetch(`/api/observacoes/subtabs?categoria=${cat}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: DbSubtab[]) => {
        if (cancelled) return
        // Remove automaticamente subtabs dinâmicos que conflitam com colunas estáticas (ex: Informações NR)
        const toDelete = data.filter(ds => _IMAGE_ONLY_ASCII.includes(_ascii(ds.subtab)))
        toDelete.forEach(ds => {
          fetch(`/api/observacoes/subtabs?categoria=${encodeURIComponent(ds.categoria)}&subtab=${encodeURIComponent(ds.subtab)}`, { method: 'DELETE' }).catch(() => {})
        })
        setDbSubtabs(data.filter(ds => !_IMAGE_ONLY_ASCII.includes(_ascii(ds.subtab))))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeCatKey])

  useEffect(() => {
    if (activeCatKey === 'Funcionários') return

    const top = topScrollRef.current
    const cols = colsScrollRef.current
    if (!top || !cols) return

    let isSyncing = false

    const syncFromTop = () => {
      if (isSyncing) return
      isSyncing = true
      cols.scrollLeft = top.scrollLeft
      isSyncing = false
    }

    const syncFromCols = () => {
      if (isSyncing) return
      isSyncing = true
      top.scrollLeft = cols.scrollLeft
      isSyncing = false
    }

    top.addEventListener('scroll', syncFromTop)
    cols.addEventListener('scroll', syncFromCols)

    return () => {
      top.removeEventListener('scroll', syncFromTop)
      cols.removeEventListener('scroll', syncFromCols)
    }
  }, [activeCatKey])

  const activeCategory = useMemo<Category | undefined>(
    () => CATEGORIES.find(c => c.key === activeCatKey),
    [activeCatKey]
  )

  const allSubtabs = useMemo(() => {
    const staticSubs = activeCategory?.subtabs ?? []
    const staticKeys = new Set(staticSubs.map(s => s.key))
    // Também filtra subtabs dinâmicos cujo nome coincide com o título de uma coluna estática
    // (evita duplicatas como "Informações NR" quando já existe como coluna em "Referências NR")
    const staticColTitles = new Set(staticSubs.flatMap(s => s.columns.map(c => _ascii(c.title))))
    const dynSubs = dbSubtabs
      .filter(ds =>
        !staticKeys.has(ds.subtab) &&
        !staticColTitles.has(_ascii(ds.subtab)) &&
        !_IMAGE_ONLY_ASCII.includes(_ascii(ds.subtab))
      )
      .map(ds => {
        const imageOnly = isImageOnlyColuna(ds.subtab)
        return { key: ds.subtab, columns: [{ title: ds.subtab, cards: [] as Card[], isFixed: false, imageOnly }] }
      })
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
  const colWidth = isImageOnlyColuna(activeSubtab?.key ?? '') ? 520
    : ['Ficha Registro + ASO', 'EPI + Treinamentos'].includes(activeSubtab?.key ?? '') ? 580
    : 320

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

  const funcFixedMergedCol = useMemo<ColumnUI | null>(() => {
    if (mergedFixedCols.length === 0) return null
    if (mergedFixedCols.length === 1) return mergedFixedCols[0]
    const first = mergedFixedCols[0]
    const rest = mergedFixedCols.slice(1)
    const mergedCards: CardUI[] = [
      ...first.cards,
      ...rest.flatMap(col =>
        col.cards.map(card => ({ ...card, group: card.group ?? col.title }))
      ),
    ]
    return { ...first, cards: mergedCards }
  }, [mergedFixedCols])

  const totalResults = useMemo(() => {
    if (!search) return null
    return [...mergedMainCols, ...mergedFixedCols].reduce(
      (sum, col) => sum + col.cards.filter(c => matchesSearch(c, search)).length, 0
    )
  }, [mergedMainCols, mergedFixedCols, search])

  useEffect(() => {
    const cols = colsScrollRef.current
    const spacer = spacerRef.current
    if (!cols || !spacer) return
    const update = () => {
      spacer.style.width = cols.scrollWidth + 'px'
    }
    const id = requestAnimationFrame(update)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(cols)
    return () => {
      cancelAnimationFrame(id)
      ro?.disconnect()
    }
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

  const handleAdd = useCallback((coluna: string, subtabKey: string) => {
    const sub = allSubtabs.find(s => s.key === subtabKey)
    const col = sub?.columns.find(c => c.title === coluna)
    const imageOnly = col?.imageOnly === true || isImageOnlyColuna(coluna)
    setModal({ ...MODAL_INIT, open: true, mode: 'create', coluna, subtabKey, imageOnly })
  }, [allSubtabs])

  const handleEditOpen = useCallback((id: string, motivo: string, parecer: string, coluna: string, subtabKey: string, imagemUrl: string) => {
    if (modal.imagemPreview.startsWith('blob:')) URL.revokeObjectURL(modal.imagemPreview)
    setModal({ open: true, mode: 'edit', coluna, subtabKey, editingId: id, motivo, parecerBody: parecer, imagemUrl, imagemFile: null, imagemPreview: imagemUrl, imageOnly: false, uploadError: '', saving: false })
  }, [modal.imagemPreview])

  const handleDeleteRequest = useCallback((id: string) => {
    setConfirm({ open: true, type: 'delete', id })
  }, [])

  const handleInlineCreate = useCallback(async (catKey: string, subtabKey: string, coluna: string, motivo: string, parecer: string) => {
    const res = await fetch('/api/observacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: catKey, subtab: subtabKey, coluna, motivo, parecer, status_edicao: 'pendente_validacao' }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    const created: DbObservacao = await res.json()
    setDbObs(prev => [...prev, {
      ...created,
      atualizado_por_profile: created.atualizado_por ? { nome: profile?.nome ?? '' } : null,
    }])
  }, [profile])

  const handleInlineSave = useCallback(async (id: string, parecer: string) => {
    const res = await fetch(`/api/observacoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parecer }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    const updated: DbObservacao = await res.json()
    setDbObs(prev => prev.map(o => o.id === updated.id ? updated : o))
  }, [])

  const handleValidate = useCallback(async (id: string) => {
    const res = await fetch(`/api/observacoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate' }),
    })
    if (res.ok) {
      const updated: DbObservacao = await res.json()
      setDbObs(prev => prev.map(o => o.id === updated.id ? updated : o))
    }
  }, [])

  function buildParecer(): string {
    if (isImageOnlyColuna(modal.coluna)) return modal.parecerBody || ''
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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Falha ao fazer upload da imagem')
    }
    const { url } = await res.json()
    return url as string
  }

  async function handleSave() {
    const imageOnly = isImageOnlyColuna(modal.coluna)
    if (imageOnly) {
      if (!modal.imagemFile && !modal.imagemUrl) return
    } else {
      if (!modal.motivo.trim() || !modal.parecerBody.trim()) return
    }
    const motivo = imageOnly
      ? (modal.imagemFile?.name.replace(/\.[^.]+$/, '') ?? `imagem-${Date.now()}`)
      : modal.motivo.trim()

    if (modal.mode === 'edit') {
      setModal(m => ({ ...m, saving: true, uploadError: '' }))
      let imagemUrl: string | null
      try {
        imagemUrl = await uploadImageIfNeeded()
      } catch (e) {
        setModal(m => ({ ...m, saving: false, uploadError: e instanceof Error ? e.message : 'Erro no upload' }))
        return
      }
      setModal(m => ({ ...m, saving: false }))
      setConfirm({ open: true, type: 'edit', id: modal.editingId!, motivo, parecer: buildParecer(), imagemUrl })
      return
    }

    setModal(m => ({ ...m, saving: true, uploadError: '' }))
    let imagemUrl: string | null
    try {
      imagemUrl = await uploadImageIfNeeded()
    } catch (e) {
      setModal(m => ({ ...m, saving: false, uploadError: e instanceof Error ? e.message : 'Erro no upload' }))
      return
    }
    const res = await fetch('/api/observacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoria: activeCatKey,
        subtab: modal.subtabKey,
        coluna: modal.coluna,
        motivo,
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

  return (
    <>
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

            {isImageOnlyColuna(modal.coluna) ? (
              <div style={{ padding: 20 }}>
                <ObsImageModal
                  preview={modal.imagemPreview}
                  onFileSelect={handleFileSelect}
                  onRemove={handleRemoveImage}
                />
              </div>
            ) : (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: 'block', marginBottom: 6 }}>
                    Imagem (opcional)
                  </label>
                  <ObsImageModal
                    preview={modal.imagemPreview}
                    onFileSelect={handleFileSelect}
                    onRemove={handleRemoveImage}
                  />
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
            )}

            <div style={{
              padding: '12px 20px', borderTop: `1px solid ${BORDER}`,
              display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', alignItems: 'center',
            }}>
              {modal.uploadError && (
                <span style={{ flex: 1, fontSize: 12, color: '#DC2626' }}>⚠ {modal.uploadError}</span>
              )}
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
                disabled={modal.saving || (isImageOnlyColuna(modal.coluna)
                  ? (!modal.imagemFile && !modal.imagemUrl)
                  : (!modal.motivo.trim() || !modal.parecerBody.trim())
                )}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: modal.saving ? MUTED : PRIMARY, color: '#fff',
                  fontSize: 13, cursor: modal.saving ? 'not-allowed' : 'pointer', fontWeight: 700,
                  opacity: (isImageOnlyColuna(modal.coluna)
                    ? (!modal.imagemFile && !modal.imagemUrl)
                    : (!modal.motivo.trim() || !modal.parecerBody.trim())
                  ) ? 0.5 : 1,
                }}
              >
                {modal.saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </Backdrop>
      )}

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

      <div style={{
        display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0,
        minHeight: 'calc(100vh - 140px)', borderRadius: 10, overflow: 'clip',
        border: `1px solid ${BORDER}`, boxShadow: '0 1px 6px rgba(30,37,61,0.06)',
      }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', background: BG_PAGE, minWidth: 0 }}>

          {hasSubtabs && (
            <div style={{
              background: '#fff', borderBottom: `1px solid ${BORDER}`,
              padding: '10px 20px', display: 'flex', gap: 6, flexWrap: 'wrap',
              alignItems: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 6 }}>
                Subcat.:
              </span>
              {allSubtabs.filter(st =>
                // Oculta subtabs dinâmicos imageOnly que não são da lista estática
                !isImageOnlyColuna(st.key) || !!activeCategory?.subtabs.find(s => s.key === st.key)
              ).map(st => {
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

          {activeSubtab ? (
            activeCatKey === 'Funcionários' ? (
              <div style={{
                flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden',
                display: 'flex', flexDirection: 'row', alignItems: 'stretch',
                padding: '0 20px 20px', gap: 0,
              }}>
                <div
                  ref={colsScrollRef}
                  className="obs-hscroll-visible"
                  style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', paddingRight: 0 }}
                >
                  <div style={{ display: 'flex', flexDirection: 'row', gap: 16, height: '100%', width: 'max-content' }}>
                    {mergedMainCols.map(col => (
                      <div
                        key={`${activeSubtab.key}|${col.title}`}
                        style={{ width: colWidth, minWidth: colWidth, flexShrink: 0, height: '100%', backgroundColor: BG_CARD, borderRadius: 10 }}
                      >
                        <ObsColumn
                          col={col} catKey={activeCatKey} subtabKey={activeSubtab.key}
                          search={search} copiedId={copiedId} onCopy={handleCopy} papel={papel}
                          onAdd={handleAdd} onEdit={handleEditOpen} onDelete={handleDeleteRequest}
                          onInlineSave={handleInlineSave} onValidate={handleValidate} onInlineCreate={handleInlineCreate}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {funcFixedMergedCol && <div style={{ flexShrink: 0, width: 12 }} />}

                {funcFixedMergedCol && (
                  <div style={{ flexShrink: 0, width: 280, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <ObsColumn
                      col={funcFixedMergedCol} catKey={activeCatKey} subtabKey={activeSubtab.key}
                      search={search} copiedId={copiedId} onCopy={handleCopy} papel={papel}
                      onAdd={handleAdd} onEdit={handleEditOpen} onDelete={handleDeleteRequest}
                      onInlineSave={handleInlineSave} onValidate={handleValidate} onInlineCreate={handleInlineCreate}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                flex: 1, minHeight: 0, minWidth: 0,
                display: 'flex', flexDirection: 'column', padding: '0 20px 20px',
              }}>
                <div ref={topScrollRef} className="obs-scroll-top">
                  <div ref={spacerRef} style={{ height: 1 }} />
                </div>

                <div
                  ref={colsScrollRef}
                  className="obs-hscroll-hidden"
                  style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'row', gap: 16, height: '100%', width: 'max-content' }}>
                    {(activeSubtab.key === 'Certidões'
                      ? [...mergedFixedCols, ...mergedMainCols]
                      : [...mergedMainCols, ...mergedFixedCols]
                    ).map(col => (
                      <div
                        key={`${activeSubtab.key}|${col.title}`}
                        style={{ width: colWidth, minWidth: colWidth, flexShrink: 0, height: '100%' }}
                      >
                        <ObsColumn
                          col={col} catKey={activeCatKey} subtabKey={activeSubtab.key}
                          search={search} copiedId={copiedId} onCopy={handleCopy} papel={papel}
                          onAdd={handleAdd} onEdit={handleEditOpen} onDelete={handleDeleteRequest}
                          onInlineSave={handleInlineSave} onValidate={handleValidate} onInlineCreate={handleInlineCreate}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div style={{ flex: 1, color: MUTED, fontSize: 14, padding: 32, textAlign: 'center' }}>
              Selecione uma categoria.
            </div>
          )}

          {activeSubtab && search && totalResults === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: MUTED, flexShrink: 0 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>
                Nenhum resultado para &ldquo;{search}&rdquo;
              </div>
              <div style={{ fontSize: 13 }}>Tente outros termos ou limpe a busca.</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
