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

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
function formatCicloPeriodo(dataInicio: string, dataFim: string | null): string {
  const ini = new Date(dataInicio + 'T12:00:00')
  const iniStr = `${MONTHS_PT[ini.getMonth()]}/${String(ini.getFullYear()).slice(-2)}`
  if (!dataFim) return `${iniStr} - em aberto`
  const fim = new Date(dataFim + 'T12:00:00')
  return `${iniStr} - ${MONTHS_PT[fim.getMonth()]}/${String(fim.getFullYear()).slice(-2)}`
}

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

// Badge compacto: "Tipo 1 - O Reformador (Perfeccionista)" -> "T1 Reformador"
function shortEneagrama(tipo: string): string {
  const m = tipo.match(/Tipo\s*(\d)\s*[-—]\s*(?:O\s+)?([^(]+?)(?:\s*\(|$)/i)
  if (m) return `T${m[1]} ${m[2].trim()}`
  return tipo.replace('Tipo ', 'T')
}

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
                {shortEneagrama(e.tipo)}
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

function StaticPdiCard({ pdi, isGestorAdmin, onArchive, onDelete }: {
  pdi: PdiColaborador
  isGestorAdmin?: boolean
  onArchive?: () => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [working, setWorking] = useState(false)

  const totais = pdi.matrizAvaliacao.totais
  const topAnimal = [...pdi.perfilComportamental.animais].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0))[0] ?? null

  const actions = isGestorAdmin ? (
    <div style={{ padding: '10px 18px 14px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 6, justifyContent: confirmDelete ? 'space-between' : 'flex-end' }}>
      {confirmDelete ? (
        <>
          <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Excluir este PDI?</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #E2E8F0', borderRadius: 6, backgroundColor: '#fff', color: '#475569', cursor: 'pointer' }}>Não</button>
            <button onClick={async () => { setWorking(true); await onDelete?.(); setConfirmDelete(false); setWorking(false) }} style={{ fontSize: 12, padding: '4px 12px', border: 'none', borderRadius: 6, backgroundColor: '#DC2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Sim, excluir</button>
          </div>
        </>
      ) : (
        <>
          <button onClick={async () => { setWorking(true); await onArchive?.(); setWorking(false) }} disabled={working} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: 6, backgroundColor: '#F8FAFC', color: '#475569', cursor: working ? 'not-allowed' : 'pointer', opacity: working ? 0.6 : 1 }}>
            {working ? '…' : '📦 Arquivar'}
          </button>
          <button onClick={() => setConfirmDelete(true)} disabled={working} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #FECACA', borderRadius: 6, backgroundColor: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>🗑️</button>
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
        periodo: pdi.periodo,
        totais: totais.max > 0 ? totais : null,
        eneagramaRanking: pdi.perfilComportamental.eneagrama.ranking,
        topAnimal,
        mbtiTipo: pdi.perfilComportamental.mbti?.tipo ?? null,
      }}
    />
  )
}

type CicloScores = { avaliacao_diretiva: number[]; autoavaliacao: number[]; ambicao: number[]; status: string; data_inicio: string | null; data_fim: string | null }
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
  const periodo = scores?.data_inicio
    ? formatCicloPeriodo(scores.data_inicio, scores.data_fim ?? null)
    : null

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

// ── Avaliações agregadas — data-driven ───────────────────────────────────────

type CicloAgregado = {
  key?: string
  numero: number
  data_inicio: string | null
  data_fim: string | null
  competencias: string[]
  pessoas: { nome: string; diretiva: number[]; auto: number[]; ambicao: number[] }[]
}

function scoreColor(v: number): string {
  if (!v) return '#D1D5DB'
  if (v <= 1) return '#EF4444'
  if (v <= 2) return '#F97316'
  if (v <= 3) return '#EAB308'
  if (v <= 4) return '#22C55E'
  return '#16A34A'
}

function CicloAgregadoCard({ ciclo }: { ciclo: CicloAgregado }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'diretiva' | 'auto' | 'ambicao'>('diretiva')

  const tabLabel = { diretiva: 'Avaliação Diretiva', auto: 'Autoavaliação', ambicao: 'Ambição' }
  const tabColor = { diretiva: '#2A4F96', auto: '#D1AE6E', ambicao: '#16A34A' }
  const max = ciclo.competencias.length * 5

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
          padding: '14px 20px', cursor: 'pointer', userSelect: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '4px solid #2A4F96',
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>
            {ciclo.data_inicio ? formatCicloPeriodo(ciclo.data_inicio, ciclo.data_fim) : `Ciclo ${ciclo.numero}`}
          </div>
          <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>
            {ciclo.pessoas.length} colaboradores · {ciclo.competencias.length} competências
          </div>
        </div>
        <span style={{ fontSize: 18, color: '#6B7A99', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </div>

      {open && (
        <div style={{ marginTop: 8, background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            {(['diretiva', 'auto', 'ambicao'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`gt3-tab${tab === t ? ' gt3-tab-active' : ''}`}
                style={{
                  padding: '10px 20px', border: 'none', background: 'transparent',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  color: tab === t ? tabColor[t] : '#94A3B8',
                  borderBottom: '2px solid transparent',
                  transition: 'color 200ms var(--ease-gt3)',
                  ['--tab-active-color' as string]: tabColor[t],
                } as React.CSSProperties}>
                {tabLabel[t]}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto', padding: '16px' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(to bottom, #FAFCFE, #F5F8FC)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-mute)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.9px', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border-soft)' }}>
                    Colaborador
                  </th>
                  {ciclo.competencias.map(c => (
                    <th key={c} style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--text-mute)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.9px', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border-soft)' }}>
                      {c}
                    </th>
                  ))}
                  <th style={{ padding: '8px 12px', textAlign: 'center', color: '#1E293B', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.9px', borderBottom: '2px solid var(--border-soft)', whiteSpace: 'nowrap' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {ciclo.pessoas.map((p, pi) => {
                  const scores = p[tab]
                  const total = scores.reduce((a, b) => a + b, 0)
                  const hasData = scores.length > 0
                  return (
                    <tr key={p.nome} style={{ borderBottom: pi < ciclo.pessoas.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>{p.nome}</td>
                      {ciclo.competencias.map((_, ci) => {
                        const v = scores[ci]
                        return (
                          <td key={ci} style={{ padding: '9px 6px', textAlign: 'center' }}>
                            {hasData && v != null ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 26, height: 26, borderRadius: 6,
                                background: `${scoreColor(v)}22`, color: scoreColor(v),
                                fontWeight: 700, fontSize: 13,
                              }}>
                                {v}
                              </span>
                            ) : <span style={{ color: '#D1D5DB' }}>—</span>}
                          </td>
                        )
                      })}
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        {hasData ? (
                          <span style={{ fontWeight: 700, fontSize: 13, color: tabColor[tab] }}>
                            {total}<span style={{ fontSize: 10, fontWeight: 400, color: '#94A3B8', marginLeft: 2 }}>/{max}</span>
                          </span>
                        ) : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function AvaliacoesAgregadasView() {
  const [ciclos, setCiclos] = useState<CicloAgregado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pdi/avaliacoes-agregadas')
      .then(r => r.ok ? r.json() : [])
      .then((data: CicloAgregado[]) => { setCiclos(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>Carregando avaliações…</div>
  )

  if (!ciclos.length) return (
    <div style={{ padding: '20px 0', color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>
      Nenhum dado de avaliação encontrado.
    </div>
  )

  return (
    <div style={{ marginBottom: 20 }}>
      {ciclos.map(c => <CicloAgregadoCard key={c.key ?? c.numero} ciclo={c} />)}
    </div>
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

  const [showAvaliacoes, setShowAvaliacoes] = useState(false)
  const [modal, setModal] = useState<ModalState>(MODAL_INIT)
  const [editModal, setEditModal] = useState<EditModalState>(EDIT_INIT)
  const [colabs, setColabs] = useState<Colab[]>([])
  const [localDbPdis, setLocalDbPdis] = useState<DbPdi[]>(dbPdis)
  const [deletedStaticIds, setDeletedStaticIds] = useState<Set<string>>(new Set())

  // Slugs estáticos que já foram migrados para o banco — não mostrar o card estático duplicado
  const migratedSlugs = new Set(
    localDbPdis.map(p => p.conclusoes?._original_slug).filter(Boolean) as string[]
  )
  const sorted = [...staticPdis]
    .filter(p => !migratedSlugs.has(p.id) && !deletedStaticIds.has(p.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [agendaBadge, setAgendaBadge] = useState(0)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (isGestorAdmin && searchParams.get('agenda') === '1') setAgendaOpen(true)
  }, [isGestorAdmin, searchParams])

  const activeDbPdis = localDbPdis.filter(p => p.status !== 'arquivado')
  const archivedDbPdis = [...localDbPdis.filter(p => p.status === 'arquivado')]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const allActive: ({ type: 'static'; pdi: PdiColaborador } | { type: 'db'; pdi: DbPdi })[] = [
    ...sorted.map(p => ({ type: 'static' as const, pdi: p })),
    ...activeDbPdis.map(p => ({ type: 'db' as const, pdi: p })),
  ].sort((a, b) => a.pdi.nome.localeCompare(b.pdi.nome, 'pt-BR'))
  const totalCount = allActive.length + archivedDbPdis.length

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

  async function handleArchiveStatic(staticPdi: PdiColaborador) {
    const res = await fetch('/api/pdi/migrar-estatico', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staticId: staticPdi.id, nome: staticPdi.nome, funcao: staticPdi.funcao }),
    })
    if (!res.ok) return
    const { id: newId } = await res.json() as { id: string }
    await fetch(`/api/pdi/${newId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'arquivado' }),
    })
    setLocalDbPdis(prev => [...prev, {
      id: newId, nome: staticPdi.nome, funcao: staticPdi.funcao,
      data_inicio: null, colaborador_id: null, created_at: new Date().toISOString(),
      status: 'arquivado',
      conclusoes: { _original_slug: staticPdi.id },
      eneagrama: staticPdi.perfilComportamental.eneagrama.ranking.length > 0
        ? { ranking: staticPdi.perfilComportamental.eneagrama.ranking } : null,
      animais: staticPdi.perfilComportamental.animais.length > 0
        ? staticPdi.perfilComportamental.animais : null,
    }])
  }

  async function handleDeleteStatic(staticPdi: PdiColaborador) {
    const res = await fetch('/api/pdi/migrar-estatico', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staticId: staticPdi.id, nome: staticPdi.nome, funcao: staticPdi.funcao }),
    })
    if (!res.ok) return
    const { id: newId } = await res.json() as { id: string }
    await fetch(`/api/pdi/${newId}`, { method: 'DELETE' })
    setDeletedStaticIds(prev => new Set([...prev, staticPdi.id]))
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {/* Toggle Avaliações */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: showAvaliacoes ? '#2A4F96' : '#94A3B8' }}>Avaliações</span>
              <div
                onClick={() => setShowAvaliacoes(v => !v)}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: showAvaliacoes ? '#2A4F96' : '#D1D5DB',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: showAvaliacoes ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                }} />
              </div>
            </label>
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

      {isGestorAdmin && showAvaliacoes && <AvaliacoesAgregadasView />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {allActive.map(item => item.type === 'static'
          ? <StaticPdiCard
              key={item.pdi.id} pdi={item.pdi}
              isGestorAdmin={isGestorAdmin}
              onArchive={() => handleArchiveStatic(item.pdi)}
              onDelete={() => handleDeleteStatic(item.pdi)}
            />
          : (
            <DbPdiCard
              key={item.pdi.id} pdi={item.pdi} initialScores={ciclosByPdi.get(item.pdi.id) ?? null} isGestorAdmin={isGestorAdmin}
              onEdit={() => setEditModal({ open: true, pdiId: item.pdi.id, nome: item.pdi.nome, funcao: item.pdi.funcao, saving: false, error: '' })}
              onArchive={() => handleArchive(item.pdi)}
              onDelete={() => handleDelete(item.pdi.id)}
            />
          )
        )}
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
        <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="gt3-drop-in" style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
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
        <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="gt3-drop-in" style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 440 }}>
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
