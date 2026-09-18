'use client'

import { memo, useState, useEffect, useRef } from 'react'
import type { Revision, Suggestions } from './types'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const SUCCESS_BG = '#F0FDF4'
const SUCCESS_TEXT = '#166534'

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: PRIMARY, color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const btnSecondary: React.CSSProperties = {
  padding: '8px 14px', background: '#fff', color: INK,
  border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', fontSize: 13,
  border: `1px solid ${BORDER}`, borderRadius: 8, background: '#fff',
  color: INK, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

export const RevisionRow = memo(function RevisionRow({ rev, people, suggestions, readOnly, onUpdate, onDelete }: {
  rev: Revision
  people: string[]
  suggestions: Suggestions
  readOnly: boolean
  onUpdate: (id: string, field: keyof Revision, value: string | boolean) => void
  onDelete: (id: string) => void
}) {
  const rowBg = rev.resolvido ? SUCCESS_BG : '#fff'

  if (readOnly) {
    return (
      <tr style={{ background: rowBg }}>
        {(['data','documento','empresa','responsavel','inconsistencia'] as const).map(f => (
          <td key={f} style={{ padding: '8px 10px', border: `1px solid var(--border-soft)`, fontSize: 13, color: rev.resolvido ? SUCCESS_TEXT : INK, textDecoration: rev.resolvido ? 'line-through' : 'none' }}>
            {String(rev[f] ?? '')}
          </td>
        ))}
        <td style={{ padding: '8px 10px', border: `1px solid var(--border-soft)`, textAlign: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: rev.resolvido ? '#D1FAE5' : '#FEF2F2', color: rev.resolvido ? '#065F46' : '#991B1B' }}>
            {rev.resolvido ? 'Resolvido' : 'Pendente'}
          </span>
        </td>
      </tr>
    )
  }

  const cellStyle: React.CSSProperties = {
    border: `1px solid var(--border-soft)`, padding: 0, height: 36, background: rowBg,
  }
  const editInput = (field: keyof Revision, placeholder: string, listId?: string): React.ReactNode => (
    <input
      type="text"
      defaultValue={String(rev[field] ?? '')}
      placeholder={placeholder}
      list={listId}
      onBlur={e => onUpdate(rev.id, field, e.target.value)}
      style={{
        width: '100%', height: 36, border: 'none', background: 'transparent',
        padding: '0 8px', fontSize: 13, color: rev.resolvido ? MUTED : INK,
        fontFamily: 'inherit', outline: 'none',
        textDecoration: rev.resolvido ? 'line-through' : 'none',
      }}
    />
  )

  return (
    <tr>
      <td style={{ ...cellStyle, width: 108 }}>{editInput('data', 'dd/mm/aaaa')}</td>
      <td style={cellStyle}>{editInput('documento', '—', 'dl-cr-doc')}</td>
      <td style={cellStyle}>{editInput('empresa', '—', 'dl-cr-emp')}</td>
      <td style={{ ...cellStyle, minWidth: 120 }}>
        <select
          defaultValue={rev.responsavel}
          onBlur={e => onUpdate(rev.id, 'responsavel', e.target.value)}
          style={{ width: '100%', height: 36, border: 'none', background: 'transparent', padding: '0 8px', fontSize: 13, color: rev.resolvido ? MUTED : INK, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
        >
          <option value="">—</option>
          {people.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </td>
      <td style={cellStyle}>{editInput('inconsistencia', 'Descreva a inconsistência…', 'dl-cr-inc')}</td>
      <td style={{ ...cellStyle, width: 80, textAlign: 'center' }}>
        <input
          type="checkbox"
          defaultChecked={rev.resolvido}
          onChange={e => onUpdate(rev.id, 'resolvido', e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16A34A' }}
        />
      </td>
      <td style={{ ...cellStyle, width: 44, textAlign: 'center' }}>
        <button
          onClick={() => onDelete(rev.id)}
          title="Excluir linha"
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: MUTED, fontSize: 15, padding: '4px 8px', borderRadius: 6 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; (e.currentTarget as HTMLElement).style.background = '#FEF2F2' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = MUTED; (e.currentTarget as HTMLElement).style.background = 'none' }}
        >🗑</button>
      </td>
    </tr>
  )
})

export function ExportMenu({ onExportRevCSV, onExportSchedCSV, onExportJSON }: {
  onExportRevCSV: () => void
  onExportSchedCSV: () => void
  onExportJSON: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={btnSecondary}>↓ Exportar ▾</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 50, overflow: 'hidden' }}>
          {[
            { label: 'CSV — Revisões', fn: () => { onExportRevCSV(); setOpen(false) } },
            { label: 'CSV — Escala', fn: () => { onExportSchedCSV(); setOpen(false) } },
            { label: 'JSON (backup)', fn: () => { onExportJSON(); setOpen(false) } },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderRadius: 0, padding: '10px 14px', background: 'transparent', fontSize: 13, cursor: 'pointer', color: INK, fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function RevisaoTable({ filteredRevisions, search, people, suggestions, onSearchChange, onAddRevision, onUpdateRevision, onDeleteRevision, onExportRevCSV, onExportSchedCSV, onExportJSON }: {
  filteredRevisions: Revision[]
  search: string
  people: string[]
  suggestions: Suggestions
  onSearchChange: (v: string) => void
  onAddRevision: () => void
  onUpdateRevision: (id: string, field: keyof Revision, value: string | boolean) => void
  onDeleteRevision: (id: string) => void
  onExportRevCSV: () => void
  onExportSchedCSV: () => void
  onExportJSON: () => void
}) {
  return (
    <>
      <datalist id="dl-cr-emp">{suggestions.empresa.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-cr-doc">{suggestions.documento.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-cr-inc">{suggestions.inconsistencia.map(v => <option key={v} value={v} />)}</datalist>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: MUTED, fontSize: 13, pointerEvents: 'none' }}>🔍</span>
          <input
            type="text" value={search} onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar empresa, documento, responsável…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <button onClick={onAddRevision} style={btnPrimary}>+ Adicionar revisão</button>
        <ExportMenu onExportRevCSV={onExportRevCSV} onExportSchedCSV={onExportSchedCSV} onExportJSON={onExportJSON} />
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 24, background: '#fff', borderRadius: 8, border: `1px solid ${BORDER}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Data','Documento','Empresa','Responsável','Inconsistência','Resolvido',''].map((h, i) => (
                <th key={i} style={{ background: 'linear-gradient(to bottom, #FAFCFE, #F5F8FC)', color: 'var(--text-mute)', fontWeight: 700, padding: '10px 10px', textAlign: i === 5 ? 'center' : 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.9px', whiteSpace: 'nowrap', borderBottom: `1px solid var(--border-soft)` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRevisions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: 13, background: '#F8FAFC' }}>
                  {search ? 'Nenhum registro encontrado para a busca.' : 'Nenhuma revisão registrada. Clique em "+ Adicionar revisão".'}
                </td>
              </tr>
            ) : filteredRevisions.map(rev => (
              <RevisionRow
                key={rev.id}
                rev={rev}
                people={people}
                suggestions={suggestions}
                readOnly={false}
                onUpdate={onUpdateRevision}
                onDelete={onDeleteRevision}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export { btnPrimary, btnSecondary, inputStyle }
