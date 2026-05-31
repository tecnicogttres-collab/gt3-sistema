'use client'

import type { Sheet, ScheduleRow } from './types'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const WEEKEND_BG = '#C7DAEF'
const WEEKEND_TEXT = '#1E3A6E'
const HOLIDAY_BG = '#E8E6DC'
const HOLIDAY_TEXT = '#4A4339'

const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function pad(n: number) { return String(n).padStart(2, '0') }

export function ScheduleTable({ sheet, people, readOnly, onPersonChange }: {
  sheet: Sheet
  people: string[]
  readOnly: boolean
  onPersonChange?: (day: number, person: string) => void
}) {
  return (
    <div style={{ overflowX: 'auto', maxWidth: 420 }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ background: PRIMARY_LIGHT, color: PRIMARY, fontWeight: 600, padding: '9px 14px', textAlign: 'center', fontSize: 12, borderTopLeftRadius: 8, width: 100, border: `1px solid ${BORDER}` }}>DIA</th>
            <th style={{ background: PRIMARY_LIGHT, color: PRIMARY, fontWeight: 600, padding: '9px 14px', textAlign: 'center', fontSize: 12, borderTopRightRadius: 8, border: `1px solid ${BORDER}`, borderLeft: 'none' }}>REVISOR</th>
          </tr>
        </thead>
        <tbody>
          {sheet.schedule.map((row: ScheduleRow) => {
            const isWknd = row.type === 'weekend'
            const isHol = row.type === 'holiday'
            const bg = isWknd ? WEEKEND_BG : isHol ? HOLIDAY_BG : '#fff'
            const dayClr = isWknd ? WEEKEND_TEXT : isHol ? HOLIDAY_TEXT : MUTED
            const dateStr = `${pad(row.day)}/${MONTHS_SHORT[sheet.monthIdx]}`
            return (
              <tr key={row.day}>
                <td style={{ background: bg, border: `1px solid ${BORDER}`, height: 34, textAlign: 'center', padding: '0 14px' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: dayClr }}>{dateStr}</span>
                </td>
                <td style={{ background: bg, border: `1px solid ${BORDER}`, borderLeft: 'none', height: 34, padding: 0 }}>
                  {isWknd || isHol ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isWknd ? WEEKEND_TEXT : HOLIDAY_TEXT }}>{row.label || 'FERIADO'}</span>
                    </div>
                  ) : readOnly ? (
                    <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <span style={{ fontSize: 13, color: row.person ? INK : '#C0C8D8' }}>{row.person || '—'}</span>
                    </div>
                  ) : (
                    <select
                      value={row.person}
                      onChange={e => onPersonChange?.(row.day, e.target.value)}
                      style={{ width: '100%', height: 34, border: 'none', background: 'transparent', padding: '0 10px', fontSize: 13, color: row.person ? INK : MUTED, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="">—</option>
                      {people.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function RevisaoEquipe({ people, newPersonInput, onInputChange, onAddPerson, onRemovePerson }: {
  people: string[]
  newPersonInput: string
  onInputChange: (v: string) => void
  onAddPerson: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onRemovePerson: (idx: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 12, fontSize: 13 }}>
      <span style={{ color: MUTED }}>👥 Equipe:</span>
      {people.map((p, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', padding: '3px 4px 3px 10px', borderRadius: 999, border: `1px solid ${BORDER}` }}>
          {p}
          <button onClick={() => onRemovePerson(i)} style={{ border: 'none', background: 'none', padding: '2px 6px', cursor: 'pointer', color: '#9CA3AF', fontSize: 14, lineHeight: 1 }}>×</button>
        </span>
      ))}
      <input
        type="text"
        value={newPersonInput}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={onAddPerson}
        placeholder="+ adicionar (Enter)"
        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, padding: '4px 8px', minWidth: 160, fontFamily: 'inherit', color: INK }}
      />
    </div>
  )
}
