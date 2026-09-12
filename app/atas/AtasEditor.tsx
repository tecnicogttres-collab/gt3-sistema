'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Rich Text Editor ─────────────────────────────────────────────────────────

const FONT_COLORS = ['#1a1f2e', '#DC2626', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#6B7280']
const HILITE_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA', '#E9D5FF', '#FECACA', 'transparent']

function RichTextEditor({ value, onChange, placeholder, minRows = 3, resizable = false }: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minRows?: number
  resizable?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const focused = useRef(false)
  const [colorPicker, setColorPicker] = useState<null | 'fore' | 'hilite'>(null)

  useEffect(() => {
    if (!ref.current) return
    // Sync only on mount or when externally cleared
    if (!focused.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value
    }
  }, [value])

  const execCmd = (cmd: string, val?: string) => {
    ref.current?.focus()
    try { document.execCommand('styleWithCSS', false, 'true') } catch {}
    document.execCommand(cmd, false, val)
    onChange(ref.current?.innerHTML ?? '')
  }

  const toolbarBtns = [
    { label: 'N', title: 'Negrito', cmd: 'bold',          style: { fontWeight: 800 } },
    { label: 'I', title: 'Itálico', cmd: 'italic',         style: { fontStyle: 'italic' } },
    { label: 'S', title: 'Sublinhado', cmd: 'underline',   style: { textDecoration: 'underline' } },
    { label: 'T', title: 'Tachado',  cmd: 'strikeThrough', style: { textDecoration: 'line-through' } },
  ]

  const btnBase: React.CSSProperties = { width: 24, height: 22, border: 'none', borderRadius: 4, background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#2A4F96', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <div style={{ border: '1px solid rgba(42,79,150,0.18)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid rgba(42,79,150,0.09)', background: '#F8FAFC', position: 'relative' }}>
        {toolbarBtns.map(btn => (
          <button
            key={btn.cmd}
            title={btn.title}
            onMouseDown={e => { e.preventDefault(); execCmd(btn.cmd) }}
            style={{ ...btnBase, ...btn.style }}
          >{btn.label}</button>
        ))}
        <div style={{ width: 1, height: 14, background: 'rgba(42,79,150,0.15)', margin: '0 3px' }} />
        <button title="Lista" onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList') }} style={btnBase}>≡</button>
        <div style={{ width: 1, height: 14, background: 'rgba(42,79,150,0.15)', margin: '0 3px' }} />
        {/* Cor da letra */}
        <button title="Cor da letra" onMouseDown={e => { e.preventDefault(); setColorPicker(p => p === 'fore' ? null : 'fore') }} style={{ ...btnBase, flexDirection: 'column', gap: 0, lineHeight: 1 }}>
          <span style={{ fontWeight: 700 }}>A</span>
          <span style={{ width: 14, height: 3, background: '#DC2626', borderRadius: 1 }} />
        </button>
        {/* Grifar / realce */}
        <button title="Grifar (realce)" onMouseDown={e => { e.preventDefault(); setColorPicker(p => p === 'hilite' ? null : 'hilite') }} style={{ ...btnBase, background: '#FEF08A55' }}>🖍</button>

        {colorPicker && (
          <div style={{ position: 'absolute', top: 28, left: colorPicker === 'fore' ? 156 : 184, zIndex: 30, background: '#fff', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', width: 132 }}>
            {(colorPicker === 'fore' ? FONT_COLORS : HILITE_COLORS).map(c => (
              <button
                key={c}
                onMouseDown={e => {
                  e.preventDefault()
                  if (colorPicker === 'fore') execCmd('foreColor', c)
                  else execCmd('hiliteColor', c === 'transparent' ? '#ffffff00' : c)
                  setColorPicker(null)
                }}
                title={c === 'transparent' ? 'Remover realce' : c}
                style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid rgba(0,0,0,0.12)', background: c === 'transparent' ? 'repeating-linear-gradient(45deg,#fff,#fff 4px,#eee 4px,#eee 8px)' : c, cursor: 'pointer' }}
              />
            ))}
          </div>
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => { focused.current = true }}
        onBlur={() => { focused.current = false; setColorPicker(null) }}
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        style={{ minHeight: minRows * 26, maxHeight: resizable ? 600 : undefined, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', color: '#1a1f2e', outline: 'none', lineHeight: 1.65, overflowWrap: 'break-word' as const, resize: resizable ? 'vertical' : 'none', overflow: resizable ? 'auto' : 'visible' }}
      />
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Participante = { nome: string; empresa: string }

export type TopicoHistorico = {
  data: string   // YYYY-MM-DD
  texto: string
}

export type TopicoStatus = '' | 'Pendente' | 'Em análise' | 'Em andamento' | 'Acompanhamento' | 'Concluído' | 'Cancelado'

export type Topico = {
  id: string
  titulo: string
  andamentoGeral?: string   // andamento persistente do tópico (não vira histórico)
  descricao: string         // preenchimento do dia ("ATÉ AQUI:") — vira histórico na nova reunião
  contratante: string
  prazo: string
  responsavel: string
  status?: TopicoStatus
  cor?: string
  historico?: TopicoHistorico[]
  finalizado?: boolean
  finalizado_em?: string
}

export type AtaEditorData = {
  titulo: string
  data: string
  cliente?: string
  localReuniao: string
  numeroAta: string
  participantes: string   // JSON: Participante[]
  status: string
  conteudo: string        // JSON: Topico[]
  notifyUserIds?: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _cnt = 0
function uid() { return `t${Date.now()}_${++_cnt}` }

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  'Pendente':      { color: '#92400E', bg: '#FEF3C7', label: '● Pendente' },
  'Em análise':    { color: '#6D28D9', bg: '#EDE9FE', label: '◔ Em análise' },
  'Em andamento':  { color: '#1D4ED8', bg: '#DBEAFE', label: '◑ Em andamento' },
  'Acompanhamento':{ color: '#0F766E', bg: '#CCFBF1', label: '↻ Acompanhamento' },
  'Concluído':     { color: '#065F46', bg: '#D1FAE5', label: '✓ Concluído' },
  'Cancelado':     { color: '#6B7280', bg: '#F3F4F6', label: '✕ Cancelado' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status]
  if (!s) return null
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      color: s.color, background: s.bg,
    }}>{s.label}</span>
  )
}

function parseClientes(val: string): string[] {
  if (!val?.trim()) return []
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p.map(String) } catch {}
  return val.split('/').map(s => s.trim()).filter(Boolean)
}

function parseParticipantes(val?: string): Participante[] {
  if (!val?.trim()) return []
  try {
    const parsed = JSON.parse(val)
    if (Array.isArray(parsed)) return parsed
  } catch { /* legacy plain text */ }
  return val.split(/[,;]/).map(s => ({ nome: s.trim(), empresa: '' })).filter(p => p.nome)
}

function parseTopicos(val?: string): Topico[] {
  if (!val?.trim()) return []
  try {
    const parsed = JSON.parse(val)
    if (Array.isArray(parsed)) return parsed
  } catch { /* legacy HTML */ }
  return [{ id: uid(), titulo: 'Pontos discutidos', descricao: val ?? '', contratante: '', prazo: '', responsavel: '' }]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ATAS_STATUS = ['Rascunho', 'Aguardando Validação', 'Validada']
const STATUS_COLOR: Record<string, string> = {
  'Rascunho': '#94A3B8',
  'Aguardando Validação': '#F59E0B',
  'Validada': '#10B981',
}

const TOPIC_COLORS = ['#2A4F96', '#5B8DEF', '#10B981', '#059669', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B']

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', border: '1px solid rgba(42,79,150,0.20)', borderRadius: 7,
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', color: '#1a1f2e',
  background: '#fff', outline: 'none', boxSizing: 'border-box', ...extra,
})

const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase',
  letterSpacing: '0.08em', display: 'block', marginBottom: 4,
}

const sectionTitle = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: 11, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center',
  gap: 8, ...extra,
})

// ─── Component ────────────────────────────────────────────────────────────────

export default function AtasEditor({ initial, onSave, onClose, enableNotifModal, availableUsers }: {
  initial?: Partial<AtaEditorData>
  onSave: (data: AtaEditorData) => Promise<void>
  onClose: () => void
  enableNotifModal?: boolean
  availableUsers?: { id: string; nome: string }[]
}) {
  // Meta fields
  const [titulo,   setTitulo]   = useState(initial?.titulo          ?? '')
  const [dataVal,  setDataVal]  = useState(initial?.data            ?? new Date().toISOString().slice(0, 10))
  const [clientes, setClientes] = useState<string[]>(() => parseClientes(initial?.cliente ?? ''))
  const [local,    setLocal]    = useState(initial?.localReuniao    ?? '')
  const [numAta,   setNumAta]   = useState(initial?.numeroAta       ?? '')
  const [status,   setStatus]   = useState(initial?.status         ?? 'Rascunho')

  // Participantes
  const [participantes, setParticipantes] = useState<Participante[]>(
    () => parseParticipantes(initial?.participantes)
  )
  const [addClienteInput, setAddClienteInput] = useState('')
  const [addPartInputs, setAddPartInputs] = useState<Record<string, string>>({})

  // Tópicos
  const [topicos, setTopicos] = useState<Topico[]>(
    () => parseTopicos(initial?.conteudo)
  )
  const [colorPickerOpenId, setColorPickerOpenId] = useState<string | null>(null)
  const [historyOpenId,    setHistoryOpenId]    = useState<string | null>(null)
  const [addHistForm,      setAddHistForm]      = useState<{ topicId: string; data: string; texto: string } | null>(null)


  // Save
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  // Notification modal
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [notifOption,    setNotifOption]    = useState<'none' | 'all' | 'select'>('none')
  const [notifSelected,  setNotifSelected]  = useState<Set<string>>(new Set())

  // ── Participante / Contratante actions ────────────────────────────────────

  function addCliente() {
    const v = addClienteInput.trim()
    if (!v || clientes.includes(v)) return
    setClientes(prev => [...prev, v])
    setAddClienteInput('')
  }

  function removeCliente(idx: number) {
    setClientes(prev => prev.filter((_, i) => i !== idx))
  }

  function addPartToCompany(empresa: string) {
    const nome = (addPartInputs[empresa] ?? '').trim()
    if (!nome) return
    setParticipantes(prev => [...prev, { nome, empresa }])
    setAddPartInputs(prev => ({ ...prev, [empresa]: '' }))
  }

  function removePart(idx: number) {
    setParticipantes(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Tópico actions ────────────────────────────────────────────────────────

  function addTopico() {
    setTopicos(prev => [...prev, {
      id: uid(), titulo: '', andamentoGeral: '', descricao: '',
      contratante: '', prazo: '', responsavel: '',
    }])
    setTimeout(() => {
      document.getElementById('topico-last')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  function updateTopico(id: string, field: keyof Topico, value: string) {
    setTopicos(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  function removeTopico(id: string) {
    setTopicos(prev => prev.filter(t => t.id !== id))
  }

  /** Move o tópico pra seção "Tópicos finalizados nesta reunião" (some da lista ativa
   *  daqui pra frente) — usa a data da própria reunião, não a data de hoje, como
   *  finalizado_em. Só entra no banco quando a ata for salva, como qualquer outra edição. */
  function finalizarTopico(id: string) {
    setTopicos(prev => prev.map(t => t.id === id
      ? { ...t, finalizado: true, finalizado_em: dataVal || new Date().toISOString().slice(0, 10) }
      : t
    ))
  }

  function arquivarDescricao(topicId: string) {
    const topico = topicos.find(t => t.id === topicId)
    if (!topico?.descricao.trim()) return
    const entry: TopicoHistorico = { data: dataVal || new Date().toISOString().slice(0, 10), texto: topico.descricao }
    setTopicos(prev => prev.map(t => t.id === topicId
      ? { ...t, descricao: '', historico: [entry, ...(t.historico ?? [])] }
      : t
    ))
    setHistoryOpenId(topicId)
  }

  function addHistoricoEntry(topicId: string, data: string, texto: string) {
    if (!texto.trim()) return
    const entry: TopicoHistorico = { data: data || new Date().toISOString().slice(0, 10), texto: texto.trim() }
    setTopicos(prev => prev.map(t => t.id === topicId
      ? { ...t, historico: [...(t.historico ?? []), entry].sort((a, b) => b.data.localeCompare(a.data)) }
      : t
    ))
    setAddHistForm(null)
  }

  function removeHistoricoEntry(topicId: string, idx: number) {
    setTopicos(prev => prev.map(t => t.id === topicId
      ? { ...t, historico: (t.historico ?? []).filter((_, i) => i !== idx) }
      : t
    ))
  }

  function moveTopico(id: string, dir: -1 | 1) {
    setTopicos(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const tgt = idx + dir
      if (tgt < 0 || tgt >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[tgt]] = [next[tgt], next[idx]]
      return next
    })
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!dataVal) { setErr('Data é obrigatória'); return }
    if (clientes.length === 0) { setErr('Informe ao menos um contratante'); return }

    if (enableNotifModal && status === 'Validada') {
      setNotifOption('none')
      setNotifSelected(new Set())
      setNotifModalOpen(true)
      return
    }

    await doSave()
  }

  async function doSave(notifyUserIds?: string[]) {
    setSaving(true); setErr('')
    try {
      await onSave({
        titulo,
        data: dataVal,
        cliente: clientes.join(' / '),
        localReuniao: local,
        numeroAta: numAta,
        participantes: JSON.stringify(participantes),
        status,
        conteudo: JSON.stringify(topicos),
        notifyUserIds,
      })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  async function handleNotifConfirm() {
    setNotifModalOpen(false)
    let notifyUserIds: string[] | undefined
    if (notifOption === 'all') {
      notifyUserIds = (availableUsers ?? []).map(u => u.id)
    } else if (notifOption === 'select') {
      notifyUserIds = [...notifSelected]
    }
    await doSave(notifyUserIds)
  }

  // ── Print ────────────────────────────────────────────────────────────────

  function handlePrint() { window.print() }

  // ── Date display ─────────────────────────────────────────────────────────

  const dateDisplay = dataVal
    ? new Date(dataVal + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  const stColor = STATUS_COLOR[status] ?? '#94A3B8'

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#F0F3F9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Print + richtext styles */}
      <style>{`
        @media screen { #gt3-ata-print { display: none !important; } }
        @media print {
          body * { visibility: hidden !important; }
          #gt3-ata-print { visibility: visible !important; display: block !important; position: absolute; top: 0; left: 0; width: 100%; }
          #gt3-ata-print * { visibility: visible !important; }
        }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #adb5bd; pointer-events: none; display: block; }
        [contenteditable] ul { margin: 4px 0; padding-left: 20px; }
        [contenteditable] li { margin: 2px 0; }
      `}</style>

      {/* ── Topbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
        background: '#fff', borderBottom: '1px solid rgba(42,79,150,0.10)',
        flexShrink: 0, boxShadow: '0 1px 4px rgba(42,79,150,0.07)', zIndex: 10,
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#2A4F96', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>GT3</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#2A4F96', paddingRight: 12, borderRight: '1px solid rgba(42,79,150,0.12)', marginRight: 4 }}>
          Atas Contratantes
        </span>
        <span style={{ fontSize: 13, color: '#6B7A99', flexShrink: 0 }}>
          {clientes.join(' / ') || 'Nova ata'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {err && <span style={{ fontSize: 12, color: '#EF4444' }}>{err}</span>}

          {/* Status */}
          <button
            onClick={() => { const i = ATAS_STATUS.indexOf(status); setStatus(ATAS_STATUS[(i + 1) % 3]) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${stColor}33`, background: `${stColor}18`, color: stColor, whiteSpace: 'nowrap' }}
          >
            ● {status}
          </button>

          <button onClick={handlePrint} style={{ height: 30, padding: '0 14px', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 6, background: '#fff', fontSize: 12, color: '#5a6178', cursor: 'pointer' }}>
            🖨 PDF
          </button>
          <button onClick={onClose} style={{ height: 30, padding: '0 14px', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 6, background: '#fff', fontSize: 12, color: '#5a6178', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{ height: 30, padding: '0 18px', border: 'none', borderRadius: 6, background: '#2A4F96', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{ width: '100%', maxWidth: 820, background: '#fff', borderRadius: 16, border: '1px solid rgba(42,79,150,0.10)', boxShadow: '0 4px 20px rgba(42,79,150,0.08)', overflow: 'hidden', flexShrink: 0 }}
        >
          {/* Blue top bar */}
          <div style={{ height: 5, background: 'linear-gradient(90deg, #2A4F96, #5B8DEF)' }} />

          <div style={{ padding: '36px 44px 44px' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 22, borderBottom: '1px solid rgba(42,79,150,0.12)', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <input
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Título da ata (opcional)…"
                  style={{ fontSize: 20, fontWeight: 700, color: '#2A4F96', border: 'none', outline: 'none', width: '100%', background: 'transparent', fontFamily: 'inherit', padding: 0, marginBottom: 4 }}
                />
                <div style={{ fontSize: 13, color: '#6B7A99' }}>{dateDisplay}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ display: 'inline-block', padding: '3px 12px', background: '#D1AE6E', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  {numAta || 'Nº —/—'}
                </div>
              </div>
            </div>

            {/* ── Meta fields ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 32, padding: '16px 18px', background: '#F8FAFC', borderRadius: 10, border: '1px solid rgba(42,79,150,0.08)' }}>
              {/* Multi-contratante */}
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={lbl}>Contratante(s) *</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '6px 8px', border: '1px solid rgba(42,79,150,0.20)', borderRadius: 7, background: '#fff', minHeight: 38 }}>
                  {clientes.map((c, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 10px', background: '#EEF2FB', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#2A4F96' }}>
                      {c}
                      <button onClick={() => removeCliente(i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(42,79,150,0.15)', color: '#2A4F96', cursor: 'pointer', fontSize: 11, padding: 0 }}>×</button>
                    </span>
                  ))}
                  <input
                    value={addClienteInput}
                    onChange={e => setAddClienteInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCliente() } }}
                    onBlur={addCliente}
                    placeholder={clientes.length === 0 ? 'Ex.: Marcopolo AR — pressione Enter para adicionar…' : '+ outro contratante…'}
                    style={{ flex: 1, minWidth: 160, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', background: 'transparent', color: '#1a1f2e', padding: '2px 4px' }}
                  />
                </div>
              </div>
              <div>
                <span style={lbl}>Data da reunião</span>
                <input type="date" value={dataVal} onChange={e => setDataVal(e.target.value)} style={inp()} />
              </div>
              <div>
                <span style={lbl}>Local</span>
                <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Online / Caxias do Sul — RS" style={inp()} />
              </div>
              <div>
                <span style={lbl}>Número da ata</span>
                <input value={numAta} onChange={e => setNumAta(e.target.value)} placeholder="Ex.: Nº 04/26" style={inp()} />
              </div>
            </div>

            {/* ── Participantes por empresa ── */}
            {(() => {
              const groups: { label: string; key: string; accent: string; bg: string; chipBg: string }[] = [
                { label: 'GT3 Consultoria', key: 'GT3', accent: '#2A4F96', bg: '#EEF2FB', chipBg: '#DDE5F8' },
                ...clientes.map(c => ({ label: c, key: c, accent: '#92400E', bg: '#FDF8EE', chipBg: '#FDEFD0' })),
              ]
              const knownKeys = new Set(['GT3', 'GT3 Consultoria', ...clientes])
              const otherParts = participantes.map((p, idx) => ({ p, idx })).filter(({ p }) => !knownKeys.has(p.empresa))
              return (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ ...sectionTitle(), borderBottom: '1px solid rgba(42,79,150,0.10)', paddingBottom: 8, marginBottom: 14 }}>
                    <span>Participantes</span>
                    <span style={{ fontWeight: 400, color: '#94A3B8', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                      {participantes.length} pessoa{participantes.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {groups.map(g => {
                      const members = participantes
                        .map((p, idx) => ({ p, idx }))
                        .filter(({ p }) => p.empresa === g.key || (g.key === 'GT3' && p.empresa === 'GT3 Consultoria'))
                      const inputVal = addPartInputs[g.key] ?? ''
                      return (
                        <div key={g.key} style={{ border: `1px solid ${g.accent}22`, borderLeft: `3px solid ${g.accent}`, borderRadius: 8, background: g.bg, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: g.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{g.label}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            {members.map(({ p, idx }) => (
                              <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px 4px 10px', background: g.chipBg, borderRadius: 20, fontSize: 13, fontWeight: 500, color: '#1a1f2e' }}>
                                {p.nome}
                                <button onClick={() => removePart(idx)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', border: 'none', background: `${g.accent}22`, color: g.accent, cursor: 'pointer', fontSize: 11, padding: 0 }}>×</button>
                              </span>
                            ))}
                            <input
                              value={inputVal}
                              onChange={e => setAddPartInputs(prev => ({ ...prev, [g.key]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPartToCompany(g.key) } }}
                              placeholder="+ nome…"
                              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', color: '#1a1f2e', padding: '4px 6px', minWidth: 80 }}
                            />
                          </div>
                        </div>
                      )
                    })}

                    {/* Participantes sem empresa conhecida (legado) */}
                    {otherParts.length > 0 && (
                      <div style={{ border: '1px solid rgba(42,79,150,0.12)', borderRadius: 8, background: '#F8FAFC', padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Outros</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {otherParts.map(({ p, idx }) => (
                            <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px 4px 10px', background: '#E5E7EB', borderRadius: 20, fontSize: 13 }}>
                              {p.nome}{p.empresa ? ` (${p.empresa})` : ''}
                              <button onClick={() => removePart(idx)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', border: 'none', background: '#d1d5db', color: '#374151', cursor: 'pointer', fontSize: 11, padding: 0 }}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── Tópicos ── */}
            <div>
              <div style={{ ...sectionTitle(), borderBottom: '1px solid rgba(42,79,150,0.10)', paddingBottom: 8 }}>
                <span>Tópicos / Pontos discutidos</span>
                <span style={{ fontWeight: 400, color: '#94A3B8', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                  {topicos.filter(t => !t.finalizado).length} ativo{topicos.filter(t => !t.finalizado).length !== 1 ? 's' : ''}
                  {topicos.some(t => t.finalizado) && <span style={{ marginLeft: 6, color: '#10B981' }}>· {topicos.filter(t => t.finalizado).length} finalizado{topicos.filter(t => t.finalizado).length !== 1 ? 's' : ''}</span>}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                {topicos.filter(t => !t.finalizado).map((t, idx) => {
                  const cor = t.cor ?? '#2A4F96'
                  return (
                    <div
                      key={t.id}
                      id={idx === topicos.filter(x => !x.finalizado).length - 1 ? 'topico-last' : undefined}
                      style={{ background: '#F8FAFC', borderRadius: 12, border: '1px solid rgba(42,79,150,0.12)', borderLeft: `4px solid ${cor}`, overflow: 'hidden' }}
                    >
                      {/* Content area */}
                      <div style={{ padding: '14px 16px 14px 50px', position: 'relative' }}>
                        {/* Number badge */}
                        <div style={{ position: 'absolute', left: 12, top: 14, width: 26, height: 26, borderRadius: 6, background: cor, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {idx + 1}
                        </div>

                      {/* Título */}
                      <div style={{ marginBottom: 10 }}>
                        <input
                          value={t.titulo}
                          onChange={e => updateTopico(t.id, 'titulo', e.target.value)}
                          placeholder="Assunto / título do tópico…"
                          style={{ ...inp(), fontWeight: 600, fontSize: 14 }}
                        />
                      </div>

                      {/* ATÉ AQUI: andamento persistente do tópico */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>ATÉ AQUI:</span>
                          <span style={{ fontSize: 10, color: '#B0B8C9' }}>situação acumulada do tópico</span>
                        </div>
                        <RichTextEditor
                          value={t.andamentoGeral ?? ''}
                          onChange={html => updateTopico(t.id, 'andamentoGeral', html)}
                          placeholder="Situação acumulada / contexto do tópico até agora…"
                          minRows={2}
                          resizable
                        />
                      </div>

                      {/* Na data desta reunião, definiu-se: (vira histórico na nova reunião) */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Na data desta reunião, definiu-se:</span>
                          {dataVal && <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(dataVal + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
                        </div>
                        <RichTextEditor
                          value={t.descricao}
                          onChange={html => updateTopico(t.id, 'descricao', html)}
                          placeholder="O que foi discutido / decidido nesta reunião…"
                          minRows={3}
                          resizable
                        />
                      </div>

                      {/* Meta: contratante (só com 2+ contratantes), prazo, responsável, status */}
                      <div style={{ display: 'grid', gridTemplateColumns: clientes.length > 1 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '8px 12px' }}>
                        {clientes.length > 1 && (
                          <div>
                            <span style={lbl}>Contratante</span>
                            <select
                              value={t.contratante}
                              onChange={e => updateTopico(t.id, 'contratante', e.target.value)}
                              style={{ ...inp({ fontSize: 12 }), cursor: 'pointer' }}
                            >
                              <option value="">— todas —</option>
                              {clientes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <span style={lbl}>Prazo</span>
                          <input
                            type="date"
                            value={t.prazo}
                            onChange={e => updateTopico(t.id, 'prazo', e.target.value)}
                            style={inp({ fontSize: 12 })}
                          />
                        </div>
                        <div>
                          <span style={lbl}>Responsável</span>
                          <input
                            value={t.responsavel}
                            onChange={e => updateTopico(t.id, 'responsavel', e.target.value)}
                            placeholder="Nome…"
                            style={inp({ fontSize: 12 })}
                          />
                        </div>
                        <div>
                          <span style={lbl}>Status</span>
                          <select
                            value={t.status ?? ''}
                            onChange={e => updateTopico(t.id, 'status', e.target.value)}
                            style={{ ...inp({ fontSize: 12 }), cursor: 'pointer' }}
                          >
                            <option value="">— sem status —</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Em análise">Em análise</option>
                            <option value="Em andamento">Em andamento</option>
                            <option value="Acompanhamento">Acompanhamento</option>
                            <option value="Concluído">Concluído</option>
                            <option value="Cancelado">Cancelado</option>
                          </select>
                        </div>
                      </div>

                      {/* ── Histórico ── */}
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(42,79,150,0.10)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setHistoryOpenId(historyOpenId === t.id ? null : t.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(42,79,150,0.20)', background: historyOpenId === t.id ? '#EEF2FB' : '#fff', color: '#2A4F96', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            📋 Histórico{(t.historico?.length ?? 0) > 0 ? ` (${t.historico!.length})` : ''}
                          </button>
                          {t.descricao.trim() && (
                            <button
                              onClick={() => arquivarDescricao(t.id)}
                              title="Arquiva a observação atual no histórico e abre campo para nova"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(42,79,150,0.20)', background: '#fff', color: '#5B8DEF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            >
                              ⬆ Atualizar
                            </button>
                          )}
                        </div>

                        {historyOpenId === t.id && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(t.historico ?? []).length === 0 && addHistForm?.topicId !== t.id && (
                              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Nenhuma entrada ainda. Clique em "Atualizar" para arquivar a observação atual, ou adicione uma entrada manual.</p>
                            )}
                            {(t.historico ?? []).map((h, i) => (
                              <div key={i} style={{ padding: '10px 12px', background: '#F0F4FF', borderRadius: 8, border: '1px solid rgba(42,79,150,0.12)', position: 'relative' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: cor, marginBottom: 4 }}>
                                  {new Date(h.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </div>
                                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: h.texto }} />
                                <button
                                  onClick={() => removeHistoricoEntry(t.id, i)}
                                  title="Remover entrada"
                                  style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 4, border: '1px solid rgba(42,79,150,0.15)', background: '#fff', color: '#9399ae', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#fef2f2'; el.style.color = '#dc2626' }}
                                  onMouseLeave={e => { const el = e.currentTarget; el.style.background = '#fff'; el.style.color = '#9399ae' }}
                                >×</button>
                              </div>
                            ))}

                            {addHistForm?.topicId === t.id ? (
                              <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid rgba(42,79,150,0.15)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, marginBottom: 10 }}>
                                  <div>
                                    <span style={lbl}>Data</span>
                                    <input type="date" value={addHistForm.data} onChange={e => setAddHistForm(f => f ? { ...f, data: e.target.value } : f)} style={inp({ fontSize: 12 })} />
                                  </div>
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <span style={lbl}>Observação</span>
                                    <textarea
                                      value={addHistForm.texto}
                                      onChange={e => setAddHistForm(f => f ? { ...f, texto: e.target.value } : f)}
                                      rows={3}
                                      placeholder="Descreva o que foi discutido ou decidido nesta data…"
                                      style={{ ...inp(), resize: 'vertical', lineHeight: 1.6 }}
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => addHistoricoEntry(t.id, addHistForm.data, addHistForm.texto)} disabled={!addHistForm.texto.trim()} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2A4F96', color: '#fff', fontSize: 12, fontWeight: 600, cursor: addHistForm.texto.trim() ? 'pointer' : 'not-allowed', opacity: addHistForm.texto.trim() ? 1 : 0.5 }}>Salvar</button>
                                  <button onClick={() => setAddHistForm(null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(42,79,150,0.18)', background: '#fff', color: '#5a6178', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddHistForm({ topicId: t.id, data: new Date().toISOString().slice(0, 10), texto: '' })}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: '1px dashed rgba(42,79,150,0.25)', background: 'transparent', color: '#5B8DEF', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-start' }}
                              >
                                + Entrada manual
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      </div>{/* end content area */}

                      {/* ── Bottom toolbar ── */}
                      <div style={{ borderTop: '1px solid rgba(42,79,150,0.09)', background: '#F0F3FA', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Color picker */}
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setColorPickerOpenId(colorPickerOpenId === t.id ? null : t.id)}
                            title="Cor do tópico"
                            style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${cor}55`, background: cor, cursor: 'pointer', flexShrink: 0, display: 'block' }}
                          />
                          {colorPickerOpenId === t.id && (
                            <div style={{ position: 'absolute', left: 0, bottom: 28, zIndex: 20, background: '#fff', border: '1px solid rgba(42,79,150,0.15)', borderRadius: 10, padding: '10px', display: 'flex', gap: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', flexWrap: 'wrap', width: 156 }}>
                              {TOPIC_COLORS.map(c => (
                                <button key={c} onClick={() => { updateTopico(t.id, 'cor', c); setColorPickerOpenId(null) }} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: cor === c ? '3px solid #1E253D' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, outline: 'none' }} />
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ width: 1, height: 14, background: 'rgba(42,79,150,0.15)', margin: '0 2px' }} />
                        <button onClick={() => moveTopico(t.id, -1)} disabled={idx === 0} title="Mover acima" style={{ height: 26, padding: '0 10px', borderRadius: 5, border: '1px solid rgba(42,79,150,0.18)', background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: 12, color: '#6B7A99', opacity: idx === 0 ? 0.35 : 1 }}>↑ Subir</button>
                        <button onClick={() => moveTopico(t.id, 1)} disabled={idx === topicos.filter(x => !x.finalizado).length - 1} title="Mover abaixo" style={{ height: 26, padding: '0 10px', borderRadius: 5, border: '1px solid rgba(42,79,150,0.18)', background: '#fff', cursor: idx === topicos.filter(x => !x.finalizado).length - 1 ? 'not-allowed' : 'pointer', fontSize: 12, color: '#6B7A99', opacity: idx === topicos.filter(x => !x.finalizado).length - 1 ? 0.35 : 1 }}>↓ Descer</button>
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={() => finalizarTopico(t.id)}
                          title="Move para 'Tópicos finalizados nesta reunião' — só grava ao salvar a ata"
                          style={{ height: 26, padding: '0 12px', borderRadius: 5, border: '1px solid rgba(16,185,129,0.30)', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#10B981', fontWeight: 600 }}
                          onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#ECFDF5' }}
                          onMouseLeave={e => { const el = e.currentTarget; el.style.background = '#fff' }}
                        >✓ Finalizar</button>
                        <button
                          onClick={() => removeTopico(t.id)}
                          style={{ height: 26, padding: '0 12px', borderRadius: 5, border: '1px solid rgba(42,79,150,0.18)', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#9399ae' }}
                          onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#fef2f2'; el.style.color = '#dc2626'; el.style.borderColor = '#fca5a5' }}
                          onMouseLeave={e => { const el = e.currentTarget; el.style.background = '#fff'; el.style.color = '#9399ae'; el.style.borderColor = 'rgba(42,79,150,0.18)' }}
                        >× Remover</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add topic button */}
              <button
                onClick={addTopico}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: '2px dashed rgba(42,79,150,0.25)', background: 'transparent', color: '#5B8DEF', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center', transition: 'all .15s' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = '#2A4F96'; el.style.background = '#F0F4FF'; el.style.color = '#2A4F96' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(42,79,150,0.25)'; el.style.background = 'transparent'; el.style.color = '#5B8DEF' }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Novo tópico
              </button>
            </div>

            {/* ── Footer / Assinaturas ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 40, paddingTop: 16, borderTop: '1px solid rgba(42,79,150,0.10)', fontSize: 11, color: '#9399ae' }}>
              <span style={{ fontWeight: 600, color: '#2A4F96', opacity: 0.5 }}>GT3 Consultoria</span>
              <div style={{ display: 'flex', gap: 32 }}>
                <div style={{ fontSize: 11, color: '#9399ae', borderTop: '1px solid rgba(42,79,150,0.22)', paddingTop: 2, width: 160, textAlign: 'center' }}>Responsável GT3</div>
                <div style={{ fontSize: 11, color: '#9399ae', borderTop: '1px solid rgba(42,79,150,0.22)', paddingTop: 2, width: 160, textAlign: 'center' }}>Responsável {clientes[0] || 'Cliente'}</div>
              </div>
              <span>Pág. 1</span>
            </div>

          </div>
        </div>
      </div>

      {/* ── Print area (hidden on screen, shows on print) ── */}
      <div id="gt3-ata-print">
        <PrintView
          titulo={titulo}
          dataVal={dataVal}
          cliente={clientes.join(' / ')}
          local={local}
          numAta={numAta}
          status={status}
          participantes={participantes}
          topicos={topicos}
        />
      </div>

      {/* ── Notification Modal ── */}
      {notifModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 420, maxWidth: '90vw', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1E253D' }}>Notificar a equipe?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7A99' }}>A ata será salva como Validada. Deseja notificar alguém?</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(['none', 'all', 'select'] as const).map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1px solid ${notifOption === opt ? '#2A4F96' : 'rgba(42,79,150,0.15)'}`, background: notifOption === opt ? '#EEF2FB' : '#F8FAFC', cursor: 'pointer' }}>
                  <input type="radio" name="notif" value={opt} checked={notifOption === opt} onChange={() => setNotifOption(opt)} style={{ accentColor: '#2A4F96' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1E253D' }}>
                    {opt === 'none' ? 'Não notificar' : opt === 'all' ? 'Notificar todos os usuários' : 'Selecionar usuários'}
                  </span>
                </label>
              ))}
            </div>

            {notifOption === 'select' && availableUsers && availableUsers.length > 0 && (
              <div style={{ marginBottom: 20, maxHeight: 180, overflowY: 'auto', border: '1px solid rgba(42,79,150,0.12)', borderRadius: 10, padding: '8px 12px' }}>
                {availableUsers.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={notifSelected.has(u.id)}
                      onChange={() => setNotifSelected(prev => {
                        const next = new Set(prev)
                        next.has(u.id) ? next.delete(u.id) : next.add(u.id)
                        return next
                      })}
                      style={{ accentColor: '#2A4F96' }}
                    />
                    <span style={{ fontSize: 13, color: '#334155' }}>{u.nome}</span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setNotifModalOpen(false)}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(42,79,150,0.18)', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleNotifConfirm}
                disabled={notifOption === 'select' && notifSelected.size === 0}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (notifOption === 'select' && notifSelected.size === 0) ? 'not-allowed' : 'pointer', opacity: (notifOption === 'select' && notifSelected.size === 0) ? 0.5 : 1 }}
              >
                Confirmar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Print View ───────────────────────────────────────────────────────────────

export function PrintView({ titulo, dataVal, cliente, local, numAta, status, participantes, topicos }: {
  titulo: string; dataVal: string; cliente: string; local: string; numAta: string; status: string
  participantes: Participante[]; topicos: Topico[]
}) {
  const dateDisplay = dataVal
    ? new Date(dataVal + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  const prazoFmt = (iso: string) => iso
    ? new Date(iso + 'T12:00').toLocaleDateString('pt-BR')
    : '—'

  return (
    <div style={{ fontFamily: 'Segoe UI, Arial, sans-serif', maxWidth: 800, margin: '0 auto', padding: '40px 48px', color: '#1a1f2e', fontSize: 13 }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #2A4F96', marginBottom: 24, paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#2A4F96', marginBottom: 4 }}>
            {titulo || `Ata de Reunião — ${cliente}`}
          </div>
          <div style={{ fontSize: 13, color: '#5a6178' }}>{dateDisplay}{local ? ` — ${local}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {numAta && <div style={{ display: 'inline-block', padding: '3px 10px', background: '#D1AE6E', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{numAta}</div>}
          <div style={{ fontSize: 11, color: '#5a6178' }}>{status}</div>
        </div>
      </div>

      {/* Meta */}
      {cliente && <div style={{ marginBottom: 16, fontSize: 13, color: '#334155' }}><strong>Contratante:</strong> {cliente}</div>}

      {/* Participantes */}
      {participantes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Participantes</div>
          {participantes.map((p, i) => (
            <div key={i} style={{ marginBottom: 4, fontSize: 13 }}>
              <strong>{p.nome}</strong>{p.empresa ? ` — ${p.empresa}` : ''}
            </div>
          ))}
        </div>
      )}

      {/* Tópicos */}
      {topicos.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Pontos discutidos</div>
          {topicos.map((t, idx) => {
            const cor = t.cor ?? '#2A4F96'
            return (
              <div key={t.id} style={{ marginBottom: 18, padding: '14px 16px', border: '1px solid #e0e5ef', borderLeft: `3px solid ${cor}`, borderRadius: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: cor, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{idx + 1}. {t.titulo || '(Sem título)'}</span>
                  {t.finalizado && <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981', background: '#D1FAE5', padding: '2px 8px', borderRadius: 999 }}>✓ Finalizado</span>}
                  {t.status && <StatusBadge status={t.status} />}
                </div>
                {t.andamentoGeral && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Até aqui:</div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: '#334155' }} dangerouslySetInnerHTML={{ __html: t.andamentoGeral }} />
                  </div>
                )}
                {t.descricao && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Na data desta reunião ({dateDisplay}), definiu-se:</div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: '#334155' }} dangerouslySetInnerHTML={{ __html: t.descricao }} />
                  </div>
                )}
                {(t.contratante || t.prazo || t.responsavel) && (
                  <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#5a6178', borderTop: '1px solid #eee', paddingTop: 8, marginBottom: 8 }}>
                    {t.contratante && <span><strong>Contratante:</strong> {t.contratante}</span>}
                    {t.prazo && <span><strong>Prazo:</strong> {prazoFmt(t.prazo)}</span>}
                    {t.responsavel && <span><strong>Responsável:</strong> {t.responsavel}</span>}
                  </div>
                )}
                {(t.historico?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Histórico</div>
                    {t.historico!.map((h, i) => (
                      <div key={i} style={{ marginBottom: 8, paddingLeft: 10, borderLeft: `2px solid ${cor}44` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: cor, marginBottom: 2 }}>
                          {new Date(h.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 12, color: '#5a6178', lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: h.texto }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
