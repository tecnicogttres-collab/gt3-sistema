'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AtaEditorData = {
  titulo: string
  data: string
  cliente?: string
  localReuniao: string
  numeroAta: string
  participantes: string
  status: string
  conteudo: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ATAS_STATUS = ['Rascunho', 'Aguardando Validação', 'Validada']

const inp: React.CSSProperties = {
  width: '100%', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 6,
  padding: '6px 9px', fontSize: 13, fontFamily: 'inherit', color: '#1a1f2e',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase',
  letterSpacing: '0.08em', display: 'block', marginBottom: 3,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AtasEditor({ initial, onSave, onClose }: {
  initial?: Partial<AtaEditorData>
  onSave: (data: AtaEditorData) => Promise<void>
  onClose: () => void
}) {
  const [titulo,  setTitulo]  = useState(initial?.titulo       ?? '')
  const [data,    setData]    = useState(initial?.data         ?? new Date().toISOString().slice(0, 10))
  const [local,   setLocal]   = useState(initial?.localReuniao ?? '')
  const [numAta,  setNumAta]  = useState(initial?.numeroAta    ?? '')
  const [partic,  setPartic]  = useState(initial?.participantes ?? '')
  const [status,  setStatus]  = useState(initial?.status       ?? 'Rascunho')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  const bodyRef = useRef<HTMLDivElement>(null)

  // seed contentEditable with existing HTML on mount
  useEffect(() => {
    if (bodyRef.current && initial?.conteudo) {
      bodyRef.current.innerHTML = initial.conteudo
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function execCmd(cmd: string, val?: string) {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, val)
  }

  async function handleSave() {
    if (!data) { setErr('Data é obrigatória'); return }
    setSaving(true); setErr('')
    try {
      await onSave({
        titulo,
        data,
        localReuniao: local,
        numeroAta: numAta,
        participantes: partic,
        status,
        conteudo: bodyRef.current?.innerHTML ?? '',
      })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  const tbBtn = (cmd: string, label: string, val?: string): React.ReactNode => (
    <button
      key={cmd + (val ?? '')}
      onMouseDown={e => { e.preventDefault(); execCmd(cmd, val) }}
      title={label}
      style={{
        width: 28, height: 28, border: 'none', background: 'transparent',
        borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700,
        color: '#5a6178', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0F4FA' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#F0F3F9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: '#fff', borderBottom: '1px solid rgba(42,79,150,0.1)', flexShrink: 0, boxShadow: '0 1px 4px rgba(42,79,150,0.07)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#2A4F96', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>GT3</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#2A4F96', paddingRight: 12, borderRight: '1px solid rgba(42,79,150,0.12)', marginRight: 4 }}>Atas GT3</span>

        {/* Formatting toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderRight: '1px solid rgba(42,79,150,0.12)', paddingRight: 10, marginRight: 4 }}>
          {tbBtn('bold', 'N')}
          <span onMouseDown={e => { e.preventDefault(); execCmd('italic') }} title="Itálico" style={{ width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontStyle: 'italic', fontWeight: 700, color: '#5a6178', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0F4FA' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >I</span>
          {tbBtn('underline', 'S')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderRight: '1px solid rgba(42,79,150,0.12)', paddingRight: 10, marginRight: 4 }}>
          {tbBtn('insertUnorderedList', '•—')}
          {tbBtn('insertOrderedList', '1.')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {tbBtn('justifyLeft', '⬛')}
          {tbBtn('justifyCenter', '▬')}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {err && <span style={{ fontSize: 12, color: '#EF4444' }}>{err}</span>}
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ height: 30, padding: '0 8px', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, background: '#fff', color: status === 'Validada' ? '#10B981' : status === 'Aguardando Validação' ? '#F59E0B' : '#94A3B8' }}
          >
            {ATAS_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={onClose} style={{ height: 30, padding: '0 14px', border: '1px solid #CBD5E0', borderRadius: 6, background: '#fff', fontSize: 12, color: '#5a6178', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ height: 30, padding: '0 18px', border: 'none', borderRadius: 6, background: '#2A4F96', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: 14, border: '1px solid rgba(42,79,150,0.10)', boxShadow: '0 4px 20px rgba(42,79,150,0.08)', padding: '36px 44px', borderTop: '3px solid #2A4F96' }}>

          {/* Título */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(42,79,150,0.10)' }}>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Título da reunião / ata…"
              style={{ ...inp, fontSize: 20, fontWeight: 700, color: '#2A4F96', border: 'none', borderBottom: '2px solid rgba(42,79,150,0.15)', borderRadius: 0, padding: '4px 0', flex: 1, background: 'transparent' }}
            />
            <div style={{ flexShrink: 0, paddingTop: 4 }}>
              <div style={{ display: 'inline-block', padding: '3px 12px', background: '#D1AE6E', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {numAta || 'Nº —/—'}
              </div>
            </div>
          </div>

          {/* Meta fields: 2x2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 28, padding: '16px 18px', background: '#F8FAFC', borderRadius: 10, border: '1px solid rgba(42,79,150,0.08)' }}>
            <div>
              <span style={lbl}>Data</span>
              <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
            </div>
            <div>
              <span style={lbl}>Local</span>
              <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Online / Caxias do Sul" style={inp} />
            </div>
            <div>
              <span style={lbl}>Número da ata</span>
              <input value={numAta} onChange={e => setNumAta(e.target.value)} placeholder="Ex.: Nº 04/26" style={inp} />
            </div>
            <div>
              <span style={lbl}>Participantes</span>
              <input value={partic} onChange={e => setPartic(e.target.value)} placeholder="Ex.: Fernando, Marcio, Ana" style={inp} />
            </div>
          </div>

          {/* Body — contentEditable */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            data-ph="Escreva o conteúdo da ata aqui…"
            style={{
              minHeight: 320, outline: 'none', fontSize: 13.5,
              color: '#334155', lineHeight: 1.75, fontFamily: 'inherit',
            }}
            onFocus={e => { if (!(e.currentTarget as HTMLElement).textContent?.trim()) (e.currentTarget as HTMLElement).style.opacity = '1' }}
          />
          <style>{`
            [data-ph]:empty::before { content: attr(data-ph); color: #94A3B8; pointer-events: none; }
            [contenteditable] ul, [contenteditable] ol { padding-left: 1.4em; }
            [contenteditable] li { margin-bottom: 2px; }
          `}</style>

        </div>
      </div>
    </div>
  )
}
