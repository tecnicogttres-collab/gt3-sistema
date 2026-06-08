'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '../lib/supabase'

type AgendaItem = {
  id: string
  pdi_id: string
  colaborador_id: string | null
  numero_ciclo: number
  data_inicio: string
  data_fim: string | null
  data_conversa: string
  conversa_confirmada_em: string | null
  colaborador_nome: string
}

const MONTHS_PT_AG = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
function formatCicloPeriodo(dataInicio: string, dataFim: string | null): string {
  const ini = new Date(dataInicio + 'T12:00:00')
  const iniStr = `${MONTHS_PT_AG[ini.getMonth()]}/${String(ini.getFullYear()).slice(-2)}`
  if (!dataFim) return `${iniStr} - em aberto`
  const fim = new Date(dataFim + 'T12:00:00')
  return `${iniStr} - ${MONTHS_PT_AG[fim.getMonth()]}/${String(fim.getFullYear()).slice(-2)}`
}

type Props = { open: boolean; onClose: () => void; onCountChange: (n: number) => void }

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
function pad2(n: number) { return String(n).padStart(2, '0') }

function fmtConversa(iso: string) {
  const d = new Date(iso)
  return `${WEEKDAYS[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} às ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export default function PdiAgendaDrawer({ open, onClose, onCountChange }: Props) {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [reagendarId, setReagendarId] = useState<string | null>(null)
  const [reagendarDate, setReagendarDate] = useState('')
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [realizadasOpen, setRealizadasOpen] = useState(false)
  const channelName = useRef(`pdi-agenda-rt-${Math.random().toString(36).slice(2)}`)

  const updateBadge = useCallback((data: AgendaItem[]) => {
    const now = Date.now()
    const in30 = now + 30 * 86400000
    onCountChange(data.filter(i => {
      const t = new Date(i.data_conversa).getTime()
      return t >= now && t <= in30
    }).length)
  }, [onCountChange])

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch('/api/pdi/agenda')
      if (res.ok) {
        const data: AgendaItem[] = await res.json()
        setItems(data)
        updateBadge(data)
      }
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [updateBadge])

  // Initial fetch for badge count
  useEffect(() => { void load() }, [load])

  // Refresh items when drawer opens
  useEffect(() => { if (open) void load(true) }, [open, load])

  // Realtime updates
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pdi_ciclos' }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [load])

  async function doReagendar(item: AgendaItem) {
    if (!reagendarDate) return
    setSaving(item.id)
    try {
      await fetch(`/api/pdi/${item.pdi_id}/ciclos/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_conversa: new Date(reagendarDate).toISOString() }),
      })
      setReagendarId(null)
      void load(true)
    } finally { setSaving(null) }
  }

  async function doRemover(item: AgendaItem) {
    setSaving(item.id)
    try {
      await fetch(`/api/pdi/${item.pdi_id}/ciclos/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_conversa: null }),
      })
      setRemoveConfirmId(null)
      void load(true)
    } finally { setSaving(null) }
  }

  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 86400000)
  const proximos = items.filter(i => { const d = new Date(i.data_conversa); return d >= now && d <= in30 })
  const futuras = items.filter(i => new Date(i.data_conversa) > in30)
  const realizadas = items.filter(i => new Date(i.data_conversa) < now)

  const renderItem = (item: AgendaItem) => {
    const confirmed = !!item.conversa_confirmada_em
    const isRE = reagendarId === item.id
    const isRM = removeConfirmId === item.id
    const isSaving = saving === item.id

    return (
      <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.colaborador_nome}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
              {item.data_inicio ? formatCicloPeriodo(item.data_inicio, item.data_fim) : `Ciclo ${item.numero_ciclo}`}
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{fmtConversa(item.data_conversa)}</div>
          </div>
          <span style={{
            flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 10,
            backgroundColor: confirmed ? '#DCFCE7' : '#FEF9C3',
            color: confirmed ? '#166534' : '#854D0E', whiteSpace: 'nowrap',
          }}>
            {confirmed ? '✅ Confirmado' : '⏳ Aguardando'}
          </span>
        </div>

        {isRE ? (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="datetime-local"
              value={reagendarDate}
              onChange={e => setReagendarDate(e.target.value)}
              style={{ flex: 1, minWidth: 180, fontSize: 12, padding: '5px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontFamily: 'inherit' }}
            />
            <button
              onClick={() => void doReagendar(item)}
              disabled={isSaving || !reagendarDate}
              style={{ fontSize: 12, padding: '5px 12px', border: 'none', borderRadius: 6, backgroundColor: '#2A4F96', color: '#fff', cursor: isSaving ? 'wait' : 'pointer', fontWeight: 600 }}
            >{isSaving ? '…' : 'Salvar'}</button>
            <button
              onClick={() => setReagendarId(null)}
              style={{ fontSize: 12, padding: '5px 9px', border: '1px solid #E2E8F0', borderRadius: 6, backgroundColor: '#fff', color: '#475569', cursor: 'pointer' }}
            >✕</button>
          </div>
        ) : isRM ? (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, flex: 1 }}>Remover data?</span>
            <button
              onClick={() => setRemoveConfirmId(null)}
              style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: 6, backgroundColor: '#fff', color: '#475569', cursor: 'pointer' }}
            >Não</button>
            <button
              onClick={() => void doRemover(item)}
              disabled={isSaving}
              style={{ fontSize: 12, padding: '4px 10px', border: 'none', borderRadius: 6, backgroundColor: '#DC2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
            >Sim</button>
          </div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setReagendarId(item.id); setReagendarDate(toDatetimeLocal(item.data_conversa)) }}
              style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #CBD5E1', borderRadius: 6, backgroundColor: '#F8FAFC', color: '#2A4F96', cursor: 'pointer', fontWeight: 500 }}
            >Reagendar</button>
            <button
              onClick={() => setRemoveConfirmId(item.id)}
              style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #FECACA', borderRadius: 6, backgroundColor: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}
            >Remover data</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      {open && (
        <>
          <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
            backgroundColor: '#fff', zIndex: 1001, display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', animation: 'slideInRight 0.25s ease-out',
          }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>📅 Agenda PDI</div>
                <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>Todas as conversas agendadas</div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', lineHeight: 1, padding: '2px 6px' }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '32px 0' }}>Carregando…</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '14px 0 6px' }}>
                    Próximos 30 dias ({proximos.length})
                  </div>
                  {proximos.length === 0
                    ? <div style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic', paddingBottom: 12 }}>Nenhuma conversa nos próximos 30 dias</div>
                    : proximos.map(renderItem)
                  }

                  <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 0 6px' }}>
                      Futuras ({futuras.length})
                    </div>
                    {futuras.length === 0
                      ? <div style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic', paddingBottom: 12 }}>Nenhuma</div>
                      : futuras.map(renderItem)
                    }
                  </div>

                  <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 8 }}>
                    <button
                      onClick={() => setRealizadasOpen(o => !o)}
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                      <span>Realizadas ({realizadas.length})</span>
                      <span style={{ fontSize: 10 }}>{realizadasOpen ? '▲' : '▼'}</span>
                    </button>
                    {realizadasOpen && (
                      realizadas.length === 0
                        ? <div style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic', paddingBottom: 12 }}>Nenhuma</div>
                        : realizadas.map(renderItem)
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
