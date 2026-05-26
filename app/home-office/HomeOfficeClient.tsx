'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type RowType = 'normal' | 'weekend' | 'holiday'
type Row = { day: number; type: RowType; label: string; entries: string[] }
// id is set when the sheet comes from Supabase
type Sheet = { id?: string; year: number; monthIdx: number; name: string; rows: Row[] }
type HistoryData = Record<number, Record<number, Sheet>>

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const DEFAULT_PEOPLE = ['Marcio Z', 'Luciane', 'Rodrigo Balem']
const STATUS_OPTIONS = ['Presencial', 'Home Office', 'Férias', 'Licença']

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const PRIMARY_DARK = '#1E3A6E'
const ACCENT = '#D1AE6E'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const WEEKEND_BG = '#C7DAEF'
const WEEKEND_TEXT = '#1E3A6E'
const HOLIDAY_BG = '#E8E6DC'
const HOLIDAY_TEXT = '#4A4339'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }
function monthKey(year: number, monthIdx: number) {
  return MONTHS_SHORT[monthIdx] + '/' + String(year).slice(-2)
}
function daysInMonth(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 0).getDate()
}
function dayOfWeek(year: number, monthIdx: number, day: number) {
  return new Date(year, monthIdx, day).getDay()
}

function buildSheet(year: number, monthIdx: number): Sheet {
  const total = daysInMonth(year, monthIdx)
  const rows: Row[] = []
  for (let d = 1; d <= total; d++) {
    const dow = dayOfWeek(year, monthIdx, d)
    let type: RowType = 'normal'
    let label = ''
    if (dow === 6) { type = 'weekend'; label = 'SAB' }
    else if (dow === 0) { type = 'weekend'; label = 'DOM' }
    rows.push({ day: d, type, label, entries: [] })
  }
  return { year, monthIdx, name: monthKey(year, monthIdx), rows }
}

function nextMonthOf(year: number, monthIdx: number) {
  if (monthIdx === 11) return { year: year + 1, monthIdx: 0 }
  return { year, monthIdx: monthIdx + 1 }
}

// ─── Row → Sheet ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSheet(r: any): Sheet {
  return {
    id: r.id,
    year: r.year,
    monthIdx: r.month_idx,
    name: monthKey(r.year, r.month_idx),
    rows: r.rows ?? [],
  }
}

// ─── Modal: Gerar planilha ────────────────────────────────────────────────────

function GenerateModal({
  onClose,
  onGenerate,
}: {
  onClose: () => void
  onGenerate: (year: number, monthIdx: number) => void
}) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2]

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: INK }}>Gerar nova planilha</h3>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: MUTED }}>
          Sábados e domingos serão marcados automaticamente. Feriados podem ser adicionados depois.
        </p>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 4 }}>Mês</label>
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          style={inputStyle}
        >
          {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, margin: '12px 0 4px' }}>Ano</label>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={inputStyle}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={() => onGenerate(year, month)} style={btnPrimary}>Gerar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Marcar feriado ────────────────────────────────────────────────────

function HolidayModal({
  mode,
  sheet,
  onClose,
  onConfirm,
}: {
  mode: 'mark' | 'unmark'
  sheet: Sheet
  onClose: () => void
  onConfirm: (day: number, name?: string) => void
}) {
  const totalDays = daysInMonth(sheet.year, sheet.monthIdx)
  const [day, setDay] = useState('')
  const [name, setName] = useState('')

  const holidays = sheet.rows.filter(r => r.type === 'holiday')

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: INK }}>
          {mode === 'mark' ? '⭐ Marcar feriado' : '↺ Desmarcar feriado'}
        </h3>
        {mode === 'unmark' && holidays.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 13, margin: '12px 0' }}>Nenhum feriado marcado neste mês.</p>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, margin: '12px 0 4px' }}>
              {mode === 'unmark' ? 'Feriado para desmarcar' : `Dia (1–${totalDays})`}
            </label>
            {mode === 'unmark' ? (
              <select value={day} onChange={e => setDay(e.target.value)} style={inputStyle}>
                <option value="">Selecione</option>
                {holidays.map(r => (
                  <option key={r.day} value={r.day}>{pad(r.day)} — {r.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="number" min={1} max={totalDays}
                value={day} onChange={e => setDay(e.target.value)}
                placeholder={`1 a ${totalDays}`}
                style={inputStyle}
              />
            )}
            {mode === 'mark' && (
              <>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, margin: '12px 0 4px' }}>
                  Nome do feriado (opcional)
                </label>
                <input
                  type="text"
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ex: Caravaggio"
                  style={inputStyle}
                />
              </>
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          {(mode === 'mark' || holidays.length > 0) && (
            <button
              onClick={() => {
                const d = parseInt(day)
                if (!d || d < 1 || d > totalDays) return
                onConfirm(d, name || undefined)
              }}
              style={btnPrimary}
            >
              {mode === 'mark' ? 'Marcar' : 'Desmarcar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px',
  fontSize: 13, border: `1px solid ${BORDER}`, borderRadius: 8,
  background: '#fff', color: INK, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: PRIMARY, color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', background: '#fff', color: INK,
  border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
}

const btnDanger: React.CSSProperties = {
  ...btnSecondary, color: '#DC2626', borderColor: '#FECACA',
}

// ─── Month Table ──────────────────────────────────────────────────────────────

function MonthTable({
  sheet,
  people,
  readOnly,
  pendingAddDays,
  onEntryChange,
  onEntryAdd,
  onPendingCommit,
}: {
  sheet: Sheet
  people: string[]
  readOnly: boolean
  pendingAddDays?: Set<number>
  onEntryChange?: (day: number, idx: number, person: string) => void
  onEntryAdd?: (day: number) => void
  onPendingCommit?: (day: number, person: string) => void
}) {
  const selectStyle: React.CSSProperties = {
    flex: 1, height: 36, border: 'none', background: 'transparent',
    padding: '0 10px', fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit', outline: 'none',
  }
  const iconBtnStyle: React.CSSProperties = {
    border: 'none', background: 'none', padding: '0 6px', cursor: 'pointer',
    height: 36, display: 'flex', alignItems: 'center', fontSize: 14,
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{
              background: PRIMARY_LIGHT, color: PRIMARY, fontWeight: 600,
              padding: '10px 14px', textAlign: 'center', fontSize: 12,
              borderTopLeftRadius: 8, width: 100,
              border: `1px solid ${BORDER}`,
            }}>DIA</th>
            <th style={{
              background: PRIMARY_LIGHT, color: PRIMARY, fontWeight: 600,
              padding: '10px 14px', textAlign: 'center', fontSize: 12,
              borderTopRightRadius: 8,
              border: `1px solid ${BORDER}`, borderLeft: 'none',
            }}>PESSOA</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map(row => {
            const dateStr = `${pad(row.day)}/${MONTHS_SHORT[sheet.monthIdx]}`
            const isWeekend = row.type === 'weekend'
            const isHoliday = row.type === 'holiday'
            const rowBg = isWeekend ? WEEKEND_BG : isHoliday ? HOLIDAY_BG : '#fff'
            const dayColor = isWeekend ? WEEKEND_TEXT : isHoliday ? HOLIDAY_TEXT : MUTED

            const dateTd = (
              <td style={{
                background: rowBg, borderBottom: `1px solid ${BORDER}`,
                borderLeft: `1px solid ${BORDER}`, padding: '0 14px',
                textAlign: 'center', verticalAlign: 'middle',
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: dayColor }}>{dateStr}</span>
              </td>
            )

            if (isWeekend || isHoliday) {
              return (
                <tr key={row.day}>
                  {dateTd}
                  <td style={{
                    background: rowBg, borderBottom: `1px solid ${BORDER}`,
                    borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`,
                    height: 36, padding: 0,
                  }}>
                    <div style={{ padding: '0 14px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isWeekend ? WEEKEND_TEXT : HOLIDAY_TEXT }}>
                        {row.label || 'FERIADO'}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            }

            const entries = row.entries || []

            if (readOnly) {
              return (
                <tr key={row.day}>
                  {dateTd}
                  <td style={{
                    background: rowBg, borderBottom: `1px solid ${BORDER}`,
                    borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`,
                    padding: 0,
                  }}>
                    <div style={{ padding: '6px 14px', minHeight: 36, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
                      {entries.length === 0 ? (
                        <span style={{ fontSize: 13, color: '#C0C8D8' }}>—</span>
                      ) : entries.map((e, i) => (
                        <span key={i} style={{ fontSize: 13, color: INK }}>{e}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            }

            const hasPending = pendingAddDays?.has(row.day) ?? false
            const displayEntries = entries.length === 0 ? [''] : entries

            return (
              <tr key={row.day}>
                {dateTd}
                <td style={{
                  background: rowBg, borderBottom: `1px solid ${BORDER}`,
                  borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`,
                  padding: 0,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0' }}>
                    {displayEntries.map((person, i) => {
                      const isLastEntry = i === entries.length - 1
                      const showAdd = isLastEntry && person !== '' && !hasPending
                      const showRemove = person !== ''
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', minHeight: 36 }}>
                          <select
                            value={person}
                            onChange={e => onEntryChange?.(row.day, i, e.target.value)}
                            style={{ ...selectStyle, color: person ? INK : MUTED }}
                          >
                            <option value="">—</option>
                            {people.map(p => <option key={p} value={p}>{p}</option>)}
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          {showRemove && (
                            <button
                              onClick={() => onEntryChange?.(row.day, i, '')}
                              title="Remover"
                              style={{ ...iconBtnStyle, color: '#9CA3AF' }}
                            >×</button>
                          )}
                          {showAdd && (
                            <button
                              onClick={() => onEntryAdd?.(row.day)}
                              title="Adicionar pessoa"
                              style={{ ...iconBtnStyle, color: PRIMARY, fontWeight: 700, fontSize: 16 }}
                            >+</button>
                          )}
                        </div>
                      )
                    })}
                    {hasPending && (
                      <div style={{ display: 'flex', alignItems: 'center', minHeight: 36 }}>
                        <select
                          value=""
                          onChange={e => onPendingCommit?.(row.day, e.target.value)}
                          style={{ ...selectStyle, color: MUTED }}
                        >
                          <option value="">+ Selecionar colaborador</option>
                          {people.map(p => <option key={p} value={p}>{p}</option>)}
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          onClick={() => onPendingCommit?.(row.day, '')}
                          title="Cancelar"
                          style={{ ...iconBtnStyle, color: '#9CA3AF' }}
                        >×</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomeOfficeClient() {
  const [hydrated, setHydrated] = useState(false)
  const [view, setView] = useState<'current' | 'history'>('current')
  const [current, setCurrent] = useState<Sheet | null>(null)
  const [history, setHistory] = useState<HistoryData>({})
  const [people, setPeople] = useState<string[]>([...DEFAULT_PEOPLE])
  const [histPath, setHistPath] = useState<{ year: number | null; month: number | null }>({ year: null, month: null })
  const [newPersonInput, setNewPersonInput] = useState('')
  const [pendingAddDays, setPendingAddDays] = useState<Set<number>>(new Set())

  // Modals
  const [showGenerate, setShowGenerate] = useState(false)
  const [holidayModal, setHolidayModal] = useState<'mark' | 'unmark' | null>(null)

  // ── Load from Supabase ──
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('home_office_sheets')
        .select('*')
        .order('year', { ascending: false })
        .order('month_idx', { ascending: false })

      if (error) {
        console.error('Erro ao carregar home office:', error)
        setHydrated(true)
        return
      }

      const sheets = data ?? []
      const currentRow = sheets.find(s => s.is_current) ?? null
      if (currentRow) {
        setCurrent(rowToSheet(currentRow))
        setPeople(currentRow.people ?? [...DEFAULT_PEOPLE])
      }

      const hist: HistoryData = {}
      for (const s of sheets.filter(s => !s.is_current)) {
        if (!hist[s.year]) hist[s.year] = {}
        hist[s.year][s.month_idx] = rowToSheet(s)
      }
      setHistory(hist)
      setHydrated(true)
    }
    load()
  }, [])

  // ── Persist rows of current sheet ──
  const saveCurrentRows = useCallback(async (newRows: Row[], optimisticSheet: Sheet) => {
    setCurrent(optimisticSheet)
    if (!optimisticSheet.id) return
    const supabase = createClient()
    const { error } = await supabase
      .from('home_office_sheets')
      .update({ rows: newRows })
      .eq('id', optimisticSheet.id)
    if (error) console.error('Erro ao salvar planilha:', error)
  }, [])

  // ── Persist people list ──
  const savePeople = useCallback(async (newPeople: string[]) => {
    setPeople(newPeople)
    if (!current?.id) return
    const supabase = createClient()
    const { error } = await supabase
      .from('home_office_sheets')
      .update({ people: newPeople })
      .eq('id', current.id)
    if (error) console.error('Erro ao salvar equipe:', error)
  }, [current?.id])

  // ── Current tab actions ──────────────────────────────────────────────────

  async function handleGenerate(year: number, monthIdx: number) {
    const newSheet = buildSheet(year, monthIdx)
    const supabase = createClient()

    // Archive existing current (if any)
    if (current?.id) {
      const { error } = await supabase
        .from('home_office_sheets')
        .update({ is_current: false })
        .eq('id', current.id)
      if (error) { console.error('Erro ao arquivar planilha:', error); return }
      // Keep old current in history
      setHistory(prev => {
        const h = { ...prev }
        if (!h[current.year]) h[current.year] = {}
        h[current.year][current.monthIdx] = { ...current, id: current.id }
        return h
      })
    }

    // Insert (or overwrite) new current sheet
    const { data, error } = await supabase
      .from('home_office_sheets')
      .upsert(
        { year, month_idx: monthIdx, is_current: true, rows: newSheet.rows, people },
        { onConflict: 'year,month_idx' }
      )
      .select()
      .single()

    if (error) { console.error('Erro ao gerar planilha:', error); return }

    setCurrent(rowToSheet(data))
    setShowGenerate(false)
    setPendingAddDays(new Set())
  }

  function handleEntryChange(day: number, idx: number, person: string) {
    if (!current) return
    const rows = current.rows.map(r => {
      if (r.day !== day) return r
      const newEntries = [...r.entries]
      if (person === '') {
        if (idx < newEntries.length) newEntries.splice(idx, 1)
      } else {
        newEntries[idx] = person
      }
      return { ...r, entries: newEntries }
    })
    void saveCurrentRows(rows, { ...current, rows })
  }

  function handleEntryAdd(day: number) {
    setPendingAddDays(prev => new Set([...prev, day]))
  }

  function handlePendingCommit(day: number, person: string) {
    setPendingAddDays(prev => { const next = new Set(prev); next.delete(day); return next })
    if (!person || !current) return
    const rows = current.rows.map(r => {
      if (r.day !== day) return r
      return { ...r, entries: [...r.entries, person] }
    })
    void saveCurrentRows(rows, { ...current, rows })
  }

  function handleAddPerson(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const name = newPersonInput.trim()
    if (!name || people.includes(name)) return
    void savePeople([...people, name])
    setNewPersonInput('')
  }

  function handleRemovePerson(idx: number) {
    void savePeople(people.filter((_, i) => i !== idx))
  }

  function handleMarkHoliday(day: number, name?: string) {
    if (!current) return
    const rows = current.rows.map(r =>
      r.day === day ? { ...r, type: 'holiday' as RowType, label: (name || 'FERIADO').toUpperCase(), entries: [] } : r
    )
    void saveCurrentRows(rows, { ...current, rows })
    setHolidayModal(null)
  }

  function handleUnmarkHoliday(day: number) {
    if (!current) return
    const dow = dayOfWeek(current.year, current.monthIdx, day)
    const rows = current.rows.map(r => {
      if (r.day !== day) return r
      if (dow === 6) return { ...r, type: 'weekend' as RowType, label: 'SAB', entries: [] }
      if (dow === 0) return { ...r, type: 'weekend' as RowType, label: 'DOM', entries: [] }
      return { ...r, type: 'normal' as RowType, label: '', entries: [] }
    })
    void saveCurrentRows(rows, { ...current, rows })
    setHolidayModal(null)
  }

  function handleReset() {
    if (!current) return
    if (!window.confirm('Limpar todos os preenchimentos do mês vigente?')) return
    const freshRows = buildSheet(current.year, current.monthIdx).rows
    setPendingAddDays(new Set())
    void saveCurrentRows(freshRows, { ...current, rows: freshRows })
  }

  async function handleFinalize() {
    if (!current) return
    const label = `${MONTHS_PT[current.monthIdx]} de ${current.year}`
    if (!window.confirm(`Finalizar ${label} e mover para o histórico?\n\nO próximo mês será gerado automaticamente.`)) return

    const { year: ny, monthIdx: nm } = nextMonthOf(current.year, current.monthIdx)
    const supabase = createClient()

    // Archive current sheet
    const { error: archiveErr } = await supabase
      .from('home_office_sheets')
      .update({ is_current: false })
      .eq('id', current.id)
    if (archiveErr) { console.error('Erro ao finalizar planilha:', archiveErr); return }

    // Insert new current sheet for next month
    const { data, error: insertErr } = await supabase
      .from('home_office_sheets')
      .upsert(
        { year: ny, month_idx: nm, is_current: true, rows: buildSheet(ny, nm).rows, people },
        { onConflict: 'year,month_idx' }
      )
      .select()
      .single()
    if (insertErr) { console.error('Erro ao gerar próximo mês:', insertErr); return }

    const archivedSheet = { ...current }
    setHistory(prev => {
      const h = { ...prev }
      if (!h[current.year]) h[current.year] = {}
      h[current.year][current.monthIdx] = archivedSheet
      return h
    })
    setCurrent(rowToSheet(data))
    setPeople(people)
    setPendingAddDays(new Set())
  }

  // ── History actions ──────────────────────────────────────────────────────

  async function handleDeleteArchived(year: number, month: number) {
    const sheet = history[year]?.[month]
    if (!sheet) return
    if (!window.confirm(`Excluir ${sheet.name} permanentemente do histórico?`)) return

    const supabase = createClient()
    const { error } = await supabase
      .from('home_office_sheets')
      .delete()
      .eq('year', year)
      .eq('month_idx', month)
      .eq('is_current', false)
    if (error) { console.error('Erro ao excluir histórico:', error); return }

    setHistory(prev => {
      const h = { ...prev }
      const yr = { ...h[year] }
      delete yr[month]
      if (Object.keys(yr).length === 0) {
        delete h[year]
      } else {
        h[year] = yr
      }
      return h
    })
    setHistPath({ year: null, month: null })
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = current ? {
    workdays: current.rows.filter(r => r.type === 'normal').length,
    filled: current.rows.filter(r => r.type === 'normal' && r.entries.length > 0).length,
    holidays: current.rows.filter(r => r.type === 'holiday').length,
  } : null

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hydrated) return null

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK, letterSpacing: -0.3 }}>
          Controle de Home Office
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
          Gestão mensal com arquivamento automático no histórico
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'inline-flex', padding: 4,
        background: '#F0F4FA', borderRadius: 10, gap: 4,
        marginBottom: 20,
      }}>
        {(['current', 'history'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '8px 18px', fontSize: 14, fontWeight: 500,
              border: 'none', borderRadius: 7, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
              background: view === v ? '#fff' : 'transparent',
              color: view === v ? INK : MUTED,
              boxShadow: view === v ? '0 1px 4px rgba(30,37,61,0.10)' : 'none',
            }}
          >
            {v === 'current' ? '📅 Mês vigente' : '📁 Histórico'}
          </button>
        ))}
      </div>

      {/* ── Mês Vigente ─────────────────────────────────────────────────── */}
      {view === 'current' && (
        <>
          {!current ? (
            <div style={{
              padding: '48px 24px', textAlign: 'center',
              background: '#F8FAFC', borderRadius: 10,
              border: `1px solid ${BORDER}`,
            }}>
              <p style={{ margin: '0 0 16px', color: MUTED, fontSize: 14 }}>Nenhuma planilha ativa.</p>
              <button onClick={() => setShowGenerate(true)} style={btnPrimary}>+ Gerar nova planilha</button>
            </div>
          ) : (
            <>
              <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 600, color: INK, textTransform: 'capitalize' }}>
                {MONTHS_PT[current.monthIdx]} de {current.year}
              </h3>

              {/* Stats */}
              {stats && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Dias úteis', value: stats.workdays },
                    { label: 'Preenchidos', value: stats.filled },
                    { label: 'Feriados', value: stats.holidays },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: PRIMARY_LIGHT, borderRadius: 8,
                      padding: '10px 16px', flex: 1, minWidth: 100,
                    }}>
                      <div style={{ fontSize: 11, color: PRIMARY, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: PRIMARY_DARK, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* People bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                flexWrap: 'wrap', padding: '10px 12px',
                background: '#F8FAFC', borderRadius: 8,
                border: `1px solid ${BORDER}`, marginBottom: 14,
                fontSize: 13,
              }}>
                <span style={{ color: MUTED }}>👥 Equipe:</span>
                {people.map((p, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: '#fff', padding: '3px 4px 3px 10px',
                    borderRadius: 999, border: `1px solid ${BORDER}`, fontSize: 13,
                  }}>
                    {p}
                    <button
                      onClick={() => handleRemovePerson(i)}
                      aria-label={`Remover ${p}`}
                      style={{
                        border: 'none', background: 'none', padding: '2px 6px',
                        cursor: 'pointer', color: '#9CA3AF', borderRadius: '50%',
                        fontSize: 14, lineHeight: 1,
                      }}
                    >×</button>
                  </span>
                ))}
                <input
                  type="text"
                  value={newPersonInput}
                  onChange={e => setNewPersonInput(e.target.value)}
                  onKeyDown={handleAddPerson}
                  placeholder="+ adicionar (Enter)"
                  style={{
                    border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 13, padding: '4px 8px', minWidth: 160, fontFamily: 'inherit', color: INK,
                  }}
                />
              </div>

              {/* Table */}
              <MonthTable
                sheet={current}
                people={people}
                readOnly={false}
                pendingAddDays={pendingAddDays}
                onEntryChange={handleEntryChange}
                onEntryAdd={handleEntryAdd}
                onPendingCommit={handlePendingCommit}
              />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => setHolidayModal('mark')} style={btnSecondary}>⭐ Marcar feriado</button>
                <button onClick={() => setHolidayModal('unmark')} style={btnSecondary}>↺ Desmarcar feriado</button>
                <button onClick={handleReset} style={btnDanger}>🗑 Limpar mês</button>
                <button onClick={handleFinalize} style={{ ...btnPrimary, marginLeft: 'auto' }}>
                  ✓ Finalizar e arquivar
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Histórico ───────────────────────────────────────────────────── */}
      {view === 'history' && (() => {
        const { year, month } = histPath
        const years = Object.keys(history).map(Number).sort((a, b) => b - a)

        if (year !== null && month !== null) {
          const sheet = history[year]?.[month]
          if (!sheet) { setHistPath({ year, month: null }); return null }
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED, marginBottom: 14 }}>
                <button onClick={() => setHistPath({ year: null, month: null })} style={{ ...btnSecondary, padding: '4px 8px', fontSize: 13 }}>Histórico</button>
                <span>/</span>
                <button onClick={() => setHistPath({ year, month: null })} style={{ ...btnSecondary, padding: '4px 8px', fontSize: 13 }}>{year}</button>
                <span>/</span>
                <span style={{ color: INK, fontWeight: 500 }}>{sheet.name}</span>
              </div>

              <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 600, color: INK, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'capitalize' }}>
                {MONTHS_PT[sheet.monthIdx]} de {sheet.year}
                <span style={{ fontSize: 11, color: MUTED, fontWeight: 400, background: '#F0F4FA', padding: '3px 8px', borderRadius: 20 }}>
                  somente leitura
                </span>
              </h3>

              <MonthTable sheet={sheet} people={[]} readOnly={true} />

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={() => setHistPath({ year, month: null })} style={btnSecondary}>← Voltar para {year}</button>
                <button onClick={() => handleDeleteArchived(year, month)} style={{ ...btnDanger, marginLeft: 'auto' }}>
                  🗑 Excluir do histórico
                </button>
              </div>
            </>
          )
        }

        if (year !== null) {
          const months = history[year] ?? {}
          const monthList = Object.keys(months).map(Number).sort((a, b) => a - b)
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED, marginBottom: 14 }}>
                <button onClick={() => setHistPath({ year: null, month: null })} style={{ ...btnSecondary, padding: '4px 8px', fontSize: 13 }}>Histórico</button>
                <span>/</span>
                <span style={{ color: INK, fontWeight: 500 }}>{year}</span>
              </div>
              {monthList.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: MUTED, background: '#F8FAFC', borderRadius: 10, border: `1px solid ${BORDER}` }}>
                  Nenhum mês arquivado em {year}.
                </div>
              ) : monthList.map(m => (
                <div
                  key={m}
                  onClick={() => setHistPath({ year, month: m })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', border: `1px solid ${BORDER}`,
                    borderRadius: 8, background: '#fff', cursor: 'pointer',
                    marginBottom: 6, fontSize: 14,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <span style={{ fontSize: 18 }}>📄</span>
                  <span style={{ fontWeight: 500, color: INK }}>{months[m].name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: MUTED, textTransform: 'capitalize' }}>
                    {MONTHS_PT[m]}
                  </span>
                </div>
              ))}
            </>
          )
        }

        if (years.length === 0) {
          return (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: MUTED, background: '#F8FAFC', borderRadius: 10, border: `1px solid ${BORDER}` }}>
              Histórico vazio.<br />
              <small style={{ fontSize: 12 }}>Finalize um mês na guia "Mês vigente" para arquivá-lo aqui.</small>
            </div>
          )
        }
        return (
          <>
            {years.map(y => {
              const count = Object.keys(history[y] ?? {}).length
              return (
                <div
                  key={y}
                  onClick={() => setHistPath({ year: y, month: null })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', border: `1px solid ${BORDER}`,
                    borderRadius: 8, background: '#fff', cursor: 'pointer',
                    marginBottom: 6, fontSize: 14, fontWeight: 500,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <span style={{ fontSize: 18, color: PRIMARY }}>📁</span>
                  <span style={{ color: INK }}>{y}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: MUTED }}>
                    {count} {count === 1 ? 'mês' : 'meses'}
                  </span>
                </div>
              )
            })}
          </>
        )
      })()}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showGenerate && (
        <GenerateModal onClose={() => setShowGenerate(false)} onGenerate={handleGenerate} />
      )}
      {holidayModal && current && (
        <HolidayModal
          mode={holidayModal}
          sheet={current}
          onClose={() => setHolidayModal(null)}
          onConfirm={(day, name) =>
            holidayModal === 'mark' ? handleMarkHoliday(day, name) : handleUnmarkHoliday(day)
          }
        />
      )}
    </div>
  )
}
