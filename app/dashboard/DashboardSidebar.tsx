'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '../lib/supabase'

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

type LembreteItem = {
  titulo: string
  daysLeft: number
}

type PdiAgendaEntry = {
  colaborador_nome: string
  data_conversa: string
  numero_ciclo: number
}

function fmtDateShort(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nextOccStr(periodo: string, dataInicio: string): Date {
  const parse = (s: string) => new Date(s + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = parse(dataInicio)
  if (periodo === 'unico') return start
  if (periodo === 'diario') return today < start ? start : today
  const d = new Date(start)
  if (periodo === 'semanal') { while (d < today) d.setDate(d.getDate() + 7) }
  else if (periodo === 'mensal') { while (d < today) d.setMonth(d.getMonth() + 1) }
  else if (periodo === 'trimestral') { while (d < today) d.setMonth(d.getMonth() + 3) }
  else if (periodo === 'semestral') { while (d < today) d.setMonth(d.getMonth() + 6) }
  else if (periodo === 'anual') { while (d < today) d.setFullYear(d.getFullYear() + 1) }
  return d
}


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

export default function DashboardSidebar({ role }: { role?: string }) {
  const [priorities, setPriorities] = useState<Prioridade[]>([])
  const [hoNames, setHoNames] = useState<string[]>([])
  const [bsaPerson, setBsaPerson] = useState('')
  const [bdayItems, setBdayItems] = useState<BdayItem[]>([])
  const [lembreteItems, setLembreteItems] = useState<LembreteItem[]>([])
  const [modalPrio, setModalPrio] = useState<Prioridade | null>(null)
  const [pdiAgenda, setPdiAgenda] = useState<PdiAgendaEntry[]>([])

  async function loadPrioridades() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prioridades')
      .select('id, empresa, contratante, responsavel, status_feed')
      .order('posicao', { ascending: true })
    if (error) {
      console.error('Erro ao carregar prioridades no dashboard:', error.message, error.code)
      setPriorities([])
    } else {
      setPriorities(
        (data ?? []).map(row => ({
          id: row.id,
          empresa: row.empresa,
          contratante: row.contratante,
          responsavel: row.responsavel,
          statusFeed: row.status_feed ?? [],
        }))
      )
    }
  }

  function loadData() {
    const today = new Date()
    const todayDay = today.getDate()
    const todayMonth = today.getMonth()
    const todayYear = today.getFullYear()

    // Home Office — entries for today: read from Supabase (async, fire-and-forget)
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('home_office_sheets')
          .select('year, month_idx, rows')
          .eq('is_current', true)
          .maybeSingle()
        if (data && data.year === todayYear && data.month_idx === todayMonth) {
          const row = (data.rows as { day: number; type: string; entries?: string[] }[])?.find(
            r => r.day === todayDay && r.type === 'normal'
          )
          setHoNames(row?.entries?.filter((e: string) => Boolean(e)) ?? [])
        } else {
          setHoNames([])
        }
      } catch {
        setHoNames([])
      }
    })()

    // BSA (Controle Revisão) — person assigned for today
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('controle_revisao_sheets')
          .select('year, month_idx, schedule')
          .eq('is_current', true)
          .maybeSingle()
        if (data && data.year === todayYear && data.month_idx === todayMonth) {
          const row = (data.schedule as { day: number; type: string; person?: string }[])?.find(
            r => r.day === todayDay && r.type === 'normal'
          )
          setBsaPerson(row?.person ?? '')
        } else {
          setBsaPerson('')
        }
      } catch {
        setBsaPerson('')
      }
    })()

    // Aniversários — today through today+3 days (from Supabase)
    ;(async () => {
      try {
        const supabase = createClient()
        const dates = Array.from({ length: 4 }, (_, i) => {
          const d = new Date(todayYear, todayMonth, todayDay + i)
          return { dia: d.getDate(), mes: d.getMonth() + 1, offset: i, month0: d.getMonth() }
        })
        const months = [...new Set(dates.map(d => d.mes))]
        const { data } = await supabase
          .from('aniversarios')
          .select('nome, dia, mes')
          .in('mes', months)
        if (!data) { setBdayItems([]); return }
        const dateSet = new Map(dates.map(d => [`${d.mes}-${d.dia}`, d]))
        const items: BdayItem[] = []
        for (const row of data) {
          const info = dateSet.get(`${row.mes}-${row.dia}`)
          if (info) {
            items.push({ name: row.nome as string, day: info.dia, month0: info.month0, daysLeft: info.offset })
          }
        }
        items.sort((a, b) => a.daysLeft - b.daysLeft)
        setBdayItems(items)
      } catch {
        setBdayItems([])
      }
    })()

    // Lembretes próximos (próximos 3 dias, inclusive hoje)
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('lembretes')
          .select('titulo, periodo, data_inicio, concluido')
        if (!data) { setLembreteItems([]); return }
        const todayBase = new Date(); todayBase.setHours(0, 0, 0, 0)
        const items: LembreteItem[] = []
        for (const r of data) {
          if (r.concluido && r.periodo === 'unico') continue
          const next = nextOccStr(r.periodo, r.data_inicio as string)
          const diff = Math.round((next.getTime() - todayBase.getTime()) / 86400000)
          if (diff >= 0 && diff <= 3) {
            items.push({ titulo: r.titulo as string, daysLeft: diff })
          }
        }
        items.sort((a, b) => a.daysLeft - b.daysLeft)
        setLembreteItems(items)
      } catch {
        setLembreteItems([])
      }
    })()
  }

  useEffect(() => {
    const interval = setInterval(() => {
      void loadPrioridades()
      loadData()
    }, 300_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadPrioridades()
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  useEffect(() => {
    if (!role || !['gestor', 'admin'].includes(role)) return
    async function loadPdiAgenda() {
      try {
        const res = await fetch('/api/pdi/agenda')
        if (!res.ok) return
        const items = await res.json() as PdiAgendaEntry[]
        const now = Date.now()
        const in30 = now + 30 * 86400000
        setPdiAgenda(
          items
            .filter(i => {
              const t = new Date(i.data_conversa).getTime()
              return t >= now && t <= in30
            })
            .slice(0, 5)
        )
      } catch { /* noop */ }
    }
    void loadPdiAgenda()
  }, [role])

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

        {/* ── Block 3: Próximas Conversas PDI (conditional, gestor/admin) ── */}
        {pdiAgenda.length > 0 && (
          <div style={{
            background: '#EFF6FF',
            borderRadius: 8,
            borderLeft: '4px solid #2A4F96',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2A4F96', marginBottom: 10 }}>
              📅 Próximas Conversas PDI
            </div>
            {pdiAgenda.map((item, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13, color: '#1E293B',
                  padding: '5px 0',
                  borderBottom: i < pdiAgenda.length - 1 ? '1px solid #DBEAFE' : 'none',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.colaborador_nome}
                </span>
                <span style={{ color: '#6B7280', fontSize: 11 }}>{fmtDateShort(item.data_conversa)}</span>
              </div>
            ))}
            <Link href="/pdi?agenda=1" style={{ fontSize: 12, color: '#2A4F96', marginTop: 8, display: 'block', textDecoration: 'none', fontWeight: 500 }}>
              Ver agenda completa →
            </Link>
          </div>
        )}

        {/* ── Block 4: Lembretes próximos (conditional) ────────────────── */}
        {lembreteItems.length > 0 && (
          <div style={{
            background: '#FFF8F0',
            borderRadius: 8,
            borderLeft: '4px solid #B85C1A',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7A3A0E', marginBottom: 10 }}>
              📌 Lembretes
            </div>
            {lembreteItems.map((item, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13, color: '#1E293B',
                  padding: '5px 0',
                  borderBottom: i < lembreteItems.length - 1 ? '1px solid #FDDFC4' : 'none',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.titulo}
                </span>
                <span style={{ color: item.daysLeft === 0 ? '#B85C1A' : '#6B7280', fontSize: 11 }}>
                  {item.daysLeft === 0 ? 'Hoje' : item.daysLeft === 1 ? 'Amanhã' : `Em ${item.daysLeft} dias`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Block 5: Aniversários (conditional) ─────────────────────── */}
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
