'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as allPdis from '../../data/pdis/index'
import type { PdiColaborador } from '../../data/pdis/types'
import type { DbPdi, DbCicloScore } from './page'
import PdiAgendaDrawer from './PdiAgendaDrawer'

const staticPdis = Object.values(allPdis) as PdiColaborador[]

type Colab = { id: string; nome: string; papel: string; pdi_slug: string | null }

type ModalState = {
  open: boolean
  colaborador_id: string
  nome: string
  funcao: string
  data_inicio: string
  observacao: string
  saving: boolean
  error: string
}

type EditModalState = {
  open: boolean
  pdiId: string
  nome: string
  funcao: string
  saving: boolean
  error: string
}

const today = new Date().toISOString().split('T')[0]

const MODAL_INIT: ModalState = {
  open: false, colaborador_id: '', nome: '', funcao: '',
  data_inicio: today, observacao: '', saving: false, error: '',
}

const EDIT_INIT: EditModalState = {
  open: false, pdiId: '', nome: '', funcao: '', saving: false, error: '',
}

function avatarInitials(nome: string) {
  const parts = nome.trim().split(' ')
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')
}

function progresso(pdi: PdiColaborador) {
  const total = pdi.planoDeAcao.length
  if (!total) return { pct: 0, concluidos: 0, total: 0 }
  const concluidos = pdi.planoDeAcao.filter(a => a.status === 'Concluído').length
  return { pct: Math.round((concluidos / total) * 100), concluidos, total }
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7A99', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: '#1E293B' }}>{value}/{max}</span>
      </div>
      <div style={{ height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

// ── Card unificado ────────────────────────────────────────────────────────────

type PdiCardData = {
  nome: string
  funcao: string
  periodo?: string | null
  totais?: { diretiva: number; auto: number; ambicao: number; max: number } | null
  eneagramaRanking: { rank: number; tipo: string; pontuacao: string }[]
  topAnimal?: { emoji: string; animal: string; percentual?: number } | null
  mbtiTipo?: string | null
  isArchived?: boolean
}

function PdiCardInner({ data, href, footer }: { data: PdiCardData; href: string; footer?: React.ReactNode }) {
  const { nome, funcao, periodo, totais, eneagramaRanking, topAnimal, mbtiTipo, isArchived } = data
  const hasScores = !!totais && totais.max > 0 && (totais.diretiva > 0 || totais.auto > 0 || totais.ambicao > 0)

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #E2E8F0', overflow: 'hidden', opacity: isArchived ? 0.75 : 1, transition: 'box-shadow 0.15s, transform 0.15s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 4px 16px rgba(42,79,150,0.13)'; el.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'; el.style.transform = 'translateY(0)' }}
    >
      <div style={{ height: 3, backgroundColor: isArchived ? '#94A3B8' : '#D1AE6E' }} />
      <Link href={href} style={{ textDecoration: 'none', display: 'block', padding: '16px 18px 14px' }}>
        {/* Avatar + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: isArchived ? '#94A3B8' : '#1E3A6E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1AE6E', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {avatarInitials(nome).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}</div>
            <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>{funcao || 'Função não informada'}</div>
          </div>
        </div>

        {/* Período */}
        {periodo && (
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>📅</span><span>{periodo}</span>
          </div>
        )}

        {/* Scores */}
        {hasScores ? (
          <div style={{ marginBottom: 12 }}>
            <ScoreBar label="Avaliação diretiva" value={totais!.diretiva} max={totais!.max} color="#2A4F96" />
            <ScoreBar label="Autoavaliação"       value={totais!.auto}     max={totais!.max} color="#D1AE6E" />
            <ScoreBar label="Ambição realista"    value={totais!.ambicao}  max={totais!.max} color="#16A34A" />
          </div>
        ) : !periodo && !eneagramaRanking.length && !topAnimal ? (
          <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
            Dados pendentes de preenchimento
          </div>
        ) : null}

        {/* Eneagrama */}
        {eneagramaRanking.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
            {eneagramaRanking.slice(0, 3).map((e, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, backgroundColor: i === 0 ? '#FEF3C7' : i === 1 ? '#EBF4FF' : '#F0FFF4', color: i === 0 ? '#92400E' : i === 1 ? '#1E40AF' : '#166534' }}>
                {e.tipo.replace('Tipo ', 'T')}
              </span>
            ))}
          </div>
        )}

        {/* Animal + MBTI */}
        {(topAnimal || mbtiTipo) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {topAnimal && (
              <span style={{ fontSize: 11, color: '#475569' }}>
                {topAnimal.emoji} {topAnimal.animal}{topAnimal.percentual ? ` ${topAnimal.percentual}%` : ''}
              </span>
            )}
            {mbtiTipo && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, backgroundColor: '#1E3A6E', color: '#D1AE6E', letterSpacing: '0.05em' }}>
                {mbtiTipo}
              </span>
            )}
          </div>
        )}
      </Link>
      {footer}
    </div>
  )
}

function StaticPdiCard({ pdi }: { pdi: PdiColaborador }) {
  const totais = pdi.matrizAvaliacao.totais
  const topAnimal = [...pdi.perfilComportamental.animais].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0))[0] ?? null
  return (
    <PdiCardInner
      href={`/pdi/${pdi.id}`}
      data={{
        nome: pdi.nome,
        funcao: pdi.funcao,
        periodo: pdi.periodo,
        totais: totais.max > 0 ? totais : null,
        eneagramaRanking: pdi.perfilComportamental.eneagrama.ranking,
        topAnimal,
        mbtiTipo: pdi.perfilComportamental.mbti?.tipo ?? null,
      }}
    />
  )
}

type CicloScores = { avaliacao_diretiva: number[]; autoavaliacao: number[]; ambicao: number[]; status: string }
type CardExtra = { eneagrama: DbPdi['eneagrama']; animais: DbPdi['animais']; conclusoes: DbPdi['conclusoes'] }

function DbPdiCard({ pdi, initialScores, isGestorAdmin, onEdit, onArchive, onDelete }: {
  pdi: DbPdi
  initialScores: CicloScores | null
  isGestorAdmin: boolean
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [scores, setScores] = useState<CicloScores | null>(initialScores)
  const [extra, setExtra] = useState<CardExtra>({ eneagrama: pdi.eneagrama, animais: pdi.animais, conclusoes: pdi.conclusoes })
  const isArchived = pdi.status === 'arquivado'

  // Só refaz fetch quando a janela volta ao foco (para reflectir edições recentes)
  useEffect(() => {
    let cancelled = false

    function doFetch() {
      Promise.all([
        fetch(`/api/pdi/${pdi.id}/ciclos`).then(r => r.ok ? r.json() : []),
        fetch(`/api/pdi/${pdi.id}`).then(r => r.ok ? r.json() : null),
      ]).then(([ciclos, extraData]: [CicloScores[], CardExtra | null]) => {
        if (cancelled) return
        const comDados = (ciclos as CicloScores[]).filter(c => c.avaliacao_diretiva?.length > 0)
        const c = comDados.find(c => c.status === 'ativo') ?? comDados[0] ?? (ciclos as CicloScores[]).find(c => c.status === 'ativo') ?? ciclos[0]
        if (c) setScores(c as CicloScores)
        if (extraData) setExtra(extraData as CardExtra)
      }).catch(() => {})
    }

    window.addEventListener('focus', doFetch)
    return () => {
      cancelled = true
      window.removeEventListener('focus', doFetch)
    }
  }, [pdi.id])

  const totais = scores && scores.avaliacao_diretiva.length > 0 ? {
    diretiva: scores.avaliacao_diretiva.reduce((s, v) => s + v, 0),
    auto:     scores.autoavaliacao.reduce((s, v) => s + v, 0),
    ambicao:  scores.ambicao.reduce((s, v) => s + v, 0),
    max:      scores.avaliacao_diretiva.length * 5,
  } : null

  const topAnimal = [...(extra.animais ?? [])].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0))[0] ?? null
  const periodo = pdi.data_inicio ? new Date(pdi.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : null

  const actions = isGestorAdmin ? (
    <div style={{ padding: '10px 18px 14px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 6, justifyContent: confirmDelete ? 'space-between' : 'flex-end' }}>
      {confirmDelete ? (
        <>
          <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Excluir este PDI?</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #E2E8F0', borderRadius: 6, backgroundColor: '#fff', color: '#475569', cursor: 'pointer' }}>Não</button>
            <button onClick={() => { onDelete(); setConfirmDelete(false) }} style={{ fontSize: 12, padding: '4px 12px', border: 'none', borderRadius: 6, backgroundColor: '#DC2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Sim, excluir</button>
          </div>
        </>
      ) : (
        <>
          <button onClick={onEdit} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: 6, backgroundColor: '#F8FAFC', color: '#475569', cursor: 'pointer' }}>✏️ Editar</button>
          <button onClick={onArchive} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: 6, backgroundColor: '#F8FAFC', color: '#475569', cursor: 'pointer' }}>{isArchived ? '📂 Reativar' : '📦 Arquivar'}</button>
          <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #FECACA', borderRadius: 6, backgroundColor: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>🗑️</button>
        </>
      )}
    </div>
  ) : null

  return (
    <PdiCardInner
      href={`/pdi/${pdi.id}`}
      footer={actions}
      data={{
        nome: pdi.nome,
        funcao: pdi.funcao,
        periodo,
        totais,
        eneagramaRanking: extra.eneagrama?.ranking ?? [],
        topAnimal,
        mbtiTipo: extra.conclusoes?._mbti_tipo ?? null,
        isArchived,
      }}
    />
  )
}

export default function PdiListClient({ dbPdis, ciclosScores, papel }: { dbPdis: DbPdi[]; ciclosScores: DbCicloScore[]; papel: string }) {
  const isGestorAdmin = ['gestor', 'admin'].includes(papel)

  // Mapeia pdi_id → melhor ciclo com score (pré-buscado server-side)
  const ciclosByPdi = new Map<string, CicloScores>()
  for (const c of ciclosScores) {
    if (!c.avaliacao_diretiva?.length) continue
    const existing = ciclosByPdi.get(c.pdi_id)
    if (!existing || c.status === 'ativo') ciclosByPdi.set(c.pdi_id, c as CicloScores)
  }

  const [modal, setModal] = useState<ModalState>(MODAL_INIT)
  const [editModal, setEditModal] = useState<EditModalState>(EDIT_INIT)
  const [colabs, setColabs] = useState<Colab[]>([])
  const [localDbPdis, setLocalDbPdis] = useState<DbPdi[]>(dbPdis)

  // Slugs estáticos que já foram migrados para o banco — não mostrar o card estático duplicado
  const migratedSlugs = new Set(
    localDbPdis.map(p => p.conclusoes?._original_slug).filter(Boolean) as string[]
  )
  const sorted = [...staticPdis]
    .filter(p => !migratedSlugs.has(p.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [agendaBadge, setAgendaBadge] = useState(0)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (isGestorAdmin && searchParams.get('agenda') === '1') setAgendaOpen(true)
  }, [isGestorAdmin, searchParams])

  const activeDbPdis = localDbPdis.filter(p => p.status !== 'arquivado')
  const archivedDbPdis = localDbPdis.filter(p => p.status === 'arquivado')
  const totalCount = sorted.length + activeDbPdis.length + archivedDbPdis.length

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8,
    fontSize: 13, color: '#1E293B', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7A99',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5,
  }

  async function openModal() {
    setModal({ ...MODAL_INIT, open: true })
    if (colabs.length === 0) {
      try {
        const res = await fetch('/api/pdi/colaboradores')
        if (res.ok) setColabs(await res.json())
      } catch { /* noop */ }
    }
  }

  function handleColabChange(id: string) {
    const colab = colabs.find(c => c.id === id)
    setModal(m => ({ ...m, colaborador_id: id, nome: colab?.nome ?? m.nome }))
  }

  async function handleCreate() {
    if (!modal.colaborador_id || !modal.nome.trim()) {
      setModal(m => ({ ...m, error: 'Selecione o colaborador e informe o nome.' }))
      return
    }
    setModal(m => ({ ...m, saving: true, error: '' }))
    try {
      const res = await fetch('/api/pdi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaborador_id: modal.colaborador_id,
          nome: modal.nome,
          funcao: modal.funcao,
          data_inicio: modal.data_inicio || undefined,
          observacao: modal.observacao,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setModal(m => ({ ...m, saving: false, error: body.error ?? 'Erro ao criar PDI.' }))
        return
      }
      const created = await res.json() as DbPdi
      setLocalDbPdis(prev => [...prev, created])
      setModal(MODAL_INIT)
    } catch {
      setModal(m => ({ ...m, saving: false, error: 'Erro ao criar PDI.' }))
    }
  }

  async function handleEdit() {
    if (!editModal.nome.trim()) return
    setEditModal(m => ({ ...m, saving: true, error: '' }))
    try {
      const res = await fetch(`/api/pdi/${editModal.pdiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editModal.nome.trim(), funcao: editModal.funcao.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setEditModal(m => ({ ...m, saving: false, error: body.error ?? 'Erro ao salvar.' }))
        return
      }
      setLocalDbPdis(prev => prev.map(p => p.id === editModal.pdiId ? { ...p, nome: editModal.nome.trim(), funcao: editModal.funcao.trim() } : p))
      setEditModal(EDIT_INIT)
    } catch {
      setEditModal(m => ({ ...m, saving: false, error: 'Erro ao salvar.' }))
    }
  }

  async function handleArchive(pdi: DbPdi) {
    const newStatus = pdi.status === 'arquivado' ? 'ativo' : 'arquivado'
    const res = await fetch(`/api/pdi/${pdi.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) setLocalDbPdis(prev => prev.map(p => p.id === pdi.id ? { ...p, status: newStatus } : p))
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/pdi/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) setLocalDbPdis(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1E293B' }}>PDI</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7A99' }}>
            {totalCount} colaborador{totalCount !== 1 ? 'es' : ''} com plano de desenvolvimento individual
          </p>
        </div>
        {isGestorAdmin && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setAgendaOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', backgroundColor: '#fff', color: '#2A4F96',
                border: '1px solid #2A4F96', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#EBF0FB' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
            >
              📅 Agenda PDI{agendaBadge > 0 ? ` (${agendaBadge})` : ''}
            </button>
            <button
              onClick={openModal}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', backgroundColor: '#2A4F96', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A6E' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A4F96' }}
            >
              ＋ Novo PDI
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {sorted.map(pdi => <StaticPdiCard key={pdi.id} pdi={pdi} />)}
        {activeDbPdis.map(pdi => (
          <DbPdiCard
            key={pdi.id} pdi={pdi} initialScores={ciclosByPdi.get(pdi.id) ?? null} isGestorAdmin={isGestorAdmin}
            onEdit={() => setEditModal({ open: true, pdiId: pdi.id, nome: pdi.nome, funcao: pdi.funcao, saving: false, error: '' })}
            onArchive={() => handleArchive(pdi)}
            onDelete={() => handleDelete(pdi.id)}
          />
        ))}
      </div>

      {archivedDbPdis.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Arquivados</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {archivedDbPdis.map(pdi => (
              <DbPdiCard
                key={pdi.id} pdi={pdi} initialScores={ciclosByPdi.get(pdi.id) ?? null} isGestorAdmin={isGestorAdmin}
                onEdit={() => setEditModal({ open: true, pdiId: pdi.id, nome: pdi.nome, funcao: pdi.funcao, saving: false, error: '' })}
                onArchive={() => handleArchive(pdi)}
                onDelete={() => handleDelete(pdi.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #2A4F96 0%, #1E3A6E 100%)', padding: '18px 24px', borderRadius: '16px 16px 0 0' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>＋ Novo PDI</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Plano de Desenvolvimento Individual</p>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {modal.error && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>
                  {modal.error}
                </div>
              )}

              <div>
                <label style={labelStyle}>Colaborador *</label>
                <select
                  value={modal.colaborador_id}
                  onChange={e => handleColabChange(e.target.value)}
                  style={{ ...inputStyle, backgroundColor: '#fff', cursor: 'pointer' }}
                >
                  <option value="">Selecione um colaborador...</option>
                  {colabs.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome}{c.pdi_slug ? ' (já tem PDI)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Nome completo *</label>
                <input
                  type="text"
                  value={modal.nome}
                  onChange={e => setModal(m => ({ ...m, nome: e.target.value }))}
                  placeholder="Nome do colaborador no PDI"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Cargo / Função</label>
                <input
                  type="text"
                  value={modal.funcao}
                  onChange={e => setModal(m => ({ ...m, funcao: e.target.value }))}
                  placeholder="Ex: Analista de Segurança"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Data de início</label>
                <input
                  type="date"
                  value={modal.data_inicio}
                  onChange={e => setModal(m => ({ ...m, data_inicio: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Observação inicial (opcional)</label>
                <textarea
                  value={modal.observacao}
                  onChange={e => setModal(m => ({ ...m, observacao: e.target.value }))}
                  placeholder="Contexto, objetivos ou notas iniciais..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' as const }}
                />
              </div>
            </div>

            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setModal(MODAL_INIT)}
                disabled={modal.saving}
                style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: 8, backgroundColor: '#fff', fontSize: 13, color: '#475569', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={modal.saving || !modal.colaborador_id || !modal.nome.trim()}
                style={{
                  padding: '9px 22px', border: 'none', borderRadius: 8,
                  backgroundColor: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: modal.saving ? 'not-allowed' : 'pointer',
                  opacity: (modal.saving || !modal.colaborador_id || !modal.nome.trim()) ? 0.6 : 1,
                }}
              >
                {modal.saving ? 'Criando…' : 'Criar PDI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agenda Drawer */}
      {isGestorAdmin && (
        <PdiAgendaDrawer
          open={agendaOpen}
          onClose={() => setAgendaOpen(false)}
          onCountChange={setAgendaBadge}
        />
      )}

      {/* Edit Modal */}
      {editModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 440 }}>
            <div style={{ background: 'linear-gradient(135deg, #2A4F96 0%, #1E3A6E 100%)', padding: '18px 24px', borderRadius: '16px 16px 0 0' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>✏️ Editar PDI</h2>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {editModal.error && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>{editModal.error}</div>
              )}
              <div>
                <label style={labelStyle}>Nome completo *</label>
                <input type="text" value={editModal.nome} onChange={e => setEditModal(m => ({ ...m, nome: e.target.value }))} placeholder="Nome" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Cargo / Função</label>
                <input type="text" value={editModal.funcao} onChange={e => setEditModal(m => ({ ...m, funcao: e.target.value }))} placeholder="Ex: Analista de Segurança" style={inputStyle} />
              </div>
            </div>
            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setEditModal(EDIT_INIT)} disabled={editModal.saving} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: 8, backgroundColor: '#fff', fontSize: 13, color: '#475569', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleEdit} disabled={editModal.saving || !editModal.nome.trim()} style={{ padding: '9px 22px', border: 'none', borderRadius: 8, backgroundColor: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: editModal.saving ? 'not-allowed' : 'pointer', opacity: (editModal.saving || !editModal.nome.trim()) ? 0.6 : 1 }}>
                {editModal.saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
