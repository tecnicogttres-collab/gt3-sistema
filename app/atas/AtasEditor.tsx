'use client'

import { useState, useRef } from 'react'

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

type Participant = { id: string; nome: string; empresa: string }
type Assunto     = { id: string; descricao: string; responsavel: string; prazo: string; status: string }
type Section     = { id: string; titulo: string; conteudo: string }

const ATAS_STATUS    = ['Rascunho', 'Aguardando Validação', 'Validada']
const ASSUNTO_STATUS = ['', 'Aberto', 'Em andamento', 'Concluído', 'Cancelado']

function uid() { return Math.random().toString(36).slice(2) }

// ─── HTML serialization ───────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function serializeConteudo(participants: Participant[], assuntos: Assunto[], sections: Section[]): string {
  let html = ''

  // Participants table
  const pts = participants.filter(p => p.nome || p.empresa)
  if (pts.length) {
    html += '<div class="ata-section ata-participants-section">'
    html += '<div class="ata-bh2">Participantes</div>'
    html += '<div class="ata-btable-wrap"><table class="ata-btable ata-btable-part">'
    html += '<tr><th>Participante</th><th>Empresa</th></tr>'
    pts.forEach(p => { html += `<tr><td>${esc(p.nome)}</td><td>${esc(p.empresa)}</td></tr>` })
    html += '</table></div></div>'
  }

  // Assuntos table
  const items = assuntos.filter(a => a.descricao || a.responsavel || a.prazo || a.status)
  if (items.length) {
    html += '<div class="ata-section ata-assuntos-section">'
    html += '<div class="ata-bh2">Assuntos</div>'
    html += '<div class="ata-btable-wrap"><table class="ata-btable ata-assuntos">'
    html += '<tr><th class="col-num">#</th><th>Descrição</th><th class="col-right">Responsável</th><th class="col-right">Prazo</th><th class="col-right">Status</th></tr>'
    items.forEach((a, i) => {
      const desc = esc(a.descricao).replace(/\n/g, '<br>')
      html += `<tr data-assunto="1"><td class="col-num">${i + 1}</td><td class="col-desc">${desc}</td><td class="col-right">${esc(a.responsavel)}</td><td class="col-right">${esc(a.prazo)}</td><td class="col-right col-status">${esc(a.status)}</td></tr>`
    })
    html += '</table></div></div>'
  }

  // Extra sections
  sections.forEach(s => {
    if (!s.titulo && !s.conteudo) return
    const body = esc(s.conteudo).replace(/\n/g, '<br>')
    html += `<div class="ata-section ata-free-section"><div class="ata-bh2">${esc(s.titulo || 'Seção')}</div><div class="ata-section-body">${body}</div></div>`
  })

  return html
}

// ─── HTML parsing (for editing existing atas) ────────────────────────────────

function parseConteudo(html: string): { participants: Participant[]; assuntos: Assunto[]; sections: Section[] } {
  const dflt = {
    participants: [{ id: uid(), nome: '', empresa: '' }, { id: uid(), nome: '', empresa: '' }],
    assuntos: [{ id: uid(), descricao: '', responsavel: '', prazo: '', status: '' }, { id: uid(), descricao: '', responsavel: '', prazo: '', status: '' }],
    sections: [],
  }
  if (!html?.trim()) return dflt

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')

    // Participants
    const participants: Participant[] = []
    doc.querySelectorAll('.ata-btable-part tr').forEach((tr, i) => {
      if (i === 0) return
      const cells = tr.querySelectorAll('td')
      participants.push({ id: uid(), nome: cells[0]?.textContent ?? '', empresa: cells[1]?.textContent ?? '' })
    })
    if (!participants.length) participants.push(...dflt.participants)

    // Assuntos
    const assuntos: Assunto[] = []
    doc.querySelectorAll('.ata-assuntos tr').forEach((tr, i) => {
      if (i === 0) return
      const cells = tr.querySelectorAll('td')
      const descHtml = cells[1]?.innerHTML ?? ''
      const descPlain = descHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
      assuntos.push({ id: uid(), descricao: descPlain, responsavel: cells[2]?.textContent ?? '', prazo: cells[3]?.textContent ?? '', status: cells[4]?.textContent ?? '' })
    })
    if (!assuntos.length) assuntos.push(...dflt.assuntos)

    // Extra sections
    const sections: Section[] = []
    doc.querySelectorAll('.ata-free-section').forEach(s => {
      const bodyHtml = s.querySelector('.ata-section-body')?.innerHTML ?? ''
      const bodyPlain = bodyHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
      sections.push({ id: uid(), titulo: s.querySelector('.ata-bh2')?.textContent ?? '', conteudo: bodyPlain })
    })

    return { participants, assuntos, sections }
  } catch {
    return dflt
  }
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inp: React.CSSProperties = { width: '100%', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 6, padding: '6px 9px', fontSize: 13, fontFamily: 'inherit', color: '#1a1f2e', background: '#fff', outline: 'none', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }

// ─── Component ────────────────────────────────────────────────────────────────

export default function AtasEditor({ initial, onSave, onClose }: {
  initial?: Partial<AtaEditorData>
  onSave: (data: AtaEditorData) => Promise<void>
  onClose: () => void
}) {
  // Meta fields
  const [titulo, setTitulo]     = useState(initial?.titulo ?? '')
  const [data, setData]         = useState(initial?.data ?? new Date().toISOString().slice(0, 10))
  const [local, setLocal]       = useState(initial?.localReuniao ?? '')
  const [numAta, setNumAta]     = useState(initial?.numeroAta ?? '')
  const [status, setStatus]     = useState(initial?.status ?? 'Rascunho')

  // Structured content
  const parsed = useRef(parseConteudo(initial?.conteudo ?? ''))
  const [participants, setParticipants] = useState<Participant[]>(parsed.current.participants)
  const [assuntos, setAssuntos]         = useState<Assunto[]>(parsed.current.assuntos)
  const [sections, setSections]         = useState<Section[]>(parsed.current.sections)

  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  // ── Participants ────────────────────────────────────────────────────────────
  function setPart(id: string, field: 'nome' | 'empresa', val: string) {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))
  }
  function addParticipant() { setParticipants(prev => [...prev, { id: uid(), nome: '', empresa: '' }]) }
  function removePart(id: string) { setParticipants(prev => prev.filter(p => p.id !== id)) }

  // ── Assuntos ────────────────────────────────────────────────────────────────
  function setAssunto(id: string, field: keyof Assunto, val: string) {
    setAssuntos(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a))
  }
  function addAssunto() { setAssuntos(prev => [...prev, { id: uid(), descricao: '', responsavel: '', prazo: '', status: '' }]) }
  function removeAssunto(id: string) { setAssuntos(prev => prev.filter(a => a.id !== id)) }
  function moveAssunto(id: string, dir: -1 | 1) {
    setAssuntos(prev => {
      const arr = [...prev]; const i = arr.findIndex(a => a.id === id)
      const j = i + dir; if (j < 0 || j >= arr.length) return prev
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return arr
    })
  }

  // ── Sections ────────────────────────────────────────────────────────────────
  function setSection(id: string, field: 'titulo' | 'conteudo', val: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s))
  }
  function addSection() { setSections(prev => [...prev, { id: uid(), titulo: '', conteudo: '' }]) }
  function removeSection(id: string) { setSections(prev => prev.filter(s => s.id !== id)) }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!data) { setErr('Data é obrigatória'); return }
    setSaving(true); setErr('')
    try {
      await onSave({
        titulo, data, localReuniao: local, numeroAta: numAta,
        participantes: participants.filter(p => p.nome).map(p => `${p.nome} (${p.empresa})`).join(', '),
        status,
        conteudo: serializeConteudo(participants, assuntos, sections),
      })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const sectionBox: React.CSSProperties = { background: '#fff', border: '1px solid rgba(42,79,150,0.12)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#F0F3F9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: '#fff', borderBottom: '1px solid rgba(42,79,150,0.1)', flexShrink: 0, boxShadow: '0 1px 4px rgba(42,79,150,0.07)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#2A4F96', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>GT3</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#2A4F96', paddingRight: 12, borderRight: '1px solid rgba(42,79,150,0.12)', marginRight: 4 }}>Atas GT3</span>
        <span style={{ fontSize: 13, color: '#5a6178', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {titulo || 'Nova ata…'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {err && <span style={{ fontSize: 12, color: '#EF4444' }}>{err}</span>}
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ height: 30, padding: '0 8px', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', color: status === 'Validada' ? '#10B981' : status === 'Aguardando Validação' ? '#F59E0B' : '#94A3B8', fontWeight: 600, background: '#fff' }}>
            {ATAS_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={onClose} style={{ height: 30, padding: '0 14px', border: '1px solid #CBD5E0', borderRadius: 6, background: '#fff', fontSize: 12, color: '#5a6178', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ height: 30, padding: '0 18px', border: 'none', borderRadius: 6, background: '#2A4F96', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* ── 1. Header doc ── */}
          <div style={{ ...sectionBox, borderTop: '3px solid #2A4F96' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Título da reunião / ata…"
                style={{ ...inp, fontSize: 18, fontWeight: 700, color: '#2A4F96', border: 'none', borderBottom: '2px solid rgba(42,79,150,0.15)', borderRadius: 0, padding: '4px 0', flex: 1, background: 'transparent' }}
              />
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ display: 'inline-block', padding: '3px 12px', background: '#D1AE6E', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  {numAta || 'Nº —/—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px' }}>
              {[
                { label: 'Data',          val: data,   set: setData,    type: 'date', placeholder: '' },
                { label: 'Local',         val: local,  set: setLocal,   type: 'text', placeholder: 'Ex.: Online' },
                { label: 'Número da ata', val: numAta, set: setNumAta,  type: 'text', placeholder: 'Ex.: Nº 04/26' },
              ].map(f => (
                <div key={f.label}>
                  <span style={lbl}>{f.label}</span>
                  <input value={f.val} type={f.type} placeholder={f.placeholder} onChange={e => f.set(e.target.value)} style={inp} />
                </div>
              ))}
            </div>
          </div>

          {/* ── 2. Participants ── */}
          <div style={sectionBox}>
            <div style={sectionTitle}>Participantes</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '30%' }} />
                <col />
                <col style={{ width: 30 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...lbl, textAlign: 'left', paddingBottom: 6 }}>Participante</th>
                  <th style={{ ...lbl, textAlign: 'left', paddingBottom: 6, paddingLeft: 8 }}>Empresa</th>
                  <th style={{ width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {participants.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ paddingBottom: 6, paddingRight: 8 }}>
                      <input value={p.nome} onChange={e => setPart(p.id, 'nome', e.target.value)} placeholder={`Participante ${i + 1}`} style={inp} />
                    </td>
                    <td style={{ paddingBottom: 6, paddingRight: 8 }}>
                      <input value={p.empresa} onChange={e => setPart(p.id, 'empresa', e.target.value)} placeholder="Empresa" style={inp} />
                    </td>
                    <td style={{ paddingBottom: 6 }}>
                      <button onClick={() => removePart(p.id)} style={{ width: 26, height: 26, border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, background: 'transparent', color: '#EF4444', cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addParticipant} style={{ marginTop: 6, padding: '5px 14px', border: '1px dashed rgba(42,79,150,0.4)', borderRadius: 6, background: 'transparent', color: '#2A4F96', fontSize: 12, cursor: 'pointer' }}>
              + Participante
            </button>
          </div>

          {/* ── 3. Assuntos table ── */}
          <div style={sectionBox}>
            <div style={sectionTitle}>Assuntos</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 36 }} />
                  <col />
                  <col style={{ width: 148 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 136 }} />
                  <col style={{ width: 64 }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(42,79,150,0.15)' }}>
                    <th style={{ ...lbl, textAlign: 'center', paddingBottom: 8 }}>#</th>
                    <th style={{ ...lbl, textAlign: 'left', paddingBottom: 8, paddingLeft: 6 }}>Descrição</th>
                    <th style={{ ...lbl, textAlign: 'left', paddingBottom: 8, paddingLeft: 6 }}>Responsável</th>
                    <th style={{ ...lbl, textAlign: 'left', paddingBottom: 8, paddingLeft: 6 }}>Prazo</th>
                    <th style={{ ...lbl, textAlign: 'left', paddingBottom: 8, paddingLeft: 6 }}>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {assuntos.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(42,79,150,0.08)', verticalAlign: 'top' }}>
                      <td style={{ textAlign: 'center', paddingTop: 10, fontSize: 13, fontWeight: 700, color: '#2A4F96', paddingRight: 4 }}>{i + 1}</td>
                      <td style={{ padding: '6px 6px 6px 4px' }}>
                        <textarea
                          value={a.descricao}
                          onChange={e => setAssunto(a.id, 'descricao', e.target.value)}
                          placeholder="Descreva o assunto…"
                          rows={3}
                          style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
                        />
                      </td>
                      <td style={{ padding: '6px 6px 6px 4px' }}>
                        <input value={a.responsavel} onChange={e => setAssunto(a.id, 'responsavel', e.target.value)} placeholder="Responsável" style={inp} />
                      </td>
                      <td style={{ padding: '6px 6px 6px 4px' }}>
                        <input value={a.prazo} type="date" onChange={e => setAssunto(a.id, 'prazo', e.target.value)} style={inp} />
                      </td>
                      <td style={{ padding: '6px 6px 6px 4px' }}>
                        <select value={a.status} onChange={e => setAssunto(a.id, 'status', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                          {ASSUNTO_STATUS.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 0 6px 2px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button onClick={() => moveAssunto(a.id, -1)} disabled={i === 0} style={{ width: 24, height: 22, border: '1px solid rgba(42,79,150,0.2)', borderRadius: 4, background: '#fff', color: '#2A4F96', cursor: 'pointer', fontSize: 11, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                          <button onClick={() => moveAssunto(a.id, 1)} disabled={i === assuntos.length - 1} style={{ width: 24, height: 22, border: '1px solid rgba(42,79,150,0.2)', borderRadius: 4, background: '#fff', color: '#2A4F96', cursor: 'pointer', fontSize: 11, opacity: i === assuntos.length - 1 ? 0.3 : 1 }}>↓</button>
                          <button onClick={() => removeAssunto(a.id)} style={{ width: 24, height: 22, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, background: 'transparent', color: '#EF4444', cursor: 'pointer', fontSize: 12 }}>×</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={addAssunto} style={{ marginTop: 10, padding: '6px 16px', border: '1px dashed rgba(42,79,150,0.4)', borderRadius: 6, background: 'transparent', color: '#2A4F96', fontSize: 12, cursor: 'pointer' }}>
              + Item
            </button>
          </div>

          {/* ── 4. Extra free sections ── */}
          {sections.map(s => (
            <div key={s.id} style={{ ...sectionBox, position: 'relative' }}>
              <button onClick={() => removeSection(s.id)} style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: '#94A3B8', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
              <input
                value={s.titulo}
                onChange={e => setSection(s.id, 'titulo', e.target.value)}
                placeholder="Título da seção…"
                style={{ ...inp, fontWeight: 700, fontSize: 13, color: '#2A4F96', marginBottom: 10, border: 'none', borderBottom: '1px solid rgba(42,79,150,0.15)', borderRadius: 0, background: 'transparent', paddingLeft: 0, paddingRight: 28 }}
              />
              <textarea
                value={s.conteudo}
                onChange={e => setSection(s.id, 'conteudo', e.target.value)}
                placeholder="Escreva livremente…"
                rows={4}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.7 }}
              />
            </div>
          ))}

          <button onClick={addSection} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: '1px dashed rgba(42,79,150,0.35)', borderRadius: 8, background: 'transparent', color: '#2A4F96', fontSize: 13, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            + Adicionar seção livre
          </button>

        </div>
      </div>
    </div>
  )
}
