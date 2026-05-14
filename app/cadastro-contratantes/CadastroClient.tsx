'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Company, Field, SEGMENTS, SEGMENT_COLORS, ALL_KEY } from './types'
import seedJson from './seedData.json'

const SEED = seedJson as Company[]
const STORAGE_KEY = 'gt3_cadastro_v1'

function loadCompanies(): Company[] {
  if (typeof window === 'undefined') return SEED
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return SEED.map(c => ({ ...c, fields: c.fields.map(f => ({ ...f })) }))
}

function saveCompanies(companies: Company[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(companies)) } catch {}
}

function getContactName(c: Company) {
  const f = c.fields.find(x => x.type === 'text' && /CONTATO/i.test(x.label))
  return f && f.type === 'text' ? (f.value || '').split('\n')[0].trim() : ''
}

function getEmailFirst(c: Company) {
  const f = c.fields.find(x => x.type === 'text' && /E[- ]?MAIL/i.test(x.label))
  if (!f || f.type !== 'text') return ''
  return (f.value || '').split(/[\n;]/).map(s => s.trim()).filter(Boolean)[0] || ''
}

function getAuthTag(c: Company): { label: string; warn: boolean } | null {
  const f = c.fields.find(x => x.type === 'text' && /AUTORIZA/i.test(x.label))
  if (!f || f.type !== 'text' || !f.value) return null
  return /^sim/i.test(f.value.trim())
    ? { label: 'Autorizado', warn: false }
    : { label: 'Verificar', warn: true }
}

function companyMatches(c: Company, term: string) {
  if (!term) return true
  const blob = [
    c.name, c.segment,
    ...c.fields.map(f =>
      f.type === 'text'
        ? (f.label || '') + ' ' + (f.value || '')
        : (f.label || '') + ' ' + (f.headers || []).join(' ') + ' ' + (f.rows || []).map(r => r.join(' ')).join(' ')
    ),
  ].join(' ').toLowerCase()
  return blob.includes(term)
}

function todayBR() {
  return new Date().toLocaleDateString('pt-BR')
}

type EditTextModal = { open: true; idx: number; label: string; value: string } | { open: false }
type NewCompanyModal = { open: true; mode: 'create' } | { open: true; mode: 'segment'; currentSeg: string } | { open: false }

export default function CadastroClient() {
  const [hydrated, setHydrated] = useState(false)
  const [companies, setCompanies] = useState<Company[]>(SEED)
  const [activeSegment, setActiveSegment] = useState(ALL_KEY)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [editTextModal, setEditTextModal] = useState<EditTextModal>({ open: false })
  const [newCompanyModal, setNewCompanyModal] = useState<NewCompanyModal>({ open: false })
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanySeg, setNewCompanySeg] = useState<string>(SEGMENTS[0])
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCompanies(loadCompanies())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) saveCompanies(companies)
  }, [companies, hydrated])

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(text)
    toastTimer.current = setTimeout(() => setToast(null), 1400)
  }, [])

  const copyText = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    showToast('Copiado: ' + (text.length > 50 ? text.slice(0, 50) + '…' : text))
  }, [showToast])

  const updateCompany = useCallback((id: string, updater: (c: Company) => Company) => {
    setCompanies(prev => prev.map(c => c.id === id ? updater({ ...c }) : c))
  }, [])

  const currentCompany = companies.find(c => c.id === currentId) ?? null

  const term = searchTerm.trim().toLowerCase()

  const countBySegment = () => {
    const counts: Record<string, number> = { [ALL_KEY]: 0 }
    SEGMENTS.forEach(s => { counts[s] = 0 })
    companies.forEach(c => {
      if (term && !companyMatches(c, term)) return
      counts[ALL_KEY]++
      counts[c.segment] = (counts[c.segment] ?? 0) + 1
    })
    return counts
  }

  const counts = countBySegment()

  const visibleCompanies = companies
    .filter(c => activeSegment === ALL_KEY ? true : c.segment === activeSegment)
    .filter(c => companyMatches(c, term))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  // ── Field helpers ──────────────────────────────────────────────────────────

  const updateField = (idx: number, updater: (f: Field) => Field) => {
    if (!currentId) return
    updateCompany(currentId, c => ({
      ...c,
      fields: c.fields.map((f, i) => i === idx ? updater({ ...f } as Field) : f),
    }))
  }

  const moveField = (idx: number, dir: -1 | 1) => {
    if (!currentId) return
    updateCompany(currentId, c => {
      const fields = [...c.fields]
      const ni = idx + dir
      if (ni < 0 || ni >= fields.length) return c
      ;[fields[idx], fields[ni]] = [fields[ni], fields[idx]]
      return { ...c, fields }
    })
  }

  const removeField = (idx: number) => {
    if (!currentId || !currentCompany) return
    if (!confirm(`Excluir o campo "${currentCompany.fields[idx].label}"?`)) return
    updateCompany(currentId, c => ({ ...c, fields: c.fields.filter((_, i) => i !== idx) }))
  }

  const addField = (type: 'text' | 'table') => {
    if (!currentId) return
    updateCompany(currentId, c => ({
      ...c,
      fields: [
        ...c.fields,
        type === 'text'
          ? { type: 'text' as const, label: 'NOVO CAMPO', value: '' }
          : { type: 'table' as const, label: 'NOVA TABELA', headers: ['Coluna 1', 'Coluna 2', 'Coluna 3'], rows: [['', '', ''], ['', '', '']] },
      ],
    }))
  }

  const addTableRow = (idx: number) => {
    updateField(idx, f => {
      if (f.type !== 'table') return f
      return { ...f, rows: [...f.rows, new Array(f.headers.length).fill('')] }
    })
  }

  const addTableCol = (idx: number) => {
    updateField(idx, f => {
      if (f.type !== 'table') return f
      return {
        ...f,
        headers: [...f.headers, 'Nova col'],
        rows: f.rows.map(r => [...r, '']),
      }
    })
  }

  const removeTableRow = (idx: number, ri: number) => {
    if (!confirm('Excluir esta linha da tabela?')) return
    updateField(idx, f => {
      if (f.type !== 'table') return f
      return { ...f, rows: f.rows.filter((_, i) => i !== ri) }
    })
  }

  const updateTableCell = (idx: number, ri: number, ci: number, val: string) => {
    updateField(idx, f => {
      if (f.type !== 'table') return f
      const rows = f.rows.map((r, i) =>
        i === ri ? r.map((c, j) => j === ci ? val : c) : r
      )
      return { ...f, rows }
    })
  }

  const updateTableHeader = (idx: number, hi: number, val: string) => {
    updateField(idx, f => {
      if (f.type !== 'table') return f
      const headers = f.headers.map((h, i) => i === hi ? val : h)
      return { ...f, headers }
    })
  }

  const updateFieldLabel = (idx: number, val: string) => {
    updateField(idx, f => ({ ...f, label: val || 'CAMPO' }))
  }

  // ── Company actions ────────────────────────────────────────────────────────

  const openNewModal = () => {
    setNewCompanyName('')
    setNewCompanySeg(SEGMENTS[0])
    setNewCompanyModal({ open: true, mode: 'create' })
  }

  const openSegmentModal = () => {
    if (!currentCompany) return
    setNewCompanySeg(currentCompany.segment)
    setNewCompanyModal({ open: true, mode: 'segment', currentSeg: currentCompany.segment })
  }

  const confirmModal = () => {
    if (!newCompanyModal.open) return
    if (newCompanyModal.mode === 'create') {
      const name = newCompanyName.trim()
      if (!name) { alert('Informe um nome para a contratante.'); return }
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36).slice(-4)
      const newCo: Company = {
        id, name, sheetName: name.toUpperCase(), segment: newCompanySeg, updated: todayBR(),
        fields: [
          { type: 'text', label: 'AUTORIZAÇÃO P/CADASTRO', value: '' },
          { type: 'text', label: 'CONTATO UNIDADES', value: '' },
          { type: 'text', label: 'TELEFONE', value: '' },
          { type: 'text', label: 'E-MAIL', value: '' },
          { type: 'text', label: 'GT0180', value: '' },
          { type: 'text', label: 'INTEGRAÇÃO', value: '' },
          { type: 'text', label: 'INFORMAÇÕES ADICIONAIS', value: '' },
          { type: 'text', label: 'GT0120', value: '' },
        ],
      }
      setCompanies(prev => [newCo, ...prev])
      setActiveSegment(newCompanySeg)
      setCurrentId(id)
    } else {
      if (!currentId) return
      updateCompany(currentId, c => ({ ...c, segment: newCompanySeg }))
    }
    setNewCompanyModal({ open: false })
  }

  const renameCompany = () => {
    if (!currentCompany) return
    const novo = prompt('Renomear contratante:', currentCompany.name)
    if (novo && novo.trim()) {
      updateCompany(currentId!, c => ({ ...c, name: novo.trim() }))
    }
  }

  const deleteCompany = () => {
    if (!currentCompany) return
    if (!confirm(`Excluir definitivamente "${currentCompany.name}"?\nEsta ação não pode ser desfeita.`)) return
    setCompanies(prev => prev.filter(c => c.id !== currentId))
    setCurrentId(null)
  }

  if (!hydrated) return null

  const dot = (seg: string) => SEGMENT_COLORS[seg] ?? '#8C6EDC'

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 120px)', minHeight: 500 }}>

      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div style={{
        width: 260, minWidth: 220, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid #E2E8F0', background: '#fff', borderRadius: '12px 0 0 12px',
        overflow: 'hidden',
      }}>
        {/* Search */}
        <div style={{ padding: '14px 14px 8px' }}>
          <input
            type="search"
            placeholder="Buscar contratante ou campo…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px', borderRadius: 8,
              border: '1px solid #CBD5E0', fontSize: 13,
              background: '#F7F9FC', outline: 'none',
            }}
          />
        </div>

        {/* Segment filters */}
        <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[ALL_KEY, ...SEGMENTS].map(seg => {
            const cnt = counts[seg] ?? 0
            const isActive = activeSegment === seg
            const color = seg === ALL_KEY ? '#D1AE6E' : (SEGMENT_COLORS[seg] ?? '#8C6EDC')
            if (seg !== ALL_KEY && cnt === 0 && !companies.some(c => c.segment === seg)) return null
            return (
              <button
                key={seg}
                onClick={() => setActiveSegment(seg)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontSize: 13, fontWeight: isActive ? 600 : 400,
                  background: isActive ? '#EEF2FF' : 'transparent',
                  color: isActive ? '#2A4F96' : '#4A5568',
                }}
              >
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{seg === ALL_KEY ? 'Todas' : seg}</span>
                <span style={{
                  fontSize: 11, background: isActive ? '#2A4F96' : '#E2E8F0',
                  color: isActive ? '#fff' : '#718096', borderRadius: 10, padding: '1px 6px',
                }}>{cnt}</span>
              </button>
            )
          })}
        </div>

        {/* Cards list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
          <div style={{ fontSize: 11, color: '#A0AEC0', padding: '4px 4px 6px', fontWeight: 500 }}>
            {activeSegment === ALL_KEY ? 'Todas' : activeSegment} · {visibleCompanies.length} contratante{visibleCompanies.length !== 1 ? 's' : ''}
          </div>
          {visibleCompanies.length === 0 && (
            <div style={{ color: '#A0AEC0', fontSize: 13, padding: '16px 4px', textAlign: 'center' }}>
              Nenhuma contratante neste filtro.
            </div>
          )}
          {visibleCompanies.map(c => {
            const isActive = c.id === currentId
            const ct = getContactName(c)
            const em = getEmailFirst(c)
            const auth = getAuthTag(c)
            return (
              <div
                key={c.id}
                onClick={() => setCurrentId(c.id)}
                style={{
                  padding: '9px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                  background: isActive ? '#EEF2FF' : '#F7F9FC',
                  border: isActive ? '1px solid #BFD0FF' : '1px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  fontWeight: 600, fontSize: 13, color: '#2D3748',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {c.name}
                </div>
                <div style={{
                  fontSize: 12, color: '#718096', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {ct || em || c.segment}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot(c.segment), display: 'inline-block' }} />
                  {auth && (
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                      background: auth.warn ? '#FFF5F5' : '#F0FFF4',
                      color: auth.warn ? '#E53E3E' : '#276749',
                      border: `1px solid ${auth.warn ? '#FEB2B2' : '#9AE6B4'}`,
                    }}>{auth.label}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Add company */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #E2E8F0' }}>
          <button
            onClick={openNewModal}
            style={{
              width: '100%', padding: '8px', borderRadius: 8, border: '1px dashed #CBD5E0',
              background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#2A4F96', fontWeight: 500,
            }}
          >
            + Nova contratante
          </button>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: '#F7F9FC', borderRadius: '0 12px 12px 0',
        overflow: 'hidden', border: '1px solid #E2E8F0', borderLeft: 'none',
      }}>
        {!currentCompany ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#A0AEC0', gap: 12,
          }}>
            <div style={{ fontSize: 48, opacity: 0.3 }}>🏢</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Selecione uma contratante</div>
            <div style={{ fontSize: 13 }}>Clique em um card à esquerda para ver a ficha</div>
          </div>
        ) : (
          <DetailPanel
            company={currentCompany}
            onCopy={copyText}
            onEditText={(idx) => {
              const f = currentCompany.fields[idx]
              if (f.type === 'text') setEditTextModal({ open: true, idx, label: f.label, value: f.value })
            }}
            onUpdateLabel={updateFieldLabel}
            onUpdateCell={updateTableCell}
            onUpdateHeader={updateTableHeader}
            onMoveField={moveField}
            onRemoveField={removeField}
            onAddField={addField}
            onAddTableRow={addTableRow}
            onAddTableCol={addTableCol}
            onRemoveTableRow={removeTableRow}
            onRename={renameCompany}
            onChangeSegment={openSegmentModal}
            onDelete={deleteCompany}
          />
        )}
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#1A202C', color: '#fff', padding: '9px 18px', borderRadius: 8,
          fontSize: 13, zIndex: 9999, pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>
          {toast}
        </div>
      )}

      {/* ── Edit text modal ─────────────────────────────────────────────── */}
      {editTextModal.open && (
        <ModalOverlay onClose={() => setEditTextModal({ open: false })}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#2D3748' }}>
            Editar: {editTextModal.label}
          </div>
          <textarea
            autoFocus
            defaultValue={editTextModal.value}
            id="edit-text-area"
            rows={6}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px',
              borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13,
              fontFamily: 'inherit', resize: 'vertical', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button onClick={() => setEditTextModal({ open: false })} style={btnSecondary}>Cancelar</button>
            <button
              onClick={() => {
                if (!editTextModal.open || !currentId) return
                const val = (document.getElementById('edit-text-area') as HTMLTextAreaElement).value
                updateField(editTextModal.idx, f => ({ ...f, value: val }))
                setEditTextModal({ open: false })
              }}
              style={btnPrimary}
            >
              Salvar
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── New company / change segment modal ─────────────────────────── */}
      {newCompanyModal.open && (
        <ModalOverlay onClose={() => setNewCompanyModal({ open: false })}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#2D3748' }}>
            {newCompanyModal.mode === 'create' ? 'Nova contratante' : `Mover segmento — ${currentCompany?.name}`}
          </div>
          {newCompanyModal.mode === 'create' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#718096', display: 'block', marginBottom: 4 }}>NOME</label>
              <input
                autoFocus
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmModal() }}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                  borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13, outline: 'none',
                }}
              />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#718096', display: 'block', marginBottom: 4 }}>SEGMENTO</label>
            <select
              value={newCompanySeg}
              onChange={e => setNewCompanySeg(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: '1px solid #CBD5E0', fontSize: 13, background: '#fff', outline: 'none',
              }}
            >
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setNewCompanyModal({ open: false })} style={btnSecondary}>Cancelar</button>
            <button onClick={confirmModal} style={btnPrimary}>
              {newCompanyModal.mode === 'create' ? 'Criar' : 'Mover'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

// ── Modal wrapper ──────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, padding: '24px 28px',
        minWidth: 360, maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Detail panel ───────────────────────────────────────────────────────────

type DetailPanelProps = {
  company: Company
  onCopy: (text: string) => void
  onEditText: (idx: number) => void
  onUpdateLabel: (idx: number, val: string) => void
  onUpdateCell: (idx: number, ri: number, ci: number, val: string) => void
  onUpdateHeader: (idx: number, hi: number, val: string) => void
  onMoveField: (idx: number, dir: -1 | 1) => void
  onRemoveField: (idx: number) => void
  onAddField: (type: 'text' | 'table') => void
  onAddTableRow: (idx: number) => void
  onAddTableCol: (idx: number) => void
  onRemoveTableRow: (idx: number, ri: number) => void
  onRename: () => void
  onChangeSegment: () => void
  onDelete: () => void
}

function DetailPanel({
  company: c,
  onCopy, onEditText, onUpdateLabel, onUpdateCell, onUpdateHeader,
  onMoveField, onRemoveField, onAddField, onAddTableRow, onAddTableCol, onRemoveTableRow,
  onRename, onChangeSegment, onDelete,
}: DetailPanelProps) {
  const color = SEGMENT_COLORS[c.segment] ?? '#8C6EDC'
  const txtCount = c.fields.filter(f => f.type === 'text').length
  const tblCount = c.fields.filter(f => f.type === 'table').length

  return (
    <>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px', borderBottom: '1px solid #E2E8F0',
        background: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#2D3748' }}>{c.name}</h2>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
              background: color + '22', color: color, border: `1px solid ${color}66`,
            }}>{c.segment}</span>
          </div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginTop: 4 }}>
            Ficha editável · {txtCount} campo{txtCount !== 1 ? 's' : ''}{tblCount ? ` · ${tblCount} tabela${tblCount !== 1 ? 's' : ''}` : ''} · atualizada em {c.updated}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onRename} style={btnSmall} title="Renomear">✎ Renomear</button>
          <button onClick={onChangeSegment} style={btnSmall} title="Mudar segmento">⇄ Segmento</button>
          <button onClick={onDelete} style={{ ...btnSmall, color: '#E53E3E', borderColor: '#FEB2B2' }} title="Excluir">✕ Excluir</button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
        {c.fields.length === 0 && (
          <div style={{
            border: '1px dashed #CBD5E0', borderRadius: 10, padding: '24px',
            textAlign: 'center', color: '#A0AEC0', fontSize: 13,
          }}>
            Nenhum campo. Use os botões abaixo para adicionar.
          </div>
        )}
        {c.fields.map((f, idx) => (
          <FieldCard
            key={idx}
            field={f}
            idx={idx}
            total={c.fields.length}
            onCopy={onCopy}
            onEditText={() => onEditText(idx)}
            onUpdateLabel={val => onUpdateLabel(idx, val)}
            onUpdateCell={(ri, ci, val) => onUpdateCell(idx, ri, ci, val)}
            onUpdateHeader={(hi, val) => onUpdateHeader(idx, hi, val)}
            onMove={dir => onMoveField(idx, dir)}
            onRemove={() => onRemoveField(idx)}
            onAddRow={() => onAddTableRow(idx)}
            onAddCol={() => onAddTableCol(idx)}
            onRemoveRow={ri => onRemoveTableRow(idx, ri)}
          />
        ))}
      </div>

      {/* Add field buttons */}
      <div style={{
        padding: '10px 20px', borderTop: '1px solid #E2E8F0', background: '#fff',
        display: 'flex', gap: 8,
      }}>
        <button onClick={() => onAddField('text')} style={{ ...btnSmall, fontSize: 12 }}>+ Campo texto</button>
        <button onClick={() => onAddField('table')} style={{ ...btnSmall, fontSize: 12 }}>+ Tabela</button>
      </div>
    </>
  )
}

// ── Field card ─────────────────────────────────────────────────────────────

type FieldCardProps = {
  field: Field
  idx: number
  total: number
  onCopy: (text: string) => void
  onEditText: () => void
  onUpdateLabel: (val: string) => void
  onUpdateCell: (ri: number, ci: number, val: string) => void
  onUpdateHeader: (hi: number, val: string) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onAddRow: () => void
  onAddCol: () => void
  onRemoveRow: (ri: number) => void
}

function FieldCard({
  field: f, idx, total, onCopy, onEditText,
  onUpdateLabel, onUpdateCell, onUpdateHeader,
  onMove, onRemove, onAddRow, onAddCol, onRemoveRow,
}: FieldCardProps) {
  const labelRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
      marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Label row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid #EDF2F7', background: '#F7F9FC',
      }}>
        <div
          ref={labelRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={() => onUpdateLabel(labelRef.current?.textContent?.trim() || 'CAMPO')}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); labelRef.current?.blur() } }}
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#4A5568',
            textTransform: 'uppercase', outline: 'none', flex: 1, cursor: 'text',
          }}
        >
          {f.label}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {f.type === 'text' && (
            <button onClick={onEditText} style={iconBtn} title="Editar valor">✎</button>
          )}
          {f.type === 'table' && (
            <>
              <button onClick={onAddRow} style={iconBtn} title="Nova linha">+L</button>
              <button onClick={onAddCol} style={iconBtn} title="Nova coluna">+C</button>
            </>
          )}
          <button onClick={() => onMove(-1)} disabled={idx === 0} style={iconBtn} title="Subir">▲</button>
          <button onClick={() => onMove(1)} disabled={idx === total - 1} style={iconBtn} title="Descer">▼</button>
          <button onClick={onRemove} style={{ ...iconBtn, color: '#E53E3E' }} title="Excluir">✕</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: f.type === 'table' ? 0 : '8px 12px' }}>
        {f.type === 'text' ? (
          <TextFieldLines value={f.value} onCopy={onCopy} />
        ) : (
          <TableFieldView
            field={f}
            onCopy={onCopy}
            onUpdateCell={onUpdateCell}
            onUpdateHeader={onUpdateHeader}
            onRemoveRow={onRemoveRow}
          />
        )}
      </div>
    </div>
  )
}

// ── Text lines ─────────────────────────────────────────────────────────────

function TextFieldLines({ value, onCopy }: { value: string; onCopy: (t: string) => void }) {
  if (!value || value.trim() === '') {
    return (
      <span style={{ color: '#CBD5E0', fontStyle: 'italic', fontSize: 13 }}>
        — vazio — (clique no ✎ para editar)
      </span>
    )
  }

  const parts: { text: string; isMail: boolean }[] = []
  value.split('\n').forEach(line => {
    const isMail = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(line)
    if (isMail && line.includes(';')) {
      line.split(';').map(s => s.trim()).filter(Boolean).forEach(s => {
        parts.push({ text: s, isMail: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(s) })
      })
    } else {
      parts.push({ text: line, isMail })
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {parts.map((p, i) => (
        <span
          key={i}
          onClick={() => p.text && onCopy(p.text)}
          title="Clique para copiar"
          style={{
            fontSize: 13, cursor: 'pointer', padding: '2px 4px', borderRadius: 4,
            color: p.isMail ? '#2A4F96' : '#2D3748',
            fontFamily: p.isMail ? 'monospace' : 'inherit',
            background: p.isMail ? '#EBF4FF' : 'transparent',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = p.isMail ? '#BEE3F8' : '#EDF2F7' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = p.isMail ? '#EBF4FF' : 'transparent' }}
        >
          {p.text || ' '}
        </span>
      ))}
    </div>
  )
}

// ── Table field view ───────────────────────────────────────────────────────

type TableFieldViewProps = {
  field: Extract<Field, { type: 'table' }>
  onCopy: (t: string) => void
  onUpdateCell: (ri: number, ci: number, val: string) => void
  onUpdateHeader: (hi: number, val: string) => void
  onRemoveRow: (ri: number) => void
}

function TableFieldView({ field: f, onCopy, onUpdateCell, onUpdateHeader, onRemoveRow }: TableFieldViewProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#EDF2F7' }}>
            {f.headers.map((h, hi) => (
              <EditableHeader
                key={hi}
                value={h}
                onSave={val => onUpdateHeader(hi, val)}
              />
            ))}
            <th style={{ width: 28, padding: '4px 6px', border: '1px solid #E2E8F0' }} />
          </tr>
        </thead>
        <tbody>
          {f.rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#F7F9FC' }}>
              {Array.from({ length: f.headers.length }).map((_, ci) => (
                <EditableCell
                  key={ci}
                  value={row[ci] ?? ''}
                  onCopy={onCopy}
                  onSave={val => onUpdateCell(ri, ci, val)}
                />
              ))}
              <td
                onClick={() => onRemoveRow(ri)}
                style={{
                  width: 28, textAlign: 'center', cursor: 'pointer',
                  color: '#FC8181', border: '1px solid #E2E8F0', padding: '4px',
                  fontSize: 11,
                }}
                title="Excluir linha"
              >✕</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EditableHeader({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const ref = useRef<HTMLTableCellElement>(null)
  return (
    <th
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={() => onSave(ref.current?.textContent?.trim() ?? '')}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ref.current?.blur() } }}
      style={{
        padding: '5px 8px', border: '1px solid #E2E8F0', textAlign: 'left',
        fontWeight: 600, color: '#4A5568', cursor: 'text', outline: 'none',
      }}
    >
      {value}
    </th>
  )
}

function EditableCell({ value, onCopy, onSave }: { value: string; onCopy: (t: string) => void; onSave: (v: string) => void }) {
  const ref = useRef<HTMLTableCellElement>(null)
  const [editing, setEditing] = useState(false)

  const startEdit = () => {
    setEditing(true)
    setTimeout(() => {
      if (!ref.current) return
      ref.current.focus()
      const range = document.createRange()
      range.selectNodeContents(ref.current)
      const sel = window.getSelection()
      sel?.removeAllRanges(); sel?.addRange(range)
    }, 0)
  }

  const stopEdit = () => {
    setEditing(false)
    onSave(ref.current?.textContent?.trim() ?? '')
  }

  return (
    <td
      ref={ref}
      contentEditable={editing}
      suppressContentEditableWarning
      onClick={() => { if (!editing && value.trim()) onCopy(value) }}
      onDoubleClick={startEdit}
      onBlur={stopEdit}
      onKeyDown={e => { if (editing && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); stopEdit() } }}
      title={editing ? undefined : value ? 'Clique para copiar · Duplo-clique para editar' : 'Duplo-clique para editar'}
      style={{
        padding: '4px 8px', border: '1px solid #E2E8F0', cursor: editing ? 'text' : (value ? 'pointer' : 'default'),
        outline: editing ? '2px solid #4299E1' : 'none', outlineOffset: -2,
        background: editing ? '#EBF4FF' : 'transparent',
        color: '#2D3748', verticalAlign: 'top',
      }}
      onMouseEnter={e => { if (!editing && value) (e.currentTarget as HTMLElement).style.background = '#EDF2F7' }}
      onMouseLeave={e => { if (!editing) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {value}
    </td>
  )
}

// ── Shared button styles ───────────────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #E2E8F0',
  borderRadius: 5, cursor: 'pointer', fontSize: 12, padding: '2px 6px', color: '#718096',
}

const btnSmall: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 7, border: '1px solid #E2E8F0',
  background: '#fff', cursor: 'pointer', fontSize: 12, color: '#4A5568', fontWeight: 500,
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, border: 'none',
  background: '#2A4F96', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, border: '1px solid #CBD5E0',
  background: '#fff', color: '#4A5568', cursor: 'pointer', fontSize: 13, fontWeight: 500,
}
