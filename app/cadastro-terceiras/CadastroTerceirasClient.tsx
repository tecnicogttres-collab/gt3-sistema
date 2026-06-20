'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '../components/UserContext'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Contratante = { id: string; nome: string; requer_cc: boolean }

type EtapaId = 'gt0100' | 'cc_notif' | 'pasta_rede' | 'gt0180' | 'cnpj_liberado' | 'gt8005' | 'email'
type EtapaEstado =
  | 'pendente' | 'ok' | 'na' | 'sob_demanda' | 'mensal'
  | 'validar' | 'validado' | 'nao_liberado' | 'liberado' | 'nao_evoluiu'

type Etapas = Partial<Record<EtapaId, EtapaEstado>>

type HistEntry = { id: string; ts: string; who: string; what: string }

type Terceira = {
  id: string
  contratante_id: string
  contratante: Contratante | null
  razao_social: string
  contato: string | null
  data: string
  tem_sub: boolean
  subcontratante: string | null
  observacao: string | null
  status: 'ativo' | 'concluido' | 'nao_evoluiu'
  arquivado_em: string | null
  etapas: Etapas
  historico: HistEntry[]
  created_at: string
}

// ─── Constantes ────────────────────────────────────────────────────────────────

type GuiaEtapa = { id: EtapaId; label: string; estados: EtapaEstado[]; condicional?: boolean; reqGestor?: boolean }
type Guia = { id: string; label: string; etapas: GuiaEtapa[] }

const GUIAS: Guia[] = [
  {
    id: 'cadastro', label: 'Cadastro', etapas: [
      { id: 'gt0100',        label: 'GT0100',           estados: ['pendente', 'ok', 'na'] },
      { id: 'cc_notif',      label: 'CC / Notificação', estados: ['pendente', 'ok', 'na'], condicional: true },
      { id: 'pasta_rede',    label: 'Pasta Rede',       estados: ['pendente', 'ok', 'na'] },
      { id: 'gt0180',        label: 'GT0180',           estados: ['pendente', 'sob_demanda', 'mensal', 'na', 'validado'] },
      { id: 'cnpj_liberado', label: 'CNPJ Liberado',    estados: ['nao_liberado', 'liberado', 'na'] },
      { id: 'gt8005',        label: 'Cadastro GT8005',  estados: ['pendente', 'ok', 'na'] },
    ],
  },
  {
    id: 'contato', label: 'Contato inicial', etapas: [
      { id: 'email', label: 'Recebeu e-mail', estados: ['pendente', 'ok', 'na'] },
    ],
  },
]

type EstadoInfo = { label: string; ico: string; completa: boolean; color: string; bg: string }
const ESTADOS: Record<EtapaEstado, EstadoInfo> = {
  pendente:     { label: 'Pendente',           ico: '○',  completa: false, color: '#d97706', bg: '#fef3c7' },
  ok:           { label: 'OK',                 ico: '✓',  completa: true,  color: '#16a34a', bg: '#dcfce7' },
  na:           { label: 'Não aplica',         ico: '—',  completa: true,  color: '#6b7280', bg: '#f3f4f6' },
  sob_demanda:  { label: 'Sob demanda',        ico: '✓',  completa: true,  color: '#16a34a', bg: '#dcfce7' },
  mensal:       { label: 'Mensal',             ico: '↻',  completa: true,  color: '#2563eb', bg: '#dbeafe' },
  validar:      { label: 'Aguard. validação',  ico: '⏳', completa: false, color: '#7c3aed', bg: '#ede9fe' },
  validado:     { label: 'Validado',           ico: '✓✓', completa: true,  color: '#2563eb', bg: '#dbeafe' },
  nao_liberado: { label: 'Não liberado',       ico: '○',  completa: false, color: '#d97706', bg: '#fef3c7' },
  liberado:     { label: 'Liberado',           ico: '✓',  completa: true,  color: '#16a34a', bg: '#dcfce7' },
  nao_evoluiu:  { label: 'Não evoluiu',        ico: '✕',  completa: false, color: '#dc2626', bg: '#fee2e2' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function etapasAplicaveis(t: Terceira): GuiaEtapa[] {
  const requerCC = !!t.contratante?.requer_cc
  return GUIAS.flatMap(g => g.etapas.filter(e => !e.condicional || requerCC))
}

function calcProgresso(t: Terceira): number {
  const etapas = etapasAplicaveis(t)
  const total = etapas.length
  const ok = etapas.filter(e => ESTADOS[t.etapas[e.id] ?? 'pendente']?.completa).length
  return total === 0 ? 0 : Math.round((ok / total) * 100)
}

function statusGuia(t: Terceira, guia: Guia): 'ok' | 'validar' | 'pendente' {
  const requerCC = !!t.contratante?.requer_cc
  const etapas = guia.etapas.filter(e => !e.condicional || requerCC)
  if (etapas.length === 0) return 'ok'
  const estados = etapas.map(e => t.etapas[e.id] ?? 'pendente')
  if (estados.every(s => ESTADOS[s]?.completa)) return 'ok'
  if (estados.some(s => s === 'validar')) return 'validar'
  return 'pendente'
}

function fmtData(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

function fmtDataHora(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ─── CSS-in-JS helpers ─────────────────────────────────────────────────────────

const S = {
  surface: '#ffffff',
  bg: '#F4F6FA',
  primary: '#2A4F96',
  primaryDark: '#1f3d75',
  primaryLight: '#eaf0fa',
  accent: '#D1AE6E',
  border: '#e2e6ee',
  borderStrong: '#cbd2dd',
  text: '#1f2937',
  textMuted: '#6b7280',
  ok: '#16a34a',
  okBg: '#dcfce7',
  pendente: '#d97706',
  pendenteBg: '#fef3c7',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  validar: '#7c3aed',
  validarBg: '#ede9fe',
  validado: '#2563eb',
  validadoBg: '#dbeafe',
  radius: '10px',
  radiusSm: '6px',
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CadastroTerceirasClient() {
  const { profile } = useUser()
  const papel = profile?.papel ?? 'colaborador'
  const podeGerenciarContratantes = papel === 'admin' || papel === 'gestor'
  const podeValidarGestor = papel === 'admin' || papel === 'gestor'

  const [terceiras, setTerceiras] = useState<Terceira[]>([])
  const [contratantes, setContratantes] = useState<Contratante[]>([])
  const [loading, setLoading] = useState(true)

  // Tabs
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos')

  // Filtros ativos
  const [busca, setBusca] = useState('')
  const [fContratante, setFContratante] = useState('')
  const [fSubcontratante, setFSubcontratante] = useState('')
  const [fGt0180, setFGt0180] = useState('')
  const [fSoSub, setFSoSub] = useState(false)

  // Filtros histórico
  const [hBusca, setHBusca] = useState('')
  const [hContratante, setHContratante] = useState('')
  const [hSubcontratante, setHSubcontratante] = useState('')
  const [hGt0180, setHGt0180] = useState('')
  const [hTipo, setHtipo] = useState('todas')
  const [hDe, setHDe] = useState('')
  const [hAte, setHAte] = useState('')
  const [hSoSub, setHSoSub] = useState(false)

  // Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState<'detalhes' | 'historico'>('detalhes')

  // Modal confirmar arquivamento
  const [modalConfirm, setModalConfirm] = useState<{ open: boolean; texto: string; onConfirm: () => void }>({
    open: false, texto: '', onConfirm: () => {}
  })

  // Modal nova terceira
  const [modalNova, setModalNova] = useState(false)
  const [novaTerceira, setNovaTerceira] = useState({
    contratante_id: '', razao_social: '', contato: '', data: new Date().toISOString().slice(0, 10),
    tem_sub: false, subcontratante: '', observacao: '',
  })
  const [salvandoNova, setSalvandoNova] = useState(false)

  // Modal contratantes
  const [modalContratantes, setModalContratantes] = useState(false)
  const [novoContratante, setNovoContratante] = useState({ nome: '', requer_cc: false })
  const [salvandoContratante, setSalvandoContratante] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)

  // Editor de estados por coluna
  const [showEditor, setShowEditor] = useState(false)
  const [customEstados, setCustomEstados] = useState<Partial<Record<EtapaId, EtapaEstado[]>>>(() => {
    try { return JSON.parse(localStorage.getItem('gt3_etapa_estados') ?? '{}') } catch { return {} }
  })

  function updateCustomEstados(etapaId: EtapaId, estados: EtapaEstado[]) {
    setCustomEstados(prev => {
      const next = { ...prev, [etapaId]: estados }
      localStorage.setItem('gt3_etapa_estados', JSON.stringify(next))
      return next
    })
  }

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, tipo = '') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, tipo })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // ── Load ──────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/terceiras'),
        fetch('/api/terceiras/contratantes'),
      ])
      if (r1.ok) setTerceiras(await r1.json())
      if (r2.ok) setContratantes(await r2.json())
    } catch { /* noop */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ESC fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (modalConfirm.open) { setModalConfirm(p => ({ ...p, open: false })); return }
      if (modalNova) { setModalNova(false); return }
      if (modalContratantes) { setModalContratantes(false); setModoEdicao(false); return }
      if (selectedId) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalConfirm.open, modalNova, modalContratantes, selectedId])

  // ── Dados computados ──────────────────────────────────────────────────────────

  const ativos = terceiras.filter(t => t.status === 'ativo')
  const arquivados = terceiras.filter(t => t.status !== 'ativo')

  function matchesFiltro(t: Terceira, q: string, fC: string, fS: string, fG: string, onlySub: boolean) {
    if (q) {
      const blob = [t.razao_social, t.contratante?.nome ?? '', t.contato ?? '', t.subcontratante ?? ''].join(' ').toLowerCase()
      if (!blob.includes(q.toLowerCase())) return false
    }
    if (fC && t.contratante_id !== fC) return false
    if (fS && t.subcontratante !== fS) return false
    if (onlySub && !t.tem_sub) return false
    if (fG && (t.etapas.gt0180 ?? '') !== fG) return false
    return true
  }

  const ativosFiltrados = ativos
    .filter(t => matchesFiltro(t, busca, fContratante, fSubcontratante, fGt0180, fSoSub))
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '') || b.created_at.localeCompare(a.created_at))

  function dataRefHist(t: Terceira) {
    return t.status === 'ativo' ? t.data : (t.arquivado_em?.slice(0, 10) ?? '')
  }

  let baseHist: Terceira[] = []
  if (hTipo === 'todas') baseHist = [...arquivados, ...ativos]
  else if (hTipo === 'arquivadas') baseHist = arquivados
  else if (hTipo === 'concluido') baseHist = arquivados.filter(t => t.status === 'concluido')
  else if (hTipo === 'nao_evoluiu') baseHist = arquivados.filter(t => t.status === 'nao_evoluiu')
  else if (hTipo === 'ativo') baseHist = ativos

  const histFiltrados = baseHist
    .filter(t => {
      if (!matchesFiltro(t, hBusca, hContratante, hSubcontratante, hGt0180, hSoSub)) return false
      const dr = dataRefHist(t)
      if (hDe && dr < hDe) return false
      if (hAte && dr > hAte) return false
      return true
    })
    .sort((a, b) => dataRefHist(b).localeCompare(dataRefHist(a)))

  const subsAtivos = [...new Set(ativos.filter(t => t.tem_sub).map(t => t.subcontratante ?? '').filter(Boolean))].sort()
  const subsTodos = [...new Set(terceiras.filter(t => t.tem_sub).map(t => t.subcontratante ?? '').filter(Boolean))].sort()

  const selectedTerceira = terceiras.find(t => t.id === selectedId) ?? null

  // ── KPIs ──────────────────────────────────────────────────────────────────────


  // ── Ações ─────────────────────────────────────────────────────────────────────

  async function handleCriarTerceira() {
    if (!novaTerceira.contratante_id) { showToast('Selecione um contratante', 'danger'); return }
    if (!novaTerceira.razao_social.trim()) { showToast('Razão social obrigatória', 'danger'); return }
    if (novaTerceira.tem_sub && !novaTerceira.subcontratante.trim()) { showToast('Informe o nome da empresa subcontratante', 'danger'); return }
    setSalvandoNova(true)
    try {
      const res = await fetch('/api/terceiras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaTerceira),
      })
      if (!res.ok) { showToast('Erro ao criar terceira', 'danger'); return }
      const nova: Terceira = await res.json()
      setTerceiras(prev => [nova, ...prev])
      setModalNova(false)
      setNovaTerceira({ contratante_id: '', razao_social: '', contato: '', data: new Date().toISOString().slice(0, 10), tem_sub: false, subcontratante: '', observacao: '' })
      showToast('✓ Terceira cadastrada', 'success')
    } finally {
      setSalvandoNova(false)
    }
  }

  async function handleUpdateInfo(id: string, campo: string, valor: unknown) {
    const res = await fetch(`/api/terceiras/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campo]: valor }),
    })
    if (res.ok) {
      const atualizada: Terceira = await res.json()
      setTerceiras(prev => prev.map(t => t.id === id ? atualizada : t))
    }
  }

  async function executarCycle(terceira: Terceira, etapa: GuiaEtapa, novoEstado: EtapaEstado) {
    // Atualiza só a etapa específica — evita sobrescrever outras atualizações em voo
    setTerceiras(prev => prev.map(t => t.id !== terceira.id ? t : { ...t, etapas: { ...t.etapas, [etapa.id]: novoEstado } }))
    const res = await fetch(`/api/terceiras/${terceira.id}/etapa`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa_id: etapa.id, novo_estado: novoEstado, obs: '' }),
    })
    if (!res.ok) {
      // Reverte só esta etapa para o valor pré-clique
      const anterior = terceira.etapas[etapa.id] ?? etapa.estados[0]
      setTerceiras(prev => prev.map(t => t.id !== terceira.id ? t : { ...t, etapas: { ...t.etapas, [etapa.id]: anterior } }))
      showToast('Erro ao salvar', 'danger')
      return
    }
    const { terceira: atualizada, arquivada, motivo } = await res.json()
    if (arquivada) {
      setTerceiras(prev => prev.map(t => t.id === atualizada.id ? atualizada : t))
      setSelectedId(null)
      showToast(motivo === 'nao_evoluiu' ? '✕ Terceira arquivada como "Não evoluiu"' : '✓ Cadastro concluído! Movido para o histórico.', motivo === 'nao_evoluiu' ? 'danger' : 'success')
    } else {
      // Merge: mantém etapas em voo mais recentes, absorve historico/metadata do servidor
      setTerceiras(prev => prev.map(t => t.id !== atualizada.id ? t : { ...atualizada, etapas: { ...atualizada.etapas, ...t.etapas } }))
    }
  }

  async function handleCycleEtapa(terceira: Terceira, etapa: GuiaEtapa) {
    if (terceira.status !== 'ativo') return
    const estados = customEstados[etapa.id] ?? etapa.estados
    if (estados.length === 0) return
    const currentEstado = terceira.etapas[etapa.id] ?? estados[0]
    const currentIdx = estados.indexOf(currentEstado)
    const nextEstado = estados[(currentIdx + 1) % estados.length]
    if (etapa.reqGestor && !podeValidarGestor && nextEstado === 'validado') {
      showToast('Esta etapa requer aprovação de gestor', 'danger'); return
    }
    await executarCycle(terceira, etapa, nextEstado)
  }

  function handleDescartarCnpj(terceira: Terceira) {
    if (terceira.status !== 'ativo') return
    const cnpjEtapa = GUIAS[0].etapas.find(e => e.id === 'cnpj_liberado')!
    setModalConfirm({
      open: true,
      texto: `Ao confirmar, a terceira <strong>${terceira.razao_social}</strong> será marcada como <strong>"CNPJ Descartado / Não evoluiu"</strong> e movida para o histórico.<br><br>Esta ação pode ser revertida pelo botão "Reativar".`,
      onConfirm: async () => {
        setModalConfirm(p => ({ ...p, open: false }))
        await executarCycle(terceira, cnpjEtapa, 'nao_evoluiu')
      },
    })
  }

  async function handleReativar(id: string) {
    const res = await fetch(`/api/terceiras/${id}/reativar`, { method: 'PATCH' })
    if (!res.ok) { showToast('Erro ao reativar', 'danger'); return }
    const atualizada: Terceira = await res.json()
    setTerceiras(prev => prev.map(t => t.id === id ? atualizada : t))
    showToast('↺ Terceira reativada', 'success')
    setSelectedId(id)
    setDrawerTab('detalhes')
  }

  async function handleAdicionarContratante() {
    if (!novoContratante.nome.trim()) { showToast('Informe o nome', 'danger'); return }
    setSalvandoContratante(true)
    try {
      const res = await fetch('/api/terceiras/contratantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoContratante),
      })
      if (!res.ok) { showToast('Erro ao adicionar contratante', 'danger'); return }
      const novo: Contratante = await res.json()
      setContratantes(prev => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)))
      setNovoContratante({ nome: '', requer_cc: false })
      showToast('✓ Contratante adicionado', 'success')
    } finally {
      setSalvandoContratante(false)
    }
  }

  async function handleToggleRequerCC(ct: Contratante) {
    const res = await fetch(`/api/terceiras/contratantes/${ct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requer_cc: !ct.requer_cc }),
    })
    if (!res.ok) return
    const atualizado: Contratante = await res.json()
    setContratantes(prev => prev.map(c => c.id === ct.id ? atualizado : c))
  }

  async function handleRenomearContratante(ct: Contratante, novoNome: string) {
    const nome = novoNome.trim()
    if (!nome || nome.toUpperCase() === ct.nome) return
    const res = await fetch(`/api/terceiras/contratantes/${ct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    if (!res.ok) { showToast('Erro ao renomear contratante', 'danger'); return }
    const atualizado: Contratante = await res.json()
    setContratantes(prev => prev.map(c => c.id === ct.id ? atualizado : c).sort((a, b) => a.nome.localeCompare(b.nome)))
    setTerceiras(prev => prev.map(t => t.contratante_id === ct.id ? { ...t, contratante: atualizado } : t))
    showToast('✓ Nome atualizado', 'success')
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 40, color: S.textMuted, fontSize: 14 }}>Carregando…</div>
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', border: `1px solid ${S.borderStrong}`, borderRadius: S.radiusSm,
    fontSize: 12, fontFamily: 'inherit', background: S.surface, outline: 'none', color: S.text,
  }
  const selectStyle = inputStyle
  const btnPrimary: React.CSSProperties = {
    background: S.primary, color: '#fff', border: 'none', padding: '7px 13px',
    borderRadius: S.radiusSm, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  }
  const btnSecondary: React.CSSProperties = {
    background: S.surface, color: S.primary, border: `1px solid ${S.primary}`,
    padding: '7px 13px', borderRadius: S.radiusSm, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  }
  const btnSm: React.CSSProperties = { padding: '4px 9px', fontSize: 11 }

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: S.primary, margin: 0 }}>Cadastro de Terceiras</h1>
          <p style={{ fontSize: 12, color: S.textMuted, marginTop: 3 }}>
            Acompanhamento por etapas. Empresas com 100% ou marcadas como "Não evoluiu" vão automaticamente para o histórico.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {podeGerenciarContratantes && (
            <button style={btnSecondary} onClick={() => setModalContratantes(true)}>⚙ Contratantes</button>
          )}
          <button style={btnPrimary} onClick={() => setModalNova(true)}>+ Nova terceira</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `2px solid ${S.border}`, marginBottom: 14 }}>
        {(['ativos', 'historico'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: activeTab === tab ? S.primary : S.textMuted,
            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
            borderBottomWidth: 2, borderBottomStyle: 'solid',
            borderBottomColor: activeTab === tab ? S.primary : 'transparent',
            background: 'none',
            marginBottom: -2, transition: 'all 0.15s', fontFamily: 'inherit',
          }}>
            {tab === 'ativos' ? 'Ativos' : 'Histórico'}
            <span style={{
              display: 'inline-block', marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 11,
              background: activeTab === tab ? S.primaryLight : S.bg,
              color: activeTab === tab ? S.primary : S.textMuted,
            }}>
              {tab === 'ativos' ? ativos.length : arquivados.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Painel Ativos ── */}
      {activeTab === 'ativos' && (
        <>
          {/* Filtros */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, flex: 1, minWidth: 140, maxWidth: 240 }} type="search" placeholder="🔎 Buscar…" value={busca} onChange={e => setBusca(e.target.value)} />
            <select style={selectStyle} value={fContratante} onChange={e => setFContratante(e.target.value)}>
              <option value="">Todos contratantes</option>
              {contratantes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select style={selectStyle} value={fSubcontratante} onChange={e => setFSubcontratante(e.target.value)}>
              <option value="">Todos subcontratantes</option>
              {subsAtivos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={selectStyle} value={fGt0180} onChange={e => setFGt0180(e.target.value)}>
              <option value="">GT0180: todos</option>
              <option value="sob_demanda">Sob demanda</option>
              <option value="mensal">Mensal</option>
            </select>
            <label style={{ fontSize: 11, color: S.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={fSoSub} onChange={e => setFSoSub(e.target.checked)} /> Só subcontratadas
            </label>
            <button onClick={() => setShowEditor(v => !v)}
              style={{ marginLeft: 'auto', height: 30, padding: '0 12px', borderRadius: 6, border: `1px solid ${showEditor ? S.primary : S.border}`, background: showEditor ? S.primaryLight : 'transparent', color: showEditor ? S.primary : S.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              ⚙ Estados
            </button>
          </div>

          {/* Editor de estados por coluna */}
          {showEditor && (() => {
            const allEtapas = GUIAS.flatMap(g => g.etapas)
            const disponiveis: EtapaEstado[] = ['pendente', 'ok', 'na', 'sob_demanda', 'mensal', 'validar', 'validado', 'nao_liberado', 'liberado']
            return (
              <div style={{ background: S.surface, border: `1px solid ${S.primary}33`, borderRadius: S.radius, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: S.primary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Configurar ciclo de estados por coluna
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allEtapas.map(etapa => {
                    const estados = customEstados[etapa.id] ?? etapa.estados
                    const naoUsados = disponiveis.filter(s => !estados.includes(s))
                    return (
                      <div key={etapa.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: S.text, minWidth: 100, flexShrink: 0 }}>{etapa.label}</span>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {estados.map(s => {
                            const info = ESTADOS[s]
                            if (!info) return null
                            return (
                              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: info.bg, color: info.color, border: `1px solid ${info.color}44` }}>
                                {info.ico} {info.label}
                                <button onClick={() => updateCustomEstados(etapa.id, estados.filter(x => x !== s))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: info.color, fontSize: 11, padding: '0 0 0 3px', lineHeight: 1, opacity: 0.7 }}>×</button>
                              </span>
                            )
                          })}
                          {naoUsados.length > 0 && (
                            <select onChange={e => { if (!e.target.value) return; updateCustomEstados(etapa.id, [...estados, e.target.value as EtapaEstado]); e.target.value = '' }}
                              defaultValue=""
                              style={{ fontSize: 11, padding: '3px 6px', border: `1px dashed ${S.border}`, borderRadius: 6, background: S.bg, color: S.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}>
                              <option value="">+ Adicionar</option>
                              {naoUsados.map(s => <option key={s} value={s}>{ESTADOS[s].ico} {ESTADOS[s].label}</option>)}
                            </select>
                          )}
                          {(customEstados[etapa.id] !== undefined) && (
                            <button onClick={() => updateCustomEstados(etapa.id, etapa.estados)}
                              style={{ fontSize: 10, color: S.textMuted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                              Resetar
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Tabela ativos */}
          <TabelaAtivos
            terceiras={ativosFiltrados}
            podeValidarGestor={podeValidarGestor}
            onCycleEtapa={handleCycleEtapa}
            onDescartar={handleDescartarCnpj}
            onUpdateInfo={handleUpdateInfo}
            onOpenDrawer={id => { setSelectedId(id); setDrawerTab('detalhes') }}
          />
        </>
      )}

      {/* ── Painel Histórico ── */}
      {activeTab === 'historico' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            <Kpi label="No período" value={String(histFiltrados.length)} />
            <Kpi label="Evoluíram" value={String(histFiltrados.filter(t => t.status === 'concluido').length)} color={S.ok} />
            <Kpi label="Não evoluíram" value={String(histFiltrados.filter(t => t.status === 'nao_evoluiu').length)} color={S.danger} />
            <Kpi label="Pendentes" value={String(histFiltrados.filter(t => t.status === 'ativo').length)} color={S.pendente} />
          </div>

          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, flex: 1, minWidth: 140, maxWidth: 240 }} type="search" placeholder="🔎 Buscar…" value={hBusca} onChange={e => setHBusca(e.target.value)} />
            <select style={selectStyle} value={hContratante} onChange={e => setHContratante(e.target.value)}>
              <option value="">Todos contratantes</option>
              {contratantes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select style={selectStyle} value={hSubcontratante} onChange={e => setHSubcontratante(e.target.value)}>
              <option value="">Todos subcontratantes</option>
              {subsTodos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={selectStyle} value={hGt0180} onChange={e => setHGt0180(e.target.value)}>
              <option value="">GT0180: todos</option>
              <option value="sob_demanda">Sob demanda</option>
              <option value="mensal">Mensal</option>
            </select>
            <select style={selectStyle} value={hTipo} onChange={e => setHtipo(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="arquivadas">Evoluíram + Não evoluíram</option>
              <option value="concluido">Só Evoluíram</option>
              <option value="nao_evoluiu">Só Não evoluíram</option>
              <option value="ativo">Só Pendentes (ativas)</option>
            </select>
            <label style={{ fontSize: 11, color: S.textMuted }}>De <input type="date" style={{ ...inputStyle, marginLeft: 4 }} value={hDe} onChange={e => setHDe(e.target.value)} /></label>
            <label style={{ fontSize: 11, color: S.textMuted }}>Até <input type="date" style={{ ...inputStyle, marginLeft: 4 }} value={hAte} onChange={e => setHAte(e.target.value)} /></label>
            <label style={{ fontSize: 11, color: S.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={hSoSub} onChange={e => setHSoSub(e.target.checked)} /> Só subcontratadas
            </label>
            <button style={{ ...btnSecondary, ...btnSm }} onClick={() => { setHDe(''); setHAte('') }}>Limpar período</button>
          </div>

          <div style={{ fontSize: 12, color: S.textMuted, marginBottom: 10, fontWeight: 500 }}>
            📅 {(hDe || hAte) ? `Período: ${hDe ? fmtData(hDe) : 'início'} até ${hAte ? fmtData(hAte) : 'hoje'}` : 'Todo o histórico disponível'}
          </div>

          <TabelaHistorico terceiras={histFiltrados} selectedId={selectedId} onSelect={id => { setSelectedId(id); setDrawerTab('detalhes') }} onReativar={handleReativar} />
        </>
      )}

      {/* ── Drawer ── */}
      {selectedId && (
        <>
          <div onClick={() => setSelectedId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 90 }} />
          <aside style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 560, maxWidth: '100%',
            background: S.surface, boxShadow: '0 12px 32px rgba(15,23,42,0.15)', zIndex: 100,
            display: 'flex', flexDirection: 'column',
          }}>
            {selectedTerceira && (
              <DrawerContent
                terceira={selectedTerceira}
                drawerTab={drawerTab}
                setDrawerTab={setDrawerTab}
                podeValidarGestor={podeValidarGestor}
                contratantes={contratantes}
                onClose={() => setSelectedId(null)}
                onUpdateInfo={handleUpdateInfo}
                onCycleEtapa={handleCycleEtapa}
                onReativar={handleReativar}
              />
            )}
          </aside>
        </>
      )}

      {/* ── Modal Confirmar ── */}
      {modalConfirm.open && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalConfirm(p => ({ ...p, open: false })) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 20 }}>
          <div style={{ background: S.surface, borderRadius: S.radius, maxWidth: 480, width: '100%', padding: 20 }}>
            <h3 style={{ fontSize: 16, color: S.danger, marginBottom: 10 }}>⚠ Confirmar arquivamento</h3>
            <div style={{ background: S.dangerBg, border: `1px solid #fca5a5`, color: S.danger, padding: '12px 14px', borderRadius: S.radiusSm, fontSize: 13, lineHeight: 1.55 }}
              dangerouslySetInnerHTML={{ __html: modalConfirm.texto }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, gap: 10 }}>
              <button style={btnSecondary} onClick={() => setModalConfirm(p => ({ ...p, open: false }))}>Cancelar</button>
              <button style={{ ...btnPrimary, background: S.danger }} onClick={modalConfirm.onConfirm}>Sim, arquivar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nova Terceira ── */}
      {modalNova && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalNova(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}>
          <div style={{ background: S.surface, borderRadius: S.radius, maxWidth: 640, width: '100%', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, color: S.primary, marginBottom: 4 }}>Nova terceira</h3>
            <p style={{ fontSize: 12, color: S.textMuted, marginBottom: 14 }}>Cadastre uma terceira para começar o acompanhamento.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
              <ModalField label="Contratante *">
                <select style={{ ...inputStyle, width: '100%' }} value={novaTerceira.contratante_id}
                  onChange={e => setNovaTerceira(p => ({ ...p, contratante_id: e.target.value }))}>
                  <option value="">Selecione…</option>
                  {contratantes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.requer_cc ? ' (requer CC)' : ''}</option>)}
                </select>
              </ModalField>
              <ModalField label="Razão social *">
                <input style={{ ...inputStyle, width: '100%' }} type="text" placeholder="Ex.: EMPRESA LTDA"
                  value={novaTerceira.razao_social} onChange={e => setNovaTerceira(p => ({ ...p, razao_social: e.target.value }))} />
              </ModalField>
              <ModalField label="Contato (opcional)">
                <input style={{ ...inputStyle, width: '100%' }} type="text" placeholder="Nome da pessoa de contato"
                  value={novaTerceira.contato} onChange={e => setNovaTerceira(p => ({ ...p, contato: e.target.value }))} />
              </ModalField>
              <ModalField label="Data">
                <input style={{ ...inputStyle, width: '100%' }} type="date"
                  value={novaTerceira.data} onChange={e => setNovaTerceira(p => ({ ...p, data: e.target.value }))} />
              </ModalField>
              <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                <input type="checkbox" id="nTemSub" checked={novaTerceira.tem_sub}
                  onChange={e => setNovaTerceira(p => ({ ...p, tem_sub: e.target.checked, subcontratante: '' }))} />
                <label htmlFor="nTemSub" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>É uma empresa subcontratada</label>
              </div>
              {novaTerceira.tem_sub && (
                <div style={{ gridColumn: '1/-1' }}>
                  <ModalField label="Nome da empresa que subcontrata *">
                    <input style={{ ...inputStyle, width: '100%' }} type="text" placeholder="Ex.: LDA, Global Prest, Abaservice…"
                      value={novaTerceira.subcontratante} onChange={e => setNovaTerceira(p => ({ ...p, subcontratante: e.target.value }))} />
                  </ModalField>
                </div>
              )}
              <div style={{ gridColumn: '1/-1' }}>
                <ModalField label="Observação (opcional)">
                  <textarea style={{ ...inputStyle, width: '100%', resize: 'vertical', minHeight: 60 }}
                    placeholder="Anotações livres — não conta para o progresso"
                    value={novaTerceira.observacao} onChange={e => setNovaTerceira(p => ({ ...p, observacao: e.target.value }))} />
                </ModalField>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, gap: 10 }}>
              <button style={btnSecondary} onClick={() => setModalNova(false)}>Cancelar</button>
              <button style={btnPrimary} disabled={salvandoNova} onClick={handleCriarTerceira}>
                {salvandoNova ? 'Salvando…' : 'Criar terceira'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Contratantes ── */}
      {modalContratantes && (
        <div onClick={e => { if (e.target === e.currentTarget) { setModalContratantes(false); setModoEdicao(false) } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}>
          <div style={{ background: S.surface, borderRadius: S.radius, maxWidth: 580, width: '100%', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, color: S.primary, marginBottom: 4 }}>Gerenciar contratantes</h3>
            <p style={{ fontSize: 12, color: S.textMuted, marginBottom: 14 }}>
              {modoEdicao ? 'Edite os nomes diretamente. Salvo ao sair do campo.' : 'Marque "Requer CC" para contratantes que precisam da etapa "CC / Notificação".'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
              {contratantes.map(ct => (
                <div key={ct.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${S.border}`, borderRadius: S.radiusSm }}>
                  {modoEdicao ? (
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      defaultValue={ct.nome}
                      onBlur={e => handleRenomearContratante(ct, e.target.value)}
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{ct.nome}</span>
                  )}
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={ct.requer_cc} onChange={() => handleToggleRequerCC(ct)} /> Requer CC
                  </label>
                  {ct.requer_cc && <span style={{ fontSize: 10, background: S.accent, color: '#fff', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>CC</span>}
                </div>
              ))}
            </div>
            {!modoEdicao && (
              <>
                <label style={{ fontSize: 11, fontWeight: 700, color: S.text, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Novo contratante</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px 14px', alignItems: 'center' }}>
                  <input style={{ ...inputStyle, width: '100%' }} type="text" placeholder="Nome do contratante"
                    value={novoContratante.nome} onChange={e => setNovoContratante(p => ({ ...p, nome: e.target.value }))} />
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={novoContratante.requer_cc}
                      onChange={e => setNovoContratante(p => ({ ...p, requer_cc: e.target.checked }))} />
                    Requer CC/Notificação
                  </label>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, gap: 10 }}>
              <button style={btnSecondary} onClick={() => { setModalContratantes(false); setModoEdicao(false) }}>Fechar</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnSecondary} onClick={() => setModoEdicao(p => !p)}>
                  {modoEdicao ? '✓ Concluir edição' : 'Editar'}
                </button>
                {!modoEdicao && (
                  <button style={btnPrimary} disabled={salvandoContratante} onClick={handleAdicionarContratante}>
                    {salvandoContratante ? 'Salvando…' : '+ Adicionar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, padding: '12px 18px', borderRadius: S.radius, fontSize: 13, zIndex: 200,
          boxShadow: '0 12px 32px rgba(15,23,42,0.15)', display: 'flex', alignItems: 'center', gap: 8,
          background: toast.tipo === 'success' ? S.ok : toast.tipo === 'danger' ? S.danger : S.text,
          color: '#fff',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: S.radius, padding: '12px 16px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      <div style={{ fontSize: 10, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2, color: color ?? S.primary }}>{value}</div>
    </div>
  )
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={{ fontSize: 11, color: S.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function ProgBar({ pct, danger }: { pct: number; danger?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
      <div style={{ flex: 1, height: 5, background: S.bg, borderRadius: 3, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 3, background: danger ? `linear-gradient(90deg,${S.danger},${S.pendente})` : `linear-gradient(90deg,${S.primary},${S.accent})`, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: S.textMuted, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

function TabelaAtivos({
  terceiras,
  podeValidarGestor,
  onCycleEtapa,
  onDescartar,
  onUpdateInfo,
  onOpenDrawer,
}: {
  terceiras: Terceira[]
  podeValidarGestor: boolean
  onCycleEtapa: (t: Terceira, e: GuiaEtapa) => void
  onDescartar: (t: Terceira) => void
  onUpdateInfo: (id: string, campo: string, valor: unknown) => void
  onOpenDrawer: (id: string) => void
}) {
  const allEtapas = GUIAS.flatMap(g => g.etapas)
  const SHORT: Record<EtapaId, string> = {
    gt0100: 'GT0100', cc_notif: 'CC/Notif', pasta_rede: 'Pasta',
    gt0180: 'GT0180', cnpj_liberado: 'CNPJ Lib.', gt8005: 'GT8005', email: 'E-mail',
  }

  const [colWidths, setColWidths] = useState<number[]>(() => [
    100, 200, 118, 140,
    ...allEtapas.map(e => e.id === 'gt0180' ? 160 : e.id === 'cnpj_liberado' ? 115 : 74),
    100, 180, 130,
  ])

  const dragging = useRef<{ colIdx: number; startX: number; startW: number } | null>(null)

  function startResize(e: React.MouseEvent, colIdx: number) {
    e.preventDefault()
    dragging.current = { colIdx, startX: e.clientX, startW: colWidths[colIdx] }
    function onMove(ev: MouseEvent) {
      if (!dragging.current) return
      const delta = ev.clientX - dragging.current.startX
      const newW = Math.max(40, dragging.current.startW + delta)
      setColWidths(prev => prev.map((w, i) => i === dragging.current!.colIdx ? newW : w))
    }
    function onUp() {
      dragging.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  type ColDef = { label: string; align: 'left' | 'center' }
  const cols: ColDef[] = [
    { label: 'Contratante', align: 'left' },
    { label: 'Empresa', align: 'left' },
    { label: 'Contato', align: 'left' },
    { label: 'Sub', align: 'left' },
    ...allEtapas.map(e => ({
      label: SHORT[e.id] + (e.reqGestor ? ' 🔒' : ''),
      align: 'center' as const,
    })),
    { label: 'Data', align: 'left' },
    { label: 'Observação', align: 'left' },
    { label: 'CNPJ Descartado', align: 'center' },
  ]

  const thBase: React.CSSProperties = {
    padding: 0, fontSize: 10, fontWeight: 700, color: S.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
    borderBottom: `2px solid ${S.border}`, background: '#f8f9fc', userSelect: 'none',
  }

  const totalWidth = colWidths.reduce((a, b) => a + b, 0)

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', width: totalWidth }}>
          <colgroup>
            {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr>
              {cols.map((col, i) => (
                <th key={i} style={{ ...thBase, textAlign: col.align }}>
                  {/* position:relative em <th> com border-collapse falha no browser; usa div interno */}
                  <div style={{ position: 'relative', padding: '8px 18px 8px 10px', overflow: 'hidden' }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {col.label}
                    </span>
                    <div
                      onMouseDown={e => startResize(e, i)}
                      title="Arraste para redimensionar coluna"
                      style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: 12,
                        cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e => {
                        const bar = e.currentTarget.lastElementChild as HTMLElement
                        if (bar) bar.style.background = S.primary
                      }}
                      onMouseLeave={e => {
                        const bar = e.currentTarget.lastElementChild as HTMLElement
                        if (bar) bar.style.background = '#b0bcd0'
                      }}
                    >
                      <div style={{ width: 3, height: '65%', background: '#b0bcd0', borderRadius: 2, pointerEvents: 'none', transition: 'background 0.1s' }} />
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terceiras.length === 0 ? (
              <tr>
                <td colSpan={cols.length} style={{ padding: '40px', textAlign: 'center', color: S.textMuted }}>
                  Nenhuma terceira encontrada
                </td>
              </tr>
            ) : terceiras.map(t => (
              <TerceiraRow
                key={t.id}
                terceira={t}
                podeValidarGestor={podeValidarGestor}
                allEtapas={allEtapas}
                onCycleEtapa={onCycleEtapa}
                onDescartar={onDescartar}
                onUpdateInfo={onUpdateInfo}
                onOpenDrawer={onOpenDrawer}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TerceiraRow({
  terceira: t,
  podeValidarGestor,
  allEtapas,
  onCycleEtapa,
  onDescartar,
  onUpdateInfo,
  onOpenDrawer,
}: {
  terceira: Terceira
  podeValidarGestor: boolean
  allEtapas: GuiaEtapa[]
  onCycleEtapa: (t: Terceira, e: GuiaEtapa) => void
  onDescartar: (t: Terceira) => void
  onUpdateInfo: (id: string, campo: string, valor: unknown) => void
  onOpenDrawer: (id: string) => void
}) {
  const [contato, setContato] = useState(t.contato ?? '')
  const [temSub, setTemSub] = useState(t.tem_sub)
  const [sub, setSub] = useState(t.subcontratante ?? '')

  useEffect(() => { setContato(t.contato ?? '') }, [t.contato])
  useEffect(() => { setTemSub(t.tem_sub) }, [t.tem_sub])
  useEffect(() => { setSub(t.subcontratante ?? '') }, [t.subcontratante])

  const requerCC = !!t.contratante?.requer_cc
  const prog = calcProgresso(t)
  const tdSt: React.CSSProperties = { padding: '6px 10px', borderBottom: `1px solid ${S.border}`, verticalAlign: 'middle' }
  const inp: React.CSSProperties = {
    width: '100%', padding: '4px 7px', border: `1px solid ${S.border}`, borderRadius: 4,
    fontSize: 12, fontFamily: 'inherit', background: S.surface, outline: 'none', color: S.text,
    boxSizing: 'border-box' as const,
  }

  return (
    <tr
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafbfd' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
    >
      {/* Contratante */}
      <td style={{ ...tdSt, maxWidth: 140 }}>
        <span style={{ background: S.primaryLight, color: S.primary, padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'inline-block', wordBreak: 'break-word', lineHeight: 1.4 }}>
          {t.contratante?.nome ?? '—'}
        </span>
      </td>

      {/* Empresa */}
      <td style={{ ...tdSt, maxWidth: 220 }}>
        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }} title={t.razao_social}>
          {t.razao_social}
        </div>
      </td>

      {/* Contato */}
      <td style={tdSt}>
        <input
          type="text" value={contato} placeholder="—"
          onChange={e => setContato(e.target.value)}
          onBlur={e => { const v = e.target.value.trim() || null; if (v !== t.contato) onUpdateInfo(t.id, 'contato', v) }}
          style={inp}
        />
      </td>

      {/* Sub */}
      <td style={tdSt}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer', marginBottom: temSub ? 4 : 0, whiteSpace: 'nowrap' }}>
          <input
            type="checkbox" checked={temSub}
            onChange={e => {
              const c = e.target.checked
              setTemSub(c)
              onUpdateInfo(t.id, 'tem_sub', c)
              if (!c) { setSub(''); onUpdateInfo(t.id, 'subcontratante', null) }
            }}
          />
          Subcontratada
        </label>
        {temSub && (
          <input
            type="text" value={sub} placeholder="Empresa principal…"
            onChange={e => setSub(e.target.value)}
            onBlur={e => { const v = e.target.value.trim() || null; if (v !== t.subcontratante) onUpdateInfo(t.id, 'subcontratante', v) }}
            style={{ ...inp, fontSize: 11, color: '#92400e' }}
          />
        )}
      </td>

      {/* Etapas */}
      {allEtapas.map(etapa => {
        if (etapa.condicional && !requerCC) {
          return (
            <td key={etapa.id} style={{ ...tdSt, textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: '#d1d5db' }}>N/A</span>
            </td>
          )
        }
        const estado = t.etapas[etapa.id] ?? 'pendente'
        const info = ESTADOS[estado] ?? ESTADOS.pendente
        const aguardaGestor = etapa.reqGestor && !podeValidarGestor && estado === 'validar'
        const showText = etapa.id === 'gt0180' || etapa.id === 'cnpj_liberado'
        return (
          <td key={etapa.id} style={{ ...tdSt, textAlign: 'center' }}>
            <button
              onClick={() => onCycleEtapa(t, etapa)}
              title={`${etapa.label}: ${info.label}${aguardaGestor ? ' — aguardando gestor' : ' — clique para avançar'}`}
              style={{
                padding: showText ? '4px 9px' : '4px 8px', borderRadius: 5, border: `1px solid ${info.color}44`,
                cursor: 'pointer', background: info.bg, color: info.color,
                fontSize: showText ? 11 : 13, fontWeight: 700, fontFamily: 'inherit',
                lineHeight: 1.3, minWidth: 30, opacity: aguardaGestor ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
              }}
            >
              {info.ico}{showText && <span>{info.label}</span>}
            </button>
          </td>
        )
      })}

      {/* Data */}
      <td style={{ ...tdSt, color: S.textMuted, whiteSpace: 'nowrap', fontSize: 11 }}>{fmtData(t.data)}</td>

      {/* Obs / Drawer */}
      <td style={{ ...tdSt, cursor: 'pointer', maxWidth: 0 }} onClick={() => onOpenDrawer(t.id)} title={t.observacao || 'Clique para abrir'}>
        <span style={{
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 11, color: t.observacao ? S.text : S.textMuted,
        }}>
          {t.observacao || '—'}
        </span>
      </td>

      {/* CNPJ Descartado */}
      <td style={{ ...tdSt, textAlign: 'center' }}>
        <button
          onClick={() => onDescartar(t)}
          title="Marcar CNPJ como descartado e arquivar"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
            border: '1.5px solid #fca5a5', background: '#fff5f5', color: '#dc2626',
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <span style={{ width: 13, height: 13, border: '1.5px solid #dc2626', borderRadius: 3, display: 'inline-block', flexShrink: 0 }} />
          Descartar
        </button>
      </td>
    </tr>
  )
}

function TabelaHistorico({ terceiras, selectedId, onSelect, onReativar }: { terceiras: Terceira[]; selectedId: string | null; onSelect: (id: string) => void; onReativar: (id: string) => void }) {
  const btnSm: React.CSSProperties = { padding: '4px 9px', fontSize: 11, background: S.surface, color: S.primary, border: `1px solid ${S.primary}`, borderRadius: S.radiusSm, cursor: 'pointer', fontFamily: 'inherit' }
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f8f9fc' }}>
            <tr>
              {['Contratante', 'Razão social', 'Resultado', 'Progresso', 'Data ref.', 'Ações'].map((h, i) => (
                <th key={h} style={{ textAlign: [2, 5].includes(i) ? 'center' : 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terceiras.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: S.textMuted, fontSize: 13 }}>Nenhum registro encontrado</td></tr>
            ) : terceiras.map(t => {
              const prog = calcProgresso(t)
              const isConcluido = t.status === 'concluido'
              const isNaoEvoluiu = t.status === 'nao_evoluiu'
              const isAtivo = t.status === 'ativo'
              const dataRef = isAtivo ? `Cadastrada em ${fmtData(t.data)}` : `Arquivada em ${fmtDataHora(t.arquivado_em)}`
              const rowBg = isConcluido ? '#f6fdf8' : isNaoEvoluiu ? '#fef9f9' : '#fffbf2'
              return (
                <tr key={t.id} onClick={() => onSelect(t.id)} style={{ cursor: 'pointer', background: t.id === selectedId ? S.primaryLight : rowBg, transition: 'background 0.12s' }}>
                  <td style={{ padding: '9px 12px', borderBottom: `1px solid ${S.border}` }}>
                    <span style={{ background: S.primaryLight, color: S.primary, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{t.contratante?.nome ?? '—'}</span>
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: `1px solid ${S.border}`, maxWidth: 260 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.razao_social}</div>
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: `1px solid ${S.border}`, textAlign: 'center' }}>
                    {isConcluido && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase', background: S.okBg, color: S.ok }}>✓ Evoluiu</span>}
                    {isNaoEvoluiu && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase', background: S.dangerBg, color: S.danger }}>✕ Não evoluiu</span>}
                    {isAtivo && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase', background: S.pendenteBg, color: S.pendente }}>● Pendente</span>}
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: `1px solid ${S.border}` }}><ProgBar pct={prog} danger={isNaoEvoluiu} /></td>
                  <td style={{ padding: '9px 12px', borderBottom: `1px solid ${S.border}`, fontSize: 12, color: S.textMuted, whiteSpace: 'nowrap' }}>{dataRef}</td>
                  <td style={{ padding: '9px 12px', borderBottom: `1px solid ${S.border}`, textAlign: 'center' }}>
                    {(isConcluido || isNaoEvoluiu) && (
                      <button style={btnSm} onClick={e => { e.stopPropagation(); onReativar(t.id) }}>↺ Reativar</button>
                    )}
                    {isAtivo && (
                      <button style={btnSm} onClick={e => { e.stopPropagation(); onSelect(t.id) }}>→ Ver</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DrawerContent({ terceira, drawerTab, setDrawerTab, podeValidarGestor, contratantes, onClose, onUpdateInfo, onCycleEtapa, onReativar }: {
  terceira: Terceira
  drawerTab: 'detalhes' | 'historico'
  setDrawerTab: (t: 'detalhes' | 'historico') => void
  podeValidarGestor: boolean
  contratantes: Contratante[]
  onClose: () => void
  onUpdateInfo: (id: string, campo: string, valor: unknown) => void
  onCycleEtapa: (t: Terceira, e: GuiaEtapa) => void
  onReativar: (id: string) => void
}) {
  const prog = calcProgresso(terceira)
  const isArchived = terceira.status !== 'ativo'
  const requerCC = !!terceira.contratante?.requer_cc

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', border: `1px solid ${S.borderStrong}`, borderRadius: S.radiusSm,
    fontSize: 13, fontFamily: 'inherit', background: isArchived ? S.bg : S.surface, outline: 'none', color: S.text, width: '100%',
  }
  const btnPrimary: React.CSSProperties = { background: S.primary, color: '#fff', border: 'none', padding: '7px 13px', borderRadius: S.radiusSm, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
  const btnSecondary: React.CSSProperties = { background: S.surface, color: S.primary, border: `1px solid ${S.primary}`, padding: '7px 13px', borderRadius: S.radiusSm, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }

  const statusLabel = terceira.status === 'concluido' ? 'Concluído' : terceira.status === 'nao_evoluiu' ? 'Não evoluiu' : prog === 100 ? 'Concluído' : 'Pendente'
  const statusColor = terceira.status === 'concluido' ? S.ok : terceira.status === 'nao_evoluiu' ? S.danger : S.pendente
  const statusBg = terceira.status === 'concluido' ? S.okBg : terceira.status === 'nao_evoluiu' ? S.dangerBg : S.pendenteBg

  return (
    <>
      {/* Head */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, lineHeight: 1.3, wordBreak: 'break-word' }}>{terceira.razao_social}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, fontSize: 12 }}>
            <span style={{ background: S.primaryLight, color: S.primary, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{terceira.contratante?.nome ?? '—'}</span>
            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase', background: statusBg, color: statusColor }}>{statusLabel}</span>
            {terceira.tem_sub && terceira.subcontratante && <span style={{ fontSize: 11, color: '#92400e' }}>⚠ Sub: {terceira.subcontratante}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: S.textMuted, lineHeight: 1, padding: '4px 8px', borderRadius: S.radiusSm }}>×</button>
      </div>

      {/* Drawer tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, padding: '0 20px' }}>
        {(['detalhes', 'historico'] as const).map(tab => (
          <button key={tab} onClick={() => setDrawerTab(tab)} style={{
            padding: '9px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            color: drawerTab === tab ? S.primary : S.textMuted,
            borderBottom: `2px solid ${drawerTab === tab ? S.primary : 'transparent'}`,
            background: 'none', border: 'none', borderBottomWidth: 2, marginBottom: -1, fontFamily: 'inherit',
          }}>
            {tab === 'detalhes' ? 'Detalhes' : 'Histórico de alterações'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {drawerTab === 'historico' ? (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Histórico de alterações</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(terceira.historico ?? []).length === 0 ? (
                <p style={{ fontSize: 12, color: S.textMuted }}>Nenhuma alteração registrada.</p>
              ) : (
                [...(terceira.historico ?? [])].sort((a, b) => b.ts.localeCompare(a.ts)).map(h => (
                  <div key={h.id} style={{ padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: S.radiusSm, background: S.surface, fontSize: 12 }}>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{fmtDataHora(h.ts)}</div>
                    <div style={{ marginTop: 3 }}><span style={{ fontWeight: 600, color: S.primary }}>{h.who}</span> · {h.what}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div style={{ background: S.bg, padding: '12px 14px', borderRadius: S.radius, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: S.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Progresso geral</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: terceira.status === 'nao_evoluiu' ? S.danger : S.primary }}>{prog}%</span>
              </div>
              <div style={{ height: 7, background: S.surface, borderRadius: 4, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${prog}%`, background: terceira.status === 'nao_evoluiu' ? S.danger : `linear-gradient(90deg,${S.primary},${S.accent})`, borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>

            {isArchived && (
              <div style={{ background: S.primaryLight, border: `1px solid #93c5fd`, color: S.primary, padding: '10px 12px', borderRadius: S.radiusSm, fontSize: 12, marginBottom: 16 }}>
                📂 Esta terceira está arquivada ({terceira.status === 'concluido' ? 'concluída' : 'não evoluiu'}). Reative para voltar a editar.
              </div>
            )}

            {/* Info geral */}
            <DrawerSection title="Informações gerais">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                <DrawerField label="Contratante">
                  <select style={inputStyle} disabled={isArchived} value={terceira.contratante_id}
                    onChange={e => onUpdateInfo(terceira.id, 'contratante_id', e.target.value)}>
                    {contratantes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </DrawerField>
                <DrawerField label="Data">
                  <input type="date" style={inputStyle} disabled={isArchived} defaultValue={terceira.data ?? ''}
                    onBlur={e => { if (e.target.value !== terceira.data) onUpdateInfo(terceira.id, 'data', e.target.value) }} />
                </DrawerField>
                <div style={{ gridColumn: '1/-1' }}>
                  <DrawerField label="Razão social">
                    <input type="text" style={inputStyle} disabled={isArchived} defaultValue={terceira.razao_social}
                      onBlur={e => { if (e.target.value.trim().toUpperCase() !== terceira.razao_social) onUpdateInfo(terceira.id, 'razao_social', e.target.value) }} />
                  </DrawerField>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <DrawerField label="Contato (nome da pessoa)">
                    <input type="text" style={inputStyle} disabled={isArchived} defaultValue={terceira.contato ?? ''}
                      placeholder="Opcional"
                      onBlur={e => { if ((e.target.value || null) !== terceira.contato) onUpdateInfo(terceira.id, 'contato', e.target.value) }} />
                  </DrawerField>
                </div>
                <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <input type="checkbox" id="eTemSub" disabled={isArchived} defaultChecked={terceira.tem_sub}
                    onChange={e => onUpdateInfo(terceira.id, 'tem_sub', e.target.checked)} />
                  <label htmlFor="eTemSub" style={{ fontSize: 13, fontWeight: 500 }}>É empresa subcontratada</label>
                </div>
                {terceira.tem_sub && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <DrawerField label="Nome da empresa que subcontrata">
                      <input type="text" style={inputStyle} disabled={isArchived} defaultValue={terceira.subcontratante ?? ''}
                        placeholder="Ex.: LDA, Global Prest…"
                        onBlur={e => { if ((e.target.value || null) !== terceira.subcontratante) onUpdateInfo(terceira.id, 'subcontratante', e.target.value) }} />
                    </DrawerField>
                  </div>
                )}
              </div>
            </DrawerSection>

            {/* Checklist por guia */}
            {GUIAS.map(guia => {
              const etapasGuia = guia.etapas.filter(e => !e.condicional || requerCC)
              if (etapasGuia.length === 0) return null
              return (
                <DrawerSection key={guia.id} title={`Guia ${guia.label}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {etapasGuia.map(etapa => {
                      const estado = terceira.etapas[etapa.id] ?? etapa.estados[0]
                      const info = ESTADOS[estado] ?? ESTADOS.pendente
                      const bloqueada = etapa.reqGestor && !podeValidarGestor && estado === 'validar'
                      return (
                        <div key={etapa.id}
                          onClick={() => !isArchived && onCycleEtapa(terceira, etapa)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                            border: `1px solid ${S.border}`, borderRadius: S.radiusSm,
                            cursor: isArchived ? 'not-allowed' : 'pointer',
                            opacity: isArchived ? 0.7 : 1,
                            background: S.surface, transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { if (!isArchived) { (e.currentTarget as HTMLElement).style.borderColor = S.primary; (e.currentTarget as HTMLElement).style.background = S.primaryLight } }}
                          onMouseLeave={e => { if (!isArchived) { (e.currentTarget as HTMLElement).style.borderColor = S.border; (e.currentTarget as HTMLElement).style.background = S.surface } }}>
                          <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', flexShrink: 0, background: info.bg, color: info.color }}>
                            {info.ico}
                          </span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                            {etapa.label}
                            {etapa.reqGestor && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>🔒 valid. gestor</span>}
                          </span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: info.bg, color: info.color }}>
                            {info.label}
                          </span>
                          {bloqueada && <span style={{ fontSize: 10, color: '#9ca3af' }}>🔒</span>}
                        </div>
                      )
                    })}
                  </div>
                </DrawerSection>
              )
            })}

            {/* Observação */}
            <DrawerSection title="Observação — opcional, não conta para o progresso">
              <textarea
                disabled={isArchived}
                defaultValue={terceira.observacao ?? ''}
                placeholder="Anotações livres sobre esta terceira (alertas, contexto, lembretes…)"
                onBlur={e => { if ((e.target.value || null) !== terceira.observacao) onUpdateInfo(terceira.id, 'observacao', e.target.value) }}
                style={{ width: '100%', padding: '9px 11px', border: `1px solid ${S.borderStrong}`, borderRadius: S.radiusSm, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', minHeight: 70, outline: 'none', background: isArchived ? S.bg : S.surface }} />
            </DrawerSection>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: isArchived ? 'space-between' : 'flex-end', gap: 10, background: '#fafbfd', flexWrap: 'wrap' }}>
        <button style={btnSecondary} onClick={onClose}>Fechar</button>
        {isArchived && <button style={btnPrimary} onClick={() => onReativar(terceira.id)}>↺ Reativar</button>}
      </div>
    </>
  )
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 4 }}>
      <label style={{ fontSize: 11, color: S.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
