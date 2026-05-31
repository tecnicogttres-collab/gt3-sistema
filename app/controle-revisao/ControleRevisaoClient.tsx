'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../lib/supabase'
import { RevisaoTable, RevisionRow, btnPrimary, btnSecondary, inputStyle } from './RevisaoTable'
import { RevisaoEquipe, ScheduleTable } from './RevisaoEquipe'
import type { RowType, Revision, ScheduleRow, Sheet, HistoryData } from './types'

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const DEFAULT_PEOPLE = ['Marcio Z', 'Luciane', 'Rodrigo Balem', 'Camila']

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const PRIMARY_DARK = '#1E3A6E'
const ACCENT = '#D1AE6E'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'

const btnDanger: React.CSSProperties = { ...btnSecondary, color: '#DC2626', borderColor: '#FECACA' }

// ─── Helpers ────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }
function monthKey(year: number, mi: number) { return MONTHS_SHORT[mi] + '/' + String(year).slice(-2) }
function daysInMonth(year: number, mi: number) { return new Date(year, mi + 1, 0).getDate() }
function dayOfWeek(year: number, mi: number, d: number) { return new Date(year, mi, d).getDay() }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36) }
function todayStr() {
  const d = new Date()
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function buildSchedule(year: number, mi: number): ScheduleRow[] {
  const total = daysInMonth(year, mi)
  return Array.from({ length: total }, (_, i) => {
    const d = i + 1
    const dow = dayOfWeek(year, mi, d)
    if (dow === 6) return { day: d, type: 'weekend' as RowType, label: 'SAB', person: '' }
    if (dow === 0) return { day: d, type: 'weekend' as RowType, label: 'DOM', person: '' }
    return { day: d, type: 'normal' as RowType, label: '', person: '' }
  })
}

function buildSheet(year: number, mi: number): Sheet {
  return { year, monthIdx: mi, name: monthKey(year, mi), revisions: [], schedule: buildSchedule(year, mi) }
}

function nextMonthOf(year: number, mi: number) {
  return mi === 11 ? { year: year + 1, monthIdx: 0 } : { year, monthIdx: mi + 1 }
}

function newRevision(): Revision {
  return { id: uid(), data: todayStr(), documento: '', empresa: '', responsavel: '', inconsistencia: '', resolvido: false }
}

function csvEscape(v: string) {
  const s = String(v ?? '')
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob(['﻿' + content], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 100)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSheet(r: any): Sheet {
  return {
    id: r.id,
    year: r.year,
    monthIdx: r.month_idx,
    name: monthKey(r.year, r.month_idx),
    revisions: r.revisions ?? [],
    schedule: r.schedule ?? [],
  }
}

// ─── Generate Modal ──────────────────────────────────────────────────────────

function GenerateModal({ onClose, onGenerate }: {
  onClose: () => void
  onGenerate: (year: number, mi: number) => void
}) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2]
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: INK }}>Gerar nova planilha</h3>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: MUTED }}>Fins de semana marcados automaticamente. Feriados podem ser adicionados depois.</p>
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

// ─── Holiday Modal ───────────────────────────────────────────────────────────

function HolidayModal({ mode, sheet, onClose, onConfirm }: {
  mode: 'mark' | 'unmark'
  sheet: Sheet
  onClose: () => void
  onConfirm: (day: number, name?: string) => void
}) {
  const total = daysInMonth(sheet.year, sheet.monthIdx)
  const [day, setDay] = useState('')
  const [name, setName] = useState('')
  const holidays = sheet.schedule.filter(r => r.type === 'holiday')
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 600, color: INK }}>
          {mode === 'mark' ? '⭐ Marcar feriado' : '↺ Desmarcar feriado'}
        </h3>
        {mode === 'unmark' && holidays.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 13 }}>Nenhum feriado marcado neste mês.</p>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 4 }}>
              {mode === 'unmark' ? 'Feriado para desmarcar' : `Dia (1–${total})`}
            </label>
            {mode === 'unmark' ? (
              <select value={day} onChange={e => setDay(e.target.value)} style={inputStyle}>
                <option value="">Selecione</option>
                {holidays.map(r => <option key={r.day} value={r.day}>{pad(r.day)} — {r.label}</option>)}
              </select>
            ) : (
              <input type="number" min={1} max={total} value={day} onChange={e => setDay(e.target.value)} placeholder={`1 a ${total}`} style={inputStyle} />
            )}
            {mode === 'mark' && (
              <>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, margin: '12px 0 4px' }}>Nome do feriado (opcional)</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Caravaggio" style={inputStyle} />
              </>
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          {(mode === 'mark' || holidays.length > 0) && (
            <button onClick={() => { const d = parseInt(day); if (!d || d < 1 || d > total) return; onConfirm(d, name || undefined) }} style={btnPrimary}>
              {mode === 'mark' ? 'Marcar' : 'Desmarcar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ControleRevisaoClient() {
  const [hydrated, setHydrated] = useState(false)
  const [view, setView] = useState<'current' | 'history'>('current')
  const [current, setCurrent] = useState<Sheet | null>(null)
  const [history, setHistory] = useState<HistoryData>({})
  const [people, setPeople] = useState<string[]>([...DEFAULT_PEOPLE])
  const [histPath, setHistPath] = useState<{ year: number | null; month: number | null }>({ year: null, month: null })
  const [search, setSearch] = useState('')
  const [newPersonInput, setNewPersonInput] = useState('')
  const [showGenerate, setShowGenerate] = useState(false)
  const [holidayModal, setHolidayModal] = useState<'mark' | 'unmark' | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('controle_revisao_sheets')
        .select('id, year, month_idx, is_current, revisions, schedule, people')
        .order('year', { ascending: false })
        .order('month_idx', { ascending: false })

      if (error) {
        console.error('Erro ao carregar controle de revisão:', error)
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

  const saveCurrentSheet = useCallback(async (updatedSheet: Sheet) => {
    setCurrent(updatedSheet)
    if (!updatedSheet.id) return
    const supabase = createClient()
    const { error } = await supabase
      .from('controle_revisao_sheets')
      .update({ revisions: updatedSheet.revisions, schedule: updatedSheet.schedule })
      .eq('id', updatedSheet.id)
    if (error) console.error('Erro ao salvar planilha:', error)
  }, [])

  const savePeople = useCallback(async (newPeople: string[]) => {
    setPeople(newPeople)
    if (!current?.id) return
    const supabase = createClient()
    const { error } = await supabase
      .from('controle_revisao_sheets')
      .update({ people: newPeople })
      .eq('id', current.id)
    if (error) console.error('Erro ao salvar equipe:', error)
  }, [current?.id])

  const suggestions = (() => {
    const empresa = new Set<string>(), documento = new Set<string>(),
          responsavel = new Set<string>(), inconsistencia = new Set<string>()
    const all: Sheet[] = [...(current ? [current] : []),
      ...Object.values(history).flatMap(y => Object.values(y))]
    all.forEach(s => s.revisions.forEach(r => {
      if (r.empresa) empresa.add(r.empresa)
      if (r.documento) documento.add(r.documento)
      if (r.responsavel) responsavel.add(r.responsavel)
      if (r.inconsistencia) inconsistencia.add(r.inconsistencia)
    }))
    people.forEach(p => responsavel.add(p))
    return {
      empresa: [...empresa].sort((a,b) => a.localeCompare(b, 'pt-BR')),
      documento: [...documento].sort((a,b) => a.localeCompare(b, 'pt-BR')),
      responsavel: [...responsavel].sort((a,b) => a.localeCompare(b, 'pt-BR')),
      inconsistencia: [...inconsistencia].sort((a,b) => a.localeCompare(b, 'pt-BR')),
    }
  })()

  function handleAddRevision() {
    if (!current) return
    const rev = newRevision()
    void saveCurrentSheet({ ...current, revisions: [rev, ...current.revisions] })
    setSearch('')
  }

  function handleUpdateRevision(id: string, field: keyof Revision, value: string | boolean) {
    if (!current) return
    const revisions = current.revisions.map(r => r.id === id ? { ...r, [field]: value } : r)
    void saveCurrentSheet({ ...current, revisions })
  }

  function handleDeleteRevision(id: string) {
    if (!current) return
    const rev = current.revisions.find(r => r.id === id)
    const desc = rev?.empresa || rev?.responsavel || 'este registro'
    if (!window.confirm(`Excluir: ${desc}?`)) return
    const revisions = current.revisions.filter(r => r.id !== id)
    void saveCurrentSheet({ ...current, revisions })
  }

  function handlePersonChange(day: number, person: string) {
    if (!current) return
    const schedule = current.schedule.map(r => r.day === day ? { ...r, person } : r)
    void saveCurrentSheet({ ...current, schedule })
  }

  function handleMarkHoliday(day: number, name?: string) {
    if (!current) return
    const schedule = current.schedule.map(r =>
      r.day === day ? { ...r, type: 'holiday' as RowType, label: (name || 'FERIADO').toUpperCase(), person: '' } : r
    )
    void saveCurrentSheet({ ...current, schedule })
    setHolidayModal(null)
  }

  function handleUnmarkHoliday(day: number) {
    if (!current) return
    const schedule = current.schedule.map(r => {
      if (r.day !== day) return r
      const dow = dayOfWeek(current.year, current.monthIdx, day)
      if (dow === 6) return { ...r, type: 'weekend' as RowType, label: 'SAB', person: '' }
      if (dow === 0) return { ...r, type: 'weekend' as RowType, label: 'DOM', person: '' }
      return { ...r, type: 'normal' as RowType, label: '', person: '' }
    })
    void saveCurrentSheet({ ...current, schedule })
    setHolidayModal(null)
  }

  async function handleGenerate(year: number, mi: number) {
    const newSheet = buildSheet(year, mi)
    const supabase = createClient()

    if (current?.id) {
      const { error } = await supabase
        .from('controle_revisao_sheets')
        .update({ is_current: false })
        .eq('id', current.id)
      if (error) { console.error('Erro ao arquivar planilha:', error); return }
      setHistory(prev => {
        const h = { ...prev }
        if (!h[current.year]) h[current.year] = {}
        h[current.year][current.monthIdx] = { ...current }
        return h
      })
    }

    const { data, error } = await supabase
      .from('controle_revisao_sheets')
      .upsert(
        { year, month_idx: mi, is_current: true, revisions: [], schedule: newSheet.schedule, people },
        { onConflict: 'year,month_idx' }
      )
      .select('id, year, month_idx, is_current, revisions, schedule, people')
      .single()

    if (error) { console.error('Erro ao gerar planilha:', error); return }
    setCurrent(rowToSheet(data))
    setShowGenerate(false)
  }

  function handleReset() {
    if (!current) return
    if (!window.confirm('Limpar TODAS as revisões e a escala do mês vigente?\n\nEsta ação não pode ser desfeita.')) return
    const fresh = buildSheet(current.year, current.monthIdx)
    void saveCurrentSheet({ ...current, revisions: [], schedule: fresh.schedule })
  }

  async function handleFinalize() {
    if (!current) return
    const label = `${MONTHS_PT[current.monthIdx]} de ${current.year}`
    if (!window.confirm(`Finalizar ${label} e arquivar no histórico?\n\n• ${current.revisions.length} revisão(ões) serão arquivadas.\n• O próximo mês será gerado automaticamente.`)) return

    const { year: ny, monthIdx: nm } = nextMonthOf(current.year, current.monthIdx)
    const supabase = createClient()

    const { error: archiveErr } = await supabase
      .from('controle_revisao_sheets')
      .update({ is_current: false })
      .eq('id', current.id)
    if (archiveErr) { console.error('Erro ao finalizar planilha:', archiveErr); return }

    const nextSheet = buildSheet(ny, nm)
    const { data, error: insertErr } = await supabase
      .from('controle_revisao_sheets')
      .upsert(
        { year: ny, month_idx: nm, is_current: true, revisions: [], schedule: nextSheet.schedule, people },
        { onConflict: 'year,month_idx' }
      )
      .select('id, year, month_idx, is_current, revisions, schedule, people')
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

  async function handleDeleteArchived(year: number, month: number) {
    const sheet = history[year]?.[month]
    if (!sheet) return
    if (!window.confirm(`Excluir ${sheet.name} permanentemente do histórico?\n\nIsso apagará ${sheet.revisions.length} revisão(ões).`)) return

    const supabase = createClient()
    const { error } = await supabase
      .from('controle_revisao_sheets')
      .delete()
      .eq('year', year)
      .eq('month_idx', month)
      .eq('is_current', false)
    if (error) { console.error('Erro ao excluir histórico:', error); return }

    setHistory(prev => {
      const h = { ...prev }
      const yr = { ...h[year] }
      delete yr[month]
      if (Object.keys(yr).length === 0) { delete h[year] } else { h[year] = yr }
      return h
    })
    setHistPath({ year: null, month: null })
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

  function exportRevisionsCSV(sheet: Sheet) {
    const headers = ['Data','Documento','Empresa','Responsável','Inconsistência','Resolvido']
    const rows = sheet.revisions.map(r => [r.data, r.documento, r.empresa, r.responsavel, r.inconsistencia, r.resolvido ? 'Sim' : 'Não'])
    downloadFile(`revisoes_${sheet.name.replace('/','-')}.csv`, [headers,...rows].map(r => r.map(csvEscape).join(';')).join('\n'), 'text/csv')
  }

  function exportScheduleCSV(sheet: Sheet) {
    const headers = ['DIA','REVISOR']
    const rows = sheet.schedule.map(r => [`${pad(r.day)}/${MONTHS_SHORT[sheet.monthIdx]}`, r.type === 'normal' ? r.person : r.label])
    downloadFile(`escala_${sheet.name.replace('/','-')}.csv`, [headers,...rows].map(r => r.map(csvEscape).join(';')).join('\n'), 'text/csv')
  }

  function exportJSON() {
    const payload = JSON.stringify({ current, history, people }, null, 2)
    downloadFile(`backup_revisao_${new Date().toISOString().slice(0,10)}.json`, payload, 'application/json')
  }

  if (!hydrated) return null

  const filteredRevisions = current?.revisions.filter(r => {
    if (!search) return true
    const hay = `${r.data} ${r.empresa} ${r.responsavel} ${r.documento} ${r.inconsistencia}`.toLowerCase()
    return hay.includes(search.toLowerCase())
  }) ?? []

  const stats = current ? {
    total: current.revisions.length,
    pendentes: current.revisions.filter(r => !r.resolvido).length,
    resolvidos: current.revisions.filter(r => r.resolvido).length,
    empresas: new Set(current.revisions.map(r => r.empresa.trim()).filter(Boolean)).size,
    escala: `${current.schedule.filter(r => r.type === 'normal' && r.person).length}/${current.schedule.filter(r => r.type === 'normal').length}`,
  } : null

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK, letterSpacing: -0.3 }}>Revisões BSA</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>Registro de inconsistências + escala diária de revisores</p>
      </div>

      <div style={{ display: 'inline-flex', padding: 4, background: '#F0F4FA', borderRadius: 10, gap: 4, marginBottom: 20 }}>
        {(['current', 'history'] as const).map(v => (
          <button key={v} onClick={() => { setView(v); setSearch('') }} style={{ padding: '8px 18px', fontSize: 14, fontWeight: 500, border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: view === v ? '#fff' : 'transparent', color: view === v ? INK : MUTED, boxShadow: view === v ? '0 1px 4px rgba(30,37,61,0.10)' : 'none' }}>
            {v === 'current' ? '📋 Mês vigente' : '📁 Histórico'}
          </button>
        ))}
      </div>

      {view === 'current' && (
        <>
          {!current ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: '#F8FAFC', borderRadius: 10, border: `1px solid ${BORDER}` }}>
              <p style={{ margin: '0 0 16px', color: MUTED }}>Nenhuma planilha ativa.</p>
              <button onClick={() => setShowGenerate(true)} style={btnPrimary}>+ Gerar nova planilha</button>
            </div>
          ) : (
            <>
              <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 600, color: INK, textTransform: 'capitalize' }}>
                {MONTHS_PT[current.monthIdx]} de {current.year}
              </h3>

              {stats && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total de revisões', value: stats.total, color: PRIMARY },
                    { label: 'Pendentes', value: stats.pendentes, color: '#DC2626' },
                    { label: 'Resolvidos', value: stats.resolvidos, color: '#16A34A' },
                    { label: 'Empresas', value: stats.empresas, color: ACCENT },
                    { label: 'Escala', value: stats.escala, color: PRIMARY },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: PRIMARY_LIGHT, borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: PRIMARY, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', flex: '0 0 auto' }}>📋 Revisões e inconsistências</span>
              </div>

              <RevisaoTable
                filteredRevisions={filteredRevisions}
                search={search}
                people={people}
                suggestions={suggestions}
                onSearchChange={setSearch}
                onAddRevision={handleAddRevision}
                onUpdateRevision={handleUpdateRevision}
                onDeleteRevision={handleDeleteRevision}
                onExportRevCSV={() => exportRevisionsCSV(current)}
                onExportSchedCSV={() => exportScheduleCSV(current)}
                onExportJSON={exportJSON}
              />

              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                📅 Escala diária do mês
              </div>

              <RevisaoEquipe
                people={people}
                newPersonInput={newPersonInput}
                onInputChange={setNewPersonInput}
                onAddPerson={handleAddPerson}
                onRemovePerson={handleRemovePerson}
              />

              <ScheduleTable sheet={current} people={people} readOnly={false} onPersonChange={handlePersonChange} />

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => setHolidayModal('mark')} style={btnSecondary}>⭐ Marcar feriado</button>
                <button onClick={() => setHolidayModal('unmark')} style={btnSecondary}>↺ Desmarcar feriado</button>
                <button onClick={handleReset} style={btnDanger}>🗑 Limpar mês</button>
                <button onClick={handleFinalize} style={{ ...btnPrimary, marginLeft: 'auto' }}>✓ Finalizar e arquivar</button>
              </div>
            </>
          )}
        </>
      )}

      {view === 'history' && (() => {
        const { year, month } = histPath
        const years = Object.keys(history).map(Number).sort((a, b) => b - a)

        if (year !== null && month !== null) {
          const sheet = history[year]?.[month]
          if (!sheet) { setHistPath({ year, month: null }); return null }
          const emptySuggestions = { empresa: [], documento: [], responsavel: [], inconsistencia: [] }
          return (
            <>
              <Breadcrumb year={year} sheetName={sheet.name} onRoot={() => setHistPath({ year: null, month: null })} onYear={() => setHistPath({ year, month: null })} />
              <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 600, color: INK, display: 'flex', alignItems: 'center', gap: 10, textTransform: 'capitalize' }}>
                {MONTHS_PT[sheet.monthIdx]} de {sheet.year}
                <span style={{ fontSize: 11, color: MUTED, fontWeight: 400, background: '#F0F4FA', padding: '3px 8px', borderRadius: 20 }}>somente leitura</span>
              </h3>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {[{ label: 'Revisões', value: sheet.revisions.length }, { label: 'Empresas', value: new Set(sheet.revisions.map(r => r.empresa.trim()).filter(Boolean)).size }].map(({ label, value }) => (
                  <div key={label} style={{ background: PRIMARY_LIGHT, borderRadius: 8, padding: '10px 16px', flex: '0 0 auto' }}>
                    <div style={{ fontSize: 11, color: PRIMARY, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: PRIMARY_DARK, marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>📋 Revisões</div>
              <div style={{ overflowX: 'auto', marginBottom: 20, background: '#fff', borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>{['Data','Documento','Empresa','Responsável','Inconsistência','Resolvido'].map(h => (
                    <th key={h} style={{ background: PRIMARY_LIGHT, color: PRIMARY, fontWeight: 600, padding: '9px 10px', textAlign: 'left', fontSize: 12, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {sheet.revisions.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13, background: '#F8FAFC' }}>Nenhuma revisão registrada.</td></tr>
                    ) : sheet.revisions.map(rev => (
                      <RevisionRow key={rev.id} rev={rev} people={[]} suggestions={emptySuggestions} readOnly onUpdate={() => {}} onDelete={() => {}} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>📅 Escala</div>
              <ScheduleTable sheet={sheet} people={[]} readOnly />
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button onClick={() => setHistPath({ year, month: null })} style={btnSecondary}>← Voltar para {year}</button>
                <button onClick={() => exportRevisionsCSV(sheet)} style={btnSecondary}>↓ Exportar CSV</button>
                <button onClick={() => handleDeleteArchived(year, month)} style={{ ...btnDanger, marginLeft: 'auto' }}>🗑 Excluir do histórico</button>
              </div>
            </>
          )
        }

        if (year !== null) {
          const months = history[year] ?? {}
          const monthList = Object.keys(months).map(Number).sort((a, b) => a - b)
          return (
            <>
              <Breadcrumb year={year} onRoot={() => setHistPath({ year: null, month: null })} />
              {monthList.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: MUTED, background: '#F8FAFC', borderRadius: 10, border: `1px solid ${BORDER}` }}>Nenhum mês arquivado em {year}.</div>
              ) : monthList.map(m => (
                <FolderRow key={m} icon="📄" label={months[m].name} meta={`${months[m].revisions.length} revisão(ões) · ${MONTHS_PT[m]}`} onClick={() => setHistPath({ year, month: m })} />
              ))}
            </>
          )
        }

        if (years.length === 0) {
          return <div style={{ padding: '48px 24px', textAlign: 'center', color: MUTED, background: '#F8FAFC', borderRadius: 10, border: `1px solid ${BORDER}` }}>Histórico vazio.<br /><small style={{ fontSize: 12 }}>Finalize um mês na guia &ldquo;Mês vigente&rdquo; para arquivá-lo aqui.</small></div>
        }
        return (
          <>
            {years.map(y => {
              const count = Object.keys(history[y] ?? {}).length
              const total = Object.values(history[y] ?? {}).reduce((s, sh) => s + sh.revisions.length, 0)
              return <FolderRow key={y} icon="📁" label={String(y)} meta={`${count} ${count === 1 ? 'mês' : 'meses'} · ${total} revisão(ões)`} onClick={() => setHistPath({ year: y, month: null })} />
            })}
          </>
        )
      })()}

      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} onGenerate={handleGenerate} />}
      {holidayModal && current && (
        <HolidayModal mode={holidayModal} sheet={current} onClose={() => setHolidayModal(null)}
          onConfirm={(d, n) => holidayModal === 'mark' ? handleMarkHoliday(d, n) : handleUnmarkHoliday(d)} />
      )}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Breadcrumb({ year, sheetName, onRoot, onYear }: { year: number; sheetName?: string; onRoot: () => void; onYear?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED, marginBottom: 14 }}>
      <button onClick={onRoot} style={{ ...btnSecondary, padding: '4px 8px', fontSize: 13 }}>Histórico</button>
      <span>/</span>
      {onYear ? <button onClick={onYear} style={{ ...btnSecondary, padding: '4px 8px', fontSize: 13 }}>{year}</button> : <span style={{ color: INK, fontWeight: 500 }}>{year}</span>}
      {sheetName && <><span>/</span><span style={{ color: INK, fontWeight: 500 }}>{sheetName}</span></>}
    </div>
  )
}

function FolderRow({ icon, label, meta, onClick }: { icon: string; label: string; meta: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: 8, background: hovered ? '#F8FAFC' : '#fff', cursor: 'pointer', marginBottom: 6, fontSize: 14, fontWeight: 500, transition: 'background 0.15s', userSelect: 'none' }}>
      <span style={{ fontSize: 18, color: PRIMARY }}>{icon}</span>
      <span style={{ color: INK }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 12, color: MUTED, fontWeight: 400 }}>{meta}</span>
    </div>
  )
}
