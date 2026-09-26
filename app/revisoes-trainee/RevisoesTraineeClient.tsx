'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useUser } from '../components/UserContext'
import { createClient } from '../lib/supabase'

type Status = 'pending' | 'red' | 'yellow' | 'green' | 'erro_corrigido'
type AutoAval = 'aprovado' | 'pendente' | 'reprovado' | null
type SortKey = 'created_at' | 'empresa' | 'colaborador' | 'documento' | 'auto_avaliacao' | 'status'

type Registro = {
  id: string
  data_dia: string
  empresa: string
  colaborador: string | null
  documento: string
  observacoes: string | null
  auto_avaliacao: AutoAval
  criado_por: string
  created_at: string
  status: Status
  nota_revisor: string | null
  revisado_por: string | null
  revisado_em: string | null
  corrigido_em: string | null
  criado_por_profile: { nome: string } | null
  revisado_por_profile: { nome: string } | null
}

const AUTO_AVAL_META: Record<NonNullable<AutoAval>, { icon: string; label: string; color: string; bg: string }> = {
  aprovado:  { icon: '✅', label: 'Aprovei',  color: '#065F46', bg: '#D1FAE5' },
  pendente:  { icon: '⏳', label: 'Pendente', color: '#92400E', bg: '#FEF3C7' },
  reprovado: { icon: '❌', label: 'Reprovei', color: '#991B1B', bg: '#FEE2E2' },
}

type DateRow = {
  data: string
  finalizado: boolean
  finalizado_em: string | null
  finalizador?: { nome: string } | null
}

type Trainee = { id: string; nome: string }

type ApiData = {
  activeDate: string | null
  activeDateRow: DateRow | null
  records: Registro[]
  historyDates: DateRow[]
  trainees: Trainee[]
  currentUserId: string
  currentPapel: string
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pendente',
  red: 'Erro',
  yellow: 'A discutir',
  green: 'Aprovado',
  erro_corrigido: 'Erro corrigido',
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatDateLong(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function rowBg(status: Status) {
  if (status === 'red') return '#FEF2F2'
  if (status === 'yellow') return '#FFFBEB'
  if (status === 'erro_corrigido') return '#FFF7ED'
  return 'transparent'
}

function rowBorderLeft(status: Status) {
  if (status === 'red') return '3px solid #DC2626'
  if (status === 'yellow') return '3px solid #D97706'
  return '3px solid transparent'
}

// Quando colaborador é um número puro (ex: "15"), representa N documentos de uma vez
function docWeight(rec: Registro): number {
  const col = rec.colaborador?.trim()
  if (!col) return 1
  const n = parseInt(col, 10)
  return !isNaN(n) && String(n) === col && n > 0 ? n : 1
}

function sumWeight(recs: Registro[]): number {
  return recs.reduce((s, r) => s + docWeight(r), 0)
}

type EmpresaGroup = { key: string; nome: string; records: Registro[] }

// Agrupa registros consecutivos por empresa (case/trim-insensitive), escopado por
// pessoa (trainee/currentUser ou trainee selecionado pelo revisor), preservando a
// ordem de primeira aparição.
function groupByEmpresa(recs: Registro[], scopeId: string): EmpresaGroup[] {
  const map = new Map<string, EmpresaGroup>()
  const order: string[] = []
  for (const r of recs) {
    const norm = (r.empresa || '').trim().toLowerCase()
    const key = `${scopeId}::${norm}`
    if (!map.has(key)) { map.set(key, { key, nome: r.empresa, records: [] }); order.push(key) }
    map.get(key)!.records.push(r)
  }
  return order.map(k => map.get(k)!)
}

export default function RevisoesTraineeClient() {
  const { profile, loading: profileLoading } = useUser()

  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [activeTraineeId, setActiveTraineeId] = useState<string>('')
  const activeTraineeIdRef = useRef('')

  // Add record form (trainee)
  const [newEmpresa, setNewEmpresa] = useState('')
  const [newColaborador, setNewColaborador] = useState('')
  const [newDocumento, setNewDocumento] = useState('')
  const [newObservacoes, setNewObservacoes] = useState('')
  const [newAutoAval, setNewAutoAval] = useState<AutoAval>(null)
  const [addingRow, setAddingRow] = useState(false)
  const [addError, setAddError] = useState('')

  // Sort (revisor view)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Finalizar com pendentes — escolha por trainee
  const [groupActions, setGroupActions] = useState<Record<string, 'transfer' | 'history'>>({})

  // Inline edit (trainee)
  const [editCell, setEditCell] = useState<{ id: string; field: string } | null>(null)
  const [editVal, setEditVal] = useState('')
  const editRef = useRef<HTMLInputElement>(null)

  // Gavetas por empresa (expandir/recolher quando há 2+ documentos)
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<string>>(new Set())
  function toggleEmpresaGroup(key: string) {
    setExpandedEmpresas(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }
  const newDocumentoRef = useRef<HTMLInputElement>(null)

  // Flag modal (revisor)
  const [flagModal, setFlagModal] = useState<{ ids: string[]; status: 'red' | 'yellow'; empresa?: string } | null>(null)
  const [flagNote, setFlagNote] = useState('')
  const [flagLoading, setFlagLoading] = useState(false)

  // Finalizar modal
  const [finalizarOpen, setFinalizarOpen] = useState(false)
  const [finalizarLoading, setFinalizarLoading] = useState(false)

  // Nova data modal
  const [novaDataOpen, setNovaDataOpen] = useState(false)
  const [novaDataInput, setNovaDataInput] = useState(todayISO())
  const [novaDataLoading, setNovaDataLoading] = useState(false)
  const [novaDataError, setNovaDataError] = useState('')

  // History
  const [historyRecords, setHistoryRecords] = useState<Record<string, Registro[]>>({})

  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => { return () => { clearTimeout(toastTimerRef.current) } }, [])

  // Per-item processing (optimistic updates + Realtime dedup)
  const processingIds = useRef<Set<string>>(new Set())
  const pendingOptimistic = useRef<Map<string, Partial<Registro>>>(new Map())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  // Ref kept in sync with data.records so the Realtime handler can compare
  // local state without stale closures (never triggers re-renders).
  const recordsRef = useRef<Registro[]>([])

  function startProcessing(id: string) {
    processingIds.current.add(id)
    setLoadingIds(prev => new Set([...prev, id]))
  }
  function endProcessing(id: string) {
    processingIds.current.delete(id)
    pendingOptimistic.current.delete(id)
    setLoadingIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }
  function revertOptimistic(id: string, prevPatch: Partial<Registro>) {
    endProcessing(id)
    setData(prev => prev ? { ...prev, records: prev.records.map(r => r.id === id ? { ...r, ...prevPatch } : r) } : prev)
  }

  // Empresa copy feedback
  const [copiedEmpresaId, setCopiedEmpresaId] = useState<string | null>(null)
  const copiedEmpresaTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => { return () => { clearTimeout(copiedEmpresaTimer.current) } }, [])

  // Documento copy feedback
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null)
  const copiedDocTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => { return () => { clearTimeout(copiedDocTimer.current) } }, [])

  // Banco de documentos
  const [docBanco, setDocBanco] = useState<{ id: string; nome: string }[]>([])
  const [showDocSugg, setShowDocSugg] = useState(false)
  const [docBancoOpen, setDocBancoOpen] = useState(false)
  const [newDocBancoInput, setNewDocBancoInput] = useState('')
  const [addingDocBanco, setAddingDocBanco] = useState(false)

  // Relatório
  type ReportFilters = { startDate: string; endDate: string; traineeId: string; status: '' | Status }
  const [reportOpen, setReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportResult, setReportResult] = useState<Registro[] | null>(null)
  const [reportFilters, setReportFilters] = useState<ReportFilters>({ startDate: '', endDate: '', traineeId: '', status: '' })

  const isTrainee = profile?.papel === 'trainee'
  activeTraineeIdRef.current = activeTraineeId

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastTimerRef.current!)
    toastTimerRef.current = setTimeout(() => setToast(''), 3000)
  }

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/revisoes')
    if (!res.ok) { setFetchError('Erro ao carregar dados'); setLoading(false); return }
    const json: ApiData = await res.json()
    if (!activeTraineeIdRef.current && json.trainees.length > 0) {
      setActiveTraineeId(json.trainees[0].id)
    }
    // Re-apply any in-flight optimistic updates so they aren't overwritten by the re-fetch
    if (pendingOptimistic.current.size > 0) {
      json.records = json.records.map(r => {
        const patch = pendingOptimistic.current.get(r.id)
        return patch ? { ...r, ...patch } : r
      })
    }
    recordsRef.current = json.records
    setData(json)
    setLoading(false)
    setFetchError('')
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  async function handleAddDocBanco() {
    const nome = newDocBancoInput.trim()
    if (!nome) return
    setAddingDocBanco(true)
    try {
      const res = await fetch('/api/revisoes/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        showToast(err.error ?? 'Erro ao adicionar documento')
        return
      }
      const novo = await res.json() as { id: string; nome: string }
      setDocBanco(prev => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setNewDocBancoInput('')
    } finally {
      setAddingDocBanco(false)
    }
  }

  async function handleDeleteDocBanco(id: string) {
    const res = await fetch(`/api/revisoes/documentos?id=${id}`, { method: 'DELETE' })
    if (res.ok) setDocBanco(prev => prev.filter(d => d.id !== id))
  }

  useEffect(() => {
    if (!profileLoading) fetchData()
  }, [profileLoading, fetchData])

  const fetchDocBanco = useCallback(async () => {
    const res = await fetch('/api/revisoes/documentos')
    if (res.ok) setDocBanco(await res.json())
  }, [])
  useEffect(() => { fetchDocBanco() }, [fetchDocBanco])

  useEffect(() => {
    if (editCell && editRef.current) editRef.current.focus()
  }, [editCell])

  // Realtime — atualiza automaticamente em INSERT/UPDATE sem precisar do botão Atualizar
  useEffect(() => {
    const supabase = createClient()
    // Unique name per effect invocation avoids Strict Mode double-mount collision
    // (removeChannel is async, so reusing the same name on the second run would
    //  find the still-subscribed channel and throw when .on() is called)
    const channel = supabase
      .channel(`revisoes-trainee-rt-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'revisoes_trainee' }, () => void fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'revisoes_trainee' }, (payload) => {
        const id = (payload.new as { id?: string }).id
        const newStatus = (payload.new as { status?: string }).status
        if (!id) return
        // ID is being processed locally — optimistic update is authoritative
        if (processingIds.current.has(id)) return
        // Local state already reflects this status — skip re-fetch to avoid flicker
        const local = recordsRef.current.find(r => r.id === id)
        if (local?.status === newStatus) return
        void fetchData()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData])

  const activeDate = data?.activeDate ?? null
  const isFinalized = data?.activeDateRow?.finalizado ?? false
  const records = data?.records ?? []

  const visibleRecords = isTrainee
    ? records.filter(r => r.criado_por === data?.currentUserId)
    : activeTraineeId
      ? records.filter(r => r.criado_por === activeTraineeId)
      : []

  const activeRecords = visibleRecords.filter(r => r.status !== 'green' && r.status !== 'erro_corrigido')
  const pendingCount = sumWeight(visibleRecords.filter(r => r.status === 'pending'))
  const redCount = sumWeight(visibleRecords.filter(r => r.status === 'red'))
  const yellowCount = sumWeight(visibleRecords.filter(r => r.status === 'yellow'))
  const greenCount = sumWeight(visibleRecords.filter(r => r.status === 'green'))
  const erroCorrigidoCount = sumWeight(visibleRecords.filter(r => r.status === 'erro_corrigido'))
  const totalCount = sumWeight(visibleRecords)

  const sortedRecords = useMemo(() => {
    const arr = [...activeRecords]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortKey === 'created_at') {
        av = new Date(a.created_at).getTime()
        bv = new Date(b.created_at).getTime()
      } else {
        av = (a[sortKey] ?? '') as string
        bv = (b[sortKey] ?? '') as string
      }
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return arr
  }, [activeRecords, sortKey, sortDir])

  const viewedPersonId = isTrainee ? (data?.currentUserId ?? '') : activeTraineeId

  const traineeGroups = useMemo(
    () => groupByEmpresa(isTrainee ? activeRecords : [], viewedPersonId),
    [isTrainee, activeRecords, viewedPersonId]
  )
  const revisorGroups = useMemo(
    () => groupByEmpresa(!isTrainee ? sortedRecords : [], viewedPersonId),
    [isTrainee, sortedRecords, viewedPersonId]
  )

  const docSuggestions = newDocumento.trim()
    ? docBanco.filter(d => d.nome.toLowerCase().includes(newDocumento.toLowerCase()))
    : docBanco


  const pendingByTrainee = useMemo(() => {
    const map: Record<string, { nome: string; count: number }> = {}
    records.filter(r => r.status === 'pending').forEach(r => {
      const key = r.criado_por
      if (!map[key]) map[key] = { nome: r.criado_por_profile?.nome ?? key.slice(0, 8), count: 0 }
      map[key].count += docWeight(r)
    })
    return map
  }, [records])

  if (profileLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6B7A99', fontSize: 14 }}>
        Carregando...
      </div>
    )
  }

  if (fetchError) {
    return <div style={{ padding: 32, color: '#DC2626', fontSize: 14 }}>{fetchError}</div>
  }

  if (!data) return null

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  // ── Add record ─────────────────────────────────────────────────
  async function handleAddRow(autoAval: NonNullable<AutoAval>) {
    if (!newEmpresa.trim() || !newDocumento.trim()) {
      setAddError('Preencha Empresa e Documento antes de salvar.')
      return
    }
    if (!activeDate) return
    setAddError('')
    setAddingRow(true)

    const res = await fetch('/api/revisoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data_dia: activeDate,
        empresa: newEmpresa,
        colaborador: newColaborador,
        documento: newDocumento,
        observacoes: newObservacoes,
        auto_avaliacao: autoAval,
      }),
    })

    if (res.ok) {
      // Empresa é mantida propositalmente: permite adicionar vários documentos
      // seguidos para a mesma empresa sem precisar redigitar o nome.
      setNewColaborador(''); setNewDocumento('')
      setNewObservacoes(''); setNewAutoAval(null)
      await fetchData()
    } else {
      const d = await res.json().catch(() => ({}))
      setAddError(d.error ?? 'Erro ao salvar registro. Tente novamente.')
    }
    setAddingRow(false)
  }

  // ── Inline edit ────────────────────────────────────────────────
  function startEdit(id: string, field: string, value: string) {
    setEditCell({ id, field })
    setEditVal(value)
  }

  async function commitEdit() {
    if (!editCell) return
    const rec = records.find(r => r.id === editCell.id)
    if (!rec || rec[editCell.field as keyof Registro] === editVal) { setEditCell(null); return }
    const res = await fetch(`/api/revisoes/${editCell.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [editCell.field]: editVal }),
    })
    if (res.ok) await fetchData()
    setEditCell(null)
  }

  // ── Delete record ──────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return
    await fetch(`/api/revisoes/${id}`, { method: 'DELETE' })
    await fetchData()
  }

  // ── Optimistic status helper ────────────────────────────────────
  function applyOptimisticStatus(id: string, patch: Partial<Registro>) {
    pendingOptimistic.current.set(id, patch)
    setData(prev => {
      if (!prev) return prev
      const newRecords = prev.records.map(r => r.id === id ? { ...r, ...patch } : r)
      recordsRef.current = newRecords
      return { ...prev, records: newRecords }
    })
  }

  // ── Approve ────────────────────────────────────────────────────
  async function handleApprove(id: string) {
    if (processingIds.current.has(id)) return
    const prev = data!.records.find(r => r.id === id)
    startProcessing(id)
    applyOptimisticStatus(id, { status: 'green', nota_revisor: null })
    const res = await fetch(`/api/revisoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'green', nota_revisor: null }),
    })
    if (res.ok) {
      endProcessing(id)
    } else {
      if (prev) revertOptimistic(id, { status: prev.status, nota_revisor: prev.nota_revisor })
      else endProcessing(id)
      showToast('Erro ao aprovar. Tente novamente.')
    }
  }

  // ── Clear flag ─────────────────────────────────────────────────
  async function handleClear(id: string) {
    if (processingIds.current.has(id)) return
    const prev = data!.records.find(r => r.id === id)
    startProcessing(id)
    applyOptimisticStatus(id, { status: 'pending', nota_revisor: null })
    const res = await fetch(`/api/revisoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', nota_revisor: null }),
    })
    if (res.ok) {
      endProcessing(id)
    } else {
      if (prev) revertOptimistic(id, { status: prev.status, nota_revisor: prev.nota_revisor })
      else endProcessing(id)
      showToast('Erro ao limpar flag. Tente novamente.')
    }
  }

  // ── Flag modal ─────────────────────────────────────────────────
  function openFlag(id: string, status: 'red' | 'yellow') {
    const rec = records.find(r => r.id === id)
    setFlagModal({ ids: [id], status })
    setFlagNote(rec?.nota_revisor ?? '')
  }

  // Gaveta recolhida: aplica a mesma sinalização a todos os documentos da empresa
  function openFlagGroup(group: EmpresaGroup, status: 'red' | 'yellow') {
    setFlagModal({ ids: group.records.map(r => r.id), status, empresa: group.nome })
    setFlagNote('')
  }

  function handleApproveGroup(group: EmpresaGroup) {
    group.records.forEach(r => { void handleApprove(r.id) })
  }

  async function flagOne(id: string, status: 'red' | 'yellow', nota: string) {
    if (processingIds.current.has(id)) return
    const prev = data!.records.find(r => r.id === id)
    startProcessing(id)
    applyOptimisticStatus(id, { status: status as Status, nota_revisor: nota })
    const res = await fetch(`/api/revisoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, nota_revisor: nota }),
    })
    if (res.ok) {
      endProcessing(id)
    } else {
      if (prev) revertOptimistic(id, { status: prev.status, nota_revisor: prev.nota_revisor })
      else endProcessing(id)
      showToast('Erro ao sinalizar. Tente novamente.')
    }
  }

  async function submitFlag() {
    if (!flagModal) return
    if (!flagNote.trim()) { alert('Descreva o motivo da sinalização.'); return }
    const { ids, status } = flagModal
    const nota = flagNote
    // Optimistic — fecha modal imediatamente
    setFlagModal(null); setFlagNote('')
    await Promise.all(ids.map(id => flagOne(id, status, nota)))
  }

  // ── Já corrigido (trainee) ─────────────────────────────────────
  async function handleJaCorrigido(id: string) {
    if (processingIds.current.has(id)) return
    const prev = data!.records.find(r => r.id === id)
    startProcessing(id)
    applyOptimisticStatus(id, { status: 'erro_corrigido', corrigido_em: new Date().toISOString() })
    const res = await fetch(`/api/revisoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'erro_corrigido' }),
    })
    if (res.ok) {
      endProcessing(id)
      showToast('Correção registrada.')
    } else {
      if (prev) revertOptimistic(id, { status: prev.status })
      else endProcessing(id)
      showToast('Erro ao registrar correção. Tente novamente.')
    }
  }

  // ── Cycle auto_avaliacao no row do trainee ─────────────────────
  async function cycleAutoAval(rec: Registro) {
    const order: AutoAval[] = [null, 'aprovado', 'pendente', 'reprovado']
    const idx = order.indexOf(rec.auto_avaliacao)
    const next = order[(idx + 1) % order.length]
    await fetch(`/api/revisoes/${rec.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_avaliacao: next }),
    })
    await fetchData()
  }

  // ── Finalizar ──────────────────────────────────────────────────
  function openFinalizar() {
    const pending = records.filter(r => r.status === 'pending')
    const initial: Record<string, 'transfer' | 'history'> = {}
    pending.forEach(r => { if (!initial[r.criado_por]) initial[r.criado_por] = 'transfer' })
    setGroupActions(initial)
    setFinalizarOpen(true)
  }

  async function handleFinalizar() {
    if (!activeDate) return
    setFinalizarLoading(true)

    // Executa transferências escolhidas antes de finalizar
    const transfers = Object.entries(groupActions)
      .filter(([, action]) => action === 'transfer')
      .map(([criado_por]) =>
        fetch('/api/revisoes/transferir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criado_por, from_data_dia: activeDate }),
        })
      )
    if (transfers.length > 0) await Promise.all(transfers)

    const res = await fetch('/api/revisoes/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_dia: activeDate }),
    })
    if (res.ok) showToast('Dia finalizado com sucesso!')
    setFinalizarOpen(false)
    setFinalizarLoading(false)
    await fetchData()
  }

  // ── Nova data ──────────────────────────────────────────────────
  async function handleNovaData() {
    setNovaDataLoading(true); setNovaDataError('')
    const res = await fetch('/api/revisoes/datas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_dia: novaDataInput }),
    })
    if (res.ok) {
      setNovaDataOpen(false); setNovaDataInput(todayISO())
      await fetchData()
    } else {
      const d = await res.json()
      setNovaDataError(d.error ?? 'Erro ao criar data')
    }
    setNovaDataLoading(false)
  }

  // ── CSV export ─────────────────────────────────────────────────
  function exportCSV() {
    const rows = [['Data', 'Trainee', 'Empresa', 'Colaborador', 'Documento', 'Observações', 'Auto-aval', 'Status', 'Nota revisor', 'Revisor', 'Hora revisão']]
    records.forEach(r => {
      rows.push([
        r.data_dia, r.criado_por_profile?.nome ?? '', r.empresa, r.colaborador ?? '', r.documento,
        r.observacoes ?? '', r.auto_avaliacao ?? '',
        STATUS_LABEL[r.status], r.nota_revisor ?? '',
        r.revisado_por_profile?.nome ?? '', r.revisado_em ? formatTime(r.revisado_em) : '',
      ])
    })
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `gt3_revisoes_${activeDate ?? 'historico'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Relatório ──────────────────────────────────────────────────
  // Busca + filtra os registros do histórico conforme os filtros do relatório
  async function computeReportRecs(): Promise<Registro[]> {
    const allDates = data?.historyDates ?? []
    const filteredDates = allDates.filter(hd => {
      if (reportFilters.startDate && hd.data < reportFilters.startDate) return false
      if (reportFilters.endDate && hd.data > reportFilters.endDate) return false
      return true
    })
    const combined: Record<string, Registro[]> = { ...historyRecords }
    const toFetch = filteredDates.filter(hd => !combined[hd.data])
    await Promise.all(toFetch.map(async hd => {
      const res = await fetch(`/api/revisoes?date=${hd.data}`)
      if (res.ok) combined[hd.data] = await res.json()
    }))
    if (toFetch.length > 0) setHistoryRecords(combined)
    let recs = filteredDates.flatMap(hd => combined[hd.data] ?? [])
    if (reportFilters.traineeId) recs = recs.filter(r => r.criado_por === reportFilters.traineeId)
    if (reportFilters.status) recs = recs.filter(r => r.status === reportFilters.status)
    return recs
  }

  async function generateReport() {
    setReportLoading(true)
    const recs = await computeReportRecs()
    setReportResult(recs)
    setReportLoading(false)
  }

  // Gera direto o ranking de documentos mais avaliados (sem precisar montar a tabela antes)
  async function generateDocsRanking() {
    setReportLoading(true)
    const recs = await computeReportRecs()
    setReportResult(recs)
    setReportLoading(false)
    printDocsRanking(recs)
  }

  function exportReportCSV() {
    if (!reportResult) return
    const rows = [['Data', 'Trainee', 'Empresa', 'Colaborador', 'Documento', 'Observações', 'Auto-aval', 'Status', 'Nota revisor', 'Revisor']]
    reportResult.forEach(r => rows.push([
      r.data_dia, r.criado_por_profile?.nome ?? '', r.empresa, r.colaborador ?? '', r.documento,
      r.observacoes ?? '', r.auto_avaliacao ?? '', STATUS_LABEL[r.status], r.nota_revisor ?? '',
      r.revisado_por_profile?.nome ?? '',
    ]))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `gt3_relatorio_${reportFilters.startDate || 'completo'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function printReport() {
    if (!reportResult) return
    const win = window.open('', '_blank')
    if (!win) return
    const STATUS_COLOR: Record<Status, string> = { green: '#D1FAE5', red: '#FEE2E2', yellow: '#FEF3C7', pending: '#F1F5F9', erro_corrigido: '#FFF7ED' }
    const STATUS_TEXT: Record<Status, string> = { green: '#065F46', red: '#991B1B', yellow: '#92400E', pending: '#6B7A99', erro_corrigido: '#C2410C' }
    const rows = reportResult.map(r => `<tr style="border-bottom:1px solid #eee;background:${STATUS_COLOR[r.status]}">
      <td style="padding:5px 8px;font-size:11px;">${r.data_dia}</td>
      <td style="padding:5px 8px;font-size:11px;">${r.criado_por_profile?.nome ?? '—'}</td>
      <td style="padding:5px 8px;font-size:11px;">${r.empresa}</td>
      <td style="padding:5px 8px;font-size:11px;">${r.colaborador ?? '—'}</td>
      <td style="padding:5px 8px;font-size:11px;">${r.documento}</td>
      <td style="padding:5px 8px;font-size:11px;color:${STATUS_TEXT[r.status]};font-weight:600;">${STATUS_LABEL[r.status]}</td>
      <td style="padding:5px 8px;font-size:11px;">${r.revisado_por_profile?.nome ?? '—'}</td>
    </tr>`).join('')
    const totals = (reportResult ?? []).reduce((acc, r) => { const w = docWeight(r); acc[r.status] = (acc[r.status] ?? 0) + w; return acc }, {} as Record<string, number>)
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório GT3</title>
    <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}
    th{background:#f0f4fa;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
    .totals{display:flex;gap:16px;margin:12px 0;font-size:13px}
    @media print{.no-print{display:none}}</style></head><body>
    <h2 style="margin:0 0 4px;font-size:18px">Relatório de Revisões Trainee</h2>
    <p style="margin:0 0 12px;font-size:12px;color:#6B7A99">${sumWeight(reportResult)} documentos · gerado em ${new Date().toLocaleString('pt-BR')}</p>
    <div class="totals">
      <span>✅ Aprovados: <b>${totals.green ?? 0}</b></span>
      <span>❌ Erros: <b>${totals.red ?? 0}</b></span>
      <span>⚠️ A discutir: <b>${totals.yellow ?? 0}</b></span>
      <span>🔧 Corrigidos: <b>${totals.erro_corrigido ?? 0}</b></span>
      <span>⏳ Pendentes: <b>${totals.pending ?? 0}</b></span>
    </div>
    <button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;background:#2A4F96;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
    <table><thead><tr>
      <th>Data</th><th>Trainee</th><th>Empresa</th><th>Colaborador</th><th>Documento</th><th>Status</th><th>Revisor</th>
    </tr></thead><tbody>${rows}</tbody></table></body></html>`)
    win.document.close()
  }

  // Relatório agregado: documentos mais avaliados (ranking por frequência)
  function printDocsRanking(recsArg?: Registro[]) {
    const recs = recsArg ?? reportResult
    if (!recs) return
    const win = window.open('', '_blank')
    if (!win) return
    type Agg = { total: number; green: number; red: number; yellow: number; erro_corrigido: number; pending: number }
    const map = new Map<string, Agg>()
    for (const r of recs) {
      const doc = r.documento?.trim() || '—'
      const a = map.get(doc) ?? { total: 0, green: 0, red: 0, yellow: 0, erro_corrigido: 0, pending: 0 }
      const w = docWeight(r)
      a.total += w
      a[r.status] += w
      map.set(doc, a)
    }
    const ranked = [...map.entries()].sort((x, y) => y[1].total - x[1].total)
    const totalDocs = sumWeight(recs)
    const maxTotal = ranked[0]?.[1].total ?? 1
    const rows = ranked.map(([doc, a], i) => {
      const pct = totalDocs > 0 ? Math.round((a.total / totalDocs) * 100) : 0
      const barPct = Math.round((a.total / maxTotal) * 100)
      return `<tr style="border-bottom:1px solid #eee">
        <td style="padding:5px 8px;font-size:11px;text-align:center;color:#6B7A99">${i + 1}</td>
        <td style="padding:5px 8px;font-size:11px;font-weight:600">${doc}</td>
        <td style="padding:5px 8px;min-width:120px"><div style="background:#2A4F96;height:11px;border-radius:3px;width:${barPct}%"></div></td>
        <td style="padding:5px 8px;font-size:12px;text-align:center;font-weight:700">${a.total}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:center;color:#6B7A99">${pct}%</td>
        <td style="padding:5px 8px;font-size:11px;text-align:center;color:#065F46">${a.green || ''}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:center;color:#991B1B">${a.red || ''}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:center;color:#92400E">${a.yellow || ''}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:center;color:#C2410C">${a.erro_corrigido || ''}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:center;color:#6B7A99">${a.pending || ''}</td>
      </tr>`
    }).join('')
    const periodo = (reportFilters.startDate || reportFilters.endDate)
      ? `${reportFilters.startDate ? formatDate(reportFilters.startDate) : 'início'} a ${reportFilters.endDate ? formatDate(reportFilters.endDate) : 'hoje'}`
      : 'todo o período'
    const traineeNome = reportFilters.traineeId
      ? (data?.trainees.find(t => t.id === reportFilters.traineeId)?.nome ?? '')
      : ''
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Docs mais avaliados — GT3</title>
    <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}
    th{background:#f0f4fa;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#475569}
    @media print{.no-print{display:none}}</style></head><body>
    <h2 style="margin:0 0 4px;font-size:18px">Documentos mais avaliados — Revisões Trainee</h2>
    <p style="margin:0 0 12px;font-size:12px;color:#6B7A99">
      ${ranked.length} documento(s) distintos · ${totalDocs} avaliações · período: ${periodo}${traineeNome ? ` · trainee: ${traineeNome}` : ''} · gerado em ${new Date().toLocaleString('pt-BR')}
    </p>
    <button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;background:#2A4F96;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
    <table><thead><tr>
      <th style="text-align:center">#</th><th>Documento</th><th>Frequência</th><th style="text-align:center">Total</th><th style="text-align:center">%</th>
      <th style="text-align:center">✅</th><th style="text-align:center">❌</th><th style="text-align:center">⚠️</th><th style="text-align:center">🔧</th><th style="text-align:center">⏳</th>
    </tr></thead><tbody>${rows}</tbody></table></body></html>`)
    win.document.close()
  }

  // ── Cell renderer ──────────────────────────────────────────────
  function renderCell(rec: Registro, field: 'empresa' | 'colaborador' | 'documento') {
    // documento e empresa nunca abrem edição inline — são sempre copy-on-click
    // (empresa agora é definida uma vez e reaproveitada nas gavetas por empresa)
    const canEdit = isTrainee && rec.criado_por === data!.currentUserId && !!activeDate && !isFinalized && field !== 'documento' && field !== 'empresa'
    const isEditing = editCell?.id === rec.id && editCell.field === field
    const isCopiedEmpresa = field === 'empresa' && !canEdit && copiedEmpresaId === rec.id
    const isCopiedDoc = field === 'documento' && copiedDocId === rec.id
    const isCopied = isCopiedEmpresa || isCopiedDoc
    const isCopyable = (field === 'empresa' && !canEdit) || field === 'documento'

    if (canEdit && isEditing) {
      return (
        <input
          ref={editRef}
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit() } if (e.key === 'Escape') setEditCell(null) }}
          style={{ width: '100%', border: 'none', borderBottom: '2px solid #2A4F96', outline: 'none', fontSize: 13, padding: '2px 0', background: 'transparent', color: '#1E293B' }}
        />
      )
    }

    function handleClick() {
      if (canEdit) { startEdit(rec.id, field, rec[field] ?? ''); return }
      if (field === 'empresa' && rec.empresa) {
        navigator.clipboard.writeText(rec.empresa).catch(() => {})
        setCopiedEmpresaId(rec.id)
        clearTimeout(copiedEmpresaTimer.current)
        copiedEmpresaTimer.current = setTimeout(() => setCopiedEmpresaId(null), 1000)
      }
      if (field === 'documento' && rec.documento) {
        navigator.clipboard.writeText(rec.documento).catch(() => {})
        setCopiedDocId(rec.id)
        clearTimeout(copiedDocTimer.current)
        copiedDocTimer.current = setTimeout(() => setCopiedDocId(null), 1000)
      }
    }

    const rawVal = rec[field]
    const isMultiplier = field === 'colaborador' && !!rawVal && /^\d+$/.test(rawVal.trim()) && parseInt(rawVal) > 1

    return (
      <span
        onClick={handleClick}
        title={isCopyable ? 'Clique para copiar' : undefined}
        style={{
          cursor: canEdit ? 'text' : isCopyable ? 'pointer' : 'default',
          borderBottom: canEdit ? '1px dashed #CBD5E1' : 'none',
          fontSize: 13, color: isCopied ? '#16A34A' : '#1E293B',
          display: 'block', minWidth: 60, minHeight: 20, padding: '2px 0',
          transition: 'color 0.15s', userSelect: isCopyable ? 'none' : 'auto',
        }}
      >
        {isCopied ? '✓ Copiado!' : isMultiplier ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 700, color: '#D97706' }}>×{rawVal}</span>
            <span style={{ fontSize: 10, color: '#94A3B8', background: '#FEF3C7', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>docs</span>
          </span>
        ) : (rawVal || <span style={{ color: '#CBD5E1' }}>—</span>)}
      </span>
    )
  }

  // ── Linha de registro (usada solta ou dentro de uma gaveta expandida) ──
  function renderRecordRow(rec: Registro, nested = false) {
    return (
      <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-soft)', backgroundColor: nested ? '#FAFBFF' : rowBg(rec.status), borderLeft: nested ? '3px solid transparent' : rowBorderLeft(rec.status), transition: 'background-color 200ms var(--ease-gt3)' }}>
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#6B7A99', fontSize: 12 }}>{formatTime(rec.created_at)}</td>
        <td style={{ padding: nested ? '10px 14px 10px 30px' : '10px 14px' }}>
          {nested ? <span style={{ color: '#CBD5E1', fontSize: 12 }}>↳</span> : renderCell(rec, 'empresa')}
        </td>
        <td style={{ padding: '10px 14px' }}>{renderCell(rec, 'colaborador')}</td>
        <td style={{ padding: '10px 14px' }}>
          {renderCell(rec, 'documento')}
          {rec.observacoes && (
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4, fontStyle: 'italic', borderLeft: '2px solid #CBD5E1', paddingLeft: 6 }}>
              obs: "{rec.observacoes}"
            </div>
          )}
          {rec.nota_revisor && (
            <div style={{ fontSize: 11, color: rec.status === 'red' ? '#9B1C1C' : '#92400E', marginTop: 4, fontStyle: 'italic', borderLeft: `2px solid ${rec.status === 'red' ? '#FCA5A5' : '#FCD34D'}`, paddingLeft: 6 }}>
              "{rec.nota_revisor}" — {rec.revisado_por_profile?.nome ?? '—'}
            </div>
          )}
        </td>
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          {isTrainee && rec.criado_por === data!.currentUserId && !isFinalized ? (
            <button
              onClick={() => cycleAutoAval(rec)}
              style={{ padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer', backgroundColor: rec.auto_avaliacao ? AUTO_AVAL_META[rec.auto_avaliacao].bg : '#F1F5F9', color: rec.auto_avaliacao ? AUTO_AVAL_META[rec.auto_avaliacao].color : '#94A3B8' }}
              title="Clique para alterar"
            >
              {rec.auto_avaliacao ? `${AUTO_AVAL_META[rec.auto_avaliacao].icon} ${AUTO_AVAL_META[rec.auto_avaliacao].label}` : '—'}
            </button>
          ) : rec.auto_avaliacao ? (
            <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 500, backgroundColor: AUTO_AVAL_META[rec.auto_avaliacao].bg, color: AUTO_AVAL_META[rec.auto_avaliacao].color }}>
              {AUTO_AVAL_META[rec.auto_avaliacao].icon} {AUTO_AVAL_META[rec.auto_avaliacao].label}
            </span>
          ) : (
            <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>
          )}
        </td>
        {!isTrainee && (
          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 4, backgroundColor: rec.status === 'green' ? '#D1FAE5' : rec.status === 'red' ? '#FEE2E2' : rec.status === 'yellow' ? '#FEF3C7' : rec.status === 'erro_corrigido' ? '#FFF7ED' : '#F1F5F9', color: rec.status === 'green' ? '#065F46' : rec.status === 'red' ? '#991B1B' : rec.status === 'yellow' ? '#92400E' : rec.status === 'erro_corrigido' ? '#C2410C' : '#6B7A99' }}>
              {rec.status === 'erro_corrigido' ? '⚠️ Erro corrigido' : STATUS_LABEL[rec.status]}
            </span>
          </td>
        )}
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          {isTrainee ? (
            rec.criado_por === data!.currentUserId && !isFinalized && (
              (rec.status === 'red' || rec.status === 'yellow') ? (
                <button
                  onClick={() => handleJaCorrigido(rec.id)}
                  disabled={loadingIds.has(rec.id)}
                  style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #C2410C', background: '#FFF7ED', color: '#C2410C', fontSize: 11, fontWeight: 600, cursor: loadingIds.has(rec.id) ? 'wait' : 'pointer', opacity: loadingIds.has(rec.id) ? 0.6 : 1 }}
                >
                  {loadingIds.has(rec.id) ? '…' : '✅ Já corrigido'}
                </button>
              ) : (
                <button onClick={() => handleDelete(rec.id)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 12, padding: '3px 6px', borderRadius: 4 }} onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')} onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}>
                  excluir
                </button>
              )
            )
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => handleApprove(rec.id)}
                disabled={loadingIds.has(rec.id)}
                style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid transparent', background: 'transparent', color: '#16A34A', fontSize: 11, fontWeight: 500, cursor: loadingIds.has(rec.id) ? 'wait' : 'pointer', opacity: loadingIds.has(rec.id) ? 0.5 : 1 }}
                onMouseEnter={e => { if (!loadingIds.has(rec.id)) { e.currentTarget.style.background = '#F0FFF4'; e.currentTarget.style.borderColor = '#16A34A' } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
              >
                ✓ Aprovar
              </button>
              <button
                onClick={() => openFlag(rec.id, 'yellow')}
                disabled={loadingIds.has(rec.id)}
                style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid transparent', background: 'transparent', color: '#D97706', fontSize: 11, fontWeight: 500, cursor: loadingIds.has(rec.id) ? 'wait' : 'pointer', opacity: loadingIds.has(rec.id) ? 0.5 : 1 }}
                onMouseEnter={e => { if (!loadingIds.has(rec.id)) { e.currentTarget.style.background = '#FFFBEB'; e.currentTarget.style.borderColor = '#D97706' } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
              >
                ! Discutir
              </button>
              <button
                onClick={() => openFlag(rec.id, 'red')}
                disabled={loadingIds.has(rec.id)}
                style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid transparent', background: 'transparent', color: '#DC2626', fontSize: 11, fontWeight: 500, cursor: loadingIds.has(rec.id) ? 'wait' : 'pointer', opacity: loadingIds.has(rec.id) ? 0.5 : 1 }}
                onMouseEnter={e => { if (!loadingIds.has(rec.id)) { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#DC2626' } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
              >
                ✕ Erro
              </button>
              {rec.status !== 'pending' && (
                <button
                  onClick={() => handleClear(rec.id)}
                  disabled={loadingIds.has(rec.id)}
                  style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: 'transparent', color: '#94A3B8', fontSize: 11, cursor: loadingIds.has(rec.id) ? 'wait' : 'pointer', opacity: loadingIds.has(rec.id) ? 0.5 : 1 }}
                  onMouseEnter={e => { if (!loadingIds.has(rec.id)) { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#F1F5F9' } }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent' }}
                >
                  limpar
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
    )
  }

  // ── Cabeçalho de gaveta (empresa com 2+ documentos) ─────────────
  function renderGroupHeaderRow(group: EmpresaGroup) {
    const isExpanded = expandedEmpresas.has(group.key)
    const totalDocs = group.records.length
    const groupCopyId = `grp-${group.key}`
    const avalCounts: Partial<Record<NonNullable<AutoAval>, number>> = {}
    group.records.forEach(r => { if (r.auto_avaliacao) avalCounts[r.auto_avaliacao] = (avalCounts[r.auto_avaliacao] ?? 0) + 1 })
    const statusCounts: Partial<Record<Status, number>> = {}
    group.records.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1 })
    const STATUS_DOT: Record<Status, string> = { green: '#16A34A', red: '#DC2626', yellow: '#D97706', pending: '#94A3B8', erro_corrigido: '#C2410C' }
    const docNames = group.records.map(r => r.documento).filter(Boolean)

    function copyEmpresa(e: React.MouseEvent) {
      e.stopPropagation()
      navigator.clipboard.writeText(group.nome).catch(() => {})
      setCopiedEmpresaId(groupCopyId)
      clearTimeout(copiedEmpresaTimer.current)
      copiedEmpresaTimer.current = setTimeout(() => setCopiedEmpresaId(null), 1000)
    }

    return (
      <tr
        key={group.key}
        onClick={() => toggleEmpresaGroup(group.key)}
        title="Clique para expandir/recolher os documentos desta empresa"
        style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-soft)', backgroundColor: isExpanded ? '#EEF3FF' : '#FAFBFF', borderLeft: '3px solid #D1AE6E', transition: 'background-color 150ms var(--ease-gt3)' }}
      >
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-block', fontSize: 10, color: '#94A3B8', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>▶</span>
        </td>
        <td style={{ padding: '10px 14px' }}>
          <span
            onClick={copyEmpresa}
            title="Clique para copiar"
            style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: copiedEmpresaId === groupCopyId ? '#16A34A' : '#1E293B' }}
          >
            {copiedEmpresaId === groupCopyId ? '✓ Copiado!' : group.nome}
          </span>
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 10, padding: '2px 8px' }}>
            ×{totalDocs} docs
          </span>
        </td>
        <td style={{ padding: '10px 14px', fontSize: 12, color: '#CBD5E1' }}>—</td>
        <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7A99' }}>
          {isExpanded ? (
            <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>clique para recolher</span>
          ) : (
            <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{docNames.join(', ')}</span>
          )}
        </td>
        <td style={{ padding: '10px 14px' }}>
          {Object.keys(avalCounts).length === 0 ? <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span> : (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(Object.keys(avalCounts) as NonNullable<AutoAval>[]).map(k => (
                <span key={k} style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: AUTO_AVAL_META[k].bg, color: AUTO_AVAL_META[k].color }}>
                  {AUTO_AVAL_META[k].icon} {avalCounts[k]}
                </span>
              ))}
            </div>
          )}
        </td>
        {!isTrainee && (
          <td style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(statusCounts) as Status[]).map(s => (
                <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#475569' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_DOT[s], display: 'inline-block' }} />
                  {statusCounts[s]}
                </span>
              ))}
            </div>
          </td>
        )}
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          {!isTrainee && !isExpanded ? (
            // Revisor com a gaveta recolhida: define todos os documentos de uma vez.
            // Expandida, volta a ser item a item.
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              {([
                { lbl: '✓ Aprovar tudo', color: '#16A34A', hover: '#F0FFF4', onClick: () => handleApproveGroup(group) },
                { lbl: '! Discutir tudo', color: '#D97706', hover: '#FFFBEB', onClick: () => openFlagGroup(group, 'yellow') },
                { lbl: '✕ Erro em tudo', color: '#DC2626', hover: '#FEF2F2', onClick: () => openFlagGroup(group, 'red') },
              ]).map(b => {
                const busy = group.records.some(r => loadingIds.has(r.id))
                return (
                  <button
                    key={b.lbl}
                    onClick={b.onClick}
                    disabled={busy}
                    style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${b.color}33`, background: '#fff', color: b.color, fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1 }}
                    onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = b.hover; e.currentTarget.style.borderColor = b.color } }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = `${b.color}33` }}
                  >
                    {b.lbl}
                  </button>
                )
              })}
              <span onClick={() => toggleEmpresaGroup(group.key)} style={{ fontSize: 11, color: '#5B8DEF', fontWeight: 600, cursor: 'pointer', marginLeft: 4 }}>▸ expandir</span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: '#5B8DEF', fontWeight: 600 }}>{isExpanded ? '▾ recolher' : '▸ expandir'}</span>
          )}
        </td>
      </tr>
    )
  }

  // ── Botão "+ adicionar documento" dentro de uma gaveta expandida (trainee) ──
  function renderAddMoreRow(group: EmpresaGroup) {
    const colSpan = isTrainee ? 6 : 7
    return (
      <tr key={`add-${group.key}`} style={{ backgroundColor: '#FAFBFF', borderBottom: '1px solid var(--border-soft)' }}>
        <td colSpan={colSpan} style={{ padding: '6px 14px 10px 30px' }}>
          <button
            onClick={() => {
              setNewEmpresa(group.nome)
              setTimeout(() => newDocumentoRef.current?.focus(), 0)
              newDocumentoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            style={{ background: 'none', border: '1px dashed #C7D7F0', color: '#2A4F96', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}
          >
            + Adicionar outro documento para {group.nome}
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1100, backgroundColor: '#1E3A6E', color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Revisões Trainee</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7A99' }}>
            {activeDate ? formatDateLong(activeDate) : 'Nenhuma data ativa'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isTrainee && (
            <div style={{ display: 'flex', gap: 8 }}>
              {activeDate && !isFinalized && (
                <button onClick={openFinalizar} style={{ padding: '8px 16px', backgroundColor: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Finalizar dia
                </button>
              )}
              {!activeDate && (
                <button onClick={() => { setNovaDataOpen(true); setNovaDataInput(todayISO()); setNovaDataError('') }} style={{ padding: '8px 16px', backgroundColor: '#2A4F96', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + Nova data
                </button>
              )}
              {activeDate && (
                <button onClick={exportCSV} style={{ padding: '8px 16px', backgroundColor: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Exportar CSV
                </button>
              )}
              {data.historyDates.length > 0 && (
                <button onClick={() => { setReportOpen(true); setReportResult(null) }} title="Histórico e relatórios dos dias finalizados" style={{ padding: '8px 16px', backgroundColor: '#fff', color: '#2A4F96', border: '1px solid #2A4F96', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  📊 Histórico / Relatório
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => setDocBancoOpen(true)}
            title="Banco de Documentos"
            style={{ padding: '6px 12px', background: 'transparent', color: '#5B8DEF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            📋 Docs
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Atualizar (atualização automática ativa)"
            style={{ padding: '6px 10px', background: 'transparent', color: '#94A3B8', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.5 : 1, fontFamily: 'inherit' }}
          >
            <span className={refreshing ? 'animate-spin' : ''} style={{ display: 'inline-block' }}>🔄</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      {activeDate && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: totalCount, color: '#1E293B' },
            { label: 'Pendentes', value: pendingCount, color: '#6B7A99' },
            { label: 'Com erro', value: redCount, color: '#DC2626' },
            { label: 'A discutir', value: yellowCount, color: '#D97706' },
            { label: 'Aprovados', value: greenCount, color: '#16A34A' },
            ...(erroCorrigidoCount > 0 ? [{ label: 'Corrigidos', value: erroCorrigidoCount, color: '#C2410C' }] : []),
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', minWidth: 72 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* No active date */}
      {!activeDate && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '48px 32px', textAlign: 'center', color: '#6B7A99', fontSize: 14, marginBottom: 24 }}>
          {isTrainee ? 'Aguardando um revisor criar a data do dia.' : 'Nenhuma data ativa. Clique em "+ Nova data" para iniciar.'}
        </div>
      )}

      {/* Trainee tabs (revisor only) */}
      {!isTrainee && activeDate && (
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E2E8F0', overflowX: 'auto' }}>
          {data.trainees.length === 0 ? (
            <span style={{ padding: '11px 18px', fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>Nenhum trainee cadastrado</span>
          ) : data.trainees.map(t => {
            const tRecs = records.filter(r => r.criado_por === t.id)
            const tFlagged = tRecs.filter(r => r.status === 'red' || r.status === 'yellow').length
            const isActive = activeTraineeId === t.id
            return (
              <button key={t.id} onClick={() => setActiveTraineeId(t.id)}
                className={`gt3-tab${isActive ? ' gt3-tab-active' : ''}`}
                style={{ background: 'none', border: 'none', padding: '11px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', color: isActive ? '#1E293B' : '#6B7A99', borderBottom: '2px solid transparent', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 7, transition: 'color 200ms var(--ease-gt3)', ['--tab-active-color' as string]: '#2A4F96' } as React.CSSProperties}>
                {t.nome.split(' ')[0]}
                {tFlagged > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#DC2626', display: 'inline-block' }} />}
                <span style={{ backgroundColor: isActive ? '#1E3A6E' : '#E2E8F0', color: isActive ? '#D1AE6E' : '#6B7A99', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>
                  {/* Pendentes (não avaliados) + com erro (falta o trainee corrigir) + a discutir */}
                  {sumWeight(tRecs.filter(r => r.status === 'pending' || r.status === 'red' || r.status === 'yellow'))}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      {activeDate && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: isTrainee ? 12 : '0 0 12px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '11px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FAFAFA' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
              {isTrainee ? 'Seus registros de hoje' : (activeTraineeId ? `Registros — ${data.trainees.find(t => t.id === activeTraineeId)?.nome ?? '—'}` : 'Registros')}
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isTrainee ? 'Você está adicionando registros' : 'Modo revisor'}
            </span>
          </div>

          {activeRecords.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
              {isTrainee ? 'Nenhum registro ainda. Use o formulário abaixo para adicionar.' : 'Nenhum registro pendente para este trainee.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(to bottom, #FAFCFE, #F5F8FC)' }}>
                    {(isTrainee
                      ? [
                          { key: 'created_at',     label: 'Hora' },
                          { key: 'empresa',        label: 'Empresa' },
                          { key: 'colaborador',    label: 'Colaborador' },
                          { key: 'documento',      label: 'Documento' },
                          { key: 'auto_avaliacao', label: 'Auto-aval' },
                          { key: null,             label: '' },
                        ]
                      : [
                          { key: 'created_at',     label: 'Hora' },
                          { key: 'empresa',        label: 'Empresa' },
                          { key: 'colaborador',    label: 'Colaborador' },
                          { key: 'documento',      label: 'Documento' },
                          { key: 'auto_avaliacao', label: 'Auto-aval' },
                          { key: 'status',         label: 'Status revisor' },
                          { key: null,             label: 'Ações' },
                        ]
                    ).map((col, i) => {
                      const canSort = !isTrainee && col.key !== null
                      const isActive = canSort && sortKey === col.key
                      return (
                        <th
                          key={i}
                          onClick={() => canSort && toggleSort(col.key as SortKey)}
                          style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: isActive ? '#1E293B' : 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.9px', borderBottom: '1px solid var(--border-soft)', whiteSpace: 'nowrap', cursor: canSort ? 'pointer' : 'default', userSelect: 'none' }}
                        >
                          {col.label}
                          {isActive && <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(isTrainee ? traineeGroups : revisorGroups).flatMap(group => {
                    if (group.records.length < 2) {
                      return [renderRecordRow(group.records[0])]
                    }
                    const isExpanded = expandedEmpresas.has(group.key)
                    const rows = [renderGroupHeaderRow(group)]
                    if (isExpanded) {
                      group.records.forEach(rec => rows.push(renderRecordRow(rec, true)))
                      if (isTrainee && !isFinalized) rows.push(renderAddMoreRow(group))
                    }
                    return rows
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add form (trainee) */}
          {isTrainee && !isFinalized && (
            <div style={{ padding: '11px 18px', borderTop: '1px solid #F1F5F9', backgroundColor: '#FAFAFA' }}>
              {totalCount >= 1000 ? (
                <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 13, color: '#DC2626', textAlign: 'center', fontWeight: 500 }}>
                  Limite de 1000 registros por dia atingido.
                </div>
              ) : (
                <>
                  {addError && (
                    <div style={{ marginBottom: 8, padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
                      {addError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <input type="text" placeholder="Empresa *" value={newEmpresa} onChange={e => { setNewEmpresa(e.target.value); if (addError) setAddError('') }} style={{ flex: 2, minWidth: 110, padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none', backgroundColor: '#fff' }} onFocus={e => { e.target.style.borderColor = '#2A4F96' }} onBlur={e => { e.target.style.borderColor = '#D1D5DB' }} />
                    <input type="text" placeholder="Colaborador (opcional)" value={newColaborador} onChange={e => { setNewColaborador(e.target.value); if (addError) setAddError('') }} style={{ flex: 1, minWidth: 110, padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none', backgroundColor: '#fff' }} onFocus={e => { e.target.style.borderColor = '#2A4F96' }} onBlur={e => { e.target.style.borderColor = '#D1D5DB' }} />
                    {/* Documento com autocomplete do banco */}
                    <div style={{ position: 'relative', flex: 2, minWidth: 110 }}>
                      <input
                        ref={newDocumentoRef}
                        type="text"
                        placeholder="Documento *"
                        value={newDocumento}
                        onChange={e => { setNewDocumento(e.target.value); setShowDocSugg(true); if (addError) setAddError('') }}
                        onFocus={e => { e.target.style.borderColor = '#2A4F96'; setShowDocSugg(true) }}
                        onBlur={e => { e.target.style.borderColor = '#D1D5DB'; setTimeout(() => setShowDocSugg(false), 150) }}
                        onKeyDown={e => {
                          if (e.key === 'Escape') setShowDocSugg(false)
                          if (e.key === 'Enter' && showDocSugg && docSuggestions.length > 0) {
                            e.preventDefault()
                            setNewDocumento(docSuggestions[0].nome)
                            setShowDocSugg(false)
                          }
                        }}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box' }}
                      />
                      {showDocSugg && docSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #D1D5DB', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
                          {docSuggestions.map(d => (
                            <button
                              key={d.id}
                              type="button"
                              onMouseDown={() => { setNewDocumento(d.nome); setShowDocSugg(false) }}
                              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderBottom: '1px solid #F1F5F9', background: 'none', cursor: 'pointer', fontSize: 13, color: '#1E293B' }}
                            >
                              {d.nome}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <textarea
                    placeholder="Observações (opcional)"
                    value={newObservacoes}
                    onChange={e => setNewObservacoes(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none', backgroundColor: '#fff', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 8 }}
                    onFocus={e => { e.target.style.borderColor = '#2A4F96' }}
                    onBlur={e => { e.target.style.borderColor = '#D1D5DB' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#6B7A99', fontWeight: 500, marginRight: 4 }}>
                      {addingRow ? 'Salvando...' : 'Salvar como:'}
                    </span>
                    {(['aprovado', 'pendente', 'reprovado'] as const).map(v => {
                      const meta = AUTO_AVAL_META[v]
                      return (
                        <button
                          key={v}
                          onClick={() => handleAddRow(v)}
                          disabled={addingRow}
                          style={{ padding: '8px 14px', borderRadius: 6, border: `1px solid ${meta.color}`, backgroundColor: meta.bg, color: meta.color, fontSize: 12, fontWeight: 600, cursor: addingRow ? 'not-allowed' : 'pointer', opacity: addingRow ? 0.6 : 1 }}
                        >
                          {meta.icon} {meta.label}
                        </button>
                      )
                    })}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: totalCount >= 700 ? '#D97706' : '#94A3B8' }}>
                      {totalCount} / 1000
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {isTrainee && isFinalized && (
            <div style={{ padding: '11px 18px', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', fontSize: 12, color: '#6B7A99', textAlign: 'center' }}>
              Este dia foi finalizado — novos registros não são permitidos.
            </div>
          )}
        </div>
      )}

      {/* Histórico removido da página — agora acessível apenas via "📊 Histórico / Relatório" (botão no topo) */}

      {/* ── Modal: Flag ───────────────────────────────────────────── */}
      {flagModal && (
        <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setFlagModal(null) }}>
          <div className="gt3-drop-in" style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>
                {flagModal.status === 'red' ? 'Marcar como erro' : 'Sinalizar para discussão'}
                {flagModal.ids.length > 1 && ` — ${flagModal.ids.length} documentos`}
              </h2>
              <button onClick={() => setFlagModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B7A99' }}>
              {flagModal.status === 'red' ? 'Descreva o que está errado.' : 'Descreva o que precisa ser conversado.'}
              {flagModal.ids.length > 1 && <> A mesma observação será aplicada a todos os documentos de <strong>{flagModal.empresa}</strong>.</>}
            </p>
            <textarea autoFocus value={flagNote} onChange={e => setFlagNote(e.target.value)} placeholder="Digite sua observação..." rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, color: '#1E293B', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} onFocus={e => { e.target.style.borderColor = '#2A4F96' }} onBlur={e => { e.target.style.borderColor = '#D1D5DB' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setFlagModal(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={submitFlag} disabled={flagLoading} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: flagLoading ? '#9BB3D4' : flagModal.status === 'red' ? '#DC2626' : '#D97706', color: '#fff', fontSize: 14, fontWeight: 600, cursor: flagLoading ? 'not-allowed' : 'pointer' }}>
                {flagLoading ? 'Salvando...' : 'Salvar sinalização'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Finalizar ──────────────────────────────────────── */}
      {finalizarOpen && (
        <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setFinalizarOpen(false) }}>
          <div className="gt3-drop-in" style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 540, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#1E293B' }}>Finalizar dia</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6B7A99' }}>
              {activeDate ? `Finalizar ${formatDateLong(activeDate)}? Os registros vão para o histórico.` : ''}
            </p>

            {Object.keys(pendingByTrainee).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, fontSize: 13, color: '#92400E', marginBottom: 12 }}>
                  ⚠️ Há registros pendentes não avaliados. Escolha o destino de cada trainee:
                </div>

                {Object.entries(pendingByTrainee).map(([traineeId, group]) => {
                  const action = groupActions[traineeId] ?? 'transfer'
                  return (
                    <div key={traineeId} style={{ padding: 12, border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 8, backgroundColor: '#FAFAFA' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8 }}>
                        {group.nome} <span style={{ color: '#94A3B8', fontWeight: 400 }}>· {group.count} pendente{group.count > 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setGroupActions(prev => ({ ...prev, [traineeId]: 'transfer' }))}
                          style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: `1px solid ${action === 'transfer' ? '#2A4F96' : '#D1D5DB'}`, backgroundColor: action === 'transfer' ? '#EBF2FF' : '#fff', color: action === 'transfer' ? '#1E3A6E' : '#6B7A99', fontSize: 12, fontWeight: action === 'transfer' ? 600 : 500, cursor: 'pointer', textAlign: 'left' }}
                        >
                          {action === 'transfer' ? '◉' : '○'} Transferir para hoje
                        </button>
                        <button
                          onClick={() => setGroupActions(prev => ({ ...prev, [traineeId]: 'history' }))}
                          style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: `1px solid ${action === 'history' ? '#6B7A99' : '#D1D5DB'}`, backgroundColor: action === 'history' ? '#F1F5F9' : '#fff', color: action === 'history' ? '#1E293B' : '#6B7A99', fontSize: 12, fontWeight: action === 'history' ? 600 : 500, cursor: 'pointer', textAlign: 'left' }}
                        >
                          {action === 'history' ? '◉' : '○'} Não alterar nada
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                        {action === 'transfer'
                          ? 'Os pendentes voltam a aparecer hoje, para o trainee continuar de onde parou.'
                          : 'Os pendentes ficam como estão e vão para o histórico deste dia sem avaliação.'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setFinalizarOpen(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleFinalizar} disabled={finalizarLoading} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: finalizarLoading ? '#F87171' : '#DC2626', color: '#fff', fontSize: 14, fontWeight: 600, cursor: finalizarLoading ? 'not-allowed' : 'pointer' }}>
                {finalizarLoading ? 'Finalizando...' : 'Confirmar finalização'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Relatório ─────────────────────────────────────── */}
      {reportOpen && (
        <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '32px 16px', overflowY: 'auto' }} onClick={e => { if (e.target === e.currentTarget) setReportOpen(false) }}>
          <div className="gt3-drop-in" style={{ backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 820, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>📊 Relatório do Histórico</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94A3B8' }}>Filtre e exporte os registros arquivados</p>
              </div>
              <button onClick={() => setReportOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Filtros */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em' }}>De</label>
                <input type="date" value={reportFilters.startDate} onChange={e => setReportFilters(f => ({ ...f, startDate: e.target.value }))}
                  style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Até</label>
                <input type="date" value={reportFilters.endDate} onChange={e => setReportFilters(f => ({ ...f, endDate: e.target.value }))}
                  style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trainee</label>
                <select value={reportFilters.traineeId} onChange={e => setReportFilters(f => ({ ...f, traineeId: e.target.value }))}
                  style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none', background: '#fff' }}>
                  <option value="">Todos</option>
                  {data.trainees.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</label>
                <select value={reportFilters.status} onChange={e => setReportFilters(f => ({ ...f, status: e.target.value as '' | Status }))}
                  style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none', background: '#fff' }}>
                  <option value="">Todos</option>
                  <option value="green">Aprovado</option>
                  <option value="pending">Pendente</option>
                  <option value="red">Erro</option>
                  <option value="yellow">A discutir</option>
                  <option value="erro_corrigido">⚠️ Erro corrigido</option>
                </select>
              </div>
              <button onClick={generateReport} disabled={reportLoading}
                style={{ padding: '8px 18px', background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: reportLoading ? 'wait' : 'pointer', opacity: reportLoading ? 0.7 : 1 }}>
                {reportLoading ? 'Carregando…' : 'Gerar'}
              </button>
              <button onClick={generateDocsRanking} disabled={reportLoading}
                title="Lista/ranking de quais documentos foram feitos no período e filtros"
                style={{ padding: '8px 16px', background: '#EBF0FB', color: '#2A4F96', border: '1px solid #C7D7F0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: reportLoading ? 'wait' : 'pointer', opacity: reportLoading ? 0.7 : 1 }}>
                📊 Docs mais avaliados
              </button>
            </div>

            {/* Resultado */}
            <div style={{ padding: '0 24px 24px' }}>
              {reportResult === null && !reportLoading && (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>
                  Defina os filtros e clique em &ldquo;Gerar&rdquo; para visualizar os registros.
                </div>
              )}

              {reportResult && (
                <>
                  {/* Totais */}
                  <div style={{ display: 'flex', gap: 10, padding: '14px 0 12px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Total', value: sumWeight(reportResult), color: '#1E293B' },
                      { label: 'Aprovados', value: sumWeight(reportResult.filter(r => r.status === 'green')), color: '#16A34A' },
                      { label: 'Erros', value: sumWeight(reportResult.filter(r => r.status === 'red')), color: '#DC2626' },
                      { label: 'A discutir', value: sumWeight(reportResult.filter(r => r.status === 'yellow')), color: '#D97706' },
                      { label: 'Corrigidos', value: sumWeight(reportResult.filter(r => r.status === 'erro_corrigido')), color: '#C2410C' },
                      { label: 'Pendentes', value: sumWeight(reportResult.filter(r => r.status === 'pending')), color: '#6B7A99' },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', minWidth: 80 }}>
                        <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={exportReportCSV} style={{ padding: '7px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                        ⬇ Exportar CSV
                      </button>
                      <button onClick={printReport} style={{ padding: '7px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                        🖨 Imprimir
                      </button>
                      <button onClick={() => printDocsRanking()} disabled={reportResult.length === 0} title="Ranking dos documentos mais avaliados no período" style={{ padding: '7px 14px', background: reportResult.length === 0 ? '#EEF2F7' : '#EBF0FB', border: '1px solid #C7D7F0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: reportResult.length === 0 ? 'not-allowed' : 'pointer', color: '#2A4F96' }}>
                        📊 Docs mais avaliados
                      </button>
                    </div>
                  </div>

                  {/* Tabela */}
                  {reportResult.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: 13, fontStyle: 'italic', background: '#F8FAFC', borderRadius: 8 }}>
                      Nenhum registro encontrado para os filtros selecionados.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #E2E8F0', maxHeight: 420, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr style={{ background: '#F8FAFC' }}>
                            {['Data', 'Trainee', 'Empresa', 'Colaborador', 'Documento', 'Auto-aval', 'Status', 'Revisor'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportResult.map(r => (
                            <tr key={r.id} style={{ borderBottom: '1px solid #F8FAFC', background: rowBg(r.status) }}>
                              <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', color: '#6B7A99' }}>{formatDate(r.data_dia)}</td>
                              <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>{r.criado_por_profile?.nome ?? '—'}</td>
                              <td style={{ padding: '7px 12px' }}>{r.empresa}</td>
                              <td style={{ padding: '7px 12px' }}>
                                {r.colaborador && /^\d+$/.test(r.colaborador.trim()) && parseInt(r.colaborador) > 1 ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontWeight: 700, color: '#D97706' }}>×{r.colaborador}</span>
                                    <span style={{ fontSize: 10, color: '#94A3B8', background: '#FEF3C7', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>docs</span>
                                  </span>
                                ) : (r.colaborador ?? '—')}
                              </td>
                              <td style={{ padding: '7px 12px' }}>
                                {r.documento}
                                {r.nota_revisor && <div style={{ fontSize: 10, color: '#6B7A99', fontStyle: 'italic', marginTop: 1 }}>"{r.nota_revisor}"</div>}
                              </td>
                              <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                {r.auto_avaliacao ? (
                                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: AUTO_AVAL_META[r.auto_avaliacao].bg, color: AUTO_AVAL_META[r.auto_avaliacao].color }}>
                                    {AUTO_AVAL_META[r.auto_avaliacao].icon} {AUTO_AVAL_META[r.auto_avaliacao].label}
                                  </span>
                                ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                              </td>
                              <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: r.status === 'green' ? '#D1FAE5' : r.status === 'red' ? '#FEE2E2' : r.status === 'yellow' ? '#FEF3C7' : r.status === 'erro_corrigido' ? '#FFF7ED' : '#F1F5F9', color: r.status === 'green' ? '#065F46' : r.status === 'red' ? '#991B1B' : r.status === 'yellow' ? '#92400E' : r.status === 'erro_corrigido' ? '#C2410C' : '#6B7A99' }}>
                                  {r.status === 'erro_corrigido' ? '⚠️ Erro corrigido' : STATUS_LABEL[r.status]}
                                </span>
                              </td>
                              <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', color: '#6B7A99' }}>{r.revisado_por_profile?.nome ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Banco de Documentos ──────────────────────────────── */}
      {docBancoOpen && (
        <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setDocBancoOpen(false) }}>
          <div className="gt3-drop-in" style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>📋 Banco de Documentos</h2>
              <button onClick={() => setDocBancoOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8', lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6B7A99' }}>Documentos disponíveis no campo de autocomplete ao adicionar revisões.</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Nome do documento…"
                value={newDocBancoInput}
                onChange={e => setNewDocBancoInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddDocBanco() }}
                style={{ flex: 1, padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none' }}
                onFocus={e => { e.target.style.borderColor = '#2A4F96' }}
                onBlur={e => { e.target.style.borderColor = '#D1D5DB' }}
              />
              <button
                onClick={handleAddDocBanco}
                disabled={addingDocBanco || !newDocBancoInput.trim()}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: addingDocBanco || !newDocBancoInput.trim() ? 'not-allowed' : 'pointer', opacity: addingDocBanco || !newDocBancoInput.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                {addingDocBanco ? 'Salvando…' : '+ Adicionar'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {docBanco.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0', margin: 0 }}>Nenhum documento cadastrado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {docBanco.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, border: '1px solid #F1F5F9', background: '#FAFAFA' }}>
                      <span style={{ fontSize: 13, color: '#1E293B' }}>{d.nome}</span>
                      {!isTrainee && (
                        <button
                          onClick={() => handleDeleteDocBanco(d.id)}
                          title="Remover"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#EF4444', padding: '2px 6px', borderRadius: 4, lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nova data ──────────────────────────────────────── */}
      {novaDataOpen && (
        <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setNovaDataOpen(false) }}>
          <div className="gt3-drop-in" style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#1E293B' }}>Nova data</h2>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B7A99' }}>Selecione a data a ser ativada.</p>
            <input type="date" value={novaDataInput} onChange={e => setNovaDataInput(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
            {novaDataError && <div style={{ marginBottom: 14, padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{novaDataError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setNovaDataOpen(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleNovaData} disabled={novaDataLoading || !novaDataInput} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: novaDataLoading ? '#9BB3D4' : '#2A4F96', color: '#fff', fontSize: 14, fontWeight: 600, cursor: novaDataLoading ? 'not-allowed' : 'pointer' }}>
                {novaDataLoading ? 'Criando...' : 'Criar data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
