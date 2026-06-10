'use client'

import { useEffect, useRef, useState } from 'react'

export type AtaEditorData = {
  titulo: string
  data: string
  cliente: string
  localReuniao: string
  numeroAta: string
  participantes: string
  status: string
  conteudo: string
}

const STATUS_OPTIONS = ['Rascunho', 'Aguardando Validação', 'Validada']

const DEFAULT_BLOCKS: Array<{ type: string; content?: string }> = [
  { type: 'bh2', content: 'Assuntos debatidos' },
  { type: 'table' },
  { type: 'bh2', content: 'Definições e encaminhamentos' },
  { type: 'bt' },
  { type: 'cw', content: 'Pendências a acompanhar na próxima reunião...' },
  { type: 'bh2', content: 'Próxima reunião' },
  { type: 'bt' },
]

// ─── Editor init (imperative DOM, same logic as HTML reference) ──────────────

function initEditor(container: HTMLDivElement, menu: HTMLDivElement, initialHtml?: string) {
  let blockCount = 0
  let insertAfterBar: HTMLElement | null = null
  let activeEdit: HTMLElement | null = null

  function makeBlock(type: string, content = ''): HTMLElement {
    const idx = blockCount++
    const w = document.createElement('div')
    w.className = 'ata-block-wrapper'
    w.dataset.idx = String(idx)

    const side = document.createElement('div')
    side.className = 'ata-bside'
    side.innerHTML = `
      <button class="ata-bside-btn" data-action="up" data-idx="${idx}" title="Mover acima">↑</button>
      <button class="ata-bside-btn" data-action="down" data-idx="${idx}" title="Mover abaixo">↓</button>
      <button class="ata-bside-btn ata-del" data-action="del" data-idx="${idx}" title="Remover">✕</button>`
    w.appendChild(side)

    let inner: HTMLElement
    if (type === 'div') {
      inner = document.createElement('hr')
      inner.className = 'ata-bdiv'
    } else if (type === 'table') {
      inner = mkTable()
    } else if (type === 'cols') {
      inner = mkCols()
    } else if (['ci', 'cw', 'co'].includes(type)) {
      inner = mkCallout(type, content)
    } else {
      inner = document.createElement('div')
      inner.className = 'ata-be ata-' + type
      inner.contentEditable = 'true'
      const ph: Record<string, string> = { bt: 'Escreva aqui…', bh1: 'Título da seção…', bh2: 'Subtítulo…', bh3: 'Rótulo…', bq: 'Citação…' }
      inner.dataset.ph = ph[type] ?? 'Escreva…'
      if (content) inner.innerHTML = content
      inner.addEventListener('focus', () => { activeEdit = inner })
      inner.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && ['bh1', 'bh2', 'bh3'].includes(type)) {
          e.preventDefault()
          const nw = makeBlock('bt')
          const nb = makeBar()
          w.after(nw); nw.after(nb)
          ;(nw.querySelector('.ata-be') as HTMLElement)?.focus()
        }
      })
    }
    w.appendChild(inner)
    return w
  }

  function mkTable(): HTMLElement {
    const wrap = document.createElement('div'); wrap.className = 'ata-btable-wrap'
    const t = document.createElement('table'); t.className = 'ata-btable'
    const headers = ['Item', 'Descrição', 'Responsável', 'Prazo', 'Status']
    const hrow = document.createElement('tr')
    headers.forEach(h => {
      const th = document.createElement('th')
      th.contentEditable = 'true'; th.textContent = h
      th.addEventListener('focus', () => { activeEdit = th })
      hrow.appendChild(th)
    })
    t.appendChild(hrow)
    for (let r = 1; r <= 3; r++) {
      const tr = document.createElement('tr')
      headers.forEach((_, ci) => {
        const td = document.createElement('td')
        td.contentEditable = 'true'; td.textContent = ci === 0 ? String(r) : ''
        td.addEventListener('focus', () => { activeEdit = td })
        td.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Tab') {
            e.preventDefault()
            const cells = [...t.querySelectorAll<HTMLElement>('th,td')]
            const i = cells.indexOf(td)
            if (i < cells.length - 1) { cells[i + 1].focus() } else {
              const nr = document.createElement('tr')
              headers.forEach((_, i2) => {
                const ntd = document.createElement('td'); ntd.contentEditable = 'true'
                ntd.textContent = i2 === 0 ? String(t.rows.length) : ''
                ntd.addEventListener('focus', () => { activeEdit = ntd })
                nr.appendChild(ntd)
              })
              t.appendChild(nr); nr.cells[1].focus()
            }
          }
        })
        tr.appendChild(td)
      })
      t.appendChild(tr)
    }
    wrap.appendChild(t); return wrap
  }

  function mkCallout(type: string, content: string): HTMLElement {
    const cfg: Record<string, { cls: string; ic: string }> = {
      ci: { cls: 'ata-bc-info', ic: 'ℹ️' },
      cw: { cls: 'ata-bc-warn', ic: '⚠️' },
      co: { cls: 'ata-bc-ok', ic: '✅' },
    }
    const c = cfg[type]
    const wrap = document.createElement('div'); wrap.className = 'ata-bcallout ' + c.cls
    const ic = document.createElement('span'); ic.className = 'ata-callout-ic'; ic.textContent = c.ic
    const tx = document.createElement('div'); tx.className = 'ata-callout-tx'; tx.contentEditable = 'true'
    if (content) tx.innerHTML = content
    tx.addEventListener('focus', () => { activeEdit = tx })
    wrap.appendChild(ic); wrap.appendChild(tx); return wrap
  }

  function mkCols(): HTMLElement {
    const wrap = document.createElement('div'); wrap.className = 'ata-bcols'
    ;['Coluna esquerda…', 'Coluna direita…'].forEach(ph => {
      const col = document.createElement('div'); col.className = 'ata-bcol ata-be'
      col.contentEditable = 'true'; col.dataset.ph = ph
      col.addEventListener('focus', () => { activeEdit = col })
      wrap.appendChild(col)
    })
    return wrap
  }

  function makeBar(): HTMLElement {
    const bar = document.createElement('div'); bar.className = 'ata-add-bar'
    const btn = document.createElement('button'); btn.className = 'ata-add-trig'
    btn.innerHTML = '+ Adicionar bloco'
    btn.addEventListener('click', e => {
      insertAfterBar = bar
      const rect = btn.getBoundingClientRect()
      menu.style.top = (rect.bottom + 5) + 'px'
      menu.style.left = Math.min(rect.left, window.innerWidth - 225) + 'px'
      menu.classList.toggle('ata-menu-open')
      e.stopPropagation()
    })
    bar.appendChild(btn); return bar
  }

  function insertBlock(type: string) {
    menu.classList.remove('ata-menu-open')
    const nb = makeBlock(type); const bar = makeBar()
    if (insertAfterBar) { insertAfterBar.after(nb); nb.after(bar) }
    else { container.appendChild(nb); container.appendChild(bar) }
    insertAfterBar = null
    const ed = nb.querySelector<HTMLElement>('[contenteditable]')
    if (ed) setTimeout(() => ed.focus(), 40)
  }

  // Side button delegation
  container.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')
    if (!btn) return
    const action = btn.dataset.action
    const idx = btn.dataset.idx
    const w = container.querySelector<HTMLElement>(`[data-idx="${idx}"]`)
    if (!w) return
    if (action === 'del') {
      const n = w.nextElementSibling
      if (n?.classList.contains('ata-add-bar')) n.remove()
      w.remove()
    } else if (action === 'up' || action === 'down') {
      const bl = [...container.querySelectorAll<HTMLElement>('.ata-block-wrapper')]
      const i = bl.indexOf(w)
      const dir = action === 'up' ? -1 : 1
      const tgt = bl[i + dir]; if (!tgt) return
      if (dir === -1) container.insertBefore(w, tgt); else container.insertBefore(tgt, w)
    }
  })

  // Menu item clicks
  menu.addEventListener('click', e => {
    const mi = (e.target as HTMLElement).closest<HTMLElement>('[data-block-type]')
    if (mi) insertBlock(mi.dataset.blockType!)
  })

  // Close menu on outside click
  document.addEventListener('click', e => {
    if (!menu.contains(e.target as Node) && !(e.target as HTMLElement).closest('.ata-add-trig'))
      menu.classList.remove('ata-menu-open')
  })

  // Initialize blocks
  if (initialHtml) {
    container.innerHTML = initialHtml
  } else {
    DEFAULT_BLOCKS.forEach(b => {
      container.appendChild(makeBlock(b.type, b.content ?? ''))
      container.appendChild(makeBar())
    })
  }

  return {
    getContent: () => container.innerHTML,
    execCmd: (cmd: string, val?: string) => {
      document.execCommand(cmd, false, val ?? '')
    },
    getActiveEdit: () => activeEdit,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AtasEditor({ initial, onSave, onClose }: {
  initial?: Partial<AtaEditorData>
  onSave: (data: AtaEditorData) => Promise<void>
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<ReturnType<typeof initEditor> | null>(null)

  const titleRef = useRef<HTMLInputElement>(null)
  const dataRef = useRef<HTMLInputElement>(null)
  const clienteRef = useRef<HTMLInputElement>(null)
  const localRef = useRef<HTMLInputElement>(null)
  const numRef = useRef<HTMLInputElement>(null)
  const partRef = useRef<HTMLInputElement>(null)
  const numBadgeRef = useRef<HTMLSpanElement>(null)

  const [status, setStatus] = useState(initial?.status ?? 'Rascunho')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!containerRef.current || !menuRef.current) return
    editorRef.current = initEditor(containerRef.current, menuRef.current, initial?.conteudo || undefined)

    if (titleRef.current) titleRef.current.value = initial?.titulo ?? ''
    if (dataRef.current) dataRef.current.value = initial?.data ?? new Date().toISOString().slice(0, 10)
    if (clienteRef.current) clienteRef.current.value = initial?.cliente ?? ''
    if (localRef.current) localRef.current.value = initial?.localReuniao ?? ''
    if (numRef.current) numRef.current.value = initial?.numeroAta ?? ''
    if (partRef.current) partRef.current.value = initial?.participantes ?? ''
    if (numBadgeRef.current) numBadgeRef.current.textContent = initial?.numeroAta || 'Nº —/—'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave() {
    const data = dataRef.current?.value
    if (!data) { setErr('Data é obrigatória'); return }
    setSaving(true); setErr('')
    try {
      await onSave({
        titulo: titleRef.current?.value ?? '',
        data,
        cliente: clienteRef.current?.value ?? '',
        localReuniao: localRef.current?.value ?? '',
        numeroAta: numRef.current?.value ?? '',
        participantes: partRef.current?.value ?? '',
        status,
        conteudo: editorRef.current?.getContent() ?? '',
      })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  const execCmd = (cmd: string, val?: string) => editorRef.current?.execCmd(cmd, val)

  const tbBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, border: 'none', background: 'transparent',
    borderRadius: 6, cursor: 'pointer', color: '#5a6178', fontSize: 13,
    flexShrink: 0,
  }
  const tbSel: React.CSSProperties = {
    height: 28, padding: '0 6px', border: '1px solid rgba(42,79,150,0.15)',
    borderRadius: 6, background: '#fff', color: '#1a1f2e', fontSize: 12,
    cursor: 'pointer',
  }
  const sep = <div style={{ width: 1, height: 22, background: 'rgba(42,79,150,0.12)', margin: '0 3px', flexShrink: 0 }} />

  return (
    <>
      {/* Overlay */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#F4F6FA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: '#fff', borderBottom: '1px solid rgba(42,79,150,0.1)', flexShrink: 0, flexWrap: 'wrap', boxShadow: '0 1px 4px rgba(42,79,150,0.07)', zIndex: 10 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12, borderRight: '1px solid rgba(42,79,150,0.1)', marginRight: 4, flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#2A4F96', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>GT3</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#2A4F96' }}>Atas</span>
          </div>

          {/* Formatting tools */}
          <select style={tbSel} onChange={e => {
            const ed = editorRef.current?.getActiveEdit()
            if (!ed) return
            const w = ed.closest<HTMLElement>('.ata-block-wrapper'); if (!w) return
            const content = ed.innerHTML
            const types: Record<string, string> = { bt: 'bt', bh1: 'bh1', bh2: 'bh2', bh3: 'bh3', bq: 'bq' }
            if (!types[e.target.value]) return
            const nw = document.createElement('div')
            nw.className = 'ata-be ata-' + e.target.value
            nw.contentEditable = 'true'
            const ph: Record<string, string> = { bt: 'Escreva aqui…', bh1: 'Título…', bh2: 'Subtítulo…', bh3: 'Rótulo…', bq: 'Citação…' }
            nw.dataset.ph = ph[e.target.value] ?? ''
            nw.innerHTML = content
            const old = w.querySelector('[contenteditable]')
            if (old) old.replaceWith(nw)
            nw.focus()
          }}>
            <option value="bt">Parágrafo</option>
            <option value="bh1">Título 1</option>
            <option value="bh2">Título 2</option>
            <option value="bh3">Subtítulo</option>
            <option value="bq">Citação</option>
          </select>
          {sep}
          <button style={tbBtn} onClick={() => execCmd('bold')} title="Negrito"><b>B</b></button>
          <button style={tbBtn} onClick={() => execCmd('italic')} title="Itálico"><i>I</i></button>
          <button style={tbBtn} onClick={() => execCmd('underline')} title="Sublinhado"><u>S</u></button>
          {sep}
          <button style={tbBtn} onClick={() => execCmd('justifyLeft')} title="Esquerda">≡←</button>
          <button style={tbBtn} onClick={() => execCmd('justifyCenter')} title="Centro">≡</button>
          <button style={tbBtn} onClick={() => execCmd('justifyRight')} title="Direita">≡→</button>
          {sep}
          <button style={tbBtn} onClick={() => execCmd('insertUnorderedList')} title="Lista">• —</button>
          <button style={tbBtn} onClick={() => execCmd('insertOrderedList')} title="Numerada">1.</button>
          {sep}
          <button style={tbBtn} onClick={() => execCmd('undo')} title="Desfazer">↩</button>
          <button style={tbBtn} onClick={() => execCmd('redo')} title="Refazer">↪</button>

          {/* Right side */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {err && <span style={{ fontSize: 12, color: '#EF4444' }}>{err}</span>}
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{ ...tbSel, fontWeight: 600, color: status === 'Validada' ? '#10B981' : status === 'Aguardando Validação' ? '#F59E0B' : '#94A3B8' }}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={onClose} style={{ ...tbBtn, width: 'auto', padding: '0 12px', fontSize: 12, border: '1px solid #CBD5E0' }}>Cancelar</button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ height: 30, padding: '0 16px', background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '36px 24px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 800, background: '#fff', border: '1px solid rgba(42,79,150,0.1)', borderRadius: 20, padding: '52px 60px', boxShadow: '0 4px 20px rgba(42,79,150,0.10)' }}>

            {/* Doc header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 22, borderBottom: '2px solid #2A4F96', gap: 16 }}>
              <input
                ref={titleRef}
                placeholder="Título da reunião / ata…"
                style={{ fontSize: 20, fontWeight: 700, color: '#2A4F96', border: 'none', background: 'transparent', outline: 'none', flex: 1, fontFamily: 'inherit' }}
              />
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span ref={numBadgeRef} style={{ display: 'inline-block', padding: '3px 10px', background: '#D1AE6E', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                  {initial?.numeroAta || 'Nº —/—'}
                </span>
              </div>
            </div>

            {/* Meta fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 30, padding: '16px 18px', background: '#f0f2f7', borderRadius: 10, border: '1px solid rgba(42,79,150,0.1)' }}>
              {[
                { label: 'Cliente / Empresa', ref: clienteRef, placeholder: 'Ex.: Marcopolo AR', col: 1 },
                { label: 'Data', ref: dataRef, placeholder: '', col: 1, type: 'date' },
                { label: 'Local', ref: localRef, placeholder: 'Ex.: Online / Caxias do Sul', col: 1 },
                { label: 'Número da ata', ref: numRef, placeholder: 'Ex.: Nº 04/26', col: 1 },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.label}</span>
                  <input
                    ref={f.ref}
                    type={f.type ?? 'text'}
                    placeholder={f.placeholder}
                    onChange={f.ref === numRef ? e => { if (numBadgeRef.current) numBadgeRef.current.textContent = e.target.value || 'Nº —/—' } : undefined}
                    style={{ fontSize: 13, border: 'none', background: 'transparent', outline: 'none', padding: '2px 0', borderBottom: '1px solid rgba(42,79,150,0.15)', fontFamily: 'inherit', color: '#1a1f2e' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Participantes</span>
                <input
                  ref={partRef}
                  placeholder="Ex.: Fernando Almeida (Marcopolo), Marcio Bastos (GT3)"
                  style={{ fontSize: 13, border: 'none', background: 'transparent', outline: 'none', padding: '2px 0', borderBottom: '1px solid rgba(42,79,150,0.15)', fontFamily: 'inherit', color: '#1a1f2e' }}
                />
              </div>
            </div>

            {/* Blocks */}
            <div ref={containerRef} style={{ position: 'relative' }} />

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 36, paddingTop: 14, borderTop: '1px solid rgba(42,79,150,0.1)', fontSize: 11, color: '#9399ae' }}>
              <span style={{ fontWeight: 600, color: '#2A4F96', opacity: 0.5 }}>GT3 Consultoria</span>
              <div style={{ display: 'flex', gap: 32 }}>
                {['Responsável GT3', 'Responsável Cliente'].map(l => (
                  <div key={l} style={{ fontSize: 11, color: '#9399ae', borderTop: '1px solid rgba(42,79,150,0.2)', paddingTop: 2, width: 160, textAlign: 'center' }}>{l}</div>
                ))}
              </div>
              <span>Pág. 1</span>
            </div>
          </div>
        </div>
      </div>

      {/* Block menu (portal-style, fixed) */}
      <div ref={menuRef} style={{ position: 'fixed', background: '#fff', border: '1px solid rgba(42,79,150,0.22)', borderRadius: 12, padding: 6, display: 'none', zIndex: 9999, boxShadow: '0 8px 32px rgba(42,79,150,.15)', minWidth: 215 }}>
        {[
          { type: 'bt',    icon: '¶',  label: 'Parágrafo',        desc: 'Texto livre' },
          { type: 'bh1',   icon: 'H1', label: 'Título 1',         desc: 'Seção principal' },
          { type: 'bh2',   icon: 'H2', label: 'Título 2',         desc: 'Subseção' },
          { type: 'bh3',   icon: 'H3', label: 'Subtítulo',        desc: 'Rótulo de seção' },
          { type: 'sep' },
          { type: 'table', icon: '⊞',  label: 'Tabela de itens',  desc: 'Item / Descrição / Prazo / Status' },
          { type: 'cols',  icon: '⫿',  label: 'Duas colunas',     desc: 'Layout lado a lado' },
          { type: 'sep' },
          { type: 'ci',    icon: 'ℹ',  label: 'Nota informativa', desc: 'Destaque azul' },
          { type: 'cw',    icon: '⚠',  label: 'Atenção',          desc: 'Destaque dourado' },
          { type: 'co',    icon: '✓',  label: 'Conclusão / OK',   desc: 'Destaque verde' },
          { type: 'sep' },
          { type: 'bq',    icon: '"',  label: 'Citação',          desc: 'Bloco recuado' },
          { type: 'div',   icon: '—',  label: 'Divisor',          desc: 'Linha separadora' },
        ].map((item, i) =>
          item.type === 'sep'
            ? <div key={i} style={{ height: 1, background: 'rgba(42,79,150,0.1)', margin: '4px 0' }} />
            : (
              <div
                key={item.type}
                data-block-type={item.type}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f2f7')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 15, color: '#2A4F96', width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#5a6178' }}>{item.desc}</div>
                </div>
              </div>
            )
        )}
      </div>

      {/* Editor scoped styles */}
      <style>{`
        .ata-menu-open { display: block !important; }
        .ata-block-wrapper { position: relative; margin: 1px 0; }
        .ata-block-wrapper:hover .ata-bside { opacity: 1; }
        .ata-bside { position: absolute; left: -48px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 2px; opacity: 0; transition: opacity .15s; }
        .ata-bside-btn { width: 22px; height: 22px; border: 1px solid rgba(42,79,150,0.15); border-radius: 5px; background: #fff; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; color: #9399ae; }
        .ata-bside-btn:hover { border-color: rgba(42,79,150,0.35); color: #2A4F96; }
        .ata-del:hover { border-color: #fca5a5 !important; color: #dc2626 !important; }
        .ata-be { outline: none; width: 100%; caret-color: #2A4F96; }
        .ata-be:empty::before { content: attr(data-ph); color: #9399ae; pointer-events: none; }
        .ata-bt  { font-size: 14px; line-height: 1.8; color: #1a1f2e; padding: 4px 0; min-height: 30px; }
        .ata-bh1 { font-size: 20px; font-weight: 700; color: #2A4F96; padding: 10px 0 4px; min-height: 40px; border-bottom: 2px solid rgba(42,79,150,0.15); margin-bottom: 4px; }
        .ata-bh2 { font-size: 15px; font-weight: 700; color: #2A4F96; padding: 8px 0 3px; min-height: 34px; }
        .ata-bh3 { font-size: 11px; font-weight: 700; color: #D1AE6E; padding: 6px 0 2px; min-height: 28px; text-transform: uppercase; letter-spacing: .10em; }
        .ata-bq  { border-left: 3px solid #D1AE6E; padding: 8px 0 8px 16px; font-size: 14px; line-height: 1.8; color: #5a6178; font-style: italic; min-height: 40px; background: #f0f2f7; border-radius: 0 6px 6px 0; margin: 4px 0; }
        .ata-bdiv { border: none; border-top: 1px solid rgba(42,79,150,0.15); margin: 12px 0; }
        .ata-bcallout { display: flex; gap: 12px; padding: 12px 16px; border-radius: 10px; margin: 4px 0; border-left: 3px solid; }
        .ata-bc-info { background: #e8f0fc; border-color: #2A4F96; }
        .ata-bc-warn { background: #fef9e7; border-color: #D1AE6E; }
        .ata-bc-ok   { background: #e8f5e9; border-color: #2e7d32; }
        .ata-callout-ic { font-size: 16px; flex-shrink: 0; margin-top: 2px; }
        .ata-callout-tx { font-size: 13.5px; line-height: 1.7; color: #1a1f2e; outline: none; flex: 1; min-height: 22px; }
        .ata-callout-tx:empty::before { content: 'Escreva uma nota…'; color: #9399ae; pointer-events: none; }
        .ata-btable-wrap { overflow-x: auto; margin: 4px 0; }
        .ata-btable { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ata-btable th, .ata-btable td { border: 1px solid rgba(42,79,150,0.15); padding: 8px 12px; text-align: left; outline: none; min-width: 80px; }
        .ata-btable th { background: #2A4F96; color: #fff; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
        .ata-btable tr:nth-child(even) td { background: #f0f2f7; }
        .ata-btable td:focus { background: #e8f0fc; box-shadow: inset 0 0 0 1.5px #2A4F96; }
        .ata-bcols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 4px 0; }
        .ata-bcol { border: 1px dashed rgba(42,79,150,0.25); border-radius: 10px; padding: 10px 12px; min-height: 56px; outline: none; font-size: 14px; line-height: 1.75; color: #1a1f2e; }
        .ata-bcol:empty::before { content: attr(data-ph); color: #9399ae; pointer-events: none; }
        .ata-bcol:focus { border-color: #2A4F96; border-style: solid; }
        .ata-add-bar { display: flex; align-items: center; gap: 8px; margin: 3px 0; opacity: 0; transition: opacity .18s; height: 22px; }
        .ata-add-bar:hover { opacity: 1; }
        .ata-add-bar::before, .ata-add-bar::after { content: ''; flex: 1; height: 1px; background: rgba(42,79,150,0.12); }
        .ata-add-trig { display: flex; align-items: center; gap: 4px; padding: 2px 10px; border: 1px solid rgba(42,79,150,0.2); border-radius: 20px; background: #fff; font-size: 11px; color: #5a6178; cursor: pointer; white-space: nowrap; }
        .ata-add-trig:hover { background: #2A4F96; color: #fff; border-color: #2A4F96; }
      `}</style>
    </>
  )
}
