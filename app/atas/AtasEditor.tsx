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

type BlockType = 'bt' | 'bh1' | 'bh2' | 'bh3' | 'bq' | 'div' | 'table' | 'ci' | 'cw' | 'co' | 'cols' | 'img'

type Block = {
  id: string
  type: BlockType
  initContent?: string
  initLeft?: string
  initRight?: string
  initHeaders?: string[]
  initRows?: string[][]
  initSrc?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

let _cnt = 0
function uid() { return `b${Date.now()}_${++_cnt}` }

const ATAS_STATUS = ['Rascunho', 'Aguardando Validação', 'Validada']

const STATUS_CFG: Record<string, { color: string; label: string; icon: string }> = {
  'Rascunho':             { color: '#94A3B8', label: 'Rascunho',             icon: '○' },
  'Aguardando Validação': { color: '#F59E0B', label: 'Aguardando Validação', icon: '◷' },
  'Validada':             { color: '#10B981', label: 'Validada',             icon: '✓' },
}

const BLOCK_MENU: { type: BlockType; label: string; desc: string; icon: string }[] = [
  { type: 'bt',    label: 'Parágrafo',          desc: 'Texto livre',              icon: '¶'  },
  { type: 'bh1',  label: 'Título 1',            desc: 'Seção principal',          icon: 'H1' },
  { type: 'bh2',  label: 'Título 2',            desc: 'Subseção',                 icon: 'H2' },
  { type: 'bh3',  label: 'Subtítulo',           desc: 'Rótulo de seção',          icon: 'H3' },
  { type: 'table',label: 'Tabela',              desc: 'Item / Prazo / Status',    icon: '⊞'  },
  { type: 'cols', label: 'Duas colunas',        desc: 'Layout lado a lado',       icon: '⧠'  },
  { type: 'ci',   label: 'Nota informativa',    desc: 'Destaque azul',            icon: 'ℹ'  },
  { type: 'cw',   label: 'Atenção / Pendência', desc: 'Destaque dourado',         icon: '⚠'  },
  { type: 'co',   label: 'Conclusão / OK',      desc: 'Destaque verde',           icon: '✓'  },
  { type: 'bq',   label: 'Citação',             desc: 'Bloco recuado',            icon: '❝'  },
  { type: 'div',  label: 'Divisor',             desc: 'Linha separadora',         icon: '—'  },
  { type: 'img',  label: 'Imagem',              desc: 'Upload de arquivo',        icon: '🖼'  },
]

const CALLOUT_CFG: Record<string, { bg: string; border: string; ic: string }> = {
  ci: { bg: '#e8f0fc', border: '#2A4F96', ic: 'ℹ️' },
  cw: { bg: '#fef9e7', border: '#D1AE6E', ic: '⚠️' },
  co: { bg: '#e8f5e9', border: '#2e7d32', ic: '✅' },
}

// ─── Default blocks ────────────────────────────────────────────────────────────

function defaultBlocks(): Block[] {
  return [
    { id: uid(), type: 'bh2', initContent: 'Assuntos debatidos' },
    { id: uid(), type: 'table', initHeaders: ['Item', 'Descrição', 'Responsável', 'Prazo', 'Status'], initRows: [['1', '', '', '', '']] },
    { id: uid(), type: 'bh2', initContent: 'Definições e encaminhamentos' },
    { id: uid(), type: 'bt',  initContent: '' },
    { id: uid(), type: 'cw', initContent: 'Pendências a acompanhar na próxima reunião...' },
    { id: uid(), type: 'bh2', initContent: 'Próxima reunião' },
    { id: uid(), type: 'bt',  initContent: '' },
  ]
}

// ─── Parse from stored HTML ────────────────────────────────────────────────────

function parseBlocks(html: string): Block[] {
  if (typeof window === 'undefined' || !html?.trim()) return defaultBlocks()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const container = doc.querySelector('[data-gt3-ata="v2"]')
  if (!container) return [{ id: uid(), type: 'bt', initContent: html }]
  const blocks: Block[] = []
  for (const el of Array.from(container.children)) {
    const type = el.getAttribute('data-block-type') as BlockType | null
    if (!type) continue
    const id = uid()
    if (type === 'div') {
      blocks.push({ id, type })
    } else if (type === 'table') {
      const headers = Array.from(el.querySelectorAll('thead th')).map(th => (th as HTMLElement).innerHTML)
      const rows = Array.from(el.querySelectorAll('tbody tr')).map(tr =>
        Array.from((tr as HTMLTableRowElement).querySelectorAll('td')).map(td => (td as HTMLElement).innerHTML)
      )
      blocks.push({ id, type, initHeaders: headers.length ? headers : ['Item', 'Descrição', 'Responsável', 'Prazo', 'Status'], initRows: rows.length ? rows : [['1', '', '', '', '']] })
    } else if (type === 'cols') {
      const [leftEl, rightEl] = Array.from(el.children)
      blocks.push({ id, type, initLeft: (leftEl as HTMLElement)?.innerHTML ?? '', initRight: (rightEl as HTMLElement)?.innerHTML ?? '' })
    } else if (type === 'img') {
      const img = el.querySelector('img')
      blocks.push({ id, type, initSrc: img?.src ?? '' })
    } else {
      blocks.push({ id, type: type as BlockType, initContent: (el as HTMLElement).innerHTML })
    }
  }
  return blocks.length ? blocks : defaultBlocks()
}

// ─── Serialize to HTML ────────────────────────────────────────────────────────

function serializeBlocks(
  blocks: Block[],
  contentRefs: React.MutableRefObject<Map<string, HTMLElement | null>>,
  tableRefs: React.MutableRefObject<Map<string, HTMLTableElement | null>>,
  imgSrcs: React.MutableRefObject<Map<string, string>>,
): string {
  const parts = blocks.map(b => {
    if (b.type === 'div') return `<hr data-block-type="div">`
    if (b.type === 'table') {
      const tbl = tableRefs.current.get(b.id)
      return tbl ? `<table data-block-type="table">${tbl.innerHTML}</table>` : ''
    }
    if (b.type === 'cols') {
      const l = contentRefs.current.get(`${b.id}-l`)?.innerHTML ?? ''
      const r = contentRefs.current.get(`${b.id}-r`)?.innerHTML ?? ''
      return `<div data-block-type="cols"><div data-col="left">${l}</div><div data-col="right">${r}</div></div>`
    }
    if (b.type === 'img') {
      const src = imgSrcs.current.get(b.id) ?? ''
      return `<div data-block-type="img">${src ? `<img src="${src}" alt="">` : ''}</div>`
    }
    const content = contentRefs.current.get(b.id)?.innerHTML ?? ''
    return `<div data-block-type="${b.type}">${content}</div>`
  })
  return `<div data-gt3-ata="v2">${parts.join('')}</div>`
}

// ─── TextBlock ────────────────────────────────────────────────────────────────

function TextBlock({ id, type, initContent, onFocus, register }: {
  id: string
  type: BlockType
  initContent?: string
  onFocus: (id: string, type: BlockType) => void
  register: (id: string, el: HTMLElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && initContent !== undefined) ref.current.innerHTML = initContent
    register(id, ref.current)
    return () => register(id, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = textBlockStyle(type)
  const ph = ({ bt: 'Escreva aqui…', bh1: 'Título da seção…', bh2: 'Subtítulo…', bh3: 'Rótulo…', bq: 'Citação…' } as Record<string, string>)[type] ?? 'Escreva…'

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-ph={ph}
      style={s}
      onFocus={() => onFocus(id, type)}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey && (type === 'bh1' || type === 'bh2' || type === 'bh3')) {
          e.preventDefault()
          // Can't easily add block here without prop drilling — user can use add-bar
        }
      }}
    />
  )
}

function textBlockStyle(type: BlockType): React.CSSProperties {
  const base: React.CSSProperties = { outline: 'none', width: '100%', padding: '4px 0', minHeight: 30 }
  switch (type) {
    case 'bh1': return { ...base, fontSize: 20, fontWeight: 700, color: '#2A4F96', padding: '10px 0 4px', minHeight: 40, borderBottom: '2px solid rgba(42,79,150,0.15)', marginBottom: 4 }
    case 'bh2': return { ...base, fontSize: 15, fontWeight: 700, color: '#2A4F96', padding: '8px 0 3px', minHeight: 34 }
    case 'bh3': return { ...base, fontSize: 11, fontWeight: 700, color: '#D1AE6E', padding: '6px 0 2px', minHeight: 28, textTransform: 'uppercase', letterSpacing: '0.10em' }
    case 'bq':  return { ...base, fontSize: 14, lineHeight: 1.8, color: '#5a6178', fontStyle: 'italic', borderLeft: '3px solid #D1AE6E', padding: '8px 0 8px 16px', minHeight: 40, background: '#f0f2f7', margin: '4px 0', borderRadius: '0 6px 6px 0' }
    default:    return { ...base, fontSize: 14, lineHeight: 1.8, color: '#1a1f2e' }
  }
}

// ─── CalloutBlock ─────────────────────────────────────────────────────────────

function CalloutBlock({ id, type, initContent, onFocus, register }: {
  id: string
  type: 'ci' | 'cw' | 'co'
  initContent?: string
  onFocus: (id: string, type: BlockType) => void
  register: (id: string, el: HTMLElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && initContent) ref.current.innerHTML = initContent
    register(id, ref.current)
    return () => register(id, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const cfg = CALLOUT_CFG[type]
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 16px', borderRadius: 10, margin: '4px 0', borderLeft: `3px solid ${cfg.border}`, background: cfg.bg }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{cfg.ic}</span>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-ph="Escreva uma nota…"
        style={{ fontSize: 13.5, lineHeight: 1.7, color: '#1a1f2e', outline: 'none', flex: 1, minHeight: 22 }}
        onFocus={() => onFocus(id, type)}
      />
    </div>
  )
}

// ─── TableBlock ───────────────────────────────────────────────────────────────

function TableBlock({ id, initHeaders, initRows, registerTable }: {
  id: string
  initHeaders?: string[]
  initRows?: string[][]
  registerTable: (id: string, el: HTMLTableElement | null) => void
}) {
  const headers = initHeaders ?? ['Item', 'Descrição', 'Responsável', 'Prazo', 'Status']
  const [rows, setRows] = useState<string[][]>(initRows ?? [Array(headers.length).fill('')])
  const tableRef = useRef<HTMLTableElement>(null)

  useEffect(() => {
    registerTable(id, tableRef.current)
    return () => registerTable(id, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addRow() { setRows(r => [...r, Array(headers.length).fill('')]) }

  function handleTabOnLast(e: React.KeyboardEvent<HTMLTableCellElement>, rowIdx: number, colIdx: number) {
    if (e.key !== 'Tab') return
    const isLastCell = rowIdx === rows.length - 1 && colIdx === headers.length - 1
    if (isLastCell) { e.preventDefault(); addRow() }
  }

  const thStyle: React.CSSProperties = {
    background: '#2A4F96', color: '#fff', fontWeight: 700, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px',
    border: '1px solid rgba(42,79,150,0.2)', textAlign: 'left', outline: 'none',
  }
  const tdStyle = (even: boolean): React.CSSProperties => ({
    border: '1px solid rgba(42,79,150,0.14)', padding: '8px 12px', fontSize: 13,
    textAlign: 'left', outline: 'none', minWidth: 80, background: even ? '#F8FAFC' : '#fff',
    verticalAlign: 'top',
  })

  return (
    <div style={{ overflowX: 'auto', margin: '4px 0' }}>
      <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} contentEditable suppressContentEditableWarning style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  contentEditable
                  suppressContentEditableWarning
                  style={tdStyle(ri % 2 === 1)}
                  onKeyDown={e => handleTabOnLast(e, ri, ci)}
                  dangerouslySetInnerHTML={{ __html: cell }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addRow}
        style={{ marginTop: 4, fontSize: 11, color: '#5B8DEF', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
      >
        + Linha
      </button>
    </div>
  )
}

// ─── ColsBlock ────────────────────────────────────────────────────────────────

function ColsBlock({ id, initLeft, initRight, onFocus, register }: {
  id: string
  initLeft?: string
  initRight?: string
  onFocus: (id: string, type: BlockType) => void
  register: (id: string, el: HTMLElement | null) => void
}) {
  const lRef = useRef<HTMLDivElement>(null)
  const rRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (lRef.current && initLeft)  lRef.current.innerHTML = initLeft
    if (rRef.current && initRight) rRef.current.innerHTML = initRight
    register(`${id}-l`, lRef.current)
    register(`${id}-r`, rRef.current)
    return () => { register(`${id}-l`, null); register(`${id}-r`, null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const colStyle: React.CSSProperties = {
    border: '1px dashed rgba(42,79,150,0.22)', borderRadius: 10, padding: '10px 12px',
    minHeight: 56, outline: 'none', fontSize: 14, lineHeight: 1.75, color: '#1a1f2e', flex: 1,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '4px 0' }}>
      <div ref={lRef} contentEditable suppressContentEditableWarning data-ph="Coluna esquerda…" style={colStyle} onFocus={() => onFocus(id, 'cols')} />
      <div ref={rRef} contentEditable suppressContentEditableWarning data-ph="Coluna direita…"  style={colStyle} onFocus={() => onFocus(id, 'cols')} />
    </div>
  )
}

// ─── ImgBlock ─────────────────────────────────────────────────────────────────

function ImgBlock({ id, initSrc, onSrcChange, imgInputRef }: {
  id: string
  initSrc?: string
  onSrcChange: (id: string, src: string) => void
  imgInputRef: React.RefObject<HTMLInputElement | null>
}) {
  const [src, setSrc] = useState(initSrc ?? '')

  function pick() {
    if (!imgInputRef.current) return
    imgInputRef.current.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f) return
      const reader = new FileReader()
      reader.onload = ev => {
        const result = ev.target?.result as string
        setSrc(result)
        onSrcChange(id, result)
      }
      reader.readAsDataURL(f)
    }
    imgInputRef.current.click()
  }

  if (src) return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <img src={src} alt="" style={{ maxWidth: '100%', borderRadius: 10 }} />
      <button onClick={() => { setSrc(''); onSrcChange(id, '') }} style={{ marginTop: 6, fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>
        Remover imagem
      </button>
    </div>
  )

  return (
    <div
      onClick={pick}
      style={{ border: '2px dashed rgba(42,79,150,0.22)', borderRadius: 10, padding: '36px', cursor: 'pointer', color: '#5a6178', fontSize: 13, textAlign: 'center', margin: '4px 0', transition: 'all .15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2A4F96'; (e.currentTarget as HTMLElement).style.color = '#2A4F96' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,79,150,0.22)'; (e.currentTarget as HTMLElement).style.color = '#5a6178' }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>🖼</div>
      Clique para adicionar imagem
    </div>
  )
}

// ─── BlockShell ───────────────────────────────────────────────────────────────

function BlockShell({ id, onRemove, onMove, children }: {
  id: string
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const btnBase: React.CSSProperties = {
    width: 22, height: 22, border: '1px solid rgba(42,79,150,0.15)', borderRadius: 5,
    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#9399ae', fontSize: 12, flexShrink: 0,
  }
  return (
    <div
      style={{ position: 'relative', margin: '1px 0' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Side controls */}
      <div style={{
        position: 'absolute', left: -36, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 2,
        opacity: hovered ? 1 : 0, transition: 'opacity .15s',
      }}>
        <button style={btnBase} onClick={() => onMove(id, -1)} title="Mover acima">↑</button>
        <button style={btnBase} onClick={() => onMove(id, 1)}  title="Mover abaixo">↓</button>
        <button
          style={{ ...btnBase, color: '#dc2626' }}
          onClick={() => onRemove(id)}
          title="Remover"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,79,150,0.15)' }}
        >✕</button>
      </div>
      {children}
    </div>
  )
}

// ─── AddBar ───────────────────────────────────────────────────────────────────

function AddBar({ afterId, onOpen }: { afterId: string | null; onOpen: (afterId: string | null, rect: DOMRect) => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0', opacity: hov ? 1 : 0, transition: 'opacity .18s', height: 22 }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ flex: 1, height: 1, background: 'rgba(42,79,150,0.10)' }} />
      <button
        onClick={e => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          onOpen(afterId, rect)
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '2px 10px',
          border: '1px solid rgba(42,79,150,0.22)', borderRadius: 20,
          background: '#fff', fontSize: 11, color: '#5a6178', cursor: 'pointer',
          whiteSpace: 'nowrap', transition: 'all .12s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2A4F96'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#5a6178' }}
      >
        + Adicionar bloco
      </button>
      <div style={{ flex: 1, height: 1, background: 'rgba(42,79,150,0.10)' }} />
    </div>
  )
}

// ─── BlockMenu ────────────────────────────────────────────────────────────────

function BlockMenu({ open, pos, onSelect, onClose }: {
  open: boolean
  pos: { top: number; left: number } | null
  onSelect: (type: BlockType) => void
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const menu = document.getElementById('gt3-block-menu')
      if (menu && !menu.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open || !pos) return null

  return (
    <div
      id="gt3-block-menu"
      style={{
        position: 'fixed', top: pos.top + 5, left: Math.min(pos.left, window.innerWidth - 230),
        background: '#fff', border: '1px solid rgba(42,79,150,0.22)', borderRadius: 12,
        padding: 6, zIndex: 9999, boxShadow: '0 8px 32px rgba(42,79,150,.15)', minWidth: 215,
      }}
    >
      {BLOCK_MENU.map((item, i) => {
        const isSep = i > 0 && (item.type === 'table' || item.type === 'ci' || item.type === 'bq')
        return (
          <div key={item.type}>
            {isSep && <div style={{ height: 1, background: 'rgba(42,79,150,0.10)', margin: '4px 0' }} />}
            <div
              onClick={() => onSelect(item.type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 8, cursor: 'pointer', transition: 'background .1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0F2F7' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 15, color: '#2A4F96', width: 22, textAlign: 'center' }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#5a6178' }}>{item.desc}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function AtasEditor({ initial, onSave, onClose }: {
  initial?: Partial<AtaEditorData>
  onSave: (data: AtaEditorData) => Promise<void>
  onClose: () => void
}) {
  const [titulo,   setTitulo]  = useState(initial?.titulo          ?? '')
  const [dataVal,  setDataVal] = useState(initial?.data            ?? new Date().toISOString().slice(0, 10))
  const [cliente,  setCliente] = useState(initial?.cliente         ?? '')
  const [local,    setLocal]   = useState(initial?.localReuniao    ?? '')
  const [numAta,   setNumAta]  = useState(initial?.numeroAta       ?? '')
  const [partic,   setPartic]  = useState(initial?.participantes   ?? '')
  const [status,   setStatus]  = useState(initial?.status         ?? 'Rascunho')
  const [saving,   setSaving]  = useState(false)
  const [err,      setErr]     = useState('')

  const [blocks, setBlocks] = useState<Block[]>(defaultBlocks)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [menuPos,    setMenuPos]    = useState<{ top: number; left: number } | null>(null)
  const [insertAfter, setInsertAfter] = useState<string | null>(null)
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [activeType, setActiveType] = useState<BlockType>('bt')

  // Uncontrolled refs
  const contentRefs = useRef<Map<string, HTMLElement | null>>(new Map())
  const tableRefs   = useRef<Map<string, HTMLTableElement | null>>(new Map())
  const imgSrcs     = useRef<Map<string, string>>(new Map())
  const logoInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef  = useRef<HTMLInputElement>(null)
  const [logoSrc, setLogoSrc] = useState('')
  const pageRef = useRef<HTMLDivElement>(null)

  // Parse blocks after mount (avoids SSR DOMParser issue)
  useEffect(() => {
    if (initial?.conteudo) setBlocks(parseBlocks(initial.conteudo))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Toolbar ──────────────────────────────────────────────────────────────────

  function execCmd(cmd: string, val?: string) {
    document.execCommand(cmd, false, val)
  }

  function handleTypeSelectChange(type: string) {
    if (!activeId) return
    const t = type as BlockType
    const currentContent = contentRefs.current.get(activeId)?.innerHTML ?? ''
    setBlocks(prev => prev.map(b => b.id === activeId ? { ...b, type: t, initContent: currentContent } : b))
  }

  // ── Block ops ─────────────────────────────────────────────────────────────────

  function addBlock(type: BlockType, afterId: string | null) {
    const newBlock: Block = { id: uid(), type }
    setBlocks(prev => {
      if (afterId === null) return [...prev, newBlock]
      const idx = prev.findIndex(b => b.id === afterId)
      if (idx === -1) return [...prev, newBlock]
      const next = [...prev]
      next.splice(idx + 1, 0, newBlock)
      return next
    })
    setMenuOpen(false)
    setInsertAfter(null)
  }

  function removeBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id))
    contentRefs.current.delete(id)
    tableRefs.current.delete(id)
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      const tgt = idx + dir
      if (tgt < 0 || tgt >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[tgt]] = [next[tgt], next[idx]]
      return next
    })
  }

  function openMenu(afterId: string | null, rect: DOMRect) {
    setInsertAfter(afterId)
    setMenuPos({ top: rect.bottom, left: rect.left })
    setMenuOpen(true)
  }

  // ── Logo ─────────────────────────────────────────────────────────────────────

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => setLogoSrc(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!dataVal) { setErr('Data é obrigatória'); return }
    setSaving(true); setErr('')
    try {
      const conteudo = serializeBlocks(blocks, contentRefs, tableRefs, imgSrcs)
      await onSave({ titulo, data: dataVal, cliente, localReuniao: local, numeroAta: numAta, participantes: partic, status, conteudo })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  // ── Print ────────────────────────────────────────────────────────────────────

  function handlePrint() {
    window.print()
  }

  // ── Date display ─────────────────────────────────────────────────────────────

  const dateDisplay = dataVal
    ? new Date(dataVal + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  const st = STATUS_CFG[status] ?? STATUS_CFG['Rascunho']

  // ── Toolbar button factory ────────────────────────────────────────────────────

  const tbBtn = (cmd: string, title: string, label: React.ReactNode, val?: string) => (
    <button
      key={cmd + (val ?? '')}
      onMouseDown={e => { e.preventDefault(); execCmd(cmd, val) }}
      title={title}
      style={{
        width: 28, height: 28, border: 'none', background: 'transparent',
        borderRadius: 5, cursor: 'pointer', color: '#5a6178', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0F2F7'; (e.currentTarget as HTMLElement).style.color = '#1a1f2e' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#5a6178' }}
    >
      {label}
    </button>
  )

  const tbSep = () => <div style={{ width: 1, height: 22, background: 'rgba(42,79,150,0.12)', margin: '0 3px' }} />

  const tbSelect = (opts: { value: string; label: string }[], onChange: (v: string) => void, width?: number) => (
    <select
      onChange={e => onChange(e.target.value)}
      style={{ height: 28, padding: '0 6px', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 5, background: '#fff', color: '#1a1f2e', fontSize: 12, cursor: 'pointer', width: width ? width : undefined }}
    >
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )

  // ─── Render ───────────────────────────────────────────────────────────────────

  const inp: React.CSSProperties = {
    width: '100%', border: 'none', background: 'transparent', outline: 'none',
    padding: '2px 0', borderBottom: '1px solid rgba(42,79,150,0.15)',
    fontSize: 13, fontFamily: 'inherit', color: '#1a1f2e',
    transition: 'border-color .15s',
  }
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase',
    letterSpacing: '0.08em', display: 'block', marginBottom: 3,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#F4F6FA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Print styles ── */}
      <style>{`
        [data-ph]:empty::before { content: attr(data-ph); color: #9399ae; pointer-events: none; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 1.4em; }
        [contenteditable] li { margin-bottom: 2px; }
        @media print {
          body * { visibility: hidden; }
          #gt3-print-area, #gt3-print-area * { visibility: visible; }
          #gt3-print-area { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      {/* ── Topbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px',
        background: '#fff', borderBottom: '1px solid rgba(42,79,150,0.10)',
        flexShrink: 0, flexWrap: 'wrap', boxShadow: '0 1px 4px rgba(42,79,150,0.07)', zIndex: 100,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12, borderRight: '1px solid rgba(42,79,150,0.12)', marginRight: 4, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#2A4F96', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>GT3</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#2A4F96' }}>Atas</span>
        </div>

        {/* Block type select */}
        <select
          value={activeType}
          onChange={e => handleTypeSelectChange(e.target.value)}
          style={{ height: 28, padding: '0 6px', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 5, background: '#fff', color: '#1a1f2e', fontSize: 12, cursor: 'pointer' }}
        >
          <option value="bt">Parágrafo</option>
          <option value="bh1">Título 1</option>
          <option value="bh2">Título 2</option>
          <option value="bh3">Subtítulo</option>
          <option value="bq">Citação</option>
        </select>

        {tbSep()}

        {/* Font */}
        {tbSelect([
          { value: 'Segoe UI', label: 'Segoe UI' },
          { value: 'Arial',    label: 'Arial'    },
          { value: 'Georgia',  label: 'Georgia'  },
          { value: 'Verdana',  label: 'Verdana'  },
        ], v => execCmd('fontName', v), 100)}

        {tbSelect([
          { value: '1', label: '8' }, { value: '2', label: '10' }, { value: '3', label: '12' },
          { value: '4', label: '14' }, { value: '5', label: '18' }, { value: '6', label: '24' }, { value: '7', label: '36' },
        ], v => execCmd('fontSize', v), 50)}

        {tbSep()}

        {tbBtn('bold',           'Negrito (Ctrl+B)',    <b>N</b>)}
        {tbBtn('italic',         'Itálico (Ctrl+I)',    <i>I</i>)}
        {tbBtn('underline',      'Sublinhado (Ctrl+U)', <u>S</u>)}
        {tbBtn('strikeThrough',  'Tachado',             <s>T</s>)}

        {tbSep()}

        {tbBtn('justifyLeft',   'Esquerda',   '⬡')}
        {tbBtn('justifyCenter', 'Centro',     '▬')}
        {tbBtn('justifyRight',  'Direita',    '⬢')}
        {tbBtn('justifyFull',   'Justificado','≡')}

        {tbSep()}

        {tbBtn('insertUnorderedList', 'Lista',    '•—')}
        {tbBtn('insertOrderedList',   'Numerada', '1.')}
        {tbBtn('indent',              'Recuar',   '→')}
        {tbBtn('outdent',             'Recuar ←', '←')}

        {tbSep()}

        {/* Color pickers */}
        <label title="Cor do texto" style={{ position: 'relative', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 5, cursor: 'pointer', overflow: 'hidden' }}>
          <span style={{ fontSize: 13, pointerEvents: 'none', color: '#5a6178' }}>A</span>
          <input type="color" defaultValue="#1a1f2e" onChange={e => execCmd('foreColor', e.target.value)} style={{ position: 'absolute', width: '200%', height: '200%', top: '-50%', left: '-50%', border: 'none', opacity: 0, cursor: 'pointer' }} />
        </label>
        <label title="Destaque" style={{ position: 'relative', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 5, cursor: 'pointer', overflow: 'hidden' }}>
          <span style={{ fontSize: 13, pointerEvents: 'none', color: '#D1AE6E' }}>◉</span>
          <input type="color" defaultValue="#fef9e7" onChange={e => execCmd('hiliteColor', e.target.value)} style={{ position: 'absolute', width: '200%', height: '200%', top: '-50%', left: '-50%', border: 'none', opacity: 0, cursor: 'pointer' }} />
        </label>

        {tbSep()}

        {tbBtn('undo', 'Desfazer (Ctrl+Z)', '↩')}
        {tbBtn('redo', 'Refazer (Ctrl+Y)',  '↪')}

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {err && <span style={{ fontSize: 12, color: '#EF4444' }}>{err}</span>}

          {/* Status badge */}
          <button
            onClick={() => {
              const idx = ATAS_STATUS.indexOf(status)
              setStatus(ATAS_STATUS[(idx + 1) % ATAS_STATUS.length])
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
              borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${st.color}22`, background: `${st.color}15`, color: st.color,
              whiteSpace: 'nowrap',
            }}
          >
            {st.icon} {st.label}
          </button>

          <button
            onClick={handlePrint}
            style={{ height: 30, padding: '0 14px', border: '1px solid rgba(42,79,150,0.22)', borderRadius: 6, background: '#fff', fontSize: 12, color: '#5a6178', cursor: 'pointer' }}
          >
            🖨 Imprimir
          </button>
          <button onClick={onClose} style={{ height: 30, padding: '0 14px', border: '1px solid rgba(42,79,150,0.18)', borderRadius: 6, background: '#fff', fontSize: 12, color: '#5a6178', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ height: 30, padding: '0 18px', border: 'none', borderRadius: 6, background: '#2A4F96', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '36px 24px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          id="gt3-print-area"
          ref={pageRef}
          style={{
            width: '100%', maxWidth: 800, background: '#fff',
            border: '1px solid rgba(42,79,150,0.10)', borderRadius: 20,
            padding: '52px 60px', boxShadow: '0 4px 20px rgba(42,79,150,0.10)',
          }}
        >
          {/* Doc header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 22, borderBottom: '2px solid #2A4F96', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
              {/* Logo */}
              <div
                onClick={() => logoInputRef.current?.click()}
                title="Adicionar logo"
                style={{
                  width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                  background: '#F0F2F7', border: '1.5px dashed rgba(42,79,150,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', overflow: 'hidden', transition: 'all .15s',
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = '#2A4F96'; el.style.background = '#e8f0fc' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(42,79,150,0.22)'; el.style.background = '#F0F2F7' }}
              >
                {logoSrc
                  ? <img src={logoSrc} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 22, color: '#9399ae' }}>🏢</span>
                }
              </div>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Título da reunião / ata…"
                style={{ fontSize: 20, fontWeight: 700, color: '#2A4F96', border: 'none', borderBottom: '2px solid rgba(42,79,150,0.15)', borderRadius: 0, padding: '4px 0', flex: 1, background: 'transparent', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ display: 'inline-block', padding: '3px 10px', background: '#D1AE6E', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                {numAta || 'Nº —/—'}
              </div>
              <div style={{ fontSize: 12, color: '#5a6178' }}>{dateDisplay}</div>
            </div>
          </div>

          {/* Meta fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 30, padding: '16px 18px', background: '#F0F2F7', borderRadius: 10, border: '1px solid rgba(42,79,150,0.10)' }}>
            <div>
              <span style={lbl}>Cliente / Empresa</span>
              <input className="meta-in-focus" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Ex.: Marcopolo AR / MP SC" style={inp} />
            </div>
            <div>
              <span style={lbl}>Data</span>
              <input type="date" value={dataVal} onChange={e => setDataVal(e.target.value)} style={inp} />
            </div>
            <div>
              <span style={lbl}>Local</span>
              <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Online / Caxias do Sul — RS" style={inp} />
            </div>
            <div>
              <span style={lbl}>Número da ata</span>
              <input value={numAta} onChange={e => setNumAta(e.target.value)} placeholder="Ex.: Nº 04/26" style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Participantes</span>
              <input value={partic} onChange={e => setPartic(e.target.value)} placeholder="Ex.: Fernando Almeida (Marcopolo AR), Marcio Bastos (GT3)" style={inp} />
            </div>
          </div>

          {/* Blocks */}
          <div style={{ position: 'relative', paddingLeft: 40 }}>
            <AddBar afterId={null} onOpen={(_, rect) => openMenu(null, rect)} />
            {blocks.map(b => (
              <div key={b.id}>
                <BlockShell id={b.id} onRemove={removeBlock} onMove={moveBlock}>
                  {renderBlock(b)}
                </BlockShell>
                <AddBar afterId={b.id} onOpen={(aid, rect) => openMenu(aid, rect)} />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 36, paddingTop: 14, borderTop: '1px solid rgba(42,79,150,0.10)', fontSize: 11, color: '#9399ae' }}>
            <span style={{ fontWeight: 600, color: '#2A4F96', opacity: 0.5 }}>GT3 Consultoria</span>
            <div style={{ display: 'flex', gap: 32 }}>
              <div style={{ fontSize: 11, color: '#9399ae', borderTop: '1px solid rgba(42,79,150,0.22)', paddingTop: 2, width: 160, textAlign: 'center' }}>Responsável GT3</div>
              <div style={{ fontSize: 11, color: '#9399ae', borderTop: '1px solid rgba(42,79,150,0.22)', paddingTop: 2, width: 160, textAlign: 'center' }}>Responsável Cliente</div>
            </div>
            <span>Pág. 1</span>
          </div>
        </div>
      </div>

      {/* ── Block menu ── */}
      <BlockMenu
        open={menuOpen}
        pos={menuPos}
        onSelect={type => addBlock(type, insertAfter)}
        onClose={() => setMenuOpen(false)}
      />

      {/* ── Hidden inputs ── */}
      <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
      <input ref={imgInputRef}  type="file" accept="image/*" style={{ display: 'none' }} />
    </div>
  )

  function renderBlock(b: Block): React.ReactNode {
    const regContent = (id: string, el: HTMLElement | null) => { if (el) contentRefs.current.set(id, el); else contentRefs.current.delete(id) }
    const regTable   = (id: string, el: HTMLTableElement | null) => { if (el) tableRefs.current.set(id, el); else tableRefs.current.delete(id) }
    const onFocus = (id: string, type: BlockType) => { setActiveId(id); setActiveType(type) }

    if (b.type === 'div') return <hr style={{ border: 'none', borderTop: '1px solid rgba(42,79,150,0.15)', margin: '12px 0' }} />

    if (b.type === 'table') return (
      <TableBlock
        id={b.id}
        initHeaders={b.initHeaders}
        initRows={b.initRows}
        registerTable={regTable}
      />
    )

    if (b.type === 'cols') return (
      <ColsBlock
        id={b.id}
        initLeft={b.initLeft}
        initRight={b.initRight}
        onFocus={onFocus}
        register={regContent}
      />
    )

    if (b.type === 'img') return (
      <ImgBlock
        id={b.id}
        initSrc={b.initSrc}
        onSrcChange={(id, src) => imgSrcs.current.set(id, src)}
        imgInputRef={imgInputRef}
      />
    )

    if (b.type === 'ci' || b.type === 'cw' || b.type === 'co') return (
      <CalloutBlock
        id={b.id}
        type={b.type}
        initContent={b.initContent}
        onFocus={onFocus}
        register={regContent}
      />
    )

    return (
      <TextBlock
        id={b.id}
        type={b.type}
        initContent={b.initContent}
        onFocus={onFocus}
        register={regContent}
      />
    )
  }
}
