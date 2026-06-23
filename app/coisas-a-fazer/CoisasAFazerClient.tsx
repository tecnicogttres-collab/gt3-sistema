'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser, displayName } from '../components/UserContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Modulo = {
  id: string
  nome: string
  criado_por: string
  created_at: string
}

type Item = {
  id: string
  modulo_id: string
  texto: string
  status: 'ativo' | 'finalizado'
  origem: 'interna' | 'sugestao'
  autor: string
  criado_em: string
  finalizado_por: string | null
  finalizado_em: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} às ${hh}:${mi}`
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; visible: boolean }>({ msg: '', visible: false })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show(msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ msg, visible: true })
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2400)
  }

  return { toast, show }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ open, title, onClose, children, footer }: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 20px 50px rgba(16,24,40,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E5E9F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E3A70', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E9F0', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
        <div style={{ padding: '16px 22px', borderTop: '1px solid #E5E9F0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#FAFBFD' }}>
          {footer}
        </div>
      </div>
    </div>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 5, margin: 0 }}>{hint}</p>}
    </div>
  )
}

// ─── Btn ─────────────────────────────────────────────────────────────────────

function Btn({ onClick, variant = 'default', size = 'md', disabled, children }: {
  onClick?: () => void
  variant?: 'default' | 'primary' | 'accent' | 'ghost'
  size?: 'md' | 'sm'
  disabled?: boolean
  children: React.ReactNode
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 10, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, border: '1px solid #D1D7E3',
    background: '#fff', color: '#1F2937', fontFamily: 'inherit', transition: 'all .15s',
    padding: size === 'sm' ? '6px 12px' : '10px 16px',
    fontSize: size === 'sm' ? 13 : 14,
  }
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: '#2A4F96', color: '#fff', borderColor: '#2A4F96' },
    accent:  { background: '#D1AE6E', color: '#4A3A1A', borderColor: '#D1AE6E' },
    ghost:   { border: '1px solid transparent', background: 'transparent' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...(variants[variant] ?? {}) }}>
      {children}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CoisasAFazerClient() {
  const { profile } = useUser()
  const { toast, show: showToast } = useToast()

  const [modulos, setModulos] = useState<Modulo[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [openModulos, setOpenModulos] = useState<Set<string>>(new Set())
  const [viewMap, setViewMap] = useState<Record<string, 'ativos' | 'historico'>>({})

  // Modals
  const [modalModulo, setModalModulo] = useState(false)
  const [modalItem, setModalItem] = useState(false)
  const [modalSugestao, setModalSugestao] = useState(false)
  const [pendingModuloId, setPendingModuloId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formNomeModulo, setFormNomeModulo] = useState('')
  const [formTextoItem, setFormTextoItem] = useState('')
  const [formTextoSugestao, setFormTextoSugestao] = useState('')
  const [formTipoSugestao, setFormTipoSugestao] = useState<'existente' | 'novo'>('existente')
  const [formModuloExistente, setFormModuloExistente] = useState('')
  const [formNomeNovoModulo, setFormNomeNovoModulo] = useState('')

  const meuNome = displayName(profile, 'Usuário')
  const papel = profile?.papel ?? 'colaborador'
  const canManage = papel === 'admin' || papel === 'gestor'

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/coisas-a-fazer')
      if (!res.ok) return
      const data = await res.json()
      setModulos(data.modulos ?? [])
      setItens(data.itens ?? [])
      if (data.modulos?.length) {
        setOpenModulos(new Set([data.modulos[0].id]))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function criarModulo() {
    if (!formNomeModulo.trim()) { showToast('Digite um nome para o módulo'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/coisas-a-fazer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'modulo', nome: formNomeModulo.trim() }),
      })
      if (!res.ok) throw new Error()
      const novo: Modulo = await res.json()
      setModulos(prev => [...prev, novo])
      setOpenModulos(prev => new Set([...prev, novo.id]))
      setModalModulo(false)
      setFormNomeModulo('')
      showToast('Módulo criado')
    } catch { showToast('Erro ao criar módulo') }
    finally { setSaving(false) }
  }

  async function adicionarItem() {
    if (!formTextoItem.trim() || !pendingModuloId) { showToast('Descreva o item'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/coisas-a-fazer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'item', modulo_id: pendingModuloId, texto: formTextoItem.trim(), origem: 'interna' }),
      })
      if (!res.ok) throw new Error()
      const novo: Item = await res.json()
      setItens(prev => [novo, ...prev])
      setModalItem(false)
      setFormTextoItem('')
      setViewMap(prev => ({ ...prev, [pendingModuloId]: 'ativos' }))
      showToast('Item adicionado')
    } catch { showToast('Erro ao adicionar item') }
    finally { setSaving(false) }
  }

  async function enviarSugestao() {
    if (!formTextoSugestao.trim()) { showToast('Descreva sua sugestão'); return }
    let moduloId = formModuloExistente
    setSaving(true)
    try {
      if (formTipoSugestao === 'novo') {
        if (!formNomeNovoModulo.trim()) { showToast('Digite o nome do módulo sugerido'); setSaving(false); return }
        const resM = await fetch('/api/coisas-a-fazer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: 'modulo', nome: formNomeNovoModulo.trim() }),
        })
        if (!resM.ok) throw new Error()
        const novoMod: Modulo = await resM.json()
        setModulos(prev => [...prev, novoMod])
        moduloId = novoMod.id
      }
      if (!moduloId) { showToast('Selecione um módulo'); setSaving(false); return }
      const res = await fetch('/api/coisas-a-fazer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'item', modulo_id: moduloId, texto: formTextoSugestao.trim(), origem: 'sugestao' }),
      })
      if (!res.ok) throw new Error()
      const novo: Item = await res.json()
      setItens(prev => [novo, ...prev])
      setOpenModulos(prev => new Set([...prev, moduloId]))
      setViewMap(prev => ({ ...prev, [moduloId]: 'ativos' }))
      setModalSugestao(false)
      setFormTextoSugestao('')
      setFormNomeNovoModulo('')
      showToast('Sugestão enviada e destacada na lista')
    } catch { showToast('Erro ao enviar sugestão') }
    finally { setSaving(false) }
  }

  async function finalizarItem(id: string) {
    try {
      const res = await fetch(`/api/coisas-a-fazer/itens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'finalizado' }),
      })
      if (!res.ok) return
      const updated: Item = await res.json()
      setItens(prev => prev.map(i => i.id === id ? updated : i))
      showToast('Item movido para o histórico')
    } catch { showToast('Erro') }
  }

  async function reativarItem(id: string) {
    try {
      const res = await fetch(`/api/coisas-a-fazer/itens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ativo' }),
      })
      if (!res.ok) return
      const updated: Item = await res.json()
      setItens(prev => prev.map(i => i.id === id ? updated : i))
      showToast('Pendência reativada')
    } catch { showToast('Erro') }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleModulo(id: string) {
    setOpenModulos(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function getView(id: string): 'ativos' | 'historico' {
    return viewMap[id] ?? 'ativos'
  }

  function countAtivos(moduloId: string) {
    return itens.filter(i => i.modulo_id === moduloId && i.status === 'ativo').length
  }

  function countHistorico(moduloId: string) {
    return itens.filter(i => i.modulo_id === moduloId && i.status === 'finalizado').length
  }

  function itensDo(moduloId: string, view: 'ativos' | 'historico') {
    return itens
      .filter(i => i.modulo_id === moduloId && i.status === (view === 'ativos' ? 'ativo' : 'finalizado'))
      .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const inpStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #D1D7E3',
    borderRadius: 6, fontFamily: 'inherit', fontSize: 14, color: '#1F2937',
    outline: 'none', boxSizing: 'border-box',
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 24px 80px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1E3A70', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <span style={{ fontSize: 26, color: '#D1AE6E' }}>✓</span>
            Coisas a Fazer
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4, margin: '4px 0 0' }}>Itens de melhoria por módulo do GT3 Sistema</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {canManage && (
            <Btn variant="primary" onClick={() => { setFormNomeModulo(''); setModalModulo(true) }}>
              + Novo módulo
            </Btn>
          )}
          <Btn variant="accent" onClick={() => {
            setFormTextoSugestao('')
            setFormNomeNovoModulo('')
            setFormTipoSugestao('existente')
            setFormModuloExistente(modulos[0]?.id ?? '')
            setModalSugestao(true)
          }}>
            💡 Sugestão
          </Btn>
        </div>
      </div>

      {/* Module list */}
      {loading && <p style={{ color: '#9CA3AF', fontSize: 14 }}>Carregando…</p>}

      {!loading && modulos.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E9F0', borderRadius: 14, padding: '28px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13.5 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>📂</div>
          Nenhum módulo cadastrado ainda.
        </div>
      )}

      {modulos.map(mod => {
        const isOpen = openModulos.has(mod.id)
        const view = getView(mod.id)
        const ativos = countAtivos(mod.id)
        const hist = countHistorico(mod.id)
        const items = itensDo(mod.id, view)

        return (
          <div key={mod.id} style={{ background: '#fff', border: '1px solid #E5E9F0', borderRadius: 14, marginBottom: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.05)', overflow: 'hidden' }}>

            {/* Module head */}
            <div
              onClick={() => toggleModulo(mod.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', cursor: 'pointer', gap: 16 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFBFD' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <span style={{ fontSize: 14, color: isOpen ? '#2A4F96' : '#9CA3AF', transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>▶</span>
                <div style={{ width: 38, height: 38, borderRadius: 6, background: '#EEF2FB', color: '#2A4F96', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📁</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.nome}</div>
                  <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 2 }}>Criado por {mod.criado_por}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span style={{
                  fontSize: 12.5, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                  background: ativos > 0 ? '#EEF2FB' : '#F4F6FA',
                  color: ativos > 0 ? '#2A4F96' : '#6B7280',
                  border: `1px solid ${ativos > 0 ? '#D6E0F5' : '#E5E9F0'}`,
                }}>
                  {ativos} ativo{ativos !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Module body */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #E5E9F0' }}>

                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#FAFBFD', borderBottom: '1px solid #E5E9F0', flexWrap: 'wrap', gap: 10 }}>
                  {/* View toggle */}
                  <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #D1D7E3', borderRadius: 10, padding: 3 }}>
                    {(['ativos', 'historico'] as const).map(v => (
                      <button
                        key={v}
                        onClick={e => { e.stopPropagation(); setViewMap(prev => ({ ...prev, [mod.id]: v })) }}
                        style={{
                          border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                          background: view === v ? '#2A4F96' : 'transparent',
                          color: view === v ? '#fff' : '#6B7280',
                        }}
                      >
                        {v === 'ativos' ? `▤ Ativos (${ativos})` : `↺ Histórico (${hist})`}
                      </button>
                    ))}
                  </div>
                  {canManage && (
                    <Btn size="sm" variant="ghost" onClick={() => { setPendingModuloId(mod.id); setFormTextoItem(''); setModalItem(true) }}>
                      + Adicionar item
                    </Btn>
                  )}
                </div>

                {/* Item list */}
                <div style={{ padding: '8px 20px 18px' }}>
                  {items.length === 0 ? (
                    <div style={{ padding: '28px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13.5 }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{view === 'ativos' ? '✓' : '↺'}</div>
                      {view === 'ativos' ? 'Nenhum item ativo. Tudo certo por aqui.' : 'Nenhum item no histórico ainda.'}
                    </div>
                  ) : items.map(item => {
                    const isSuggestion = item.origem === 'sugestao'
                    const isDone = item.status === 'finalizado'
                    return (
                      <div
                        key={item.id}
                        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 4px', borderBottom: '1px solid #F0F2F6' }}
                      >
                        <div style={{ display: 'flex', gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6, background: isDone ? '#1D9E75' : isSuggestion ? '#D4537E' : '#2A4F96' }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, color: isDone ? '#6B7280' : '#1F2937', lineHeight: 1.5, textDecoration: isDone ? 'line-through' : 'none' }}>{item.texto}</div>
                            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              {isSuggestion && (
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', background: '#FBEAF0', color: '#72243E', padding: '2px 8px', borderRadius: 10, border: '1px solid #ED93B1' }}>
                                  Sugestão de {item.autor}
                                </span>
                              )}
                              <span>{fmtDate(item.criado_em)}</span>
                            </div>
                            {isDone && item.finalizado_por && (
                              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                                ✓ Finalizado por {item.finalizado_por} em {fmtDate(item.finalizado_em!)}
                              </div>
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {!isDone ? (
                              <button
                                onClick={() => finalizarItem(item.id)}
                                title="Marcar como finalizado"
                                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E9F0', background: '#fff', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}
                                onMouseEnter={e => { const el = e.currentTarget; el.style.color = '#1D9E75'; el.style.borderColor = '#B7E4D3'; el.style.background = '#E1F5EE' }}
                                onMouseLeave={e => { const el = e.currentTarget; el.style.color = '#6B7280'; el.style.borderColor = '#E5E9F0'; el.style.background = '#fff' }}
                              >✓</button>
                            ) : (
                              <button
                                onClick={() => reativarItem(item.id)}
                                title="Reativar pendência"
                                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E9F0', background: '#fff', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}
                                onMouseEnter={e => { const el = e.currentTarget; el.style.color = '#2A4F96'; el.style.borderColor = '#C9D6F0'; el.style.background = '#EEF2FB' }}
                                onMouseLeave={e => { const el = e.currentTarget; el.style.color = '#6B7280'; el.style.borderColor = '#E5E9F0'; el.style.background = '#fff' }}
                              >↺</button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {!canManage && (
                  <div style={{ fontSize: 12.5, color: '#9CA3AF', padding: '10px 20px', background: '#FAFBFD', borderTop: '1px solid #E5E9F0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⓘ Apenas admin e gestor podem finalizar ou reativar itens.
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Modal: Novo módulo ── */}
      <Modal open={modalModulo} title="Novo módulo" onClose={() => setModalModulo(false)} footer={
        <>
          <Btn variant="ghost" onClick={() => setModalModulo(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={criarModulo} disabled={saving}>Criar módulo</Btn>
        </>
      }>
        <Field label="Nome do módulo">
          <input
            style={inpStyle}
            value={formNomeModulo}
            onChange={e => setFormNomeModulo(e.target.value)}
            placeholder="Ex.: Observações, PDI, Cadastro Contratantes..."
            onKeyDown={e => { if (e.key === 'Enter') criarModulo() }}
            autoFocus
          />
        </Field>
      </Modal>

      {/* ── Modal: Adicionar item ── */}
      <Modal open={modalItem} title="Novo item" onClose={() => setModalItem(false)} footer={
        <>
          <Btn variant="ghost" onClick={() => setModalItem(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={adicionarItem} disabled={saving}>Adicionar</Btn>
        </>
      }>
        <Field label="Descreva o que precisa ser melhorado">
          <textarea
            style={{ ...inpStyle, resize: 'vertical', minHeight: 80 }}
            value={formTextoItem}
            onChange={e => setFormTextoItem(e.target.value)}
            placeholder="Ex.: Revisar coluna de status no card de NR 35..."
            autoFocus
          />
        </Field>
      </Modal>

      {/* ── Modal: Sugestão ── */}
      <Modal open={modalSugestao} title="Enviar sugestão" onClose={() => setModalSugestao(false)} footer={
        <>
          <Btn variant="ghost" onClick={() => setModalSugestao(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={enviarSugestao} disabled={saving}>Enviar sugestão</Btn>
        </>
      }>
        <Field label="Tipo de sugestão">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['existente', 'novo'] as const).map(tipo => (
              <div
                key={tipo}
                onClick={() => setFormTipoSugestao(tipo)}
                style={{
                  flex: 1, border: '1px solid', borderRadius: 6, padding: 10, textAlign: 'center',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                  borderColor: formTipoSugestao === tipo ? '#2A4F96' : '#D1D7E3',
                  background: formTipoSugestao === tipo ? '#EEF2FB' : '#fff',
                  color: formTipoSugestao === tipo ? '#2A4F96' : '#6B7280',
                }}
              >
                {tipo === 'existente' ? 'Módulo existente' : 'Novo módulo'}
              </div>
            ))}
          </div>
        </Field>

        {formTipoSugestao === 'existente' ? (
          <Field label="Selecione o módulo">
            <select
              style={inpStyle}
              value={formModuloExistente}
              onChange={e => setFormModuloExistente(e.target.value)}
            >
              {modulos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Nome do módulo sugerido">
            <input
              style={inpStyle}
              value={formNomeNovoModulo}
              onChange={e => setFormNomeNovoModulo(e.target.value)}
              placeholder="Ex.: Módulo de Atas"
            />
          </Field>
        )}

        <Field label="O que precisa ser melhorado ou criado?" hint="Sua sugestão entra direto na lista, destacada com seu nome.">
          <textarea
            style={{ ...inpStyle, resize: 'vertical', minHeight: 80 }}
            value={formTextoSugestao}
            onChange={e => setFormTextoSugestao(e.target.value)}
            placeholder="Descreva livremente..."
          />
        </Field>
      </Modal>

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) translateY(${toast.visible ? 0 : 20}px)`,
        background: '#1F2937', color: '#fff', padding: '12px 20px', borderRadius: 10,
        fontSize: 14, fontWeight: 500, boxShadow: '0 4px 12px rgba(16,24,40,0.08)',
        opacity: toast.visible ? 1 : 0, transition: 'all .25s', zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#7FD9B5' }}>✓</span> {toast.msg}
      </div>
    </div>
  )
}
