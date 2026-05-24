'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '../components/UserContext'
import { createClient } from '../lib/supabase'
import { markPrioridadeVista } from '../components/AppShell'

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusEntry = {
  id: string
  autor: string
  data: number
  texto: string
  editadoEm?: number
}

type HistoricoItem = {
  data: number
  autor: string
  acao: string
}

type Prioridade = {
  id: string
  empresa: string
  contratante: string
  responsavel: string
  criadoEm: number
  atualizadoEm: number
  statusFeed: StatusEntry[]
  historico: HistoricoItem[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'gt3_prioridades_v1'
const EDIT_WINDOW_MS = 15 * 60 * 1000

const C = {
  primary: '#2A4F96',
  primaryHover: '#1E3A6E',
  primarySoft: '#EBF0FB',
  accent: '#D1AE6E',
  bg: '#F4F6FA',
  surface: '#fff',
  border: '#E2E8F0',
  text: '#1E293B',
  muted: '#6B7A99',
  danger: '#DC2626',
  dangerHover: '#B91C1C',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function fmtDateTime(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function fmtRelative(ts: number) {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const days = Math.floor(h / 24)
  if (days < 30) return `há ${days}d`
  return fmtDateTime(ts)
}

function seedExamples(): Prioridade[] {
  const now = Date.now()
  return [
    {
      id: uid(),
      empresa: 'Construtora Horizonte Ltda.',
      contratante: 'Indústria Metalúrgica Sul S.A.',
      responsavel: 'Rodrigo Balem',
      criadoEm: now - 86400000 * 3,
      atualizadoEm: now - 3600000 * 5,
      statusFeed: [
        { id: uid(), autor: 'Rodrigo Balem', data: now - 86400000 * 3, texto: 'PGR vencido há 2 meses. Aguardando envio do novo documento pela construtora.' },
        { id: uid(), autor: 'Rodrigo Balem', data: now - 3600000 * 5, texto: 'Contato realizado com o responsável técnico. Prometeram envio até sexta-feira.' },
      ],
      historico: [
        { data: now - 86400000 * 3, autor: 'Rodrigo Balem', acao: 'Criou a prioridade' },
        { data: now - 3600000 * 5, autor: 'Rodrigo Balem', acao: 'Adicionou nova entrada de status' },
      ],
    },
    {
      id: uid(),
      empresa: 'Serviços Gerais Vértice ME',
      contratante: 'Frigorífico Boa Vista',
      responsavel: 'Rodrigo Balem',
      criadoEm: now - 86400000,
      atualizadoEm: now - 86400000,
      statusFeed: [
        { id: uid(), autor: 'Rodrigo Balem', data: now - 86400000, texto: 'ASOs de 4 colaboradores pendentes. Empresa solicitou prorrogação de prazo.' },
      ],
      historico: [
        { data: now - 86400000, autor: 'Rodrigo Balem', acao: 'Criou a prioridade' },
      ],
    },
  ]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrioridadesClient() {
  const { profile } = useUser()

  const userName = profile?.nome ?? 'Usuário'
  const isGestor = profile?.papel === 'gestor' || profile?.papel === 'admin'

  // ── State ──
  const [priorities, setPriorities] = useState<Prioridade[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [search, setSearch] = useState('')
  const [filterResp, setFilterResp] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  // Form modal
  const [formOpen, setFormOpen] = useState(false)
  const [formEmpresa, setFormEmpresa] = useState('')
  const [formContratante, setFormContratante] = useState('')
  const [formStatus, setFormStatus] = useState('')

  // Detail modal
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailEmpresa, setDetailEmpresa] = useState('')
  const [detailContratante, setDetailContratante] = useState('')
  const [detailEmpresaOrig, setDetailEmpresaOrig] = useState('')
  const [detailContratanteOrig, setDetailContratanteOrig] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null)
  const [editingStatusText, setEditingStatusText] = useState('')

  // Confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)

  // Toast
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Persistence ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPriorities(JSON.parse(raw))
      else setPriorities(seedExamples())
    } catch {
      setPriorities(seedExamples())
    }
    setHydrated(true)
  }, [])

  const save = useCallback((updated: Prioridade[]) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch { /* noop */ }
  }, [])

  // ── Toast ──
  function toast(msg: string) {
    setToastMsg(msg)
    setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200)
  }

  // ── Derived ──
  const responsaveis = [...new Set(priorities.map(p => p.responsavel))].sort()

  const filtered = priorities.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.empresa.toLowerCase().includes(q) || p.contratante.toLowerCase().includes(q)
    const matchResp = !filterResp || p.responsavel === filterResp
    return matchSearch && matchResp
  })

  const detailPriority = priorities.find(p => p.id === detailId) ?? null

  // ── Create ──
  function openCreate() {
    setFormEmpresa('')
    setFormContratante('')
    setFormStatus('')
    setFormOpen(true)
  }

  async function saveForm() {
    const empresa = formEmpresa.trim()
    const contratante = formContratante.trim()
    const status = formStatus.trim()
    if (!empresa || !contratante) { toast('Preencha empresa e contratante'); return }
    if (!status) { toast('Adicione um status inicial'); return }
    const now = Date.now()
    const newP: Prioridade = {
      id: uid(), empresa, contratante,
      responsavel: userName,
      criadoEm: now, atualizadoEm: now,
      statusFeed: [{ id: uid(), autor: userName, data: now, texto: status }],
      historico: [{ data: now, autor: userName, acao: 'Criou a prioridade' }],
    }
    const updated = [...priorities, newP]
    setPriorities(updated)
    save(updated)
    setFormOpen(false)
    toast('Prioridade criada')

    // Broadcast para notificação Realtime — best-effort
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('prioridades_avisos')
        .insert({ empresa })
        .select('id')
        .single()
      if (data?.id && profile?.id) {
        // Marca como vista imediatamente para o criador não receber o popup
        markPrioridadeVista(data.id, profile.id)
      }
    } catch { /* noop — tabela pode ainda não existir */ }
  }

  // ── Detail ──
  function openDetail(id: string) {
    const p = priorities.find(x => x.id === id)
    if (!p) return
    setDetailId(id)
    setDetailEmpresa(p.empresa)
    setDetailContratante(p.contratante)
    setDetailEmpresaOrig(p.empresa)
    setDetailContratanteOrig(p.contratante)
    setNewStatus('')
    setEditingStatusId(null)
  }

  function closeDetail() {
    setDetailId(null)
    setEditingStatusId(null)
  }

  const detailDirty = detailEmpresa.trim() !== detailEmpresaOrig || detailContratante.trim() !== detailContratanteOrig

  function saveDetailEdit() {
    const empresa = detailEmpresa.trim()
    const contratante = detailContratante.trim()
    if (!empresa || !contratante) { toast('Empresa e contratante são obrigatórios'); return }
    const updated = priorities.map(p => {
      if (p.id !== detailId) return p
      const changes: string[] = []
      if (p.empresa !== empresa) changes.push(`Empresa: "${p.empresa}" → "${empresa}"`)
      if (p.contratante !== contratante) changes.push(`Contratante: "${p.contratante}" → "${contratante}"`)
      const hist: HistoricoItem[] = changes.length > 0
        ? [...p.historico, { data: Date.now(), autor: userName, acao: 'Editou: ' + changes.join('; ') }]
        : p.historico
      return { ...p, empresa, contratante, atualizadoEm: Date.now(), historico: hist }
    })
    setPriorities(updated)
    save(updated)
    setDetailEmpresaOrig(empresa)
    setDetailContratanteOrig(contratante)
    toast('Alterações salvas')
  }

  // ── Status feed ──
  function addStatus() {
    const text = newStatus.trim()
    if (!text) { toast('Digite uma atualização'); return }
    const now = Date.now()
    const updated = priorities.map(p => {
      if (p.id !== detailId) return p
      return {
        ...p,
        atualizadoEm: now,
        statusFeed: [...p.statusFeed, { id: uid(), autor: userName, data: now, texto: text }],
        historico: [...p.historico, { data: now, autor: userName, acao: 'Adicionou nova entrada de status' }],
      }
    })
    setPriorities(updated)
    save(updated)
    setNewStatus('')
    toast('Status adicionado')
  }

  function startEditStatus(entryId: string) {
    const entry = detailPriority?.statusFeed.find(s => s.id === entryId)
    if (!entry) return
    if (entry.autor !== userName) { toast('Apenas o autor pode editar'); return }
    if (Date.now() - entry.data >= EDIT_WINDOW_MS) { toast('Prazo de edição (15 min) expirado'); return }
    setEditingStatusId(entryId)
    setEditingStatusText(entry.texto)
  }

  function saveEditStatus() {
    const text = editingStatusText.trim()
    if (!text) { toast('Texto vazio'); return }
    const entry = detailPriority?.statusFeed.find(s => s.id === editingStatusId)
    if (!entry) return
    if (Date.now() - entry.data >= EDIT_WINDOW_MS) { toast('Prazo expirado'); setEditingStatusId(null); return }
    const updated = priorities.map(p => {
      if (p.id !== detailId) return p
      return {
        ...p,
        atualizadoEm: Date.now(),
        statusFeed: p.statusFeed.map(s =>
          s.id === editingStatusId ? { ...s, texto: text, editadoEm: Date.now() } : s
        ),
        historico: [...p.historico, { data: Date.now(), autor: userName, acao: 'Editou uma entrada de status' }],
      }
    })
    setPriorities(updated)
    save(updated)
    setEditingStatusId(null)
    toast('Entrada editada')
  }

  // ── Delete ──
  function confirmDelete(id: string) {
    const p = priorities.find(x => x.id === id)
    if (!p) return
    setConfirmText(`Tem certeza que deseja excluir "${p.empresa}"? Esta ação é irreversível.`)
    setConfirmAction(() => () => {
      const updated = priorities.filter(x => x.id !== id)
      setPriorities(updated)
      save(updated)
      setConfirmOpen(false)
      toast('Prioridade excluída')
    })
    setConfirmOpen(true)
  }

  // ── Drag & Drop ──
  function onDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault()
    if (!dragId || dragId === targetId) return
    const fromIdx = priorities.findIndex(p => p.id === dragId)
    const toIdx = priorities.findIndex(p => p.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...priorities]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    setPriorities(reordered)
    save(reordered)
    setDragId(null)
    toast('Ordem atualizada')
  }

  if (!hydrated) return null

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Prioridades</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Empresas em análise prioritária de documentação</p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar empresa ou contratante..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={inputStyle({ minWidth: 220 })}
          />
          <select
            value={filterResp}
            onChange={e => setFilterResp(e.target.value)}
            style={inputStyle()}
          >
            <option value="">Todos os responsáveis</option>
            {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={openCreate} style={btnPrimary}>+ Nova prioridade</button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px', background: C.surface,
          borderRadius: 8, border: `1px dashed ${C.border}`, color: C.muted,
        }}>
          <h3 style={{ margin: '0 0 8px', color: C.text }}>
            {priorities.length > 0 ? 'Nenhum resultado' : 'Nenhuma prioridade cadastrada'}
          </h3>
          <p style={{ margin: 0, fontSize: 13 }}>
            {priorities.length > 0
              ? 'Nenhuma prioridade corresponde aos filtros aplicados.'
              : 'Clique em "+ Nova prioridade" para adicionar a primeira empresa ao radar do time.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => {
            const pos = priorities.indexOf(p) + 1
            const last = p.statusFeed[p.statusFeed.length - 1]
            const isDragging = dragId === p.id
            return (
              <div
                key={p.id}
                draggable
                onDragStart={e => onDragStart(e, p.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={onDragOver}
                onDrop={e => onDrop(e, p.id)}
                style={{
                  background: C.surface, border: `1px solid ${dragId && dragId !== p.id ? C.primary : C.border}`,
                  borderRadius: 8, padding: 16,
                  display: 'grid', gridTemplateColumns: 'auto 32px 1fr auto', gap: 14, alignItems: 'start',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  opacity: isDragging ? 0.4 : 1,
                  transition: 'opacity 0.15s, border-color 0.15s',
                }}
              >
                {/* Drag handle */}
                <div style={{ cursor: 'grab', color: C.muted, padding: 4, userSelect: 'none', fontSize: 18, lineHeight: 1 }}
                  title="Arrastar para reordenar">⋮⋮</div>

                {/* Position */}
                <div style={{
                  background: C.primarySoft, color: C.primary, fontWeight: 700, fontSize: 13,
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {pos}
                </div>

                {/* Body */}
                <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => openDetail(p.id)}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: C.text }}>{p.empresa}</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: C.muted, marginBottom: 8 }}>
                    <span><strong style={{ color: C.text, fontWeight: 500 }}>Contratante:</strong> {p.contratante}</span>
                    <span><strong style={{ color: C.text, fontWeight: 500 }}>Responsável:</strong> {p.responsavel}</span>
                    <span><strong style={{ color: C.text, fontWeight: 500 }}>Atualizado:</strong> {fmtRelative(p.atualizadoEm)}</span>
                  </div>
                  {last && (
                    <div style={{ background: '#FAFBFC', borderLeft: `3px solid ${C.border}`, padding: '8px 12px', borderRadius: '0 4px 4px 0', fontSize: 13, marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
                        {fmtDateTime(last.data)} — {last.autor}
                      </div>
                      <div style={{ color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{last.texto}</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <button onClick={() => openDetail(p.id)} style={btnSm}>Abrir</button>
                  <button
                    onClick={() => (isGestor || p.responsavel === userName) && confirmDelete(p.id)}
                    disabled={!isGestor && p.responsavel !== userName}
                    title={!isGestor && p.responsavel !== userName ? 'Apenas o responsável ou gestor pode excluir' : undefined}
                    style={btnSmDanger(!isGestor && p.responsavel !== userName)}
                  >Excluir</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Form Modal ───────────────────────────────────────────────────── */}
      {formOpen && (
        <Modal title="Nova prioridade" onClose={() => setFormOpen(false)}
          footer={<>
            <button onClick={() => setFormOpen(false)} style={btnBase}>Cancelar</button>
            <button onClick={saveForm} style={btnPrimary}>Salvar</button>
          </>}
        >
          <FormGroup label="Nome da empresa *">
            <input
              autoFocus type="text" placeholder="Ex.: Construtora Alfa Ltda."
              value={formEmpresa} onChange={e => setFormEmpresa(e.target.value)}
              style={inputStyle({ width: '100%' })}
            />
          </FormGroup>
          <FormGroup label="Contratante *">
            <input
              type="text" placeholder="Ex.: Indústria Beta S.A."
              value={formContratante} onChange={e => setFormContratante(e.target.value)}
              style={inputStyle({ width: '100%' })}
            />
          </FormGroup>
          <FormGroup label="Status inicial *" hint="Esta será a primeira entrada do histórico cronológico de status.">
            <textarea
              placeholder="Descreva a situação inicial da prioridade..."
              value={formStatus} onChange={e => setFormStatus(e.target.value)}
              style={{ ...inputStyle({ width: '100%' }), resize: 'vertical', minHeight: 80 }}
            />
          </FormGroup>
        </Modal>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────── */}
      {detailId && detailPriority && (
        <Modal title={detailEmpresa || detailPriority.empresa} onClose={closeDetail}
          footer={<button onClick={closeDetail} style={btnBase}>Fechar</button>}
        >
          {/* Info section */}
          <Section title="Informações">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#FAFBFC', padding: 12, borderRadius: 8 }}>
              <InfoField label="Empresa">
                <input
                  type="text" value={detailEmpresa}
                  onChange={e => setDetailEmpresa(e.target.value)}
                  style={inlineEditStyle}
                />
              </InfoField>
              <InfoField label="Contratante">
                <input
                  type="text" value={detailContratante}
                  onChange={e => setDetailContratante(e.target.value)}
                  style={inlineEditStyle}
                />
              </InfoField>
              <InfoField label="Responsável GT3">
                <span style={{ fontSize: 13, padding: '6px 0', display: 'block' }}>{detailPriority.responsavel}</span>
              </InfoField>
              <InfoField label="Criado em">
                <span style={{ fontSize: 13, padding: '6px 0', display: 'block' }}>{fmtDateTime(detailPriority.criadoEm)}</span>
              </InfoField>
            </div>
            {detailDirty && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                <button onClick={() => { setDetailEmpresa(detailEmpresaOrig); setDetailContratante(detailContratanteOrig) }} style={btnSm}>Cancelar</button>
                <button onClick={saveDetailEdit} style={{ ...btnSm, ...{ background: C.primary, color: '#fff', borderColor: C.primary } }}>Salvar alterações</button>
              </div>
            )}
          </Section>

          {/* Status feed */}
          <Section title="Histórico de status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 350, overflowY: 'auto', paddingRight: 4 }}>
              {[...detailPriority.statusFeed].reverse().map(s => {
                const canEdit = s.autor === userName && (Date.now() - s.data) < EDIT_WINDOW_MS
                const isEditing = editingStatusId === s.id
                return (
                  <div key={s.id} style={{ background: '#FAFBFC', borderLeft: `3px solid ${C.primary}`, padding: '10px 12px', borderRadius: '0 4px 4px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: C.muted, marginBottom: 6 }}>
                      <span>
                        <strong style={{ color: C.text }}>{s.autor}</strong> · {fmtDateTime(s.data)}
                        {s.editadoEm && <em style={{ marginLeft: 4, color: C.muted }}>(editado)</em>}
                      </span>
                      {canEdit && !isEditing && (
                        <button onClick={() => startEditStatus(s.id)}
                          style={{ background: 'transparent', border: 'none', color: C.primary, cursor: 'pointer', fontSize: 11, padding: 0 }}>
                          editar
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <>
                        <textarea
                          autoFocus
                          value={editingStatusText}
                          onChange={e => setEditingStatusText(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingStatusId(null)} style={btnSm}>Cancelar</button>
                          <button onClick={saveEditStatus} style={{ ...btnSm, ...{ background: C.primary, color: '#fff', borderColor: C.primary } }}>Salvar</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: C.text }}>{s.texto}</div>
                    )}
                  </div>
                )
              })}
              {detailPriority.statusFeed.length === 0 && (
                <div style={{ fontSize: 13, color: C.muted }}>Sem entradas ainda.</div>
              )}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <textarea
                placeholder="Adicionar nova atualização de status..."
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                style={{ ...inputStyle({ width: '100%' }), resize: 'vertical', minHeight: 60 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={addStatus} style={{ ...btnSm, ...{ background: C.primary, color: '#fff', borderColor: C.primary } }}>
                  Adicionar atualização
                </button>
              </div>
            </div>
          </Section>

          {/* Edit history */}
          <Section title="Histórico de edições">
            <div style={{ maxHeight: 250, overflowY: 'auto', background: '#FAFBFC', borderRadius: 8, padding: '8px 12px' }}>
              {[...detailPriority.historico].reverse().map((h, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 0', borderBottom: i < detailPriority.historico.length - 1 ? `1px solid ${C.border}` : 'none', color: C.muted }}>
                  <strong style={{ color: C.text }}>{h.autor}</strong> · {fmtDateTime(h.data)} — {h.acao}
                </div>
              ))}
              {detailPriority.historico.length === 0 && (
                <div style={{ fontSize: 12, color: C.muted }}>Sem histórico.</div>
              )}
            </div>
          </Section>
        </Modal>
      )}

      {/* ── Confirm Modal ────────────────────────────────────────────────── */}
      {confirmOpen && (
        <Modal title="Confirmar exclusão" onClose={() => setConfirmOpen(false)}
          footer={<>
            <button onClick={() => setConfirmOpen(false)} style={btnBase}>Cancelar</button>
            <button onClick={() => confirmAction?.()} style={{ ...btnBase, background: C.danger, color: '#fff', borderColor: C.danger }}>Excluir</button>
          </>}
          maxWidth={420}
        >
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, color: C.text }}>{confirmText}</p>
        </Modal>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        background: C.text, color: '#fff', padding: '10px 16px',
        borderRadius: 8, fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'opacity 0.2s, transform 0.2s',
        opacity: toastVisible ? 1 : 0,
        transform: toastVisible ? 'translateY(0)' : 'translateY(10px)',
        pointerEvents: 'none', zIndex: 200,
      }}>
        {toastMsg}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Modal({ title, onClose, footer, children, maxWidth = 720 }: {
  title: string
  onClose: () => void
  footer: React.ReactNode
  children: React.ReactNode
  maxWidth?: number
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
    >
      <div style={{ background: '#fff', borderRadius: 8, maxWidth, width: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.text }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: C.muted, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: C.muted, margin: '0 0 10px', fontWeight: 600 }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13 }}>
      <label style={{ display: 'block', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</label>
      {children}
    </div>
  )
}

function FormGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
    fontSize: 13, background: '#fff', color: C.text, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box', ...extra,
  }
}

const inlineEditStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', border: '1px solid transparent',
  borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: 'transparent',
  color: C.text, transition: 'all 0.15s', boxSizing: 'border-box', outline: 'none',
}

const btnBase: React.CSSProperties = {
  padding: '8px 14px', border: `1px solid ${C.border}`, borderRadius: 8,
  background: C.surface, color: C.text, fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
}

const btnPrimary: React.CSSProperties = {
  ...btnBase, background: C.primary, color: '#fff', borderColor: C.primary,
}

const btnSm: React.CSSProperties = {
  ...btnBase, padding: '4px 10px', fontSize: 12,
}

function btnSmDanger(disabled: boolean): React.CSSProperties {
  return {
    ...btnSm,
    background: disabled ? '#F3F4F6' : C.danger,
    color: disabled ? C.muted : '#fff',
    borderColor: disabled ? C.border : C.danger,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}
