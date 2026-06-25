'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser, displayName } from '../components/UserContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Modulo = {
  id: string
  nome: string
  criado_por: string
  created_at: string
  arquivado?: boolean
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
  visibilidade?: 'todos' | 'restrito'
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
  open: boolean; title: string; onClose: () => void
  children: React.ReactNode; footer: React.ReactNode
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
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: '0 20px 50px rgba(16,24,40,0.25)', overflow: 'hidden' }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg, #2A4F96, #5B8DEF)' }} />
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E5E9F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E253D', margin: 0 }}>{title}</h3>
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
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 5, margin: '5px 0 0' }}>{hint}</p>}
    </div>
  )
}

// ─── Btn ─────────────────────────────────────────────────────────────────────

function Btn({ onClick, variant = 'default', size = 'md', disabled, children }: {
  onClick?: () => void
  variant?: 'default' | 'primary' | 'accent' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  disabled?: boolean
  children: React.ReactNode
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 8, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, border: '1px solid #D1D7E3',
    background: '#fff', color: '#1F2937', fontFamily: 'inherit', transition: 'all .15s',
    padding: size === 'sm' ? '6px 12px' : '10px 16px',
    fontSize: size === 'sm' ? 12 : 14,
  }
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: '#2A4F96', color: '#fff', borderColor: '#2A4F96' },
    accent:  { background: '#D1AE6E', color: '#4A3A1A', borderColor: '#D1AE6E' },
    ghost:   { border: '1px solid transparent', background: 'transparent', color: '#5a6178' },
    danger:  { background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...(variants[variant] ?? {}) }}>
      {children}
    </button>
  )
}

// ─── VisibilidadeToggle ───────────────────────────────────────────────────────

function VisibilidadeToggle({ value, onChange }: {
  value: 'todos' | 'restrito'
  onChange: (v: 'todos' | 'restrito') => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: value === 'restrito' ? '#FFF8EE' : '#F8FAFC', borderRadius: 8, border: `1px solid ${value === 'restrito' ? '#D1AE6E' : '#E5E9F0'}`, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onChange(value === 'todos' ? 'restrito' : 'todos')}
    >
      <div style={{ width: 34, height: 18, borderRadius: 10, background: value === 'restrito' ? '#D1AE6E' : '#CBD5E1', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: value === 'restrito' ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s' }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: value === 'restrito' ? '#92550A' : '#1F2937' }}>
          {value === 'restrito' ? '🔒 Restrito a gestor/admin' : '🌐 Visível para todos'}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
          {value === 'restrito' ? 'Colaboradores não verão esta sugestão' : 'Todos os usuários podem ver'}
        </div>
      </div>
    </div>
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
  const [autorFiltro, setAutorFiltro] = useState<'todos' | 'meus'>('todos')

  // Modals
  const [modalModulo, setModalModulo]     = useState(false)
  const [modalItem, setModalItem]         = useState(false)
  const [modalSugestao, setModalSugestao] = useState(false)
  const [pendingModuloId, setPendingModuloId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Arquivar confirm
  const [arquivarId, setArquivarId]     = useState<string | null>(null)
  const [arquivarStep, setArquivarStep] = useState<1 | 2>(1)

  // Edit item
  const [editItem, setEditItem]         = useState<Item | null>(null)
  const [formEditTexto, setFormEditTexto]   = useState('')
  const [formEditVisib, setFormEditVisib]   = useState<'todos' | 'restrito'>('todos')

  // Form state
  const [formNomeModulo,      setFormNomeModulo]      = useState('')
  const [formTextoItem,       setFormTextoItem]        = useState('')
  const [formVisibItem,       setFormVisibItem]        = useState<'todos' | 'restrito'>('todos')
  const [formTextoSugestao,   setFormTextoSugestao]   = useState('')
  const [formVisibSugestao,   setFormVisibSugestao]   = useState<'todos' | 'restrito'>('todos')
  const [formTipoSugestao,    setFormTipoSugestao]    = useState<'existente' | 'novo'>('existente')
  const [formModuloExistente, setFormModuloExistente] = useState('')
  const [formNomeNovoModulo,  setFormNomeNovoModulo]  = useState('')

  const meuNome   = displayName(profile, 'Usuário')
  const papel     = profile?.papel ?? 'colaborador'
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
        body: JSON.stringify({ tipo: 'item', modulo_id: pendingModuloId, texto: formTextoItem.trim(), origem: 'interna', visibilidade: formVisibItem }),
      })
      if (!res.ok) throw new Error()
      const novo: Item = await res.json()
      setItens(prev => [novo, ...prev])
      setModalItem(false)
      setFormTextoItem('')
      setFormVisibItem('todos')
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
        body: JSON.stringify({ tipo: 'item', modulo_id: moduloId, texto: formTextoSugestao.trim(), origem: 'sugestao', visibilidade: formVisibSugestao }),
      })
      if (!res.ok) throw new Error()
      const novo: Item = await res.json()
      setItens(prev => [novo, ...prev])
      setOpenModulos(prev => new Set([...prev, moduloId]))
      setViewMap(prev => ({ ...prev, [moduloId]: 'ativos' }))
      setModalSugestao(false)
      setFormTextoSugestao('')
      setFormNomeNovoModulo('')
      setFormVisibSugestao('todos')
      showToast('Sugestão enviada e destacada na lista')
    } catch { showToast('Erro ao enviar sugestão') }
    finally { setSaving(false) }
  }

  async function editarItem() {
    if (!editItem || !formEditTexto.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/coisas-a-fazer/itens/${editItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: formEditTexto.trim(), visibilidade: formEditVisib }),
      })
      if (!res.ok) throw new Error()
      const updated: Item = await res.json()
      setItens(prev => prev.map(i => i.id === updated.id ? updated : i))
      setEditItem(null)
      showToast('Item atualizado')
    } catch { showToast('Erro ao atualizar item') }
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

  function iniciarArquivar(id: string) {
    setArquivarId(id)
    setArquivarStep(1)
  }

  function cancelarArquivar() {
    setArquivarId(null)
    setArquivarStep(1)
  }

  async function confirmarArquivar() {
    if (!arquivarId) return
    if (arquivarStep === 1) { setArquivarStep(2); return }
    try {
      const res = await fetch('/api/coisas-a-fazer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo_id: arquivarId, arquivado: true }),
      })
      if (!res.ok) throw new Error()
      setModulos(prev => prev.filter(m => m.id !== arquivarId))
      cancelarArquivar()
      showToast('Módulo arquivado')
    } catch { showToast('Erro ao arquivar módulo') }
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

  function itensDo(moduloId: string, view: 'ativos' | 'historico') {
    return itens
      .filter(i => i.modulo_id === moduloId && i.status === (view === 'ativos' ? 'ativo' : 'finalizado'))
      .filter(i => autorFiltro === 'todos' || i.autor === meuNome)
      .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
  }

  function countAtivos(moduloId: string) {
    return itens.filter(i => i.modulo_id === moduloId && i.status === 'ativo'
      && (autorFiltro === 'todos' || i.autor === meuNome)).length
  }

  function countHistorico(moduloId: string) {
    return itens.filter(i => i.modulo_id === moduloId && i.status === 'finalizado'
      && (autorFiltro === 'todos' || i.autor === meuNome)).length
  }

  const arquivandoModulo = modulos.find(m => m.id === arquivarId)

  // ── Styles ─────────────────────────────────────────────────────────────────

  const inpStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #D1D7E3',
    borderRadius: 8, fontFamily: 'inherit', fontSize: 14, color: '#1F2937',
    outline: 'none', boxSizing: 'border-box',
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 24px 80px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1E253D', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <span style={{ fontSize: 26, color: '#D1AE6E' }}>✓</span>
            Coisas a Fazer
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4, margin: '4px 0 0' }}>Itens de melhoria por módulo do GT3 Sistema</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Filtro autor — só gestor/admin veem itens de outros */}
          {canManage && (
            <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #D1D7E3', borderRadius: 8, padding: 3 }}>
              {(['todos', 'meus'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setAutorFiltro(v)}
                  style={{
                    border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: autorFiltro === v ? '#2A4F96' : 'transparent',
                    color: autorFiltro === v ? '#fff' : '#6B7280',
                  }}
                >
                  {v === 'todos' ? 'Todos' : 'Criados por mim'}
                </button>
              ))}
            </div>
          )}

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
            setFormVisibSugestao('todos')
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
          <div
            key={mod.id}
            style={{
              background: '#fff',
              border: '1px solid rgba(42,79,150,0.14)',
              borderLeft: '3px solid #2A4F96',
              borderRadius: 12,
              marginBottom: 12,
              boxShadow: '0 1px 4px rgba(42,79,150,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Module head */}
            <div
              onClick={() => toggleModulo(mod.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', cursor: 'pointer', gap: 16, background: isOpen ? '#F5F8FF' : '#fff', transition: 'background .15s' }}
              onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}
              onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ fontSize: 11, color: isOpen ? '#2A4F96' : '#94A3B8', transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>▶</span>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: isOpen ? '#2A4F96' : '#EEF2FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'background .15s' }}>
                  <span style={{ filter: isOpen ? 'brightness(10)' : 'none' }}>📁</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1E253D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.nome}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Criado por {mod.criado_por}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: ativos > 0 ? '#EEF2FB' : '#F4F6FA',
                  color: ativos > 0 ? '#2A4F96' : '#94A3B8',
                  border: `1px solid ${ativos > 0 ? '#C9D6F0' : '#E5E9F0'}`,
                }}>
                  {ativos} ativo{ativos !== 1 ? 's' : ''}
                </span>
                {canManage && (
                  <button
                    onClick={e => { e.stopPropagation(); iniciarArquivar(mod.id) }}
                    title="Arquivar módulo"
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E5E9F0', background: '#fff', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}
                    onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#FEF2F2'; el.style.color = '#DC2626'; el.style.borderColor = '#FECACA' }}
                    onMouseLeave={e => { const el = e.currentTarget; el.style.background = '#fff'; el.style.color = '#94A3B8'; el.style.borderColor = '#E5E9F0' }}
                  >
                    ▣
                  </button>
                )}
              </div>
            </div>

            {/* Module body */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(42,79,150,0.10)' }}>

                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#F8FAFF', borderBottom: '1px solid rgba(42,79,150,0.08)', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 8, padding: 3 }}>
                    {(['ativos', 'historico'] as const).map(v => (
                      <button
                        key={v}
                        onClick={e => { e.stopPropagation(); setViewMap(prev => ({ ...prev, [mod.id]: v })) }}
                        style={{
                          border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12.5, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                          background: view === v ? '#2A4F96' : 'transparent',
                          color: view === v ? '#fff' : '#6B7280',
                        }}
                      >
                        {v === 'ativos' ? `▤ Ativos (${ativos})` : `↺ Histórico (${hist})`}
                      </button>
                    ))}
                  </div>
                  {canManage && (
                    <Btn size="sm" variant="ghost" onClick={() => { setPendingModuloId(mod.id); setFormTextoItem(''); setFormVisibItem('todos'); setModalItem(true) }}>
                      + Adicionar item
                    </Btn>
                  )}
                </div>

                {/* Item list */}
                <div style={{ padding: '6px 18px 16px' }}>
                  {items.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 13.5 }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{view === 'ativos' ? '✓' : '↺'}</div>
                      {view === 'ativos' ? 'Nenhum item ativo.' : 'Nenhum item no histórico.'}
                      {autorFiltro === 'meus' && <div style={{ fontSize: 12, marginTop: 4 }}>Filtrando só os seus itens — troque para "Todos" para ver tudo.</div>}
                    </div>
                  ) : items.map(item => {
                    const isSuggestion = item.origem === 'sugestao'
                    const isDone = item.status === 'finalizado'
                    const isRestrito = item.visibilidade === 'restrito'
                    return (
                      <div
                        key={item.id}
                        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 4px', borderBottom: '1px solid rgba(42,79,150,0.06)' }}
                      >
                        <div style={{ display: 'flex', gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 7,
                            background: isDone ? '#10B981' : isSuggestion ? '#D1AE6E' : '#2A4F96',
                          }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, color: isDone ? '#6B7280' : '#1E253D', lineHeight: 1.5, textDecoration: isDone ? 'line-through' : 'none' }}>
                              {item.texto}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              {isSuggestion && (
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', background: '#FFF8EE', color: '#92550A', padding: '2px 8px', borderRadius: 10, border: '1px solid #D1AE6E' }}>
                                  Sugestão de {item.autor}
                                </span>
                              )}
                              {!isSuggestion && (
                                <span style={{ fontSize: 11, color: '#94A3B8' }}>por {item.autor}</span>
                              )}
                              {isRestrito && canManage && (
                                <span style={{ fontSize: 11, fontWeight: 700, background: '#EEF2FB', color: '#2A4F96', padding: '2px 8px', borderRadius: 10, border: '1px solid #C9D6F0' }}>
                                  🔒 restrito
                                </span>
                              )}
                              <span>{fmtDate(item.criado_em)}</span>
                            </div>
                            {isDone && item.finalizado_por && (
                              <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 4 }}>
                                ✓ Finalizado por {item.finalizado_por} em {fmtDate(item.finalizado_em!)}
                              </div>
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            <button
                              onClick={() => { setEditItem(item); setFormEditTexto(item.texto); setFormEditVisib(item.visibilidade ?? 'todos') }}
                              title="Editar"
                              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E5E9F0', background: '#fff', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
                              onMouseEnter={e => { const el = e.currentTarget; el.style.color = '#2A4F96'; el.style.borderColor = '#C9D6F0'; el.style.background = '#EEF2FB' }}
                              onMouseLeave={e => { const el = e.currentTarget; el.style.color = '#6B7280'; el.style.borderColor = '#E5E9F0'; el.style.background = '#fff' }}
                            >✎</button>
                            {!isDone ? (
                              <button
                                onClick={() => finalizarItem(item.id)}
                                title="Marcar como finalizado"
                                style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E5E9F0', background: '#fff', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
                                onMouseEnter={e => { const el = e.currentTarget; el.style.color = '#10B981'; el.style.borderColor = '#6EE7B7'; el.style.background = '#ECFDF5' }}
                                onMouseLeave={e => { const el = e.currentTarget; el.style.color = '#6B7280'; el.style.borderColor = '#E5E9F0'; el.style.background = '#fff' }}
                              >✓</button>
                            ) : (
                              <button
                                onClick={() => reativarItem(item.id)}
                                title="Reativar pendência"
                                style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E5E9F0', background: '#fff', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
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
                  <div style={{ fontSize: 12, color: '#94A3B8', padding: '8px 18px', background: '#F8FAFF', borderTop: '1px solid rgba(42,79,150,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
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
        <Field label="Visibilidade">
          <VisibilidadeToggle value={formVisibItem} onChange={setFormVisibItem} />
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
                  flex: 1, border: '1px solid', borderRadius: 8, padding: 10, textAlign: 'center',
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

        <Field label="Visibilidade">
          <VisibilidadeToggle value={formVisibSugestao} onChange={setFormVisibSugestao} />
        </Field>
      </Modal>

      {/* ── Modal: Arquivar módulo ── */}
      <Modal
        open={!!arquivarId}
        title={arquivarStep === 1 ? 'Arquivar módulo' : 'Confirmar arquivamento'}
        onClose={cancelarArquivar}
        footer={
          <>
            <Btn variant="ghost" onClick={cancelarArquivar}>Cancelar</Btn>
            <Btn variant="danger" onClick={confirmarArquivar}>
              {arquivarStep === 1 ? 'Sim, arquivar' : 'Confirmar arquivamento'}
            </Btn>
          </>
        }
      >
        {arquivarStep === 1 ? (
          <div>
            <p style={{ fontSize: 14, color: '#1E253D', margin: '0 0 12px' }}>
              Tem certeza que deseja arquivar o módulo <strong>"{arquivandoModulo?.nome}"</strong>?
            </p>
            <div style={{ padding: '10px 14px', background: '#FFF8EE', border: '1px solid #D1AE6E', borderRadius: 8, fontSize: 13, color: '#92550A' }}>
              ⚠️ O módulo ficará oculto para todos os usuários. Os itens existentes serão preservados.
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: '#1E253D', margin: '0 0 12px' }}>
              Esta é a <strong>segunda confirmação</strong>. Após arquivado, o módulo <strong>"{arquivandoModulo?.nome}"</strong> não aparecerá mais na lista.
            </p>
            <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
              🔒 Clique em "Confirmar arquivamento" para prosseguir.
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Editar item ── */}
      <Modal open={!!editItem} title="Editar item" onClose={() => setEditItem(null)} footer={
        <>
          <Btn variant="ghost" onClick={() => setEditItem(null)}>Cancelar</Btn>
          <Btn variant="primary" onClick={editarItem} disabled={saving || !formEditTexto.trim()}>Salvar</Btn>
        </>
      }>
        <Field label="Texto">
          <textarea
            style={{ ...inpStyle, resize: 'vertical', minHeight: 80 }}
            value={formEditTexto}
            onChange={e => setFormEditTexto(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Visibilidade">
          <VisibilidadeToggle value={formEditVisib} onChange={setFormEditVisib} />
        </Field>
      </Modal>

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) translateY(${toast.visible ? 0 : 20}px)`,
        background: '#1E253D', color: '#fff', padding: '12px 20px', borderRadius: 10,
        fontSize: 14, fontWeight: 500, boxShadow: '0 4px 16px rgba(42,79,150,0.18)',
        opacity: toast.visible ? 1 : 0, transition: 'all .25s', zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#D1AE6E' }}>✓</span> {toast.msg}
      </div>
    </div>
  )
}
