'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Company, Field, SEGMENT_COLORS } from './types'
import { createClient } from '../lib/supabase'

function rowToCompany(row: {
  id: string
  name: string
  sheet_name: string
  segment: string
  updated: string
  fields: unknown
}): Company {
  const fields = (row.fields as Field[]) ?? []
  const withoutInteg = fields.filter(f => !/integra[çc][ãa]o/i.test(f.label))
  const existingInteg = fields.find(f => /integra[çc][ãa]o/i.test(f.label))
  const integField = existingInteg ?? { type: 'text' as const, label: 'INTEGRAÇÃO', value: '' }
  return {
    id: row.id,
    name: row.name,
    sheetName: row.sheet_name,
    segment: row.segment,
    updated: row.updated,
    fields: [...withoutInteg, integField],
  }
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
  if (!/^sim/i.test(f.value.trim())) return null
  return { label: 'Autorizado', warn: false }
}

function getAuthEmails(c: Company): string[] {
  const f = c.fields.find(x => x.type === 'text' && /AUTORIZA/i.test(x.label))
  if (!f || f.type !== 'text' || !f.value) return []
  const emailRe = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi
  return Array.from(new Set(f.value.match(emailRe) ?? []))
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
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<Company[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [editTextModal, setEditTextModal] = useState<EditTextModal>({ open: false })
  const [newCompanyModal, setNewCompanyModal] = useState<NewCompanyModal>({ open: false })
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanySeg, setNewCompanySeg] = useState<string>('Bertolini')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function init() {
      try {
        const [compRes, favsRes] = await Promise.all([
          supabase.from('contratantes').select('id, name, sheet_name, segment, updated, fields').order('name'),
          supabase.from('contratantes_favs').select('company_id'),
        ])
        if (cancelled) return
        if (compRes.error) console.error('Erro ao carregar contratantes:', compRes.error)
        if (favsRes.error) console.error('Erro ao carregar favoritos:', favsRes.error)
        setCompanies((compRes.data ?? []).map(rowToCompany))
        setFavorites((favsRes.data ?? []).map(r => r.company_id))

        // Migração: garante que INTEGRAÇÃO existe e está sempre no final
        const precisaReordenar = (compRes.data ?? []).filter(row => {
          const fs = (row.fields as Field[]) ?? []
          const last = fs[fs.length - 1]
          return !last || !/integra[çc][ãa]o/i.test(last.label)
        })
        if (precisaReordenar.length > 0) {
          void Promise.all(precisaReordenar.map(row => {
            const fs = (row.fields as Field[]) ?? []
            const withoutInteg = fs.filter(f => !/integra[çc][ãa]o/i.test(f.label))
            const existingInteg = fs.find(f => /integra[çc][ãa]o/i.test(f.label))
            const integField = existingInteg ?? { type: 'text' as const, label: 'INTEGRAÇÃO', value: '' }
            return supabase.from('contratantes').update({ fields: [...withoutInteg, integField] }).eq('id', row.id)
          }))
        }
      } catch (err) {
        console.error('Erro ao inicializar cadastro:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()
    return () => { cancelled = true }
  }, [])

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
    showToast('Copiado: ' + (text.length > 60 ? text.slice(0, 60) + '…' : text))
  }, [showToast])

  const toggleFavorite = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const supabase = createClient()
    const isFav = favorites.includes(id)
    setFavorites(prev => isFav ? prev.filter(x => x !== id) : [...prev, id])
    if (isFav) {
      const { error } = await supabase
        .from('contratantes_favs')
        .delete()
        .eq('company_id', id)
      if (error) {
        console.error('Erro ao remover favorito:', error)
        setFavorites(prev => [...prev, id])
      }
    } else {
      const { error } = await supabase
        .from('contratantes_favs')
        .insert({ company_id: id })
      if (error) {
        console.error('Erro ao adicionar favorito:', error)
        setFavorites(prev => prev.filter(x => x !== id))
      }
    }
  }, [favorites])

  const saveCompanyFields = useCallback(async (id: string, updatedCompany: Company) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('contratantes')
      .update({
        name: updatedCompany.name,
        sheet_name: updatedCompany.sheetName,
        segment: updatedCompany.segment,
        updated: updatedCompany.updated,
        fields: updatedCompany.fields,
      })
      .eq('id', id)
    if (error) console.error('Erro ao salvar contratante:', error)
  }, [])

  const updateCompany = useCallback((id: string, updater: (c: Company) => Company) => {
    setCompanies(prev => {
      const updated = prev.map(c => c.id === id ? updater({ ...c, updated: todayBR() }) : c)
      const updatedCo = updated.find(c => c.id === id)
      if (updatedCo) void saveCompanyFields(id, updatedCo)
      return updated
    })
  }, [saveCompanyFields])

  const currentCompany = companies.find(c => c.id === currentId) ?? null
  const term = searchTerm.trim().toLowerCase()

  const matchedCompanies = companies
    .filter(c => companyMatches(c, term))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const favCompanies = favorites
    .map(id => matchedCompanies.find(c => c.id === id))
    .filter((c): c is Company => !!c)

  const otherCompanies = matchedCompanies.filter(c => !favorites.includes(c.id))

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

  const reorderField = (from: number, to: number) => {
    if (!currentId || from === to) return
    updateCompany(currentId, c => {
      const fields = [...c.fields]
      const [moved] = fields.splice(from, 1)
      fields.splice(to, 0, moved)
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
      return { ...f, headers: [...f.headers, 'Nova col'], rows: f.rows.map(r => [...r, '']) }
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
      return { ...f, rows: f.rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r) }
    })
  }

  const updateTableHeader = (idx: number, hi: number, val: string) => {
    updateField(idx, f => {
      if (f.type !== 'table') return f
      return { ...f, headers: f.headers.map((h, i) => i === hi ? val : h) }
    })
  }

  const updateFieldLabel = (idx: number, val: string) => {
    updateField(idx, f => ({ ...f, label: val || 'CAMPO' }))
  }

  // ── Company actions ────────────────────────────────────────────────────────

  const openNewModal = () => {
    setNewCompanyName('')
    setNewCompanySeg('Bertolini')
    setNewCompanyModal({ open: true, mode: 'create' })
  }

  const openSegmentModal = () => {
    if (!currentCompany) return
    setNewCompanySeg(currentCompany.segment)
    setNewCompanyModal({ open: true, mode: 'segment', currentSeg: currentCompany.segment })
  }

  const confirmModal = async () => {
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
          { type: 'text', label: 'INFORMAÇÕES ADICIONAIS', value: '' },
          { type: 'text', label: 'GT0120', value: '' },
          { type: 'text', label: 'INTEGRAÇÃO', value: '' },
        ],
      }
      setCompanies(prev => [newCo, ...prev])
      setCurrentId(id)
      const supabase = createClient()
      const { error } = await supabase.from('contratantes').insert({
        id: newCo.id,
        name: newCo.name,
        sheet_name: newCo.sheetName,
        segment: newCo.segment,
        updated: newCo.updated,
        fields: newCo.fields,
      })
      if (error) console.error('Erro ao criar contratante:', error)
    } else {
      if (!currentId) return
      updateCompany(currentId, c => ({ ...c, segment: newCompanySeg }))
    }
    setNewCompanyModal({ open: false })
  }

  const renameCompany = () => {
    if (!currentCompany) return
    const novo = prompt('Renomear contratante:', currentCompany.name)
    if (novo && novo.trim()) updateCompany(currentId!, c => ({ ...c, name: novo.trim() }))
  }

  const deleteCompany = async () => {
    if (!currentCompany) return
    if (!confirm(`Excluir definitivamente "${currentCompany.name}"?\nEsta ação não pode ser desfeita.`)) return
    setFavorites(prev => prev.filter(id => id !== currentId))
    setCompanies(prev => prev.filter(c => c.id !== currentId))
    const supabase = createClient()
    const { error } = await supabase.from('contratantes').delete().eq('id', currentId!)
    if (error) console.error('Erro ao excluir contratante:', error)
    setCurrentId(null)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9CA3AF', fontSize: 14 }}>
        Carregando contratantes…
      </div>
    )
  }

  const totalVisible = matchedCompanies.length

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

        {/* Todas counter */}
        <div style={{ padding: '0 10px 6px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 7, fontSize: 13, fontWeight: 600,
            background: '#EEF2FF', color: '#2A4F96',
          }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#D1AE6E', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Todas</span>
            <span style={{ fontSize: 11, background: '#2A4F96', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>
              {totalVisible}
            </span>
          </div>
        </div>


        {/* Cards list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>

          {/* Favoritos section */}
          {favCompanies.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#D1AE6E', padding: '8px 4px 4px', textTransform: 'uppercase' }}>
                ★ Favoritos
              </div>
              {favCompanies.map(c => (
                <CompanyCard
                  key={c.id}
                  company={c}
                  isActive={c.id === currentId}
                  isFav={true}
                  onSelect={() => setCurrentId(c.id)}
                  onToggleFav={e => void toggleFavorite(c.id, e)}
                />
              ))}
              {otherCompanies.length > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#A0AEC0', padding: '8px 4px 4px', textTransform: 'uppercase' }}>
                  Todas · {otherCompanies.length}
                </div>
              )}
            </>
          )}

          {/* Other companies */}
          {otherCompanies.length === 0 && favCompanies.length === 0 && (
            <div style={{ color: '#A0AEC0', fontSize: 13, padding: '16px 4px', textAlign: 'center' }}>
              Nenhuma contratante encontrada.
            </div>
          )}
          {otherCompanies.map(c => (
            <CompanyCard
              key={c.id}
              company={c}
              isActive={c.id === currentId}
              isFav={false}
              onSelect={() => setCurrentId(c.id)}
              onToggleFav={e => void toggleFavorite(c.id, e)}
            />
          ))}
        </div>

        {/* Add company */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #E2E8F0' }}>
          <LabelBtn onClick={openNewModal} icon={<IconPlus size={13} />} dashed fullWidth>
            Nova contratante
          </LabelBtn>
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
            onReorderField={reorderField}
            onRemoveField={removeField}
            onAddField={addField}
            onAddTableRow={addTableRow}
            onAddTableCol={addTableCol}
            onRemoveTableRow={removeTableRow}
            onRename={renameCompany}
            onChangeSegment={openSegmentModal}
            onDelete={() => void deleteCompany()}
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
            <button
              onClick={() => setEditTextModal({ open: false })}
              style={btnSecondary}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F6FA' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
            >Cancelar</button>
            <button
              onClick={() => {
                if (!editTextModal.open || !currentId) return
                const val = (document.getElementById('edit-text-area') as HTMLTextAreaElement).value
                updateField(editTextModal.idx, f => ({ ...f, value: val }))
                setEditTextModal({ open: false })
              }}
              style={btnPrimary}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#3D6ABF' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A4F96' }}
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
                onKeyDown={e => { if (e.key === 'Enter') void confirmModal() }}
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
              {['Bertolini','Marcopolo','FCC','Auto/Componentes','Alimentos/Bebidas','Indústria Geral','Outros'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setNewCompanyModal({ open: false })}
              style={btnSecondary}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F6FA' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
            >Cancelar</button>
            <button
              onClick={() => void confirmModal()}
              style={btnPrimary}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#3D6ABF' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A4F96' }}
            >
              {newCompanyModal.mode === 'create' ? 'Criar' : 'Mover'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

// ── Company card ───────────────────────────────────────────────────────────

function CompanyCard({
  company: c, isActive, isFav, onSelect, onToggleFav,
}: {
  company: Company
  isActive: boolean
  isFav: boolean
  onSelect: () => void
  onToggleFav: (e: React.MouseEvent) => void
}) {
  const ct = getContactName(c)
  const em = getEmailFirst(c)
  const auth = getAuthTag(c)
  const dot = SEGMENT_COLORS[c.segment] ?? '#8C6EDC'
  const [hov, setHov] = useState(false)

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '8px 8px 8px 9px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
        background: isActive ? '#EEF2FF' : hov ? '#F0F3F8' : '#F7F9FC',
        border: isActive ? '1px solid #BFD0FF' : '1px solid transparent',
        borderLeft: `3px solid ${isActive ? dot : 'transparent'}`,
        boxShadow: isActive ? '0 1px 4px rgba(42,79,150,0.1)' : 'none',
        display: 'flex', alignItems: 'flex-start', gap: 6,
        transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
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
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
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
      {/* Star button */}
      <button
        onClick={onToggleFav}
        title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 2px 0',
          fontSize: 16, lineHeight: 1, color: isFav ? '#D1AE6E' : '#CBD5E0', flexShrink: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => { if (!isFav) (e.currentTarget as HTMLElement).style.color = '#D1AE6E' }}
        onMouseLeave={e => { if (!isFav) (e.currentTarget as HTMLElement).style.color = '#CBD5E0' }}
      >
        {isFav ? '★' : '☆'}
      </button>
    </div>
  )
}

// ── Modal wrapper ──────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="gt3-overlay-fade"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998,
      }}
    >
      <div className="gt3-drop-in" style={{
        background: '#fff', borderRadius: 12, padding: '24px 28px',
        minWidth: 360, maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IconPencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  )
}

function IconChevronUp() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6" /></svg>
}

function IconChevronDown() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
}

function IconPlus({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
}

function IconSwap() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 16V4M7 4L3 8M17 8v12M17 20l4-4M17 20l-4-4" />
    </svg>
  )
}

// ── Botões reutilizáveis (ícone / ícone+texto), com realce de cor no hover ──

function IconBtn({
  onClick, title, danger, disabled, children,
}: { onClick: () => void; title: string; danger?: boolean; disabled?: boolean; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  const active = hov && !disabled
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${active ? (danger ? '#FEB2B2' : '#BFD0FF') : '#E2E8F0'}`,
        background: active ? (danger ? '#FFF5F5' : '#EEF2FF') : '#fff',
        color: disabled ? '#CBD5E0' : active ? (danger ? '#E53E3E' : '#2A4F96') : '#718096',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 11, fontWeight: 700,
      }}
    >
      {children}
    </button>
  )
}

function LabelBtn({
  onClick, icon, children, danger, dashed, fullWidth,
}: { onClick: () => void; icon?: React.ReactNode; children: React.ReactNode; danger?: boolean; dashed?: boolean; fullWidth?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        width: fullWidth ? '100%' : undefined,
        padding: '7px 12px', borderRadius: 8,
        border: dashed
          ? `1px dashed ${hov ? '#2A4F96' : '#CBD5E0'}`
          : `1px solid ${danger ? '#FEB2B2' : hov ? '#BFD0FF' : '#E2E8F0'}`,
        background: dashed ? 'transparent' : hov ? (danger ? '#FFF5F5' : '#EEF2FF') : '#fff',
        color: danger ? '#E53E3E' : hov ? '#2A4F96' : dashed ? '#2A4F96' : '#4A5568',
        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
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
  onReorderField: (from: number, to: number) => void
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
  onMoveField, onReorderField, onRemoveField, onAddField, onAddTableRow, onAddTableCol, onRemoveTableRow,
  onRename, onChangeSegment, onDelete,
}: DetailPanelProps) {
  const color = SEGMENT_COLORS[c.segment] ?? '#8C6EDC'
  const txtCount = c.fields.filter(f => f.type === 'text').length
  const tblCount = c.fields.filter(f => f.type === 'table').length
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const hoverIdxRef = useRef<number | null>(null)

  // Reordenar segurando e arrastando (pointer events) — mais fluido e confiável
  // do que o drag-and-drop nativo do HTML5, que conflitava com o texto editável
  // e exigia soltar exatamente em cima do alvo.
  useEffect(() => {
    if (dragIdx === null) return

    function onPointerMove(e: PointerEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const cardEl = el?.closest('[data-field-idx]') as HTMLElement | null
      const idx = cardEl ? Number(cardEl.dataset.fieldIdx) : null
      if (idx !== hoverIdxRef.current) {
        hoverIdxRef.current = idx
        setHoverIdx(idx)
      }
    }
    function onPointerUp() {
      const from = dragIdx
      const to = hoverIdxRef.current
      if (from !== null && to !== null && to !== from) onReorderField(from, to)
      hoverIdxRef.current = null
      setDragIdx(null)
      setHoverIdx(null)
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [dragIdx, onReorderField])

  return (
    <>
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
          <LabelBtn onClick={onRename} icon={<IconPencil />}>Renomear</LabelBtn>
          <LabelBtn onClick={onChangeSegment} icon={<IconSwap />}>Segmento</LabelBtn>
          <LabelBtn onClick={onDelete} icon={<IconTrash />} danger>Excluir</LabelBtn>
        </div>
      </div>

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
            isDragging={dragIdx === idx}
            isDropTarget={hoverIdx === idx && dragIdx !== null && dragIdx !== idx}
            onHandlePointerDown={e => { e.preventDefault(); setDragIdx(idx) }}
          />
        ))}
      </div>

      <div style={{
        padding: '10px 20px', borderTop: '1px solid #E2E8F0', background: '#fff',
        display: 'flex', gap: 8,
      }}>
        <LabelBtn onClick={() => onAddField('text')} icon={<IconPlus size={13} />}>Campo texto</LabelBtn>
        <LabelBtn onClick={() => onAddField('table')} icon={<IconPlus size={13} />}>Tabela</LabelBtn>
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
  isDragging: boolean
  isDropTarget: boolean
  onHandlePointerDown: (e: React.PointerEvent) => void
}

function FieldCard({
  field: f, idx, total, onCopy, onEditText,
  onUpdateLabel, onUpdateCell, onUpdateHeader,
  onMove, onRemove, onAddRow, onAddCol, onRemoveRow,
  isDragging, isDropTarget, onHandlePointerDown,
}: FieldCardProps) {
  const labelRef = useRef<HTMLDivElement>(null)

  return (
    <div
      data-field-idx={idx}
      style={{
        background: '#fff',
        border: isDropTarget ? '2px solid #2A4F96' : '1px solid #E2E8F0',
        borderRadius: 10, marginBottom: 10, overflow: 'hidden',
        opacity: isDragging ? 0.5 : 1,
        transform: isDropTarget ? 'scale(1.01)' : 'scale(1)',
        transition: 'opacity 0.15s, border-color 0.1s, transform 0.1s',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid #EDF2F7', background: '#F7F9FC',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <div
            title="Segure e arraste para reordenar"
            onPointerDown={onHandlePointerDown}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab', color: isDragging ? '#2A4F96' : '#C4CEDD',
              fontSize: 18, marginRight: 8, width: 22, height: 22, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              userSelect: 'none', flexShrink: 0, lineHeight: 1, touchAction: 'none',
              transition: 'color 0.15s',
            }}
          >⠿</div>
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
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {f.type === 'text' && <IconBtn onClick={onEditText} title="Editar valor"><IconPencil /></IconBtn>}
          {f.type === 'table' && (
            <>
              <IconBtn onClick={onAddRow} title="Nova linha">+L</IconBtn>
              <IconBtn onClick={onAddCol} title="Nova coluna">+C</IconBtn>
            </>
          )}
          <IconBtn onClick={() => onMove(-1)} disabled={idx === 0} title="Subir"><IconChevronUp /></IconBtn>
          <IconBtn onClick={() => onMove(1)} disabled={idx === total - 1} title="Descer"><IconChevronDown /></IconBtn>
          <IconBtn onClick={onRemove} title="Excluir" danger><IconTrash /></IconBtn>
        </div>
      </div>

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

  const allEmails = parts.filter(p => p.isMail).map(p => p.text)
  const showCopyAll = allEmails.length >= 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {showCopyAll && (
        <div style={{ marginBottom: 4 }}>
          <button
            onClick={() => onCopy(allEmails.join('; '))}
            title={`Copia todos para o campo Para: do Outlook\n${allEmails.join('; ')}`}
            style={{
              fontSize: 11, padding: '3px 9px', borderRadius: 6,
              border: '1px solid #BEE3F8', background: '#EBF4FF',
              color: '#2A4F96', cursor: 'pointer', fontWeight: 600,
            }}
          >
            📋 Copiar todos ({allEmails.length})
          </button>
        </div>
      )}
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
          {p.text || ' '}
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: 'linear-gradient(to bottom, #FAFCFE, #F5F8FC)' }}>
            {f.headers.map((h, hi) => (
              <EditableHeader key={hi} value={h} onSave={val => onUpdateHeader(hi, val)} />
            ))}
            <th style={{ width: 28, padding: '4px 6px', border: '1px solid #E2E8F0' }} />
          </tr>
        </thead>
        <tbody>
          {f.rows.map((row, ri) => (
            <tr key={ri} className="gt3-fade-up" style={{ background: ri % 2 === 0 ? '#fff' : '#F7F9FC', transition: 'background-color 200ms var(--ease-gt3)' }}>
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
                  width: 20, textAlign: 'center', cursor: 'pointer',
                  color: '#FC8181', border: '1px solid #E2E8F0', padding: '2px 3px', fontSize: 10,
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
        padding: '3px 6px', border: '1px solid var(--border-soft)', textAlign: 'left',
        fontWeight: 700, color: 'var(--text-mute)', cursor: 'text', outline: 'none',
        fontSize: 10, letterSpacing: '.9px', textTransform: 'uppercase',
      }}
    >
      {value}
    </th>
  )
}

function EditableCell({ value, onCopy: _onCopy, onSave }: { value: string; onCopy: (t: string) => void; onSave: (v: string) => void }) {
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
      onClick={() => { if (!editing) startEdit() }}
      onBlur={stopEdit}
      onKeyDown={e => {
        if (!editing) return
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); stopEdit() }
        if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
      }}
      title={editing ? undefined : 'Clique para editar · Ctrl+C para copiar após selecionar'}
      style={{
        padding: '2px 5px', border: '1px solid #E2E8F0', cursor: editing ? 'text' : 'pointer',
        outline: editing ? '2px solid #4299E1' : 'none', outlineOffset: -2,
        background: editing ? '#EBF4FF' : 'transparent',
        color: '#2D3748', verticalAlign: 'top',
      }}
      onMouseEnter={e => { if (!editing) (e.currentTarget as HTMLElement).style.background = '#EDF2F7' }}
      onMouseLeave={e => { if (!editing) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {value}
    </td>
  )
}

// ── Shared button styles ───────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, border: 'none',
  background: '#2A4F96', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, border: '1px solid #CBD5E0',
  background: '#fff', color: '#4A5568', cursor: 'pointer', fontSize: 13, fontWeight: 500,
}
