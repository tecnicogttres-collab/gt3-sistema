'use client'

import type { Sheet, ScheduleRow } from './types'
import { ausenciaNoDia, rotuloAusencia, type Ausencia } from '../lib/disponibilidade-ferias'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const WEEKEND_BG = '#C7DAEF'
const WEEKEND_TEXT = '#1E3A6E'
const HOLIDAY_BG = '#E8E6DC'
const HOLIDAY_TEXT = '#4A4339'
const CONFLITO_BG = '#FEF2F2'
const CONFLITO_BORDER = '#FCA5A5'
const CONFLITO_TEXT = '#B91C1C'

const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function pad(n: number) { return String(n).padStart(2, '0') }

export function ScheduleTable({ sheet, people, readOnly, onPersonChange, ausencias = [] }: {
  sheet: Sheet
  people: string[]
  readOnly: boolean
  onPersonChange?: (day: number, person: string) => void
  /** Férias/folgas do Calendário de férias — bloqueia quem não está disponível no dia */
  ausencias?: Ausencia[]
}) {
  return (
    <div style={{ overflowX: 'auto', maxWidth: 420 }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ background: 'linear-gradient(to bottom, #FAFCFE, #F5F8FC)', color: 'var(--text-mute)', fontWeight: 700, padding: '9px 14px', textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.9px', borderTopLeftRadius: 8, width: 100, border: `1px solid var(--border-soft)` }}>DIA</th>
            <th style={{ background: 'linear-gradient(to bottom, #FAFCFE, #F5F8FC)', color: 'var(--text-mute)', fontWeight: 700, padding: '9px 14px', textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.9px', borderTopRightRadius: 8, border: `1px solid var(--border-soft)`, borderLeft: 'none' }}>REVISOR</th>
          </tr>
        </thead>
        <tbody>
          {sheet.schedule.map((row: ScheduleRow) => {
            const isWknd = row.type === 'weekend'
            const isHol = row.type === 'holiday'
            const bg = isWknd ? WEEKEND_BG : isHol ? HOLIDAY_BG : '#fff'
            const dayClr = isWknd ? WEEKEND_TEXT : isHol ? HOLIDAY_TEXT : MUTED
            const dateStr = `${pad(row.day)}/${MONTHS_SHORT[sheet.monthIdx]}`
            const dataIso = `${sheet.year}-${pad(sheet.monthIdx + 1)}-${pad(row.day)}`
            // Revisor já escalado que está de férias/folga neste dia
            const conflito = !isWknd && !isHol ? ausenciaNoDia(row.person, dataIso, ausencias) : null
            const cellBg = conflito ? CONFLITO_BG : bg
            return (
              <tr key={row.day}>
                <td style={{ background: cellBg, border: `1px solid var(--border-soft)`, height: 34, textAlign: 'center', padding: '0 14px' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: conflito ? CONFLITO_TEXT : dayClr }}>{dateStr}</span>
                </td>
                <td
                  title={conflito ? `${row.person} está de ${rotuloAusencia(conflito)} neste dia — escolha outro revisor` : undefined}
                  style={{ background: cellBg, border: `1px solid ${conflito ? CONFLITO_BORDER : 'var(--border-soft)'}`, borderLeft: 'none', height: 34, padding: 0, position: 'relative' }}>
                  {isWknd || isHol ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isWknd ? WEEKEND_TEXT : HOLIDAY_TEXT }}>{row.label || 'FERIADO'}</span>
                    </div>
                  ) : readOnly ? (
                    <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <span style={{ fontSize: 13, color: conflito ? CONFLITO_TEXT : row.person ? INK : '#C0C8D8' }}>
                        {row.person || '—'}{conflito ? ` ⚠ ${rotuloAusencia(conflito)}` : ''}
                      </span>
                    </div>
                  ) : (
                    <>
                      <select
                        value={row.person}
                        onChange={e => onPersonChange?.(row.day, e.target.value)}
                        style={{ width: '100%', height: 34, border: 'none', background: 'transparent', padding: conflito ? '0 78px 0 10px' : '0 10px', fontSize: 13, color: conflito ? CONFLITO_TEXT : row.person ? INK : MUTED, fontWeight: conflito ? 700 : 400, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="">—</option>
                        {people.map(p => {
                          const aus = ausenciaNoDia(p, dataIso, ausencias)
                          // Quem está de férias/folga no dia não pode ser escolhido (só aparece, desabilitado).
                          return <option key={p} value={p} disabled={!!aus && p !== row.person}>{aus ? `${p} — de ${rotuloAusencia(aus)}` : p}</option>
                        })}
                      </select>
                      {conflito && (
                        <span style={{ position: 'absolute', right: 26, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10.5, fontWeight: 800, color: '#fff', background: CONFLITO_TEXT, borderRadius: 999, padding: '2px 7px' }}>
                          ⚠ {rotuloAusencia(conflito)}
                        </span>
                      )}
                    </>
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
