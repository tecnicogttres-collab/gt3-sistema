'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { PdiColaborador, AcaoPdi } from '../../../data/pdis/types'

type Tab = 'acoes' | 'avaliacoes' | 'eneagrama' | 'mbti' | 'conclusoes'

type Ciclo = {
  id: string
  pdi_id: string
  colaborador_id: string
  numero_ciclo: number
  status: 'ativo' | 'arquivado'
  avaliacao_diretiva: number[]
  autoavaliacao: number[]
  ambicao: number[]
  autoavaliacao_salva: boolean
  data_conversa: string | null
  conversa_confirmada_em: string | null
  criado_em: string
  arquivado_em: string | null
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'acoes', label: 'Plano de Ações' },
  { id: 'avaliacoes', label: 'Avaliações' },
  { id: 'eneagrama', label: 'Eneagrama' },
  { id: 'mbti', label: 'MBTI' },
  { id: 'conclusoes', label: 'Conclusões' },
]

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'Concluído':    { bg: '#F0FFF4', color: '#166534' },
  'Em evolução':  { bg: '#FFFBEB', color: '#92400E' },
  'Em andamento': { bg: '#EBF4FF', color: '#1E40AF' },
  'Não iniciado': { bg: '#F8FAFC', color: '#64748B' },
}

const STATUS_OPTIONS = ['Não iniciado', 'Em andamento', 'Em evolução', 'Concluído']

const COMP_SHORT: Record<string, string> = {
  'Relacionamento Interpessoal': 'Rel. Interpessoal',
  'Inteligência Emocional no Trabalho': 'Int. Emocional',
  'Inteligência Emocional': 'Int. Emocional',
  'Cadastro e itens relacionados': 'Cadastro',
  'Atendimento ao cliente': 'Atend. Cliente',
  'PGR/PCMSO/LTCAT': 'PGR/PCMSO',
}

function shorten(s: string) { return COMP_SHORT[s] || s }

function avatarInitials(nome: string) {
  const p = nome.trim().split(' ')
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? p[0]?.[1] ?? '')).toUpperCase()
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}

// ── Types ─────────────────────────────────────────────────────────────

type DbAcao = {
  id: string
  pdi_id: string
  competencia: string
  desenvolver: string
  acoes: string
  resultados_esperados: string
  inicio: string
  termino: string
  status: string
  concluido_em: string | null
  created_at: string
}

type AcaoDisplay = {
  id: string | null
  source: 'db' | 'static'
  competencia: string
  desenvolver: string
  acoes: string
  resultadosEsperados: string
  inicio: string
  termino: string
  status: string
  concluido_em: string | null
}

type FormState = {
  competencia: string
  desenvolver: string
  acoes: string
  resultadosEsperados: string
  inicio: string
  termino: string
  status: string
}

const EMPTY_FORM: FormState = {
  competencia: '', desenvolver: '', acoes: '',
  resultadosEsperados: '', inicio: '', termino: '', status: 'Não iniciado',
}

// ── AcoesTab ──────────────────────────────────────────────────────────

function AcoesTab({ pdi, canEdit }: { pdi: PdiColaborador; canEdit: boolean }) {
  const [acoes, setAcoes] = useState<AcaoDisplay[]>([])
  const [loadingAcoes, setLoadingAcoes] = useState(true)
  const [modal, setModal] = useState<{
    open: boolean; mode: 'create' | 'edit'
    editingId: string | null; form: FormState; saving: boolean
  }>({ open: false, mode: 'create', editingId: null, form: EMPTY_FORM, saving: false })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  function dbToDisplay(a: DbAcao): AcaoDisplay {
    return {
      id: a.id, source: 'db',
      competencia: a.competencia, desenvolver: a.desenvolver, acoes: a.acoes,
      resultadosEsperados: a.resultados_esperados,
      inicio: a.inicio, termino: a.termino, status: a.status, concluido_em: a.concluido_em,
    }
  }

  function staticToDisplay(a: AcaoPdi): AcaoDisplay {
    return {
      id: null, source: 'static',
      competencia: a.competencia, desenvolver: a.desenvolver, acoes: a.acoes,
      resultadosEsperados: a.resultadosEsperados,
      inicio: a.inicio, termino: a.termino, status: a.status, concluido_em: null,
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch(`/api/pdi/${pdi.id}/acoes`)
        if (!r.ok) throw new Error('fetch failed')
        const db: DbAcao[] = await r.json()
        if (cancelled) return

        if (db.length === 0 && canEdit && pdi.planoDeAcao.length > 0) {
          const seedRes = await fetch(`/api/pdi/${pdi.id}/acoes/seed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acoes: pdi.planoDeAcao }),
          })
          if (!seedRes.ok) throw new Error('seed failed')
          const seeded: DbAcao[] = await seedRes.json()
          if (!cancelled) setAcoes(seeded.map(dbToDisplay))
        } else if (db.length === 0) {
          if (!cancelled) setAcoes(pdi.planoDeAcao.map(staticToDisplay))
        } else {
          if (!cancelled) setAcoes(db.map(dbToDisplay))
        }
      } catch {
        if (!cancelled) setApiError('Não foi possível carregar as ações.')
      } finally {
        if (!cancelled) setLoadingAcoes(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [pdi.id, canEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeAcoes = acoes.filter(a => a.status !== 'Concluído')
  const historico = acoes.filter(a => a.status === 'Concluído')

  function openCreate() {
    setApiError(null)
    setModal({ open: true, mode: 'create', editingId: null, form: { ...EMPTY_FORM }, saving: false })
  }

  function openEdit(acao: AcaoDisplay) {
    setApiError(null)
    setModal({
      open: true, mode: 'edit', editingId: acao.id, saving: false,
      form: {
        competencia: acao.competencia, desenvolver: acao.desenvolver, acoes: acao.acoes,
        resultadosEsperados: acao.resultadosEsperados,
        inicio: acao.inicio, termino: acao.termino,
        status: acao.status || 'Não iniciado',
      },
    })
  }

  function setField(field: keyof FormState, value: string) {
    setModal(m => ({ ...m, form: { ...m.form, [field]: value } }))
  }

  async function saveAcao() {
    if (!modal.form.competencia.trim()) { setApiError('Competência é obrigatória.'); return }
    setModal(m => ({ ...m, saving: true }))
    setApiError(null)
    try {
      const payload = {
        competencia: modal.form.competencia,
        desenvolver: modal.form.desenvolver,
        acoes: modal.form.acoes,
        resultados_esperados: modal.form.resultadosEsperados,
        inicio: modal.form.inicio,
        termino: modal.form.termino,
        status: modal.form.status,
      }
      let res: Response
      if (modal.mode === 'create') {
        res = await fetch(`/api/pdi/${pdi.id}/acoes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/pdi/${pdi.id}/acoes/${modal.editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      }
      if (!res.ok) throw new Error()
      const saved: DbAcao = await res.json()
      setAcoes(prev =>
        modal.mode === 'create'
          ? [...prev, dbToDisplay(saved)]
          : prev.map(a => a.id === modal.editingId ? dbToDisplay(saved) : a)
      )
      setModal(m => ({ ...m, open: false, saving: false }))
    } catch {
      setApiError('Erro ao salvar. Tente novamente.')
      setModal(m => ({ ...m, saving: false }))
    }
  }

  async function deleteAcao() {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/pdi/${pdi.id}/acoes/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAcoes(prev => prev.filter(a => a.id !== deleteId))
      setDeleteId(null)
    } catch {
      setApiError('Erro ao excluir. Tente novamente.')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8,
    fontSize: 13, color: '#1E293B', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7A99',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5,
  }

  if (loadingAcoes) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Carregando ações...</div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#6B7A99' }}>
          {activeAcoes.length} {activeAcoes.length === 1 ? 'ação ativa' : 'ações ativas'}
          {historico.length > 0 && <span style={{ marginLeft: 8, color: '#166534' }}>· {historico.length} concluída{historico.length > 1 ? 's' : ''}</span>}
        </div>
        {canEdit && (
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', backgroundColor: '#2A4F96', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            ＋ Nova ação
          </button>
        )}
      </div>

      {apiError && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 12 }}>
          {apiError}
        </div>
      )}

      {/* Active actions table */}
      {activeAcoes.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 14, backgroundColor: '#F8FAFC', borderRadius: 10, border: '1px dashed #E2E8F0' }}>
          Nenhuma ação ativa.{canEdit && ' Clique em "＋ Nova ação" para adicionar.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                {['Competência', 'A desenvolver', 'Ações', 'Resultados esperados', 'Início', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
                {canEdit && <th style={{ padding: '10px 14px', width: 80 }} />}
              </tr>
            </thead>
            <tbody>
              {activeAcoes.map((a, i) => {
                const st = STATUS_STYLE[a.status] ?? STATUS_STYLE['Não iniciado']
                return (
                  <tr key={a.id ?? i} style={{ borderBottom: i < activeAcoes.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>{a.competencia}</td>
                    <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 200 }}>{a.desenvolver || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 240 }}>{a.acoes || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 200 }}>{a.resultadosEsperados || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#6B7A99', whiteSpace: 'nowrap' }}>{a.inicio || '—'}</td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      {a.status
                        ? <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: st.bg, color: st.color }}>{a.status}</span>
                        : '—'}
                    </td>
                    {canEdit && (
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(a)} title="Editar" style={{ padding: '4px 8px', backgroundColor: '#EBF4FF', color: '#2A4F96', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>✎</button>
                          {a.source === 'db' && (
                            <button onClick={() => setDeleteId(a.id!)} title="Excluir" style={{ padding: '4px 8px', backgroundColor: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>🗑</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* History section */}
      {historico.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setHistoryOpen(h => !h)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '10px 16px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0',
              borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 11 }}>{historyOpen ? '▾' : '▸'}</span>
            <span>📋 Histórico de ações concluídas</span>
            <span style={{ marginLeft: 'auto', backgroundColor: '#166534', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
              {historico.length}
            </span>
          </button>
          {historyOpen && (
            <div style={{ marginTop: 8, borderRadius: 10, border: '1px solid #BBF7D0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#F0FFF4', borderBottom: '1px solid #BBF7D0' }}>
                    {['Competência', 'Resultados alcançados', 'Concluído em'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    {canEdit && <th style={{ padding: '10px 14px', width: 50 }} />}
                  </tr>
                </thead>
                <tbody>
                  {historico.map((a, i) => (
                    <tr key={a.id ?? i} style={{ borderBottom: i < historico.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>{a.competencia}</td>
                      <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 300 }}>{a.resultadosEsperados || '—'}</td>
                      <td style={{ padding: '11px 14px', color: '#166534', fontWeight: 500, whiteSpace: 'nowrap' }}>{a.concluido_em ? formatDate(a.concluido_em) : '—'}</td>
                      {canEdit && (
                        <td style={{ padding: '8px 14px' }}>
                          <button onClick={() => openEdit(a)} title="Editar" style={{ padding: '4px 8px', backgroundColor: '#EBF4FF', color: '#2A4F96', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>✎</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: '28px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>
                {modal.mode === 'create' ? '＋ Nova ação' : '✎ Editar ação'}
              </h2>
              <button onClick={() => setModal(m => ({ ...m, open: false }))} style={{ background: 'none', border: 'none', fontSize: 22, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
            </div>

            {apiError && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
                {apiError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Competência *</label>
                <input value={modal.form.competencia} onChange={e => setField('competencia', e.target.value)} style={inputStyle} placeholder="Ex: Proatividade" />
              </div>
              <div>
                <label style={labelStyle}>O que desenvolver</label>
                <textarea value={modal.form.desenvolver} onChange={e => setField('desenvolver', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Descreva o que deve ser desenvolvido..." />
              </div>
              <div>
                <label style={labelStyle}>Ações</label>
                <textarea value={modal.form.acoes} onChange={e => setField('acoes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Liste as ações a serem realizadas..." />
              </div>
              <div>
                <label style={labelStyle}>Resultados esperados</label>
                <textarea value={modal.form.resultadosEsperados} onChange={e => setField('resultadosEsperados', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Quais resultados são esperados?" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Data início</label>
                  <input value={modal.form.inicio} onChange={e => setField('inicio', e.target.value)} style={inputStyle} placeholder="DD/MM/AAAA" />
                </div>
                <div>
                  <label style={labelStyle}>Data término</label>
                  <input value={modal.form.termino} onChange={e => setField('termino', e.target.value)} style={inputStyle} placeholder="DD/MM/AAAA" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={modal.form.status} onChange={e => setField('status', e.target.value)} style={{ ...inputStyle, backgroundColor: '#fff', cursor: 'pointer' }}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
              <button onClick={() => setModal(m => ({ ...m, open: false }))} disabled={modal.saving} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: 8, backgroundColor: '#fff', fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={saveAcao} disabled={modal.saving} style={{ padding: '9px 22px', border: 'none', borderRadius: 8, backgroundColor: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: modal.saving ? 'not-allowed' : 'pointer', opacity: modal.saving ? 0.7 : 1 }}>
                {modal.saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 360, padding: '28px 30px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🗑</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Excluir ação</h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6B7A99' }}>Esta ação será removida permanentemente.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '9px 22px', border: '1px solid #E2E8F0', borderRadius: 8, backgroundColor: '#fff', fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={deleteAcao} style={{ padding: '9px 22px', border: 'none', borderRadius: 8, backgroundColor: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Other tabs (unchanged) ─────────────────────────────────────────────

// ── AvaliacoesTab ─────────────────────────────────────────────────────────────

function ScoreCells({ scores, color, editable, onChange }: {
  scores: number[]; color: string; editable: boolean
  onChange?: (i: number, v: number) => void
}) {
  return (
    <>
      {scores.map((v, i) => (
        <td key={i} style={{ padding: '8px 10px', textAlign: 'center' }}>
          {editable && onChange ? (
            <select
              value={v}
              onChange={e => onChange(i, Number(e.target.value))}
              style={{ width: 52, textAlign: 'center', border: '1px solid #CBD5E0', borderRadius: 6, fontSize: 13, fontWeight: 700, color, padding: '2px 4px', cursor: 'pointer' }}
            >
              {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <span style={{ fontWeight: 700, color }}>{v}</span>
          )}
        </td>
      ))}
    </>
  )
}

function CicloCard({ ciclo, pdi, papel, colaboradorId, onUpdate, onDelete, isFirst }: {
  ciclo: Ciclo; pdi: PdiColaborador; papel: string
  colaboradorId: string | null
  onUpdate: (updated: Ciclo) => void
  onDelete: (id: string) => void
  isFirst: boolean
}) {
  const isGestorAdmin = ['gestor', 'admin'].includes(papel)
  const isColab = papel === 'colaborador' || papel === 'trainee'
  const isAtivo = ciclo.status === 'ativo'
  const competencias = pdi.matrizAvaliacao.competencias
  const maxScore = competencias.length * 5

  const [diretiva, setDiretiva] = useState<number[]>(ciclo.avaliacao_diretiva.length ? ciclo.avaliacao_diretiva : competencias.map(() => 0))
  const [autoaval, setAutoaval] = useState<number[]>(ciclo.autoavaliacao.length ? ciclo.autoavaliacao : competencias.map(() => 0))
  const [ambicao, setAmbicao] = useState<number[]>(ciclo.ambicao.length ? ciclo.ambicao : competencias.map(() => 0))
  const [autoSalva, setAutoSalva] = useState(ciclo.autoavaliacao_salva)
  const [dataConversa, setDataConversa] = useState(ciclo.data_conversa ? ciclo.data_conversa.slice(0, 16) : '')
  const [saving, setSaving] = useState<'diretiva' | 'auto' | 'conversa' | null>(null)
  const [open, setOpen] = useState(isAtivo)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [err, setErr] = useState('')

  const sumDiretiva = diretiva.reduce((a, b) => a + b, 0)
  const sumAuto = autoaval.reduce((a, b) => a + b, 0)
  const sumAmbicao = ambicao.reduce((a, b) => a + b, 0)

  async function saveDiretiva() {
    setSaving('diretiva'); setErr('')
    try {
      const res = await fetch(`/api/pdi/${ciclo.pdi_id}/ciclos/${ciclo.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avaliacao_diretiva: diretiva }),
      })
      if (!res.ok) throw new Error()
      onUpdate({ ...ciclo, avaliacao_diretiva: diretiva })
    } catch { setErr('Erro ao salvar avaliação diretiva.') } finally { setSaving(null) }
  }

  async function saveAutoaval() {
    setSaving('auto'); setErr('')
    try {
      const res = await fetch(`/api/pdi/${ciclo.pdi_id}/ciclos/${ciclo.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoavaliacao: autoaval, ambicao, autoavaliacao_salva: true }),
      })
      if (!res.ok) throw new Error()
      setAutoSalva(true)
      onUpdate({ ...ciclo, autoavaliacao: autoaval, ambicao, autoavaliacao_salva: true })
    } catch { setErr('Erro ao salvar autoavaliação.') } finally { setSaving(null) }
  }

  async function saveConversa() {
    if (!dataConversa) { setErr('Informe a data e hora.'); return }
    setSaving('conversa'); setErr('')
    try {
      const res = await fetch(`/api/pdi/${ciclo.pdi_id}/ciclos/${ciclo.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_conversa: new Date(dataConversa).toISOString(),
          colaborador_id: colaboradorId,
        }),
      })
      if (!res.ok) throw new Error()
      onUpdate({ ...ciclo, data_conversa: new Date(dataConversa).toISOString() })
    } catch { setErr('Erro ao agendar conversa.') } finally { setSaving(null) }
  }

  const statusBadge = (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      backgroundColor: isAtivo ? '#D1FAE5' : '#F1F5F9',
      color: isAtivo ? '#065F46' : '#64748B',
    }}>
      {isAtivo ? 'Ativo' : 'Arquivado'}
    </span>
  )

  const arquivadoLabel = ciclo.arquivado_em
    ? `arquivado em ${new Date(ciclo.arquivado_em).toLocaleDateString('pt-BR')}`
    : ''

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      {/* Accordion header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 'none', background: isAtivo ? '#F0F7FF' : '#F8FAFC', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 11 }}>{open ? '▼' : '▶'}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#1E293B', flex: 1 }}>
          Ciclo {ciclo.numero_ciclo} {arquivadoLabel && <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8' }}>— {arquivadoLabel}</span>}
        </span>
        {statusBadge}
        {isGestorAdmin && (
          <button
            onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
            style={{ marginLeft: 8, padding: '2px 8px', border: 'none', background: '#FEF2F2', color: '#DC2626', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
          >
            🗑
          </button>
        )}
      </div>

      {open && (
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {err && <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>{err}</div>}

          {/* Score totals */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Diretiva', value: sumDiretiva, color: '#2A4F96', bg: '#EBF4FF' },
              { label: 'Autoavaliação', value: sumAuto, color: '#D1AE6E', bg: '#FFFBEB' },
              { label: 'Ambição', value: sumAmbicao, color: '#16A34A', bg: '#F0FFF4' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ flex: 1, minWidth: 130, background: bg, borderRadius: 8, padding: '10px 14px', border: `1px solid ${color}22` }}>
                <div style={{ fontSize: 10, color: '#6B7A99', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color }}>
                  {value}<span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', marginLeft: 4 }}>/ {maxScore}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Matrix table */}
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase' }}>Competência</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#2A4F96', textTransform: 'uppercase' }}>Diretiva</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#92400E', textTransform: 'uppercase' }}>Auto</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Ambição</th>
                </tr>
              </thead>
              <tbody>
                {competencias.map((comp, i) => (
                  <tr key={i} style={{ borderBottom: i < competencias.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <td style={{ padding: '8px 14px', color: '#1E293B', fontWeight: 500 }}>{shorten(comp)}</td>
                    <ScoreCells
                      scores={[diretiva[i] ?? 0]}
                      color="#2A4F96"
                      editable={isGestorAdmin && isAtivo}
                      onChange={(_, v) => setDiretiva(prev => { const a = [...prev]; a[i] = v; return a })}
                    />
                    <ScoreCells
                      scores={[autoaval[i] ?? 0]}
                      color="#92400E"
                      editable={isColab && isAtivo && !autoSalva}
                      onChange={(_, v) => setAutoaval(prev => { const a = [...prev]; a[i] = v; return a })}
                    />
                    <ScoreCells
                      scores={[ambicao[i] ?? 0]}
                      color="#166534"
                      editable={isColab && isAtivo && !autoSalva && isFirst}
                      onChange={(_, v) => setAmbicao(prev => { const a = [...prev]; a[i] = v; return a })}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Save buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isGestorAdmin && isAtivo && (
              <button
                onClick={saveDiretiva}
                disabled={saving === 'diretiva'}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving === 'diretiva' ? 0.7 : 1 }}
              >
                {saving === 'diretiva' ? 'Salvando…' : 'Salvar Avaliação Diretiva'}
              </button>
            )}
            {isColab && isAtivo && !autoSalva && (
              <button
                onClick={saveAutoaval}
                disabled={saving === 'auto'}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#D1AE6E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving === 'auto' ? 0.7 : 1 }}
              >
                {saving === 'auto' ? 'Salvando…' : 'Confirmar Autoavaliação'}
              </button>
            )}
            {isColab && autoSalva && (
              <span style={{ fontSize: 12, color: '#166534', fontWeight: 600, alignSelf: 'center' }}>✓ Autoavaliação registrada</span>
            )}
          </div>

          {/* Agendamento de conversa */}
          {isGestorAdmin && isAtivo && (
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>📅 Agendar Conversa</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#6B7A99', marginBottom: 4 }}>Data e hora</label>
                  <input
                    type="datetime-local"
                    value={dataConversa}
                    onChange={e => setDataConversa(e.target.value)}
                    style={{ padding: '7px 10px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13 }}
                  />
                </div>
                <button
                  onClick={saveConversa}
                  disabled={saving === 'conversa'}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#5B8DEF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving === 'conversa' ? 0.7 : 1 }}
                >
                  {saving === 'conversa' ? 'Salvando…' : 'Salvar data'}
                </button>
                {ciclo.data_conversa && (
                  <span style={{ fontSize: 12, color: '#374151', alignSelf: 'center' }}>
                    Agendada: {new Date(ciclo.data_conversa).toLocaleString('pt-BR')}
                    {ciclo.conversa_confirmada_em
                      ? <span style={{ marginLeft: 8, color: '#166534', fontWeight: 600 }}>✓ Confirmado</span>
                      : <span style={{ marginLeft: 8, color: '#F59E0B', fontWeight: 600 }}>⏳ Pendente</span>}
                  </span>
                )}
              </div>
            </div>
          )}
          {isColab && ciclo.data_conversa && (
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, fontSize: 13, color: '#374151' }}>
              📅 Conversa agendada para <strong>{new Date(ciclo.data_conversa).toLocaleString('pt-BR')}</strong>
              {ciclo.conversa_confirmada_em && <span style={{ marginLeft: 8, color: '#166534' }}>✓ Confirmado</span>}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 30px', maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Excluir Ciclo {ciclo.numero_ciclo}?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7A99' }}>Todos os dados deste ciclo serão removidos permanentemente.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '8px 20px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { setConfirmDelete(false); onDelete(ciclo.id) }} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AvaliacoesTab({ pdi, papel }: { pdi: PdiColaborador; papel: string }) {
  const [ciclos, setCiclos] = useState<Ciclo[]>([])
  const [loading, setLoading] = useState(true)
  const [colaboradorId, setColaboradorId] = useState<string | null>(null)
  const [showNovoCicloModal, setShowNovoCicloModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const isGestorAdmin = ['gestor', 'admin'].includes(papel)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch(`/api/pdi/${pdi.id}/ciclos`)
        if (!r.ok) throw new Error()
        const data: Ciclo[] = await r.json()
        if (!cancelled) {
          setColaboradorId(data[0]?.colaborador_id ?? null)
          setCiclos(data)
        }
      } catch { /* noop */ } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [pdi.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function criarNovoCiclo() {
    setCreating(true)
    try {
      const res = await fetch(`/api/pdi/${pdi.id}/ciclos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaborador_id: colaboradorId }),
      })
      if (!res.ok) throw new Error()
      const novo: Ciclo = await res.json()
      // Archive the previously active one in local state
      setCiclos(prev => [novo, ...prev.map(c => c.status === 'ativo' ? { ...c, status: 'arquivado' as const, arquivado_em: new Date().toISOString() } : c)])
      setShowNovoCicloModal(false)
    } catch { /* noop */ } finally { setCreating(false) }
  }

  function handleUpdate(updated: Ciclo) {
    setCiclos(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  function handleDelete(id: string) {
    setCiclos(prev => {
      const remaining = prev.filter(c => c.id !== id)
      // If we deleted the active one and there are remaining, activate the first
      if (prev.find(c => c.id === id)?.status === 'ativo' && remaining.length > 0) {
        remaining[0] = { ...remaining[0], status: 'ativo' }
      }
      return remaining
    })
    fetch(`/api/pdi/${pdi.id}/ciclos/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Carregando avaliações…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#6B7A99' }}>{ciclos.length} ciclo{ciclos.length !== 1 ? 's' : ''}</div>
        {isGestorAdmin && (
          <button
            onClick={() => setShowNovoCicloModal(true)}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Novo ciclo
          </button>
        )}
      </div>

      {ciclos.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 14, background: '#F8FAFC', borderRadius: 10, border: '1px dashed #E2E8F0' }}>
          Nenhum ciclo de avaliação iniciado.
        </div>
      )}

      {ciclos.map((ciclo, idx) => (
        <CicloCard
          key={ciclo.id}
          ciclo={ciclo}
          pdi={pdi}
          papel={papel}
          colaboradorId={colaboradorId}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          isFirst={ciclo.numero_ciclo === 1}
        />
      ))}

      {showNovoCicloModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 36px', maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔄</div>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: '#1E293B' }}>Iniciar novo ciclo?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6B7A99', lineHeight: 1.6 }}>
              O ciclo atual será arquivado. A autoavaliação ficará em branco para novo preenchimento. A ambição permanece igual ao Ciclo 1.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowNovoCicloModal(false)} style={{ padding: '9px 22px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={criarNovoCiclo} disabled={creating} style={{ padding: '9px 22px', border: 'none', borderRadius: 8, background: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Criando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EneagramaTab({ pdi }: { pdi: PdiColaborador }) {
  const { ranking, pontosFortes, pontosAtencao, comoDesenvolver } = pdi.perfilComportamental.eneagrama
  const animais = pdi.perfilComportamental.animais
  const MEDALS = ['🥇', '🥈', '🥉']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {ranking.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ranking Eneagrama</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {ranking.map((e, i) => (
              <div key={i} style={{ flex: 1, minWidth: 180, backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{MEDALS[i] ?? `#${e.rank}`}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 2 }}>{e.tipo}</div>
                <div style={{ fontSize: 12, color: '#6B7A99' }}>Pontuação: {e.pontuacao}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(pontosFortes.length > 0 || pontosAtencao.length > 0 || comoDesenvolver.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {pontosFortes.length > 0 && (
            <div style={{ backgroundColor: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>✅ Pontos fortes</div>
              {pontosFortes.map((p, i) => <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5 }}>• {p}</div>)}
            </div>
          )}
          {pontosAtencao.length > 0 && (
            <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>⚠️ Pontos de atenção</div>
              {pontosAtencao.map((p, i) => <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5 }}>• {p}</div>)}
            </div>
          )}
          {comoDesenvolver.length > 0 && (
            <div style={{ backgroundColor: '#EBF4FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>🎯 Como desenvolver</div>
              {comoDesenvolver.map((p, i) => <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5 }}>• {p}</div>)}
            </div>
          )}
        </div>
      )}
      {animais.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Perfil dos Animais</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {animais.map((a, i) => (
              <div key={i} style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{a.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>
                  {a.animal}{a.percentual ? <span style={{ fontSize: 12, fontWeight: 400, color: '#6B7A99', marginLeft: 6 }}>— {a.percentual}%</span> : ''}
                </div>
                {a.pontoForte && <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}><span style={{ fontWeight: 600, color: '#166534' }}>Ponto forte: </span>{a.pontoForte}</div>}
                {a.tendencia && <div style={{ fontSize: 12, color: '#374151' }}><span style={{ fontWeight: 600, color: '#92400E' }}>Tendência: </span>{a.tendencia}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {ranking.length === 0 && animais.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Dados de eneagrama não disponíveis.</div>
      )}
    </div>
  )
}

function MbtiTab({ pdi }: { pdi: PdiColaborador }) {
  const mbti = pdi.perfilComportamental.mbti
  if (!mbti) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Avaliação MBTI não disponível para este colaborador.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {mbti.tipo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ backgroundColor: '#1E3A6E', color: '#D1AE6E', borderRadius: 12, padding: '10px 22px', fontSize: 28, fontWeight: 800, letterSpacing: 4 }}>{mbti.tipo}</div>
          <div style={{ fontSize: 13, color: '#6B7A99' }}>Tipo predominante</div>
        </div>
      )}
      {mbti.nucleo && (
        <div style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: '16px 18px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>🧭 Núcleo de funcionamento</div>
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{mbti.nucleo}</p>
        </div>
      )}
      {mbti.veredito && (
        <div style={{ backgroundColor: '#FEF9EC', borderRadius: 10, padding: '20px 22px', border: '2px solid #D1AE6E', borderLeft: '5px solid #D1AE6E', boxShadow: '0 2px 8px rgba(209,174,110,0.15)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>🧠 Veredito organizacional</div>
          <p style={{ margin: 0, fontSize: 14, color: '#1E293B', lineHeight: 1.8, fontWeight: 500 }}>{mbti.veredito}</p>
        </div>
      )}
      {mbti.estiloDecisao && (
        <div style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: '16px 18px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>🧩 Estilo de tomada de decisão</div>
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{mbti.estiloDecisao}</p>
        </div>
      )}
      {mbti.curvaAprendizado && (
        <div style={{ backgroundColor: '#F0FFF4', borderRadius: 10, padding: '16px 18px', border: '1px solid #BBF7D0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>🔄 Curva de aprendizado</div>
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{mbti.curvaAprendizado}</p>
        </div>
      )}
      {mbti.impactoClima && (
        <div style={{ backgroundColor: '#EBF4FF', borderRadius: 10, padding: '16px 18px', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>🤝 Impacto no clima e no time</div>
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{mbti.impactoClima}</p>
        </div>
      )}
    </div>
  )
}

function ConclusoesTab({ pdi }: { pdi: PdiColaborador }) {
  const c = pdi.conclusoes
  const isEmpty = !c.forcas.length && !c.pontosAtencao.length && !c.ondeAgrega.length && !c.comoLiderar.length
  if (isEmpty) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Conclusões não disponíveis.</div>
  const sections = [
    { title: '✅ Forças visíveis', items: c.forcas, bg: '#F0FFF4', border: '#BBF7D0', titleColor: '#166534' },
    { title: '⚠️ Pontos de atenção', items: c.pontosAtencao, bg: '#FFFBEB', border: '#FDE68A', titleColor: '#92400E' },
    { title: '📌 Onde agrega mais', items: c.ondeAgrega, bg: '#EBF4FF', border: '#BFDBFE', titleColor: '#1E40AF' },
    { title: '🤝 Pode apoiar bem', items: c.comoPodeApoiar, bg: '#F5F3FF', border: '#DDD6FE', titleColor: '#5B21B6' },
    { title: '🚀 Como liderar', items: c.comoLiderar, bg: '#FEF3C7', border: '#FDE68A', titleColor: '#92400E' },
    { title: '⚡ Riscos se mal alocado', items: c.riscos, bg: '#FEF2F2', border: '#FECACA', titleColor: '#DC2626' },
  ].filter(s => s.items.length > 0)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {sections.map(({ title, items, bg, border, titleColor }) => (
        <div key={title} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: titleColor, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
          {items.map((item, i) => <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: i < items.length - 1 ? 6 : 0, lineHeight: 1.5 }}>• {item}</div>)}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export default function PdiDetailClient({ pdi, papel }: { pdi: PdiColaborador; papel: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('acoes')
  const canEdit = ['gestor', 'admin'].includes(papel)
  const hasMbti = !!pdi.perfilComportamental.mbti

  // Collaborator: mark notifications as seen on page open
  useEffect(() => {
    if (papel === 'colaborador') {
      fetch(`/api/pdi/${pdi.id}/notificacoes/vista`, { method: 'POST' }).catch(() => {})
    }
  }, [pdi.id, papel])

  const visibleTabs = TABS.filter(t => t.id !== 'mbti' || hasMbti)

  return (
    <div>
      <div style={{ marginBottom: 20, fontSize: 13, color: '#6B7A99' }}>
        <Link href="/pdi" style={{ color: '#6B7A99', textDecoration: 'none' }}>PDI</Link>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: '#1E293B', fontWeight: 500 }}>{pdi.nome}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#1E3A6E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1AE6E', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
          {avatarInitials(pdi.nome)}
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1E293B' }}>{pdi.nome}</h1>
          <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
            {pdi.funcao && <span style={{ fontSize: 13, color: '#6B7A99' }}>{pdi.funcao}</span>}
            {pdi.periodo && <span style={{ fontSize: 13, color: '#94A3B8' }}>📅 {pdi.periodo}</span>}
          </div>
          {pdi.perfilComportamental.eneagrama.ranking.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {pdi.perfilComportamental.eneagrama.ranking.map((e, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, backgroundColor: ['#FEF3C7', '#EBF4FF', '#F0FFF4'][i], color: ['#92400E', '#1E40AF', '#166534'][i] }}>
                  {['🥇', '🥈', '🥉'][i]} {e.tipo}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ borderBottom: '1px solid #E2E8F0', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {visibleTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '10px 18px', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? '#2A4F96' : 'transparent'}`, backgroundColor: 'transparent', color: activeTab === tab.id ? '#2A4F96' : '#6B7A99', fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400, cursor: 'pointer', transition: 'color 0.15s', marginBottom: -1 }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'acoes' && <AcoesTab pdi={pdi} canEdit={canEdit} />}
        {activeTab === 'avaliacoes' && <AvaliacoesTab pdi={pdi} papel={papel} />}
        {activeTab === 'eneagrama' && <EneagramaTab pdi={pdi} />}
        {activeTab === 'mbti' && <MbtiTab pdi={pdi} />}
        {activeTab === 'conclusoes' && <ConclusoesTab pdi={pdi} />}
      </div>
    </div>
  )
}
