'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../lib/supabase'
import { pickNextFeriasColor } from '../lib/feriasColors'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES_VISIVEIS = 3
const MAX_DOTS = 4
const FOLGA_COLOR = '#FFE600'

type FeriasRecord = { id: string; pessoa: string; inicio: string; fim: string; observacao: string; tipo: 'ferias' | 'folga' }
type TooltipState = { visible: boolean; x: number; y: number; record: FeriasRecord | null }
type ExtraPessoa = { id: string; nome: string; cor: string }
type ActiveUser = { id: string; nome: string; cor: string }

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

function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Registros antigos foram salvos com nome curto/abreviado (ex.: "Marcio Z.",
// "Jose", "Rodrigo") — pode não bater mais 100% com o nome completo do login
// (ex.: "Marcio Zim", "José Knapp"). Casa por prefixo, token a token, pra achar
// o colaborador certo sem precisar migrar os dados antigos.
function nameMatchesPessoa(pessoa: string, nomeCompleto: string): boolean {
  const pessoaTokens = normalizeName(pessoa).split(/\s+/).filter(Boolean)
  const nomeTokens = normalizeName(nomeCompleto).split(/\s+/).filter(Boolean)
  if (pessoaTokens.length === 0) return false
  return pessoaTokens.every((tok, i) => {
    const alvo = nomeTokens[i]
    return !!alvo && alvo.startsWith(tok.replace(/\.$/, ''))
  })
}

export default function CalendarioFeriasClient() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [view, setView] = useState<'calendario' | 'lista'>('lista')
  const [records, setRecords] = useState<FeriasRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, record: null })
  // Nome em foco na lista abaixo de cada mês — destaca os dias dele no calendário
  const [hoverRecId, setHoverRecId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mPessoa, setMPessoa] = useState('')
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [mInicio, setMInicio] = useState('')
  const [mFim, setMFim] = useState('')
  const [mObs, setMObs] = useState('')
  const [mTipo, setMTipo] = useState<'ferias' | 'folga'>('ferias')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [extraPeople, setExtraPeople] = useState<ExtraPessoa[]>([])
  const [addPersonOpen, setAddPersonOpen] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [addingSaving, setAddingSaving] = useState(false)

  const loadAll = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('ferias')
      .select('id, pessoa, inicio, fim, observacao, tipo')
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

  const loadExtraPeople = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('ferias_pessoas').select('id, nome, cor').order('created_at', { ascending: true })
    if (data) setExtraPeople(data as ExtraPessoa[])
  }, [])

  useEffect(() => { void loadExtraPeople() }, [loadExtraPeople])

  // Só colaboradores com login ativo entram nas opções — quem perde o acesso
  // some da lista (histórico continua no calendário, só não é mais selecionável).
  const loadActiveUsers = useCallback(async () => {
    const res = await fetch('/api/ferias/usuarios')
    if (res.ok) setActiveUsers(await res.json())
  }, [])

  useEffect(() => { void loadActiveUsers() }, [loadActiveUsers])

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

  // Calendário mostra MESES_VISIVEIS meses lado a lado e navega de bloco em bloco
  const shiftMonths = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setMonth(d.getMonth()); setYear(d.getFullYear())
  }
  const prevMonth = () => shiftMonths(-MESES_VISIVEIS)
  const nextMonth = () => shiftMonths(MESES_VISIVEIS)

  const visibleMonths = Array.from({ length: MESES_VISIVEIS }, (_, i) => {
    const d = new Date(year, month + i, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const lastVisible = visibleMonths[visibleMonths.length - 1]
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const monthStart = dayStr(year, month, 1)
  const monthEnd = dayStr(lastVisible.year, lastVisible.month, new Date(lastVisible.year, lastVisible.month + 1, 0).getDate())
  const monthRecords = records.filter(v => v.inicio <= monthEnd && v.fim >= monthStart)
  const periodoLabel = lastVisible.year === year
    ? `${MONTHS[month]} – ${MONTHS[lastVisible.month]} ${year}`
    : `${MONTHS[month]} ${year} – ${MONTHS[lastVisible.month]} ${lastVisible.year}`

  const uniquePeople = new Set(monthRecords.map(v => v.pessoa)).size
  const totalMonthDays = monthRecords.reduce((acc, v) => {
    const s = v.inicio < monthStart ? monthStart : v.inicio
    const e = v.fim > monthEnd ? monthEnd : v.fim
    return acc + Math.round((parseD(e).getTime() - parseD(s).getTime()) / 86400000) + 1
  }, 0)

  const allPeople = [...activeUsers.map(u => u.nome), ...extraPeople.map(p => p.nome)]
  const allColors = [...activeUsers.map(u => u.cor), ...extraPeople.map(p => p.cor)]
  const getColor = (nome: string) => {
    const exact = allPeople.indexOf(nome)
    if (exact >= 0) return allColors[exact]
    // Fallback pra registros antigos com nome curto: só entre logins ativos,
    // e só se casar com exatamente um colaborador (evita atribuir errado
    // quando há homônimos, ex.: mais de um "Rodrigo").
    const candidatos = activeUsers.filter(u => nameMatchesPessoa(nome, u.nome))
    return candidatos.length === 1 ? candidatos[0].cor : '#888'
  }

  // Lista: só o que ainda não chegou no último dia (exclui o que termina hoje ou já passou)
  const upcomingRecords = [...records]
    .filter(v => v.fim > todayStr)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))

  const openModal = (id: string | null, initialDay?: string, tipo?: 'ferias' | 'folga') => {
    setEditingId(id)
    if (id) {
      const v = records.find(x => x.id === id)
      if (v) { setMPessoa(resolvePessoa(v.pessoa)); setMInicio(v.inicio); setMFim(v.fim); setMObs(v.observacao || ''); setMTipo(v.tipo ?? 'ferias') }
    } else {
      setMPessoa(allPeople[0] ?? '')
      setMInicio(initialDay ?? '')
      setMFim(initialDay ?? '')
      setMObs('')
      setMTipo(tipo ?? 'ferias')
    }
    setSavedMsg(null)
    setModalOpen(true)
  }

  // Registro antigo com nome curto (ex.: "Marcio Z.") não bate com as opções
  // do select (nome completo do login) — sem isso o select mostrava o primeiro
  // da lista em ordem alfabética. Se casar com exatamente um colaborador, usa
  // o nome completo; senão mantém o nome gravado (vira opção extra no select).
  const resolvePessoa = (pessoa: string): string => {
    if (allPeople.includes(pessoa)) return pessoa
    const candidatos = activeUsers.filter(u => nameMatchesPessoa(pessoa, u.nome))
    return candidatos.length === 1 ? candidatos[0].nome : pessoa
  }

  const closeModal = () => { setModalOpen(false); setEditingId(null); setSavedMsg(null) }

  // Nada antes de hoje — exceto, na edição, as datas que o registro já tinha
  // (férias em andamento começaram no passado e continuam editáveis).
  const editingRecord = editingId ? records.find(x => x.id === editingId) : undefined
  const minInicio = editingRecord && editingRecord.inicio < todayStr ? editingRecord.inicio : todayStr
  const minFim = editingRecord && editingRecord.fim < todayStr ? editingRecord.fim : todayStr

  const doSave = async (): Promise<boolean> => {
    if (!mPessoa) { alert('Selecione um colaborador.'); return false }
    if (!mInicio || !mFim) { alert('Preencha início e fim.'); return false }
    if (mFim < mInicio) { alert('A data de fim deve ser igual ou posterior ao início.'); return false }
    // Data retroativa bloqueada (quase sempre é ano digitado errado)
    if (mInicio < minInicio || mFim < minFim) {
      alert(`Não é possível registrar data retroativa (anterior a ${fmt(todayStr)}).\n\nConfira o ano digitado.`)
      return false
    }
    setSaving(true)
    const supabase = createClient()
    if (editingId) {
      const { error } = await supabase.from('ferias').update({ pessoa: mPessoa, inicio: mInicio, fim: mFim, observacao: mObs, tipo: mTipo }).eq('id', editingId)
      if (error) { console.error(error); alert(`Erro ao salvar: ${error.message}`); setSaving(false); return false }
    } else {
      const { error } = await supabase.from('ferias').insert({ pessoa: mPessoa, inicio: mInicio, fim: mFim, observacao: mObs, tipo: mTipo })
      if (error) { console.error(error); alert(`Erro ao salvar: ${error.message}`); setSaving(false); return false }
    }
    setSaving(false)
    void loadAll()
    return true
  }

  const handleSave = async () => { if (await doSave()) closeModal() }

  const handleSaveAndNext = async () => {
    if (await doSave()) {
      setSavedMsg(`${mTipo === 'folga' ? 'Folga' : 'Férias'} de ${mPessoa} (${fmt(mInicio)} → ${fmt(mFim)}) salva${mTipo === 'folga' ? '' : 's'}. Pode incluir o próximo.`)
      setEditingId(null)
      setMPessoa(allPeople[0] ?? '')
      setMInicio('')
      setMFim('')
      setMObs('')
    }
  }

  const handleDelete = async () => {
    if (!editingId || !confirm('Excluir este registro de férias?')) return
    const supabase = createClient()
    await supabase.from('ferias').delete().eq('id', editingId)
    closeModal()
    void loadAll()
  }

  const handleAddPerson = async () => {
    const nome = newPersonName.trim()
    if (!nome) return
    if (allPeople.some(p => p.toLowerCase() === nome.toLowerCase())) {
      alert('Colaborador já existe na lista.'); return
    }
    setAddingSaving(true)
    const usedColors = new Set(allColors)
    const cor = pickNextFeriasColor(usedColors, activeUsers.length + extraPeople.length)
    const supabase = createClient()
    const { data, error } = await supabase.from('ferias_pessoas').insert({ nome, cor }).select('id, nome, cor').single()
    if (error) { console.error(error); setAddingSaving(false); return }
    setExtraPeople(prev => [...prev, data as ExtraPessoa])
    setNewPersonName('')
    setAddPersonOpen(false)
    setAddingSaving(false)
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
    <div style={{ maxWidth: view === 'calendario' ? 1400 : 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1.5px solid #E2E8F0', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2A4F96' }}>GT3 Consultoria</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1E293B', letterSpacing: -0.5, lineHeight: 1, marginTop: 4 }}>Calendário de Férias</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => openModal(null, undefined, 'folga')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: FOLGA_COLOR, color: '#2A2000', border: 'none', borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.92)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Adicionar folga
          </button>
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
      </div>

      {/* Toggle de visão */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([
          { key: 'calendario' as const, lbl: '📅 Calendário' },
          { key: 'lista' as const, lbl: `📋 Lista (${upcomingRecords.length})` },
        ]).map(opt => {
          const on = view === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${on ? '#2A4F96' : '#E2E8F0'}`,
                background: on ? '#2A4F96' : '#fff',
                color: on ? '#fff' : '#6B7A99',
              }}
            >
              {opt.lbl}
            </button>
          )
        })}
      </div>

      {view === 'calendario' && (
        <>
          {/* Month nav + summary */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={prevMonth} style={navBtn} title="3 meses anteriores">←</button>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#1E293B', minWidth: 260, textAlign: 'center' }}>
                {periodoLabel}
              </span>
              <button onClick={nextMonth} style={navBtn} title="Próximos 3 meses">→</button>
              {(month !== today.getMonth() || year !== today.getFullYear()) && (
                <button
                  onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()) }}
                  style={{ ...navBtn, width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600 }}
                >
                  Hoje
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { val: monthRecords.length, lbl: `registro${monthRecords.length !== 1 ? 's' : ''}` },
                { val: uniquePeople, lbl: `colaborador${uniquePeople !== 1 ? 'es' : ''}` },
                { val: totalMonthDays, lbl: 'dias no período' },
              ].map(item => (
                <div key={item.lbl} style={{ background: '#fff', border: '1px solid rgba(42,79,150,0.12)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#6b7a9e', boxShadow: '0 2px 8px rgba(42,79,150,0.06)' }}>
                  <strong style={{ color: '#2A4F96' }}>{item.val}</strong> {item.lbl}
                </div>
              ))}
            </div>
          </div>

      {/* Calendar — 3 meses lado a lado: dias só com bolinhas de cor, e a lista de quem
          está fora no mês logo abaixo (os nomes saíram de dentro das células) */}
      {loading ? (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '3rem', textAlign: 'center', color: '#6B7A99', fontSize: 14 }}>Carregando...</div>
      ) : loadError ? (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '3rem', textAlign: 'center', color: '#b03030', fontSize: 14 }}>
          Erro ao carregar dados: <strong>{loadError}</strong>
          <br />
          <span style={{ fontSize: 12, color: '#6b7a9e', marginTop: 8, display: 'block' }}>
            Verifique se a tabela <code>ferias</code> foi criada no Supabase (execute <code>supabase-ferias.sql</code>).
          </span>
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        {visibleMonths.map(({ year: y, month: m }) => {
          const totalDays = new Date(y, m + 1, 0).getDate()
          const firstDow = new Date(y, m, 1).getDay()
          const isCurrent = y === today.getFullYear() && m === today.getMonth()
          const mStart = dayStr(y, m, 1)
          const mEnd = dayStr(y, m, totalDays)
          const doMes = records
            .filter(v => v.inicio <= mEnd && v.fim >= mStart)
            .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.pessoa.localeCompare(b.pessoa))
          return (
      <div key={`${y}-${m}`} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 14px 12px', boxShadow: '0 1px 4px rgba(42,79,150,0.05)' }}>
        {/* Month title */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{MONTHS[m]} <span style={{ fontWeight: 500, color: '#94A3B8' }}>{y}</span></span>
          {isCurrent && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2A4F96', background: '#EBF0FB', borderRadius: 20, padding: '2px 8px' }}>Mês atual</span>}
        </div>

        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#A0AEC0', padding: '2px 0' }}>
              {d.charAt(0)}
            </div>
          ))}
        </div>

        {/* Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', rowGap: 2 }}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
            const ds = dayStr(y, m, d)
            const isToday = ds === todayStr
            const dow = (firstDow + d - 1) % 7
            const isWeekend = dow === 0 || dow === 6
            const vacHere = doMes.filter(v => v.inicio <= ds && ds <= v.fim)
            const hl = vacHere.find(v => v.id === hoverRecId)
            const hlColor = hl ? (hl.tipo === 'folga' ? FOLGA_COLOR : getColor(hl.pessoa)) : null
            return (
              <div
                key={d}
                onClick={() => openModal(null, ds)}
                title={vacHere.length ? vacHere.map(v => `${v.tipo === 'folga' ? 'Folga — ' : ''}${v.pessoa}`).join('\n') : 'Clique para adicionar'}
                style={{
                  height: 42, borderRadius: 8, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 3,
                  paddingTop: 4,
                  background: hlColor ? `color-mix(in srgb, ${hlColor} ${hl?.tipo === 'folga' ? 45 : 26}%, transparent)` : 'transparent',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'inset 0 0 0 1.5px #C9D6EF' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11.5, fontWeight: isToday || hl ? 700 : 500,
                  background: isToday ? '#2A4F96' : 'transparent',
                  color: isToday ? '#fff' : hl ? '#1E293B' : isWeekend ? '#A0AEC0' : '#475569',
                }}>
                  {d}
                </span>
                {vacHere.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 7 }}>
                    {vacHere.slice(0, MAX_DOTS).map(v => (
                      <span key={v.id} style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: v.tipo === 'folga' ? FOLGA_COLOR : getColor(v.pessoa),
                        boxShadow: v.tipo === 'folga' ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none',
                      }} />
                    ))}
                    {vacHere.length > MAX_DOTS && <span style={{ fontSize: 8, fontWeight: 700, color: '#6B7A99', lineHeight: 1 }}>+{vacHere.length - MAX_DOTS}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Quem está fora no mês */}
        <div style={{ borderTop: '1px solid #EEF2F7', marginTop: 10, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {doMes.length === 0 ? (
            <div style={{ fontSize: 11.5, color: '#A0AEC0', padding: '4px 4px' }}>Ninguém de férias ou folga neste mês.</div>
          ) : doMes.map(v => {
            const isFolga = v.tipo === 'folga'
            return (
              <div
                key={v.id}
                onClick={() => openModal(v.id)}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = '#F4F7FC'
                  setHoverRecId(v.id)
                  setTooltip({ visible: true, x: e.clientX + 14, y: e.clientY - 10, record: v })
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  setHoverRecId(null)
                  setTooltip(t => ({ ...t, visible: false }))
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              >
                <span style={{ width: 4, height: 16, borderRadius: 2, flexShrink: 0, background: isFolga ? FOLGA_COLOR : getColor(v.pessoa), boxShadow: isFolga ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none' }} />
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.pessoa}
                  {isFolga && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: '#6B5A00', background: '#FFF6A8', borderRadius: 4, padding: '1px 5px' }}>FOLGA</span>}
                </span>
                <span style={{ color: '#6B7A99', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 11.5 }}>
                  {v.inicio === v.fim ? fmt(v.inicio).slice(0, 5) : `${fmt(v.inicio).slice(0, 5)} – ${fmt(v.fim).slice(0, 5)}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
          )
        })}
      </div>
      )}
        </>
      )}

      {view === 'lista' && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', marginBottom: 4 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7A99', fontSize: 14 }}>Carregando...</div>
          ) : loadError ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#b03030', fontSize: 14 }}>
              Erro ao carregar dados: <strong>{loadError}</strong>
            </div>
          ) : upcomingRecords.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
              Nenhuma férias ou folga em andamento ou por vir.
            </div>
          ) : (
            <div>
              {upcomingRecords.map((v, i) => {
                const isFolga = v.tipo === 'folga'
                const emAndamento = v.inicio <= todayStr && todayStr <= v.fim
                const diasParaComecar = Math.round((parseD(v.inicio).getTime() - parseD(todayStr).getTime()) / 86400000)
                const monthKey = v.inicio.slice(0, 7)
                const isNewMonth = i === 0 || upcomingRecords[i - 1].inicio.slice(0, 7) !== monthKey
                const [my, mm] = monthKey.split('-')
                return (
                  <div key={v.id}>
                    {isNewMonth && (
                      <div style={{
                        padding: '10px 16px 6px', fontSize: 10.5, fontWeight: 700, color: '#94A3B8',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        background: '#FAFBFC', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none',
                      }}>
                        {MONTHS[parseInt(mm, 10) - 1]} {my}
                      </div>
                    )}
                    <div
                      onClick={() => openModal(v.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        borderBottom: i < upcomingRecords.length - 1 ? '1px solid #F1F5F9' : 'none',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: isFolga ? FOLGA_COLOR : getColor(v.pessoa), flexShrink: 0, border: isFolga ? '1px solid rgba(0,0,0,0.15)' : 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{v.pessoa}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 4, background: isFolga ? '#FFF7D6' : '#EBF0FB', color: isFolga ? '#8a6d00' : '#2A4F96' }}>
                            {isFolga ? 'Folga' : 'Férias'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>
                          {fmt(v.inicio)} → {fmt(v.fim)} · {totalDays(v)} dia{totalDays(v) !== 1 ? 's' : ''}
                          {v.observacao && <span style={{ fontStyle: 'italic' }}> · {v.observacao}</span>}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, whiteSpace: 'nowrap', flexShrink: 0,
                        background: emAndamento ? '#DCFCE7' : '#F1F5F9',
                        color: emAndamento ? '#166534' : '#6B7A99',
                      }}>
                        {emAndamento ? 'Em andamento' : diasParaComecar === 0 ? 'Começa hoje' : diasParaComecar === 1 ? 'Começa amanhã' : `Em ${diasParaComecar} dias`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {allPeople.map((p, i) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A99' }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: allColors[i] }} />
            {p}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A99', marginLeft: 4, paddingLeft: 12, borderLeft: '1px solid #E2E8F0' }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: FOLGA_COLOR, border: '1px solid rgba(0,0,0,0.12)' }} />
          Folga
        </div>
      </div>

      {/* Adicionar colaborador */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        {!addPersonOpen ? (
          <button
            onClick={() => { setAddPersonOpen(true); setNewPersonName('') }}
            style={{ background: 'none', border: '1px dashed #CBD5E0', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2A4F96'; (e.currentTarget as HTMLButtonElement).style.color = '#2A4F96' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E0'; (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Adicionar colaborador
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              autoFocus
              type="text"
              placeholder="Nome do colaborador"
              value={newPersonName}
              onChange={e => setNewPersonName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAddPerson(); if (e.key === 'Escape') setAddPersonOpen(false) }}
              style={{ padding: '5px 10px', border: '1px solid rgba(42,79,150,0.3)', borderRadius: 6, fontSize: 13, outline: 'none', width: 200, fontFamily: 'inherit', color: '#1E293B' }}
            />
            <button
              onClick={() => void handleAddPerson()}
              disabled={addingSaving || !newPersonName.trim()}
              style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#2A4F96', color: '#fff', fontSize: 12, fontWeight: 600, cursor: addingSaving ? 'wait' : 'pointer', opacity: !newPersonName.trim() ? 0.5 : 1 }}
            >
              {addingSaving ? '…' : 'Salvar'}
            </button>
            <button
              onClick={() => setAddPersonOpen(false)}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, color: '#6B7A99', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        )}
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
          className="gt3-overlay-fade"
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,60,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="gt3-drop-in" style={{ background: '#fff', border: '1px solid rgba(42,79,150,0.12)', borderRadius: 16, padding: '1.75rem', width: 380, maxWidth: '94vw', boxShadow: '0 8px 32px rgba(42,79,150,0.14)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#2A4F96', margin: 0 }}>
                {editingId ? (mTipo === 'folga' ? 'Editar folga' : 'Editar férias') : (mTipo === 'folga' ? 'Registrar folga' : 'Registrar férias')}
              </h3>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#a0aac4', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {savedMsg && (
              <div style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 500, marginBottom: '1rem' }}>
                ✓ {savedMsg}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={fieldLabel}>Colaborador</label>
              <select value={mPessoa} onChange={e => { setMPessoa(e.target.value); setSavedMsg(null) }} style={fieldInput}>
                {mPessoa && !allPeople.includes(mPessoa) && <option value={mPessoa}>{mPessoa}</option>}
                {allPeople.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
              <div>
                <label style={fieldLabel}>Início</label>
                <input type="date" value={mInicio} min={minInicio} onChange={e => {
                  setMInicio(e.target.value)
                  if (!mFim || mFim < e.target.value) setMFim(e.target.value)
                }} style={fieldInput} />
              </div>
              <div>
                <label style={fieldLabel}>Fim</label>
                <input type="date" value={mFim} min={mInicio && mInicio > minFim ? mInicio : minFim} onChange={e => setMFim(e.target.value)} style={fieldInput} />
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
              {!editingId && (
                <button
                  onClick={() => void handleSaveAndNext()}
                  disabled={saving}
                  style={{ background: 'transparent', color: '#2A4F96', border: '1px solid rgba(42,79,150,0.35)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
                  onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#f0f4ff' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  Salvar e incluir outro
                </button>
              )}
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
