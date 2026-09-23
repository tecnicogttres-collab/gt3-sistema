'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { nthWeekdayOfMonth } from '../lib/lembretes'
import { useUser } from '../components/UserContext'

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
  createdAt: string
}

type BdayItem = {
  name: string
  day: number
  month0: number
  daysLeft: number
}

type LembreteItem = {
  id: string
  titulo: string
  daysLeft: number
  dataOcorrencia: string
}

type TeamLembreteItem = {
  id: string
  titulo: string
  horaInicio: string | null
  colaboradorId: string
  colaboradorNome: string
}

type PdiAgendaEntry = {
  colaborador_nome: string
  data_conversa: string
  numero_ciclo: number
}

type PdiConversaColaborador = {
  cicloId: string
  pdiId: string
  dataConversa: string
  numeroCiclo: number
}

type ObsPendente = {
  id: string
  categoria: string
  coluna: string
  motivo: string
  autor: string | null
  quando: string | null
}

type DesigPendente = {
  id: string
  empresa: string
  data_verificacao: string
  setores: string[]
}

function fmtDateShort(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtConversaLabel(iso: string): { primary: string; urgent: boolean } {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const dMid = new Date(d); dMid.setHours(0, 0, 0, 0)
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const diffDays = Math.round((dMid.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return { primary: `Hoje às ${time}`, urgent: true }
  if (diffDays === 1) return { primary: `Amanhã às ${time}`, urgent: true }
  if (diffDays <= 7) return { primary: `Em ${diffDays} dias · ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} às ${time}`, urgent: false }
  return { primary: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} às ${time}`, urgent: false }
}

function nextOccStr(periodo: string, dataInicio: string, diaSemana: number | null, semanaOrdinal: number | null): Date {
  const parse = (s: string) => new Date(s + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = parse(dataInicio)
  if (periodo === 'unico') return start
  if (periodo === 'diario') return today < start ? start : today
  if (periodo === 'mensal_dia_semana' && diaSemana != null && semanaOrdinal != null) {
    let y = today.getFullYear(), m = today.getMonth()
    let occ = nthWeekdayOfMonth(y, m, diaSemana, semanaOrdinal)
    while (!occ || occ < today || occ < start) {
      m++; if (m > 11) { m = 0; y++ }
      occ = nthWeekdayOfMonth(y, m, diaSemana, semanaOrdinal)
    }
    return occ
  }
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

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function addDaysStr(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return dateToStr(d)
}

function bdayKey(month0: number, day: number) {
  return `${pad2(month0 + 1)}-${pad2(day)}`
}

function fmtTs(ts: number) {
  const d = new Date(ts)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function prioDateLabel(p: Prioridade): string {
  const latestFeed = p.statusFeed.length > 0
    ? Math.max(...p.statusFeed.map(s => s.data))
    : 0
  const ts = latestFeed || new Date(p.createdAt).getTime()
  const d = new Date(ts); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.getTime() === today.getTime()) return 'Hoje'
  if (d.getTime() === yesterday.getTime()) return 'Ontem'
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardSidebar({ role }: { role?: string }) {
  const isManager = role === 'gestor' || role === 'admin'
  const { profile } = useUser()
  const router = useRouter()
  const [priorities, setPriorities] = useState<Prioridade[]>([])
  const [hoNames, setHoNames] = useState<string[]>([])
  const [bsaPerson, setBsaPerson] = useState('')
  const [bdayItems, setBdayItems] = useState<BdayItem[]>([])
  const [lembreteItems, setLembreteItems] = useState<LembreteItem[]>([])
  const [teamLembretes, setTeamLembretes] = useState<TeamLembreteItem[]>([])
  const [abaLembretes, setAbaLembretes] = useState<'meus' | 'equipe'>('meus')
  // Data (YYYY-MM-DD) a partir da qual cada lembrete volta a aparecer aqui —
  // preenchido ao "Descartar" ou "Adiar" (não afeta a confirmação nem /lembretes).
  const [adiamentos, setAdiamentos] = useState<Record<string, string>>({})
  const [lembreteActingId, setLembreteActingId] = useState<string | null>(null)
  const [adiarPopoverId, setAdiarPopoverId] = useState<string | null>(null)
  const [adiarCustomDate, setAdiarCustomDate] = useState('')
  const [modalPrio, setModalPrio] = useState<Prioridade | null>(null)
  const [pdiAgenda, setPdiAgenda] = useState<PdiAgendaEntry[]>([])
  const [pdiConversaColaborador, setPdiConversaColaborador] = useState<PdiConversaColaborador | null>(null)
  const [obsPendentes, setObsPendentes] = useState<ObsPendente[]>([])
  const [desigPendentes, setDesigPendentes] = useState<DesigPendente[]>([])

  async function loadPrioridades() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prioridades')
      .select('id, empresa, contratante, responsavel, status_feed, created_at')
      .order('updated_at', { ascending: false })
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
          createdAt: row.created_at,
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

    // Conversa PDI agendada (futura) para o próprio usuário
    ;(async () => {
      try {
        const res = await fetch('/api/pdi/proxima-conversa')
        if (!res.ok) { setPdiConversaColaborador(null); return }
        const data = await res.json() as PdiConversaColaborador | null
        setPdiConversaColaborador(data)
      } catch {
        setPdiConversaColaborador(null)
      }
    })()

    // Lembretes próximos (próximos 3 dias, inclusive hoje) — filtrados por visibilidade e confirmação
    ;(async () => {
      try {
        const res = await fetch('/api/lembretes')
        if (!res.ok) { setLembreteItems([]); return }
        const data: Array<{ id: string; titulo: string; periodo: string; data_inicio: string; dia_semana: number | null; semana_ordinal: number | null; concluido: boolean; confirmado: boolean }> = await res.json()
        const todayBase = new Date(); todayBase.setHours(0, 0, 0, 0)
        const items: LembreteItem[] = []
        for (const r of data) {
          if (r.confirmado) continue
          if (r.concluido && r.periodo === 'unico') continue
          const next = nextOccStr(r.periodo, r.data_inicio, r.dia_semana, r.semana_ordinal)
          const diff = Math.round((next.getTime() - todayBase.getTime()) / 86400000)
          if (diff >= 0 && diff <= 3) {
            items.push({ id: r.id, titulo: r.titulo, daysLeft: diff, dataOcorrencia: dateToStr(next) })
          }
        }
        items.sort((a, b) => a.daysLeft - b.daysLeft)
        setLembreteItems(items)
      } catch {
        setLembreteItems([])
      }
    })()

    // Lembretes de outros colaboradores para hoje (aba "Equipe", só gestor/admin)
    if (isManager) {
      ;(async () => {
        try {
          const res = await fetch('/api/lembretes/equipe-hoje')
          if (!res.ok) { setTeamLembretes([]); return }
          const data: TeamLembreteItem[] = await res.json()
          setTeamLembretes(Array.isArray(data) ? data : [])
        } catch {
          setTeamLembretes([])
        }
      })()
    } else {
      setTeamLembretes([])
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      void loadPrioridades()
      loadData()
    }, 300_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reforço além do realtime: se a aba ficou em segundo plano (o navegador suspende o
  // websocket nesse caso) e volta ao foco, refaz a busca — sem isso um lembrete confirmado
  // ou excluído em outra aba pode continuar aparecendo aqui até a próxima rolagem de 5min.
  useEffect(() => {
    function onFocus() { loadData() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: atualiza dashboard imediatamente quando home-office ou revisão mudar
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`dashboard-sheets-rt-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'home_office_sheets' }, () => loadData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'controle_revisao_sheets' }, () => loadData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lembretes_historico' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lembretes' }, () => loadData())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadPrioridades()
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  // Adiamentos/descartes do próprio usuário para o bloco de Lembretes do Dashboard
  useEffect(() => {
    if (!profile?.id) return
    const supabase = createClient()
    void (async () => {
      const { data } = await supabase
        .from('lembretes_adiamentos')
        .select('lembrete_id, mostrar_a_partir_de')
        .eq('usuario_id', profile.id)
      if (!data) return
      const map: Record<string, string> = {}
      for (const row of data as { lembrete_id: string; mostrar_a_partir_de: string }[]) {
        map[row.lembrete_id] = row.mostrar_a_partir_de
      }
      setAdiamentos(map)
    })()
  }, [profile?.id])

  const todayStrLembretes = dateToStr(new Date())
  const visibleLembreteItems = lembreteItems.filter(item => {
    const hideUntil = adiamentos[item.id]
    return !hideUntil || hideUntil <= todayStrLembretes
  })

  async function persistAdiamento(lembreteId: string, mostrarAPartirDe: string) {
    if (!profile?.id) return
    setAdiamentos(prev => ({ ...prev, [lembreteId]: mostrarAPartirDe }))
    const supabase = createClient()
    const { error } = await supabase
      .from('lembretes_adiamentos')
      .upsert({ lembrete_id: lembreteId, usuario_id: profile.id, mostrar_a_partir_de: mostrarAPartirDe }, { onConflict: 'lembrete_id,usuario_id' })
    if (error) console.error('Erro ao adiar/descartar lembrete:', error.message)
  }

  async function handleConfirmDashboard(item: LembreteItem) {
    if (!profile || lembreteActingId) return
    setLembreteActingId(item.id)
    try {
      const supabase = createClient()
      const mesRef = `${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}-01`
      await supabase.from('lembretes_historico').insert({
        lembrete_id: item.id,
        lembrete_titulo: item.titulo,
        usuario_id: profile.id,
        usuario_nome: profile.nome ?? profile.usuario ?? 'Usuário',
        usuario_login: profile.usuario ?? profile.email ?? profile.nome ?? 'Usuário',
        mes_referencia: mesRef,
      })
      setLembreteItems(prev => prev.filter(i => i.id !== item.id))
    } finally {
      setLembreteActingId(null)
    }
  }

  async function handleDescartar(item: LembreteItem) {
    if (lembreteActingId) return
    setLembreteActingId(item.id)
    try {
      await persistAdiamento(item.id, addDaysStr(item.dataOcorrencia, 1))
    } finally {
      setLembreteActingId(null)
    }
  }

  async function handleAdiarPara(item: LembreteItem, dataAlvo: string) {
    if (lembreteActingId) return
    setLembreteActingId(item.id)
    setAdiarPopoverId(null)
    try {
      await persistAdiamento(item.id, dataAlvo)
    } finally {
      setLembreteActingId(null)
    }
  }

  function abrirLembreteNaPagina(item: LembreteItem) {
    router.push(`/lembretes?highlight=${item.id}`)
  }

  // Real-time: atualiza conversa PDI do colaborador imediatamente quando gestor agendar
  useEffect(() => {
    let cancelled = false
    let cleanup = () => {}
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return
      const ch = supabase
        .channel(`pdi-conversa-rt-${Math.random().toString(36).slice(2)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pdi_ciclos', filter: `colaborador_id=eq.${user.id}` },
          () => {
            if (cancelled) return
            fetch('/api/pdi/proxima-conversa')
              .then(r => r.ok ? r.json() : null)
              .then((data: PdiConversaColaborador | null) => { if (!cancelled) setPdiConversaColaborador(data) })
              .catch(() => {})
          }
        )
        .subscribe()
      cleanup = () => { void supabase.removeChannel(ch) }
    })

    return () => { cancelled = true; cleanup() }
  }, [])

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
            .slice(0, 15)
        )
      } catch { /* noop */ }
    }
    void loadPdiAgenda()
  }, [role])

  // Observações aguardando validação (gestor/admin) — aparece ao criar/editar, some ao validar.
  useEffect(() => {
    if (!role || !['gestor', 'admin'].includes(role)) { setObsPendentes([]); return }
    let cancelled = false
    const load = () => {
      fetch('/api/observacoes/pendentes')
        .then(r => r.ok ? r.json() : [])
        .then((d: ObsPendente[]) => { if (!cancelled) setObsPendentes(Array.isArray(d) ? d : []) })
        .catch(() => {})
    }
    load()
    const supabase = createClient()
    const ch = supabase
      .channel(`dashboard-obs-rt-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'observacoes' }, () => load())
      .subscribe()
    return () => { cancelled = true; void supabase.removeChannel(ch) }
  }, [role])

  // Designação de Reprovados — itens aguardando MINHA ciência. Some daqui na hora que
  // eu dou ciência (ação local otimista) e também reage a mudanças feitas em outra aba/
  // dispositivo via realtime na tabela designacoes.
  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/designacao-reprovados/pendentes')
        .then(r => r.ok ? r.json() : [])
        .then((d: DesigPendente[]) => { if (!cancelled) setDesigPendentes(Array.isArray(d) ? d : []) })
        .catch(() => {})
    }
    load()
    const supabase = createClient()
    const ch = supabase
      .channel(`dashboard-desig-rt-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'designacoes' }, () => load())
      .subscribe()
    return () => { cancelled = true; void supabase.removeChannel(ch) }
  }, [])

  async function darCienciaGrupoDesig(ids: string[]) {
    setDesigPendentes(prev => prev.filter(d => !ids.includes(d.id)))
    await Promise.all(ids.map(id => fetch(`/api/designacao-reprovados/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ciencia' }),
    })))
  }

  const sidebarWidth = Math.max(
    priorities.length <= 4 ? 380 : priorities.length <= 8 ? 440 : priorities.length <= 14 ? 500 : 560,
    pdiAgenda.length <= 5 ? 380 : pdiAgenda.length <= 10 ? 440 : 500
  )

  return (
    <>
      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div
        style={{
          width: sidebarWidth,
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
          ) : (() => {
            const groupOrder = Array.from(new Set(priorities.map(prioDateLabel)))
            const groups = priorities.reduce<Record<string, Prioridade[]>>((acc, p) => {
              const label = prioDateLabel(p)
              if (!acc[label]) acc[label] = []
              acc[label].push(p)
              return acc
            }, {})
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groupOrder.map((label, gi) => {
                  const group = groups[label]
                  const maxLen = Math.max(...group.map(p => p.empresa.length))
                  const minCellW = maxLen <= 6 ? 62 : maxLen <= 10 ? 82 : maxLen <= 16 ? 106 : 138
                  return (
                    <div key={label}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        marginBottom: 5, marginTop: gi > 0 ? 2 : 0,
                      }}>
                        {label}
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(auto-fill, minmax(${minCellW}px, 1fr))`,
                        gap: 5,
                      }}>
                        {group.map(p => (
                          <div
                            key={p.id}
                            onDoubleClick={() => setModalPrio(p)}
                            title={`${p.empresa}\n${p.contratante}${p.responsavel ? ' · ' + p.responsavel : ''}\n\nDuplo clique para detalhes`}
                            style={{
                              fontSize: 12, fontWeight: 500, color: '#1E253D',
                              background: '#FFFBF0',
                              border: '1px solid rgba(209,174,110,0.45)',
                              borderRadius: 6, padding: '5px 8px',
                              cursor: 'default', userSelect: 'none',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                          >
                            {p.empresa}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* ── Block 1b: Observações a validar (gestor/admin) ────────────── */}
        {role && ['gestor', 'admin'].includes(role) && obsPendentes.length > 0 && (
          <div style={{
            background: '#fff',
            borderRadius: 8,
            borderLeft: '4px solid #7C3AED',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6D28D9', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📝 Observações a validar</span>
              <span key={obsPendentes.length} className="gt3-pop-in" style={{ background: '#7C3AED', color: '#fff', borderRadius: 9, padding: '0 7px', fontSize: 11 }}>{obsPendentes.length}</span>
            </div>
            {obsPendentes.map((o, i) => (
              <Link
                key={o.id}
                href={`/observacoes?cat=${encodeURIComponent(o.categoria)}`}
                title={`${o.categoria} · ${o.coluna}${o.autor ? ` · ${o.autor}` : ''}`}
                style={{
                  display: 'block', textDecoration: 'none',
                  padding: '5px 0',
                  borderBottom: i < obsPendentes.length - 1 ? '1px solid #EDE9FE' : 'none',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontSize: 13, color: '#1E293B', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.motivo?.trim() || o.coluna}
                </span>
                <span style={{ fontSize: 11, color: '#6B7280' }}>
                  {o.categoria}{o.autor ? ` · ${o.autor}` : ''}
                </span>
              </Link>
            ))}
          </div>
        )}

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

        {/* ── Block 3b: Conversa PDI agendada do próprio usuário ──────── */}
        {pdiConversaColaborador && (() => {
          const { primary, urgent } = fmtConversaLabel(pdiConversaColaborador.dataConversa)
          return (
            <div style={{
              background: urgent ? '#FFF9EB' : '#EFF6FF',
              borderRadius: 8,
              borderLeft: `4px solid ${urgent ? '#D97706' : '#2A4F96'}`,
              padding: '12px 14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: urgent ? '#92400E' : '#2A4F96', marginBottom: 8 }}>
                📅 Conversa PDI agendada
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: urgent ? '#78350F' : '#1E3A6E', lineHeight: 1.4 }}>
                {primary}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>
                Ciclo {pdiConversaColaborador.numeroCiclo}
              </div>
              <Link
                href={`/pdi/${pdiConversaColaborador.pdiId}`}
                style={{
                  fontSize: 12, color: urgent ? '#D97706' : '#2A4F96',
                  marginTop: 10, display: 'inline-block', textDecoration: 'none', fontWeight: 600,
                }}
              >
                Ver meu PDI →
              </Link>
            </div>
          )
        })()}

        {/* ── Block 4: Lembretes próximos (conditional) ────────────────── */}
        {(visibleLembreteItems.length > 0 || (isManager && teamLembretes.length > 0)) && (
          <div style={{
            background: '#FFF8F0',
            borderRadius: 8,
            borderLeft: '4px solid #B85C1A',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7A3A0E' }}>
                📌 Lembretes
              </div>
              {isManager && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['meus', 'equipe'] as const).map(aba => {
                    const on = abaLembretes === aba
                    return (
                      <button
                        key={aba}
                        onClick={() => setAbaLembretes(aba)}
                        style={{
                          position: 'relative', border: `1px solid ${on ? '#B85C1A' : '#FDDFC4'}`,
                          background: on ? '#B85C1A' : '#fff', color: on ? '#fff' : '#7A3A0E',
                          borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {aba === 'meus' ? 'Meus' : 'Equipe'}
                        {aba === 'equipe' && teamLembretes.length > 0 && (
                          <span style={{
                            position: 'absolute', top: -3, right: -3, width: 8, height: 8,
                            borderRadius: '50%', background: '#D64545', border: '1.5px solid #fff',
                          }} />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {(!isManager || abaLembretes === 'meus') ? (
              visibleLembreteItems.length === 0 ? (
                <div style={{ fontSize: 12.5, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum lembrete seu para os próximos dias.</div>
              ) : visibleLembreteItems.map((item, i) => {
                const acting = lembreteActingId === item.id
                const popoverOpen = adiarPopoverId === item.id
                return (
                  <div key={item.id} style={{ padding: '7px 0', borderBottom: i < visibleLembreteItems.length - 1 ? '1px solid #FDDFC4' : 'none' }}>
                    <button
                      onClick={() => abrirLembreteNaPagina(item)}
                      title="Ver este lembrete em Lembretes ativos"
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0,
                        cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.5,
                      }}
                    >
                      <span style={{ fontWeight: 500, fontSize: 13, color: '#1E293B', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.titulo}
                      </span>
                      <span style={{ color: item.daysLeft === 0 ? '#B85C1A' : '#6B7280', fontSize: 11 }}>
                        {item.daysLeft === 0 ? 'Hoje' : item.daysLeft === 1 ? 'Amanhã' : `Em ${item.daysLeft} dias`}
                      </span>
                    </button>

                    <div style={{ display: 'flex', gap: 6, marginTop: 6, position: 'relative' }}>
                      <button
                        onClick={() => void handleConfirmDashboard(item)}
                        disabled={acting}
                        style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #16A34A', background: '#F0FDF4', color: '#15803D', fontSize: 11, fontWeight: 700, cursor: acting ? 'default' : 'pointer', opacity: acting ? 0.5 : 1, fontFamily: 'inherit' }}
                      >
                        OK
                      </button>
                      <button
                        onClick={() => void handleDescartar(item)}
                        disabled={acting}
                        style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', fontSize: 11, fontWeight: 600, cursor: acting ? 'default' : 'pointer', opacity: acting ? 0.5 : 1, fontFamily: 'inherit' }}
                      >
                        Descartar
                      </button>
                      <button
                        onClick={() => { setAdiarPopoverId(popoverOpen ? null : item.id); setAdiarCustomDate('') }}
                        disabled={acting}
                        style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${popoverOpen ? '#B85C1A' : '#D1D5DB'}`, background: popoverOpen ? '#FFF3D9' : '#fff', color: '#7A3A0E', fontSize: 11, fontWeight: 600, cursor: acting ? 'default' : 'pointer', opacity: acting ? 0.5 : 1, fontFamily: 'inherit' }}
                      >
                        Adiar
                      </button>

                      {popoverOpen && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
                          boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: 10, width: 200,
                        }}>
                          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            {[{ lbl: '+1 dia', d: 1 }, { lbl: '+3 dias', d: 3 }, { lbl: '+7 dias', d: 7 }].map(opt => (
                              <button
                                key={opt.d}
                                onClick={() => void handleAdiarPara(item, addDaysStr(todayStrLembretes, opt.d))}
                                style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#374151', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                {opt.lbl}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input
                              type="date"
                              value={adiarCustomDate}
                              onChange={e => setAdiarCustomDate(e.target.value)}
                              min={todayStrLembretes}
                              style={{ flex: 1, padding: '3px 6px', border: '1px solid #E2E8F0', borderRadius: 5, fontSize: 11, fontFamily: 'inherit', color: '#1E293B' }}
                            />
                            <button
                              onClick={() => { if (adiarCustomDate) void handleAdiarPara(item, adiarCustomDate) }}
                              disabled={!adiarCustomDate}
                              style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: '#B85C1A', color: '#fff', fontSize: 11, fontWeight: 600, cursor: adiarCustomDate ? 'pointer' : 'default', opacity: adiarCustomDate ? 1 : 0.5, fontFamily: 'inherit' }}
                            >
                              OK
                            </button>
                          </div>
                          <button
                            onClick={() => setAdiarPopoverId(null)}
                            style={{ marginTop: 6, width: '100%', padding: '3px 0', borderRadius: 5, border: 'none', background: 'none', color: '#9CA3AF', fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              teamLembretes.length === 0 ? (
                <div style={{ fontSize: 12.5, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum lembrete de outros colaboradores hoje.</div>
              ) : teamLembretes.map((item, i) => (
                <Link
                  key={item.id}
                  href={`/lembretes?outros=${item.colaboradorId}`}
                  title="Ver lembretes deste colaborador"
                  style={{
                    fontSize: 13, color: '#1E293B', textDecoration: 'none',
                    padding: '5px 0', display: 'block',
                    borderBottom: i < teamLembretes.length - 1 ? '1px solid #FDDFC4' : 'none',
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.titulo}
                  </span>
                  <span style={{ color: '#6B7280', fontSize: 11 }}>
                    {item.colaboradorNome}{item.horaInicio ? ` · ${item.horaInicio.slice(0, 5)}` : ''}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}

        {/* ── Block 4b: Designação de Reprovados — aguardando minha ciência ── */}
        {desigPendentes.length > 0 && (
          <div style={{
            background: '#EFF6FF',
            borderRadius: 8,
            borderLeft: '4px solid #2A4F96',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2A4F96' }}>
                📋 Designação de Reprovados
              </div>
              <span key={desigPendentes.length} className="gt3-pop-in" style={{ background: '#2A4F96', color: '#fff', borderRadius: 9, padding: '0 7px', fontSize: 11 }}>{desigPendentes.length}</span>
            </div>
            {(() => {
              const ordenados = [...desigPendentes].sort((a, b) =>
                b.data_verificacao.localeCompare(a.data_verificacao) || a.empresa.localeCompare(b.empresa, 'pt-BR'))
              type Grupo = { key: string; empresa: string; data: string; itens: DesigPendente[] }
              const grupos: Grupo[] = []
              const map = new Map<string, Grupo>()
              for (const d of ordenados) {
                const key = d.data_verificacao + '|' + d.empresa.trim().toLowerCase()
                let g = map.get(key)
                if (!g) { g = { key, empresa: d.empresa, data: d.data_verificacao, itens: [] }; map.set(key, g); grupos.push(g) }
                g.itens.push(d)
              }
              return grupos.map((g, i) => {
                const [y, m, dd] = g.data.split('-')
                const setoresUnicos = [...new Set(g.itens.flatMap(x => x.setores))]
                return (
                  <div key={g.key} style={{
                    padding: '7px 0', borderBottom: i < grupos.length - 1 ? '1px solid #DBEAFE' : 'none',
                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
                  }}>
                    <Link href="/designacao-reprovados?caixa=1" style={{ textDecoration: 'none', minWidth: 0, flex: 1 }}>
                      <span style={{ fontWeight: 500, color: '#1E293B', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {g.empresa}
                      </span>
                      <span style={{ color: '#6B7280', fontSize: 11 }}>
                        {dd}/{m}/{y.slice(2)} · {setoresUnicos.join(', ')}
                      </span>
                    </Link>
                    <button
                      onClick={() => void darCienciaGrupoDesig(g.itens.map(x => x.id))}
                      title="Dar ciência e tirar daqui"
                      style={{
                        flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#2A4F96', background: '#fff',
                        border: '1px solid #C7D2E8', borderRadius: 6, padding: '4px 9px', cursor: 'pointer',
                      }}
                    >
                      ✓ Ciência
                    </button>
                  </div>
                )
              })
            })()}
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
