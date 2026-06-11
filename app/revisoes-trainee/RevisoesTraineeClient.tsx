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

  // Flag modal (revisor)
  const [flagModal, setFlagModal] = useState<{ id: string; status: 'red' | 'yellow' } | null>(null)
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
  const [historyExpanded, setHistoryExpanded] = useState(true)
  const [historyRecords, setHistoryRecords] = useState<Record<string, Registro[]>>({})
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [docStatsOpen, setDocStatsOpen] = useState(false)

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
  const pendingCount = visibleRecords.filter(r => r.status === 'pending').length
  const redCount = visibleRecords.filter(r => r.status === 'red').length
  const yellowCount = visibleRecords.filter(r => r.status === 'yellow').length
  const greenCount = visibleRecords.filter(r => r.status === 'green').length
  const erroCorrigidoCount = visibleRecords.filter(r => r.status === 'erro_corrigido').length
  const totalCount = visibleRecords.length

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

  const docSuggestions = newDocumento.trim()
    ? docBanco.filter(d => d.nome.toLowerCase().includes(newDocumento.toLowerCase()))
    : docBanco

  const docHistoryStats = useMemo(() => {
    const allRecs = Object.values(historyRecords).flat()
    if (allRecs.length === 0) return []
    const countMap: Record<string, number> = {}
    allRecs.forEach(r => { const k = r.documento?.trim(); if (k) countMap[k] = (countMap[k] ?? 0) + 1 })
    const total = allRecs.length
    return Object.entries(countMap)
      .map(([nome, count]) => ({ nome, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
  }, [historyRecords])

  const pendingByTrainee = useMemo(() => {
    const map: Record<string, { nome: string; count: number }> = {}
    records.filter(r => r.status === 'pending').forEach(r => {
      const key = r.criado_por
      if (!map[key]) map[key] = { nome: r.criado_por_profile?.nome ?? key.slice(0, 8), count: 0 }
      map[key].count++
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
      setNewEmpresa(''); setNewColaborador(''); setNewDocumento('')
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
    setFlagModal({ id, status })
    setFlagNote(rec?.nota_revisor ?? '')
  }

  async function submitFlag() {
    if (!flagModal) return
    if (!flagNote.trim()) { alert('Descreva o motivo da sinalização.'); return }
    const { id, status } = flagModal
    const nota = flagNote
    if (processingIds.current.has(id)) return
    const prev = data!.records.find(r => r.id === id)
    startProcessing(id)
    // Optimistic — fecha modal imediatamente
    applyOptimisticStatus(id, { status: status as Status, nota_revisor: nota })
    setFlagModal(null); setFlagNote('')
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
    pending.forEach(r => { if (!initial[r.criado_por]) initial[r.criado_por] = 'history' })
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

  // ── History ────────────────────────────────────────────────────
  async function toggleDay(dataDia: string) {
    const next = new Set(expandedDays)
    if (next.has(dataDia)) { next.delete(dataDia); setExpandedDays(next); return }
    next.add(dataDia); setExpandedDays(next)
    if (!historyRecords[dataDia]) {
      const res = await fetch(`/api/revisoes?date=${dataDia}`)
      if (res.ok) {
        const recs: Registro[] = await res.json()
        setHistoryRecords(prev => ({ ...prev, [dataDia]: recs }))
      }
    }
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
  async function generateReport() {
    setReportLoading(true)
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
    setReportResult(recs)
    setReportLoading(false)
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
    const totals = (reportResult ?? []).reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc }, {} as Record<string, number>)
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório GT3</title>
    <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}
    th{background:#f0f4fa;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
    .totals{display:flex;gap:16px;margin:12px 0;font-size:13px}
    @media print{.no-print{display:none}}</style></head><body>
    <h2 style="margin:0 0 4px;font-size:18px">Relatório de Revisões Trainee</h2>
    <p style="margin:0 0 12px;font-size:12px;color:#6B7A99">${reportResult.length} registros · gerado em ${new Date().toLocaleString('pt-BR')}</p>
    <div class="totals">
      <span>✅ Aprovados: <b>${totals.green ?? 0}</b></span>
      <span>❌ Erros: <b>${totals.red ?? 0}</b></span>
      <span>⚠️ A discutir: <b>${totals.yellow ?? 0}</b></span>
      <span>⏳ Pendentes: <b>${totals.pending ?? 0}</b></span>
    </div>
    <button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;background:#2A4F96;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
    <table><thead><tr>
      <th>Data</th><th>Trainee</th><th>Empresa</th><th>Colaborador</th><th>Documento</th><th>Status</th><th>Revisor</th>
    </tr></thead><tbody>${rows}</tbody></table></body></html>`)
    win.document.close()
  }

  // ── Cell renderer ──────────────────────────────────────────────
  function renderCell(rec: Registro, field: 'empresa' | 'colaborador' | 'documento') {
    // documento nunca abre edição inline — é sempre copy-on-click
    const canEdit = isTrainee && rec.criado_por === data!.currentUserId && !!activeDate && !isFinalized && field !== 'documento'
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
        {isCopied ? '✓ Copiado!' : (rec[field] || <span style={{ color: '#CBD5E1' }}>—</span>)}
      </span>
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
              <button key={t.id} onClick={() => setActiveTraineeId(t.id)} style={{ background: 'none', border: 'none', padding: '11px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', color: isActive ? '#1E293B' : '#6B7A99', borderBottom: isActive ? '2px solid #2A4F96' : '2px solid transparent', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 7 }}>
                {t.nome.split(' ')[0]}
                {tFlagged > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#DC2626', display: 'inline-block' }} />}
                <span style={{ backgroundColor: isActive ? '#1E3A6E' : '#E2E8F0', color: isActive ? '#D1AE6E' : '#6B7A99', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>
                  {tRecs.filter(r => r.status !== 'green').length}
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
                  <tr style={{ backgroundColor: '#F8FAFC' }}>
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
                          style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: isActive ? '#1E293B' : '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', cursor: canSort ? 'pointer' : 'default', userSelect: 'none' }}
                        >
                          {col.label}
                          {isActive && <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(isTrainee ? activeRecords : sortedRecords).map(rec => (
                    <tr key={rec.id} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: rowBg(rec.status), borderLeft: rowBorderLeft(rec.status) }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#6B7A99', fontSize: 12 }}>{formatTime(rec.created_at)}</td>
                      <td style={{ padding: '10px 14px' }}>{renderCell(rec, 'empresa')}</td>
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
                        {isTrainee && rec.criado_por === data.currentUserId && !isFinalized ? (
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
                          rec.criado_por === data.currentUserId && !isFinalized && (
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
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add form (trainee) */}
          {isTrainee && !isFinalized && (
            <div style={{ padding: '11px 18px', borderTop: '1px solid #F1F5F9', backgroundColor: '#FAFAFA' }}>
              {totalCount >= 300 ? (
                <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 13, color: '#DC2626', textAlign: 'center', fontWeight: 500 }}>
                  Limite de 300 registros por dia atingido.
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
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: totalCount >= 130 ? '#D97706' : '#94A3B8' }}>
                      {totalCount} / 300
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

      {/* History */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Histórico</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isTrainee && data.historyDates.length > 0 && (
              <button
                onClick={() => { setReportOpen(true); setReportResult(null) }}
                style={{ padding: '6px 12px', background: '#fff', color: '#2A4F96', border: '1px solid #2A4F96', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                📊 Gerar Relatório
              </button>
            )}
            <button onClick={() => setHistoryExpanded(p => !p)} style={{ background: 'none', border: 'none', color: '#6B7A99', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
              {historyExpanded ? 'ocultar' : 'mostrar'}
            </button>
          </div>
        </div>

        {historyExpanded && docHistoryStats.length > 0 && (
          <div style={{ marginBottom: 14, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => setDocStatsOpen(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2A4F96' }}>📊 Documentos mais avaliados</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>
                  {Object.values(historyRecords).flat().length} registros · {docHistoryStats.length} tipos
                </span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{docStatsOpen ? '▲' : '▼'}</span>
              </div>
            </button>
            {docStatsOpen && (
              <div style={{ padding: '0 16px 14px', borderTop: '1px solid #F1F5F9' }}>
                <p style={{ margin: '10px 0 12px', fontSize: 11, color: '#94A3B8' }}>
                  Baseado nos dias abertos abaixo — expande mais dias para ampliar a análise.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {docHistoryStats.map(({ nome, count, pct }, i) => (
                    <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: 12, color: '#1E293B', width: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={nome}>{nome}</span>
                      <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? '#2A4F96' : i === 1 ? '#5B8DEF' : '#93B8F5', borderRadius: 99, transition: 'width 0.4s' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', width: 34, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                      <span style={{ fontSize: 11, color: '#94A3B8', width: 36, flexShrink: 0 }}>({count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {historyExpanded && (
          data.historyDates.length === 0
            ? <div style={{ padding: '16px 0', color: '#94A3B8', fontSize: 14, fontStyle: 'italic' }}>Nenhum dia finalizado ainda.</div>
            : data.historyDates.map(hd => {
              const isOpen = expandedDays.has(hd.data)
              const hRecs = historyRecords[hd.data] ?? []
              const hGreen = hRecs.filter(r => r.status === 'green').length
              const hRed = hRecs.filter(r => r.status === 'red').length
              const hYellow = hRecs.filter(r => r.status === 'yellow').length
              const hPending = hRecs.filter(r => r.status === 'pending').length

              const traineeMap: Record<string, { nome: string; recs: Registro[] }> = {}
              hRecs.forEach(r => {
                const key = r.criado_por
                if (!traineeMap[key]) traineeMap[key] = { nome: r.criado_por_profile?.nome ?? key, recs: [] }
                traineeMap[key].recs.push(r)
              })

              return (
                <div key={hd.data} style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                  <div onClick={() => toggleDay(hd.data)} style={{ padding: '11px 18px', backgroundColor: '#FAFAFA', borderBottom: isOpen ? '1px solid #E2E8F0' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F1F5F9')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{formatDate(hd.data)}</span>
                      {hd.finalizador && <span style={{ fontSize: 11, color: '#94A3B8' }}>finalizado por {hd.finalizador.nome}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11 }}>
                      {isOpen && hRecs.length > 0 && (
                        <>
                          <span style={{ color: '#16A34A' }}>● {hGreen}</span>
                          <span style={{ color: '#DC2626' }}>● {hRed}</span>
                          <span style={{ color: '#D97706' }}>● {hYellow}</span>
                          {hPending > 0 && <span style={{ color: '#94A3B8' }}>○ {hPending}</span>}
                        </>
                      )}
                      <span style={{ color: '#94A3B8', fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div>
                      {hRecs.length === 0 ? (
                        <div style={{ padding: '20px', color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>Carregando...</div>
                      ) : Object.values(traineeMap).map(({ nome, recs }) => (
                        <div key={nome} style={{ borderTop: '1px solid #F1F5F9' }}>
                          <div style={{ padding: '7px 18px', backgroundColor: '#F8FAFC', fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {nome} · {recs.length} registro{recs.length > 1 ? 's' : ''}
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ backgroundColor: '#FAFAFA' }}>
                                  {['Hora', 'Empresa', 'Colaborador', 'Documento', 'Status', 'Revisor'].map((col, i) => (
                                    <th key={i} style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #F1F5F9' }}>{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {recs.map(r => (
                                  <tr key={r.id} style={{ borderBottom: '1px solid #F8FAFC', backgroundColor: rowBg(r.status) }}>
                                    <td style={{ padding: '8px 14px', color: '#6B7A99', fontSize: 11, whiteSpace: 'nowrap' }}>{formatTime(r.created_at)}</td>
                                    <td style={{ padding: '8px 14px' }}>{r.empresa}</td>
                                    <td style={{ padding: '8px 14px' }}>{r.colaborador}</td>
                                    <td style={{ padding: '8px 14px' }}>
                                      {r.documento}
                                      {r.nota_revisor && <div style={{ fontSize: 10, color: '#6B7A99', fontStyle: 'italic', marginTop: 2 }}>"{r.nota_revisor}"</div>}
                                    </td>
                                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                                      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 4, backgroundColor: r.status === 'green' ? '#D1FAE5' : r.status === 'red' ? '#FEE2E2' : r.status === 'yellow' ? '#FEF3C7' : r.status === 'erro_corrigido' ? '#FFF7ED' : '#F1F5F9', color: r.status === 'green' ? '#065F46' : r.status === 'red' ? '#991B1B' : r.status === 'yellow' ? '#92400E' : r.status === 'erro_corrigido' ? '#C2410C' : '#6B7A99' }}>
                                        {r.status === 'erro_corrigido' ? '⚠️ Erro corrigido' : STATUS_LABEL[r.status]}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 14px', fontSize: 11, color: '#6B7A99' }}>{r.revisado_por_profile?.nome ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
        )}
      </div>

      {/* ── Modal: Flag ───────────────────────────────────────────── */}
      {flagModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setFlagModal(null) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>
                {flagModal.status === 'red' ? 'Marcar como erro' : 'Sinalizar para discussão'}
              </h2>
              <button onClick={() => setFlagModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B7A99' }}>
              {flagModal.status === 'red' ? 'Descreva o que está errado.' : 'Descreva o que precisa ser conversado.'}
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setFinalizarOpen(false) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 540, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
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
                  const action = groupActions[traineeId] ?? 'history'
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
                          {action === 'history' ? '◉' : '○'} Enviar p/ histórico sem avaliação
                        </button>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '32px 16px', overflowY: 'auto' }} onClick={e => { if (e.target === e.currentTarget) setReportOpen(false) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 820, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
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
                      { label: 'Total', value: reportResult.length, color: '#1E293B' },
                      { label: 'Aprovados', value: reportResult.filter(r => r.status === 'green').length, color: '#16A34A' },
                      { label: 'Erros', value: reportResult.filter(r => r.status === 'red').length, color: '#DC2626' },
                      { label: 'A discutir', value: reportResult.filter(r => r.status === 'yellow').length, color: '#D97706' },
                      { label: 'Pendentes', value: reportResult.filter(r => r.status === 'pending').length, color: '#6B7A99' },
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
                              <td style={{ padding: '7px 12px' }}>{r.colaborador ?? '—'}</td>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setDocBancoOpen(false) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setNovaDataOpen(false) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
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
