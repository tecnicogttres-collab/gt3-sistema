'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusEntry = {
  id: string
  autor: string
  data: number
  texto: string
}

type Prioridade = {
  id: string
  empresa: string
  contratante: string
  responsavel: string
  statusFeed: StatusEntry[]
}

type BdayItem = {
  name: string
  day: number
  month0: number
  daysLeft: number
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const PRIO_KEY = 'gt3_prioridades_v1'
const HO_KEY = 'gt3_home_office_v2'
const ANIV_KEY = 'gt3_aniversarios'
const BSA_KEY = 'gt3_controle_revisao_v1'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function bdayKey(month0: number, day: number) {
  return `${pad2(month0 + 1)}-${pad2(day)}`
}

function fmtTs(ts: number) {
  const d = new Date(ts)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardSidebar() {
  const [priorities, setPriorities] = useState<Prioridade[]>([])
  const [hoNames, setHoNames] = useState<string[]>([])
  const [bsaPerson, setBsaPerson] = useState('')
  const [bdayItems, setBdayItems] = useState<BdayItem[]>([])
  const [modalPrio, setModalPrio] = useState<Prioridade | null>(null)

  function loadData() {
    const today = new Date()
    const todayDay = today.getDate()
    const todayMonth = today.getMonth()
    const todayYear = today.getFullYear()

    // Prioridades
    try {
      const raw = localStorage.getItem(PRIO_KEY)
      setPriorities(raw ? (JSON.parse(raw) ?? []) : [])
    } catch {
      setPriorities([])
    }

    // Home Office — entries for today in the current sheet
    try {
      const raw = localStorage.getItem(HO_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        const cur = data.current
        if (cur && cur.year === todayYear && cur.monthIdx === todayMonth) {
          const row = cur.rows?.find(
            (r: { day: number; type: string; entries?: string[] }) =>
              r.day === todayDay && r.type === 'normal'
          )
          setHoNames(row?.entries?.filter((e: string) => Boolean(e)) ?? [])
        } else {
          setHoNames([])
        }
      }
    } catch {
      setHoNames([])
    }

    // BSA (Controle Revisão) — person assigned for today
    try {
      const raw = localStorage.getItem(BSA_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        const cur = data.current
        if (cur && cur.year === todayYear && cur.monthIdx === todayMonth) {
          const row = cur.schedule?.find(
            (r: { day: number; type: string; person?: string }) =>
              r.day === todayDay && r.type === 'normal'
          )
          setBsaPerson(row?.person ?? '')
        } else {
          setBsaPerson('')
        }
      }
    } catch {
      setBsaPerson('')
    }

    // Aniversários — today through today+3 days
    try {
      const raw = localStorage.getItem(ANIV_KEY)
      if (raw) {
        const data: Record<string, string[]> = JSON.parse(raw)
        const items: BdayItem[] = []
        for (let offset = 0; offset <= 3; offset++) {
          const d = new Date(todayYear, todayMonth, todayDay + offset)
          const k = bdayKey(d.getMonth(), d.getDate())
          ;(data[k] ?? []).forEach(name => {
            items.push({ name, day: d.getDate(), month0: d.getMonth(), daysLeft: offset })
          })
        }
        setBdayItems(items)
      }
    } catch {
      setBdayItems([])
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 300_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 16,
          background: '#F4F6FA',
          borderLeft: '1px solid #E5E7EB',
          borderRadius: 8,
        }}
      >
        {/* ── Block 1: Prioridades ──────────────────────────────────────── */}
        <div style={{
          background: '#fff',
          borderRadius: 8,
          borderLeft: '4px solid #D1AE6E',
          padding: '12px 14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2A4F96', marginBottom: 10 }}>
            ⚡ Prioridades
          </div>
          {priorities.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>
              Nenhuma prioridade no momento
            </div>
          ) : (
            <div>
              {priorities.map((p, i) => (
                <div
                  key={p.id}
                  onDoubleClick={() => setModalPrio(p)}
                  title="Clique duplo para ver detalhes"
                  style={{
                    fontSize: 13,
                    color: '#1E293B',
                    padding: '6px 0',
                    borderBottom: i < priorities.length - 1 ? '1px solid #F1F5F9' : 'none',
                    cursor: 'default',
                    userSelect: 'none',
                  }}
                >
                  {p.empresa}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Block 2: Home Office + BSA ────────────────────────────────── */}
        <div style={{
          background: '#fff',
          borderRadius: 8,
          padding: '12px 14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2A4F96', marginBottom: 10 }}>
            Hoje
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{
                fontSize: 11, color: '#64748B', textTransform: 'uppercase',
                letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6,
              }}>
                🏠 Home Office
              </div>
              {hoNames.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9CA3AF' }}>—</div>
              ) : hoNames.map((name, i) => (
                <div key={i} style={{ fontSize: 13, color: '#1E293B', marginBottom: 2 }}>{name}</div>
              ))}
            </div>
            <div>
              <div style={{
                fontSize: 11, color: '#64748B', textTransform: 'uppercase',
                letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6,
              }}>
                📋 Revisão BSA
              </div>
              {bsaPerson ? (
                <div style={{ fontSize: 13, color: '#1E293B' }}>{bsaPerson}</div>
              ) : (
                <div style={{ fontSize: 13, color: '#9CA3AF' }}>—</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Block 3: Aniversários (conditional) ──────────────────────── */}
        {bdayItems.length > 0 && (
          <div style={{
            background: '#FFF5F5',
            borderRadius: 8,
            borderLeft: '4px solid #F87171',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 10 }}>
              🎂 Aniversários
            </div>
            {bdayItems.map((item, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  color: '#1E293B',
                  padding: '5px 0',
                  borderBottom: i < bdayItems.length - 1 ? '1px solid #FEE2E2' : 'none',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 500 }}>{item.name}</span>
                <span style={{ color: '#6B7280', marginLeft: 6 }}>
                  🎂 {pad2(item.day)}/{pad2(item.month0 + 1)}
                </span>
                <span style={{ color: '#991B1B', fontSize: 11, marginLeft: 6 }}>
                  {item.daysLeft === 0
                    ? 'Hoje!'
                    : item.daysLeft === 1
                    ? 'Amanhã'
                    : `Em ${item.daysLeft} dias`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: detalhes da prioridade ──────────────────────────────────── */}
      {modalPrio && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setModalPrio(null) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 10, width: '100%', maxWidth: 520,
            maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1E293B' }}>
                  {modalPrio.empresa}
                </div>
                <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>
                  Contratante: {modalPrio.contratante}
                  {modalPrio.responsavel && ` · Responsável: ${modalPrio.responsavel}`}
                </div>
              </div>
              <button
                onClick={() => setModalPrio(null)}
                style={{
                  background: 'transparent', border: 'none', fontSize: 22,
                  cursor: 'pointer', color: '#9CA3AF', lineHeight: 1,
                  padding: '0 2px', marginLeft: 12, flexShrink: 0,
                }}
              >×</button>
            </div>
            {/* Body */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {modalPrio.statusFeed.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                  Sem entradas de status.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[...modalPrio.statusFeed].reverse().map(s => (
                    <div
                      key={s.id}
                      style={{
                        borderLeft: '3px solid #2A4F96',
                        background: '#FAFBFC',
                        padding: '10px 12px',
                        borderRadius: '0 6px 6px 0',
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#6B7A99', marginBottom: 6 }}>
                        <strong style={{ color: '#1E293B' }}>{s.autor}</strong>
                        {' · '}
                        {fmtTs(s.data)}
                      </div>
                      <div style={{
                        fontSize: 13, color: '#1E293B',
                        whiteSpace: 'pre-wrap', lineHeight: 1.6,
                      }}>
                        {s.texto}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
