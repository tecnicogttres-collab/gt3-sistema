'use client'

import { useEffect, useRef, useState } from 'react'
import type { Module, Role } from '../lib/modules'
import { MODULE_COMPONENT_MAP } from './moduleComponentMap'

export type SplitSide = 'left' | 'right'
export type SplitState = { open: boolean; path: string | null; side: SplitSide; ratio: number }

const SPLIT_KEY = 'gt3_split_view'
export const DEFAULT_SPLIT: SplitState = { open: false, path: null, side: 'right', ratio: 0.38 }
const MIN_RATIO = 0.2
const MAX_RATIO = 0.65

export function loadSplitState(): SplitState {
  try {
    const raw = localStorage.getItem(SPLIT_KEY)
    if (!raw) return DEFAULT_SPLIT
    const parsed = JSON.parse(raw) as Partial<SplitState>
    return {
      open: !!parsed.open,
      path: parsed.path ?? null,
      side: parsed.side === 'left' ? 'left' : 'right',
      ratio: typeof parsed.ratio === 'number' ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, parsed.ratio)) : DEFAULT_SPLIT.ratio,
    }
  } catch { return DEFAULT_SPLIT }
}

export function saveSplitState(s: SplitState) {
  try { localStorage.setItem(SPLIT_KEY, JSON.stringify(s)) } catch { /* noop */ }
}

/** Módulos elegíveis para fixar: precisam existir como componente client puro (sem rotas dinâmicas/SSR). */
export function pinnableModules(modules: Module[], papel: Role | null, allowedIds: string[] | null): Module[] {
  return modules
    .filter(m => !!MODULE_COMPONENT_MAP[m.path])
    .filter(m => {
      if (papel === 'admin') return true
      if (allowedIds !== null) return allowedIds.includes(m.id)
      return papel ? m.allowedRoles.includes(papel) : false
    })
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function SplitDivider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Arraste para redimensionar"
      style={{
        width: 6, flexShrink: 0, cursor: 'col-resize',
        background: hover ? '#9BB3D4' : '#E2E8F0',
        transition: 'background 0.12s',
        position: 'relative', zIndex: 50,
      }}
    />
  )
}

/** Hook: dá um handler de mousedown que, enquanto arrastado, recalcula o ratio com base no container. */
export function useSplitDrag(
  containerRef: React.RefObject<HTMLDivElement | null>,
  side: SplitSide,
  onRatioChange: (ratio: number) => void,
) {
  const draggingRef = useRef(false)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const raw = side === 'left' ? x / rect.width : 1 - x / rect.width
      onRatioChange(Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw)))
    }
    function onUp() {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [containerRef, side, onRatioChange])

  return (e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
}

// ─── Pinned pane ────────────────────────────────────────────────────────────

export function PinnedPane({
  path, label, color, width, onClose, onSwapSide,
}: {
  path: string
  label: string
  color: string
  width: string
  onClose: () => void
  onSwapSide: () => void
}) {
  const Comp = MODULE_COMPONENT_MAP[path]
  return (
    <div style={{
      width, flexShrink: 0, display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden', background: '#fff',
    }}>
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, gap: 8, background: '#F8FAFC',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          📌 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </span>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={onSwapSide}
            title="Trocar de lado"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7A99', fontSize: 14, padding: '4px 6px', borderRadius: 6 }}
          >⇄</button>
          <button
            onClick={onClose}
            title="Fechar tela dividida"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7A99', fontSize: 14, padding: '4px 6px', borderRadius: 6 }}
          >✕</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: '#F4F6FA', padding: 24 }}>
        {Comp ? <Comp /> : <div style={{ color: '#94A3B8', fontSize: 13 }}>Módulo indisponível para fixar.</div>}
      </div>
    </div>
  )
}

// ─── Header control ───────────────────────────────────────────────────────────

export function SplitViewButton({
  split, modules, onChange,
}: {
  split: SplitState
  modules: Module[]
  onChange: (next: SplitState) => void
}) {
  const [open, setOpen] = useState(false)
  const active = split.open && !!split.path
  const activeModule = active ? modules.find(m => m.path === split.path) : null

  function activate(path: string, side: SplitSide) {
    onChange({ ...split, open: true, path, side })
    setOpen(false)
  }

  if (active) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: '#EBF0FB', border: '1px solid #C7D6F0',
        borderRadius: 20, padding: '4px 6px 4px 10px', fontSize: 12, fontWeight: 600, color: '#1E3A6E',
      }}>
        📌 {activeModule?.label ?? split.path}
        <button
          onClick={() => setOpen(v => !v)}
          title="Trocar módulo fixado"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#1E3A6E', fontSize: 12, padding: '2px 4px' }}
        >✎</button>
        <button
          onClick={() => onChange({ ...split, open: false })}
          title="Fechar tela dividida"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#1E3A6E', fontSize: 13, padding: '2px 6px' }}
        >✕</button>
        {open && (
          <SplitPicker modules={modules} onPick={activate} onClose={() => setOpen(false)} />
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Dividir tela e fixar um módulo"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer',
          color: '#374151', fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 20,
        }}
      >
        ⧉ Dividir tela
      </button>
      {open && (
        <SplitPicker modules={modules} onPick={activate} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

function SplitPicker({
  modules, onPick, onClose,
}: {
  modules: Module[]
  onPick: (path: string, side: SplitSide) => void
  onClose: () => void
}) {
  const [path, setPath] = useState(modules[0]?.path ?? '')
  const [side, setSide] = useState<SplitSide>('right')

  return (
    <div
      onMouseLeave={onClose}
      style={{
        position: 'absolute', top: 'calc(100% + 6px)', right: 0,
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 300,
        width: 240, padding: 14,
      }}
    >
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
        Módulo a fixar
      </label>
      <select
        value={path}
        onChange={e => setPath(e.target.value)}
        style={{
          width: '100%', height: 34, padding: '0 8px', fontSize: 13,
          border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff',
          marginBottom: 12, fontFamily: 'inherit',
        }}
      >
        {modules.map(m => <option key={m.path} value={m.path}>{m.label}</option>)}
      </select>

      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
        Lado fixo
      </label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['left', 'right'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSide(s)}
            style={{
              flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 500, borderRadius: 7,
              border: `1px solid ${side === s ? '#2A4F96' : '#E2E8F0'}`,
              background: side === s ? '#2A4F96' : '#fff',
              color: side === s ? '#fff' : '#374151', cursor: 'pointer',
            }}
          >{s === 'left' ? 'Esquerda' : 'Direita'}</button>
        ))}
      </div>

      <button
        onClick={() => path && onPick(path, side)}
        disabled={!path}
        style={{
          width: '100%', padding: '8px 0', borderRadius: 8, border: 'none',
          background: path ? '#2A4F96' : '#9BB3D4', color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: path ? 'pointer' : 'not-allowed',
        }}
      >Ativar</button>
    </div>
  )
}
