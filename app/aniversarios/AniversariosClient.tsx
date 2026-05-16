'use client'

import { useState, useEffect, useCallback } from 'react'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const STORAGE_KEY = 'gt3_aniversarios'

type BdayData = Record<string, string[]>

function loadData(): BdayData {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

function saveData(d: BdayData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
}

function dateKey(month: number, day: number): string {
  return `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function DayCell({
  day, people, isToday, isLastCol, onClick,
}: {
  day: number
  people: string[]
  isToday: boolean
  isLastCol: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: 88,
        borderRight: isLastCol ? 'none' : '1px solid #E2E8F0',
        borderBottom: '1px solid #E2E8F0',
        padding: '8px 8px 6px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        background: hovered ? '#EBF0FB' : '#fff',
        transition: 'background 0.12s',
      }}
    >
      {/* Day number */}
      <div style={{ marginBottom: 5, lineHeight: 1 }}>
        {isToday ? (
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#2A4F96', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600,
          }}>{day}</div>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500, color: '#6B7A99' }}>{day}</span>
        )}
      </div>

      {/* Birthday tags */}
      {people.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {people.slice(0, 3).map((name, i) => (
            <div key={i} style={{
              background: '#EBF0FB', color: '#1E3A6E',
              borderRadius: 4, padding: '2px 6px',
              fontSize: 11, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2A4F96" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M4 20h16a2 2 0 000-4H4a2 2 0 000 4zM8 16V10M12 16V10M16 16V10M4 10h16"/>
                <circle cx="12" cy="4" r="1" fill="#2A4F96" stroke="none"/>
                <circle cx="8" cy="7" r="1" fill="#2A4F96" stroke="none"/>
                <circle cx="16" cy="7" r="1" fill="#2A4F96" stroke="none"/>
              </svg>
              {name}
            </div>
          ))}
          {people.length > 3 && (
            <div style={{ fontSize: 11, color: '#6B7A99', padding: '2px 6px' }}>
              +{people.length - 3} mais
            </div>
          )}
        </div>
      )}

      {/* Plus hint on hover */}
      {hovered && (
        <span style={{ position: 'absolute', bottom: 6, right: 6, fontSize: 16, color: '#2A4F96', lineHeight: 1, fontWeight: 300 }}>+</span>
      )}
    </div>
  )
}

export default function AniversariosClient() {
  const today = new Date()
  const [cy, setCy] = useState(today.getFullYear())
  const [cm, setCm] = useState(today.getMonth())
  const [data, setData] = useState<BdayData>({})
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [inputName, setInputName] = useState('')

  useEffect(() => { setData(loadData()) }, [])

  const refresh = useCallback(() => { setData(loadData()) }, [])

  const prevMonth = () => {
    if (cm === 0) { setCm(11); setCy(y => y - 1) }
    else setCm(m => m - 1)
  }

  const nextMonth = () => {
    if (cm === 11) { setCm(0); setCy(y => y + 1) }
    else setCm(m => m + 1)
  }

  const addPerson = () => {
    const name = inputName.trim()
    if (!name || selectedDay === null) return
    const k = dateKey(cm, selectedDay)
    const d = loadData()
    if (!d[k]) d[k] = []
    if (d[k].includes(name)) return
    d[k].push(name)
    saveData(d)
    setInputName('')
    refresh()
  }

  const removePerson = (k: string, i: number) => {
    const d = loadData()
    if (d[k]) {
      d[k].splice(i, 1)
      if (d[k].length === 0) delete d[k]
      saveData(d)
      refresh()
    }
  }

  const firstDay = new Date(cy, cm, 1).getDay()
  const totalDays = new Date(cy, cm + 1, 0).getDate()

  // Upcoming birthdays (next 30 days from today)
  const upcoming: { name: string; label: string }[] = []
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  for (let offset = 0; offset <= 30; offset++) {
    const d = new Date(ref)
    d.setDate(ref.getDate() + offset)
    const k = dateKey(d.getMonth(), d.getDate())
    if (data[k]?.length > 0) {
      data[k].forEach(name => {
        const label = offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : `${d.getDate()}/${d.getMonth() + 1}`
        upcoming.push({ name, label })
      })
    }
  }

  const modalKey = selectedDay !== null ? dateKey(cm, selectedDay) : null
  const modalPeople = modalKey ? (data[modalKey] ?? []) : []

  const navBtn: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 6, border: '1px solid #E2E8F0',
    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#6B7A99', fontSize: 16,
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #E2E8F0' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', letterSpacing: -0.3 }}>Aniversários</div>
          <div style={{ fontSize: 12, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>GT3 Consultoria</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={prevMonth} style={navBtn} title="Mês anterior">←</button>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#1E293B', minWidth: 190, textAlign: 'center' }}>
            {MONTHS[cm]} de {cy}
          </span>
          <button onClick={nextMonth} style={navBtn} title="Próximo mês">→</button>
        </div>
      </div>

      {/* Upcoming bar */}
      <div style={{
        background: '#EBF0FB', border: '1px solid #C5D4F5', borderRadius: 10,
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, marginBottom: 16, minHeight: 42, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2A4F96', whiteSpace: 'nowrap' }}>
          Próximos
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {upcoming.length === 0 ? (
            <span style={{ fontSize: 13, color: '#6B7A99', fontStyle: 'italic' }}>
              Nenhum aniversário nos próximos 30 dias
            </span>
          ) : upcoming.slice(0, 6).map((item, i) => (
            <div key={i} style={{
              background: '#fff', border: '1px solid #C5D4F5', borderRadius: 100,
              padding: '3px 10px', fontSize: 12, color: '#1E3A6E',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontWeight: 600, color: '#2A4F96', fontSize: 11 }}>{item.label}</span>
              {item.name}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#F4F6FA', borderBottom: '1px solid #E2E8F0' }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7A99' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {/* Empty leading cells */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e${i}`} style={{
              minHeight: 88,
              borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid #E2E8F0',
              borderBottom: '1px solid #E2E8F0',
              background: '#F9FAFB',
            }} />
          ))}

          {/* Day cells */}
          {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
            const k = dateKey(cm, d)
            const isToday = today.getDate() === d && today.getMonth() === cm && today.getFullYear() === cy
            const colIndex = (firstDay + d - 1) % 7
            return (
              <DayCell
                key={d}
                day={d}
                people={data[k] ?? []}
                isToday={isToday}
                isLastCol={colIndex === 6}
                onClick={() => { setSelectedDay(d); setInputName('') }}
              />
            )
          })}
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#B0ADA5', marginTop: 12 }}>
        Os dados ficam salvos neste navegador.
      </p>

      {/* Modal */}
      {selectedDay !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,25,22,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedDay(null) }}
        >
          <div style={{ background: '#fff', borderRadius: 14, width: 360, maxWidth: '94vw', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', overflow: 'hidden', animation: 'none' }}>
            {/* Modal header */}
            <div style={{ background: '#2A4F96', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontWeight: 600, fontSize: 17, color: '#fff', letterSpacing: -0.2, margin: 0 }}>
                {selectedDay} de {MONTHS[cm]}
              </h2>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>
                ×
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B0ADA5', marginBottom: 8 }}>
                Aniversariantes
              </div>

              {modalPeople.length === 0 ? (
                <p style={{ fontSize: 13, color: '#B0ADA5', fontStyle: 'italic', marginBottom: 16 }}>
                  Nenhum aniversariante cadastrado.
                </p>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  {modalPeople.map((name, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#F4F6FA', borderRadius: 6, marginBottom: 4, fontSize: 13, color: '#1E293B' }}>
                      <span>{name}</span>
                      <button
                        onClick={() => { if (modalKey) removePerson(modalKey, i) }}
                        title={`Remover ${name}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B0ADA5', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#E74C3C' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#B0ADA5' }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B0ADA5', marginBottom: 8 }}>
                Adicionar colaborador
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={inputName}
                  onChange={e => setInputName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addPerson() }}
                  placeholder="Nome completo"
                  maxLength={80}
                  autoComplete="off"
                  autoFocus
                  style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: 6, padding: '9px 12px', fontSize: 14, background: '#fff', color: '#1E293B', outline: 'none' }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#2A4F96' }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E2E8F0' }}
                />
                <button
                  onClick={addPerson}
                  style={{ background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A6E' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A4F96' }}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
