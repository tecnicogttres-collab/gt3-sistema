'use client'

import { useState } from 'react'

// Editor simples (texto livre) das Atas GT3 — separado do AtasEditor estruturado,
// que é compartilhado com o módulo Atas Contratantes.
export type AtaEditorData = {
  titulo: string
  data: string
  status: 'Rascunho' | 'Aguardando Validação' | 'Validada'
  conteudo: string
}

const STATUS_OPTIONS: AtaEditorData['status'][] = ['Rascunho', 'Aguardando Validação', 'Validada']

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569' }
const inp: React.CSSProperties = { padding: '8px 11px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 14, color: '#1A2340', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '9px 18px', borderRadius: 8, border: '1px solid #CBD5E0', background: '#fff', color: '#475569', fontSize: 14, cursor: 'pointer' }
const btnPri: React.CSSProperties = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2A4F96', color: '#fff', fontSize: 14, fontWeight: 600 }

export default function AtaTextoEditor({ initial, onSave, onClose }: {
  initial?: Partial<AtaEditorData>
  onSave: (data: AtaEditorData) => Promise<void>
  onClose: () => void
}) {
  const [titulo, setTitulo] = useState(initial?.titulo ?? '')
  const [data, setData] = useState(initial?.data ?? new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<AtaEditorData['status']>(initial?.status ?? 'Rascunho')
  const [conteudo, setConteudo] = useState(initial?.conteudo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!data) { setError('Informe a data.'); return }
    if (!conteudo.trim()) { setError('Escreva o conteúdo da ata.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ titulo: titulo.trim(), data, status, conteudo })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="gt3-overlay-fade"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
    >
      <div className="gt3-drop-in" style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F4FA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A2340' }}>
            {initial ? 'Editar ata' : 'Nova ata'}
          </h2>
          <button onClick={onClose} className="gt3-close-btn" style={{ background: 'none', border: 'none', fontSize: 22, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px' }}>
              <span style={lbl}>Título <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></span>
              <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Ata da reunião de terça" style={inp} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 150px' }}>
              <span style={lbl}>Data *</span>
              <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 180px' }}>
              <span style={lbl}>Status</span>
              <select value={status} onChange={e => setStatus(e.target.value as AtaEditorData['status'])} style={{ ...inp, background: '#fff' }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={lbl}>Conteúdo *</span>
            <textarea
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              placeholder="Escreva a ata livremente…"
              rows={16}
              style={{ ...inp, resize: 'vertical', minHeight: 300, lineHeight: 1.6 }}
            />
          </label>

          {status === 'Validada' && (
            <div style={{ fontSize: 12.5, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '9px 12px' }}>
              ⚠️ Ao salvar como <b>Validada</b>, a ata é disparada como aviso para todos.
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px' }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F0F4FA', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPri, opacity: saving ? 0.7 : 1, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
