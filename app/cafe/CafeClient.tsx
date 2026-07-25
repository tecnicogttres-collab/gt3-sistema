'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type CafeWeek = {
  weekKey: string // ISO date (YYYY-MM-DD) da segunda-feira da semana — chave estável entre meses
  diaInicio: number // dia do mês (dentro do mês da planilha) em que a semana começa
  diaFim: number // dia do mês em que a semana termina
  brokenStart: boolean // a segunda-feira dessa semana pertence ao mês anterior
  brokenEnd: boolean // a sexta-feira dessa semana pertence ao mês seguinte
  manha: string
  tarde: string
}
// id é definido quando a planilha vem do Supabase
type Sheet = { id?: string; year: number; monthIdx: number; name: string; weeks: CafeWeek[] }
type HistoryData = Record<number, Record<number, Sheet>>

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const DEFAULT_PEOPLE = ['Marcio Z', 'Luciane', 'Rodrigo Balem']

const PRIMARY = '#8C5A2B'
const PRIMARY_LIGHT = '#F5EBDD'
const PRIMARY_DARK = '#5C3A1B'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const BROKEN_BG = '#FEF3E2'
const BROKEN_TEXT = '#92400E'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }
function monthKey(year: number, monthIdx: number) {
  return MONTHS_SHORT[monthIdx] + '/' + String(year).slice(-2)
}
function daysInMonth(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 0).getDate()
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function mondayOf(d: Date): Date {
  const day = d.getDay() // 0 dom .. 6 sáb
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  return m
}

function buildWeeks(year: number, monthIdx: number): CafeWeek[] {
  const total = daysInMonth(year, monthIdx)
  const monthStart = new Date(year, monthIdx, 1)
  const monthEnd = new Date(year, monthIdx, total)
  const weeks: CafeWeek[] = []
  const monday = mondayOf(monthStart)
  while (monday <= monthEnd) {
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const dispStart = monday < monthStart ? monthStart : monday
    const dispEnd = friday > monthEnd ? monthEnd : friday
    weeks.push({
      weekKey: isoDate(monday),
      diaInicio: dispStart.getDate(),
      diaFim: dispEnd.getDate(),
      brokenStart: monday < monthStart,
      brokenEnd: friday > monthEnd,
      manha: '',
      tarde: '',
    })
    monday.setDate(monday.getDate() + 7)
  }
  return weeks
}

function buildSheet(year: number, monthIdx: number): Sheet {
  return { year, monthIdx, name: monthKey(year, monthIdx), weeks: buildWeeks(year, monthIdx) }
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
    weeks: r.weeks ?? [],
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
          Todas as semanas do mês (segunda a sexta) já ficam disponíveis para preencher.
        </p>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 4 }}>Mês</label>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} style={inputStyle}>
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

// ─── Week Table ───────────────────────────────────────────────────────────────

function WeekTable({
  sheet,
  people,
  readOnly,
  onShiftChange,
}: {
  sheet: Sheet
  people: string[]
  readOnly: boolean
  onShiftChange?: (weekKey: string, turno: 'manha' | 'tarde', person: string) => void
}) {
  const selectStyle: React.CSSProperties = {
    width: '100%', height: 36, border: 'none', background: 'transparent',
    padding: '0 10px', fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
        <thead>
          <tr>
            {['SEMANA', '☀️ MANHÃ', '🌇 TARDE'].map((label, i) => (
              <th key={label} style={{
                background: PRIMARY_LIGHT, color: PRIMARY, fontWeight: 600,
                padding: '10px 14px', textAlign: 'center', fontSize: 12,
                borderTopLeftRadius: i === 0 ? 8 : 0,
                borderTopRightRadius: i === 2 ? 8 : 0,
                border: `1px solid ${BORDER}`, borderLeft: i === 0 ? undefined : 'none',
              }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.weeks.map(week => {
            const dateStr = `${pad(week.diaInicio)}–${pad(week.diaFim)}/${MONTHS_SHORT[sheet.monthIdx]}`
            const isBroken = week.brokenStart || week.brokenEnd
            const bg = isBroken ? BROKEN_BG : '#fff'

            const dateTd = (
              <td style={{
                background: bg, borderBottom: `1px solid ${BORDER}`,
                borderLeft: `1px solid ${BORDER}`, padding: '8px 14px',
                textAlign: 'center', verticalAlign: 'middle',
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: isBroken ? BROKEN_TEXT : MUTED }}>{dateStr}</span>
                {week.brokenStart && (
                  <div style={{ fontSize: 10, color: BROKEN_TEXT, marginTop: 2 }}>continua do mês anterior</div>
                )}
                {week.brokenEnd && (
                  <div style={{ fontSize: 10, color: BROKEN_TEXT, marginTop: 2 }}>continua no próximo mês</div>
                )}
              </td>
            )

            function shiftTd(turno: 'manha' | 'tarde') {
              const value = week[turno]
              const isLast = turno === 'tarde'
              const borderStyle = {
                borderLeft: `1px solid ${BORDER}`,
                borderRight: isLast ? `1px solid ${BORDER}` : undefined,
                borderBottom: `1px solid ${BORDER}`,
              }
              if (readOnly) {
                return (
                  <td style={{ background: bg, ...borderStyle, padding: '8px 14px', textAlign: 'center' }}>
                    <span style={{ fontSize: 13, color: value ? INK : '#C0C8D8' }}>{value || '—'}</span>
                  </td>
                )
              }
              return (
                <td style={{ background: bg, ...borderStyle, padding: 0 }}>
                  <select
                    value={value}
                    onChange={e => onShiftChange?.(week.weekKey, turno, e.target.value)}
                    style={{ ...selectStyle, color: value ? INK : MUTED }}
                  >
                    <option value="">—</option>
                    {people.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
              )
            }

            return (
              <tr key={week.weekKey}>
                {dateTd}
                {shiftTd('manha')}
                {shiftTd('tarde')}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CafeClient() {
  const [hydrated, setHydrated] = useState(false)
  const [view, setView] = useState<'current' | 'history'>('current')
  const [current, setCurrent] = useState<Sheet | null>(null)
  const [history, setHistory] = useState<HistoryData>({})
  const [people, setPeople] = useState<string[]>([...DEFAULT_PEOPLE])
  const [histPath, setHistPath] = useState<{ year: number | null; month: number | null }>({ year: null, month: null })
  const [newPersonInput, setNewPersonInput] = useState('')

  const [showGenerate, setShowGenerate] = useState(false)

  // ── Load from Supabase ──
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('cafe_sheets')
        .select('id, year, month_idx, is_current, weeks, people')
        .order('year', { ascending: false })
        .order('month_idx', { ascending: false })

      if (error) {
        console.error('Erro ao carregar café:', error)
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

  // ── Persist weeks of current sheet ──
  const saveCurrentWeeks = useCallback(async (newWeeks: CafeWeek[], optimisticSheet: Sheet) => {
    setCurrent(optimisticSheet)
    if (!optimisticSheet.id) return
    const supabase = createClient()
    const { error } = await supabase
      .from('cafe_sheets')
      .update({ weeks: newWeeks })
      .eq('id', optimisticSheet.id)
    if (error) console.error('Erro ao salvar escala:', error)
  }, [])

  // ── Persist people list ──
  const savePeople = useCallback(async (newPeople: string[]) => {
    setPeople(newPeople)
    if (!current?.id) return
    const supabase = createClient()
    const { error } = await supabase
      .from('cafe_sheets')
      .update({ people: newPeople })
      .eq('id', current.id)
    if (error) console.error('Erro ao salvar equipe:', error)
  }, [current?.id])

  // ── Current tab actions ──────────────────────────────────────────────────

  async function handleGenerate(year: number, monthIdx: number) {
    const newSheet = buildSheet(year, monthIdx)
    const supabase = createClient()

    if (current?.id) {
      const { error } = await supabase
        .from('cafe_sheets')
        .update({ is_current: false })
        .eq('id', current.id)
      if (error) { console.error('Erro ao arquivar planilha:', error); return }
      setHistory(prev => {
        const h = { ...prev }
        if (!h[current.year]) h[current.year] = {}
        h[current.year][current.monthIdx] = { ...current, id: current.id }
        return h
      })
    }

    const { data, error } = await supabase
      .from('cafe_sheets')
      .upsert(
        { year, month_idx: monthIdx, is_current: true, weeks: newSheet.weeks, people },
        { onConflict: 'year,month_idx' }
      )
      .select()
      .single()

    if (error) { console.error('Erro ao gerar planilha:', error); return }

    setCurrent(rowToSheet(data))
    setShowGenerate(false)
  }

  function handleShiftChange(weekKey: string, turno: 'manha' | 'tarde', person: string) {
    if (!current) return
    const weeks = current.weeks.map(w => w.weekKey === weekKey ? { ...w, [turno]: person } : w)
    void saveCurrentWeeks(weeks, { ...current, weeks })
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

  function handleReset() {
    if (!current) return
    if (!window.confirm('Limpar todos os preenchimentos do mês vigente?')) return
    const freshWeeks = buildWeeks(current.year, current.monthIdx)
    void saveCurrentWeeks(freshWeeks, { ...current, weeks: freshWeeks })
  }

  async function handleFinalize() {
    if (!current) return
    const label = `${MONTHS_PT[current.monthIdx]} de ${current.year}`
    if (!window.confirm(`Finalizar ${label} e mover para o histórico?\n\nO próximo mês será gerado automaticamente. Se a última semana for quebrada, quem está escalado continua automaticamente nos dias restantes.`)) return

    const { year: ny, monthIdx: nm } = nextMonthOf(current.year, current.monthIdx)
    const supabase = createClient()

    // Semana quebrada no fim do mês atual → carrega manhã/tarde para a mesma semana no mês seguinte
    const lastWeek = current.weeks[current.weeks.length - 1]
    const newWeeks = buildWeeks(ny, nm)
    if (lastWeek?.brokenEnd && newWeeks[0]?.weekKey === lastWeek.weekKey) {
      newWeeks[0] = { ...newWeeks[0], manha: lastWeek.manha, tarde: lastWeek.tarde }
    }

    const { error: archiveErr } = await supabase
      .from('cafe_sheets')
      .update({ is_current: false })
      .eq('id', current.id)
    if (archiveErr) { console.error('Erro ao finalizar planilha:', archiveErr); return }

    const { data, error: insertErr } = await supabase
      .from('cafe_sheets')
      .upsert(
        { year: ny, month_idx: nm, is_current: true, weeks: newWeeks, people },
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
  }

  // ── History actions ──────────────────────────────────────────────────────

  async function handleDeleteArchived(year: number, month: number) {
    const sheet = history[year]?.[month]
    if (!sheet) return
    if (!window.confirm(`Excluir ${sheet.name} permanentemente do histórico?`)) return

    const supabase = createClient()
    const { error } = await supabase
      .from('cafe_sheets')
      .delete()
      .eq('year', year)
      .eq('month_idx', month)
      .eq('is_current', false)
    if (error) { console.error('Erro ao excluir histórico:', error); return }

    setHistory(prev => {
      const h = { ...prev }
      const yr = { ...h[year] }
      delete yr[month]
      if (Object.keys(yr).length === 0) delete h[year]
      else h[year] = yr
      return h
    })
    setHistPath({ year: null, month: null })
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = current ? {
    weeks: current.weeks.length,
    filled: current.weeks.filter(w => w.manha && w.tarde).length,
  } : null

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hydrated) return null

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK, letterSpacing: -0.3 }}>
          ☕ Escala de Café
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
          Escala semanal (manhã/tarde) com arquivamento automático no histórico
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
                    { label: 'Semanas', value: stats.weeks },
                    { label: 'Preenchidas', value: stats.filled },
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
              <WeekTable
                sheet={current}
                people={people}
                readOnly={false}
                onShiftChange={handleShiftChange}
              />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={handleReset} style={btnDanger}>🗑 Limpar mês</button>
                <button onClick={handleFinalize} style={{ ...btnPrimary, marginLeft: 'auto' }}>
                  ✓ Finalizar mês e ir para o próximo
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

              <WeekTable sheet={sheet} people={[]} readOnly={true} />

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
    </div>
  )
}
