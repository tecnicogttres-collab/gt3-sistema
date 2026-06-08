'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../lib/supabase'

const PEOPLE = ['Alexandra', 'Camila', 'Daiana', 'Emiliane', 'Giancarlo', 'Jose', 'Luciane', 'Marcio Bastos', 'Marcio Z.', 'Mariane', 'Marina', 'Rodrigo', 'Valmir']
const COLORS = ['#2A4F96', '#D1AE6E', '#3B6D11', '#7B1FA2', '#0288D1', '#F06292', '#993556', '#00796B', '#185FA5', '#993C1D', '#0F6E56', '#533AB7', '#E65100']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

type FeriasRecord = {
  id: string
  pessoa: string
  inicio: string
  fim: string
  observacao: string
}

type TooltipState = {
  visible: boolean
  x: number
  y: number
  record: FeriasRecord | null
}

function personColor(name: string): string {
  const i = PEOPLE.indexOf(name)
  return i >= 0 ? COLORS[i] : '#888'
}

function parseD(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmt(s: string): string {
  const d = parseD(s)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function totalDays(v: FeriasRecord): number {
  return Math.round((parseD(v.fim).getTime() - parseD(v.inicio).getTime()) / 86400000) + 1
}

function dayStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

export default function CalendarioFeriasClient() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [records, setRecords] = useState<FeriasRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, record: null })

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mPessoa, setMPessoa] = useState(PEOPLE[0])
  const [mInicio, setMInicio] = useState('')
  const [mFim, setMFim] = useState('')
  const [mObs, setMObs] = useState('')
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('ferias')
      .select('id, pessoa, inicio, fim, observacao')
      .order('inicio', { ascending: true })
    if (error) {
      console.error('Erro ao carregar férias:', error.message ?? error)
      setLoadError(error.message ?? 'Erro desconhecido')
      setLoading(false)
      return
    }
    setLoadError(null)
    setRecords(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      setTooltip(t => t.visible ? { ...t, x: e.clientX + 14, y: e.clientY - 10 } : t)
    }
    document.addEventListener('mousemove', fn)
    return () => document.removeEventListener('mousemove', fn)
  }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const monthStart = dayStr(year, month, 1)
  const monthEnd = dayStr(year, month, totalDaysInMonth)
  const monthRecords = records.filter(v => v.inicio <= monthEnd && v.fim >= monthStart)

  const uniquePeople = new Set(monthRecords.map(v => v.pessoa)).size
  const totalMonthDays = monthRecords.reduce((acc, v) => {
    const s = v.inicio < monthStart ? monthStart : v.inicio
    const e = v.fim > monthEnd ? monthEnd : v.fim
    return acc + Math.round((parseD(e).getTime() - parseD(s).getTime()) / 86400000) + 1
  }, 0)

  const openModal = (id: string | null, initialDay?: string) => {
    setEditingId(id)
    if (id) {
      const v = records.find(x => x.id === id)
      if (v) { setMPessoa(v.pessoa); setMInicio(v.inicio); setMFim(v.fim); setMObs(v.observacao || '') }
    } else {
      setMPessoa(PEOPLE[0])
      setMInicio(initialDay ?? '')
      setMFim(initialDay ?? '')
      setMObs('')
    }
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditingId(null) }

  const handleSave = async () => {
    if (!mInicio || !mFim) { alert('Preencha início e fim.'); return }
    if (mFim < mInicio) { alert('A data de fim deve ser igual ou posterior ao início.'); return }
    setSaving(true)
    const supabase = createClient()
    if (editingId) {
      const { error } = await supabase.from('ferias').update({ pessoa: mPessoa, inicio: mInicio, fim: mFim, observacao: mObs }).eq('id', editingId)
      if (error) { console.error(error); setSaving(false); return }
    } else {
      const { error } = await supabase.from('ferias').insert({ pessoa: mPessoa, inicio: mInicio, fim: mFim, observacao: mObs })
      if (error) { console.error(error); setSaving(false); return }
    }
    setSaving(false)
    closeModal()
    void loadAll()
  }

  const handleDelete = async () => {
    if (!editingId || !confirm('Excluir este registro de férias?')) return
    const supabase = createClient()
    await supabase.from('ferias').delete().eq('id', editingId)
    closeModal()
    void loadAll()
  }

  const navBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 6, border: '1px solid #E2E8F0',
    background: '#fff', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: '#6B7A99', fontSize: 16,
  }

  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: '#6b7a9e', marginBottom: 5,
  }

  const fieldInput: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: '1px solid rgba(42,79,150,0.2)', borderRadius: 8,
    background: '#f4f6fa', color: '#1a2744', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1.5px solid #E2E8F0', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2A4F96' }}>GT3 Consultoria</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1E293B', letterSpacing: -0.5, lineHeight: 1, marginTop: 4 }}>Calendário de Férias</div>
        </div>
        <button
          onClick={() => openModal(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#3d6abf' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A4F96' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Adicionar férias
        </button>
      </div>

      {/* Month nav + summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={prevMonth} style={navBtn}>←</button>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#1E293B', minWidth: 200 }}>
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} style={navBtn}>→</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { val: monthRecords.length, lbl: `registro${monthRecords.length !== 1 ? 's' : ''}` },
            { val: uniquePeople, lbl: `colaborador${uniquePeople !== 1 ? 'es' : ''}` },
            { val: totalMonthDays, lbl: 'dias no mês' },
          ].map(item => (
            <div key={item.lbl} style={{ background: '#fff', border: '1px solid rgba(42,79,150,0.12)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#6b7a9e', boxShadow: '0 2px 8px rgba(42,79,150,0.06)' }}>
              <strong style={{ color: '#2A4F96' }}>{item.val}</strong> {item.lbl}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#F4F6FA', borderBottom: '1px solid #E2E8F0' }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7A99' }}>
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7A99', fontSize: 14 }}>Carregando...</div>
        ) : loadError ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#b03030', fontSize: 14 }}>
            Erro ao carregar dados: <strong>{loadError}</strong>
            <br />
            <span style={{ fontSize: 12, color: '#6b7a9e', marginTop: 8, display: 'block' }}>
              Verifique se a tabela <code>ferias</code> foi criada no Supabase (execute <code>supabase-ferias.sql</code>).
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {/* Empty leading cells */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => {
              const isLast = (i + 1) % 7 === 0
              return (
                <div key={`e${i}`} style={{ minHeight: 90, borderRight: isLast ? 'none' : '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', background: '#F9FAFB' }} />
              )
            })}

            {/* Day cells */}
            {Array.from({ length: totalDaysInMonth }, (_, i) => i + 1).map(d => {
              const ds = dayStr(year, month, d)
              const isToday = ds === todayStr
              const colIndex = (firstDayOfWeek + d - 1) % 7
              const isLastCol = colIndex === 6
              const vacHere = monthRecords.filter(v => v.inicio <= ds && ds <= v.fim)

              return (
                <div
                  key={d}
                  onClick={() => openModal(null, ds)}
                  style={{
                    minHeight: 90,
                    borderRight: isLastCol ? 'none' : '1px solid #E2E8F0',
                    borderBottom: '1px solid #E2E8F0',
                    padding: '8px 6px 6px',
                    cursor: 'pointer',
                    background: '#fff',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#EBF0FB' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
                >
                  {/* Day number */}
                  <div style={{ marginBottom: 5 }}>
                    {isToday ? (
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2A4F96', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                        {d}
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#6B7A99' }}>{d}</span>
                    )}
                  </div>

                  {/* Chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {vacHere.slice(0, 3).map(v => (
                      <div
                        key={v.id}
                        title={`${v.pessoa}: ${fmt(v.inicio)} → ${fmt(v.fim)}`}
                        style={{
                          background: personColor(v.pessoa),
                          color: '#fff',
                          borderRadius: 4,
                          padding: '2px 5px',
                          fontSize: 10,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        onMouseEnter={e => {
                          e.stopPropagation()
                          setTooltip({ visible: true, x: e.clientX + 14, y: e.clientY - 10, record: v })
                        }}
                        onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                        onClick={e => { e.stopPropagation(); openModal(v.id) }}
                      >
                        {v.pessoa.split(' ')[0]}
                      </div>
                    ))}
                    {vacHere.length > 3 && (
                      <div style={{ fontSize: 10, color: '#6B7A99', padding: '1px 4px' }}>
                        +{vacHere.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {PEOPLE.map((p, i) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A99' }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS[i] }} />
            {p}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.record && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          background: '#1a2744', color: '#fff', fontSize: 12,
          padding: '6px 10px', borderRadius: 8, pointerEvents: 'none',
          zIndex: 300, whiteSpace: 'nowrap', lineHeight: 1.6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}>
          <strong>{tooltip.record.pessoa}</strong><br />
          {fmt(tooltip.record.inicio)} → {fmt(tooltip.record.fim)}<br />
          {totalDays(tooltip.record)} dias
          {tooltip.record.observacao && <><br /><em style={{ opacity: 0.8 }}>{tooltip.record.observacao}</em></>}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,60,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#fff', border: '1px solid rgba(42,79,150,0.12)', borderRadius: 16, padding: '1.75rem', width: 380, maxWidth: '94vw', boxShadow: '0 8px 32px rgba(42,79,150,0.14)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#2A4F96', margin: 0 }}>
                {editingId ? 'Editar férias' : 'Registrar férias'}
              </h3>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#a0aac4', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={fieldLabel}>Colaborador</label>
              <select value={mPessoa} onChange={e => setMPessoa(e.target.value)} style={fieldInput}>
                {PEOPLE.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
              <div>
                <label style={fieldLabel}>Início</label>
                <input type="date" value={mInicio} onChange={e => setMInicio(e.target.value)} style={fieldInput} />
              </div>
              <div>
                <label style={fieldLabel}>Fim</label>
                <input type="date" value={mFim} onChange={e => setMFim(e.target.value)} style={fieldInput} />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={fieldLabel}>Observação (opcional)</label>
              <textarea
                value={mObs}
                onChange={e => setMObs(e.target.value)}
                placeholder="Ex: 1ª parcela, férias coletivas..."
                style={{ ...fieldInput, resize: 'vertical', minHeight: 60 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: '1.5rem' }}>
              {editingId && (
                <button
                  onClick={() => void handleDelete()}
                  style={{ background: 'transparent', color: '#b03030', border: '1px solid rgba(176,48,48,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', marginRight: 'auto' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(176,48,48,0.07)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  Excluir
                </button>
              )}
              <button
                onClick={closeModal}
                style={{ background: 'transparent', color: '#6b7a9e', border: '1px solid rgba(42,79,150,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f4f6fa' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                style={{ background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#3d6abf' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A4F96' }}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
