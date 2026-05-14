'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { CATEGORIES, type Category, type Column, type Card } from './data'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const ACCENT = '#D1AE6E'
const ACCENT_DARK = '#B8922A'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const BG_CARD = '#FFFFFF'
const BG_PAGE = '#F4F6FA'

// Unique ID for each card so copy feedback is per-card
function cardId(catKey: string, subtabKey: string, colTitle: string, idx: number) {
  return `${catKey}|${subtabKey}|${colTitle}|${idx}`
}

function matchesSearch(card: Card, term: string): boolean {
  if (!term) return true
  const t = term.toLowerCase()
  return (
    card.motivo.toLowerCase().includes(t) ||
    card.parecer.toLowerCase().includes(t)
  )
}

function highlight(text: string, term: string): React.ReactNode {
  if (!term) return text
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#FFF3CD', color: INK, borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  )
}

// ─── Card Component ────────────────────────────────────────────────────────────

function ObsCard({
  card,
  id,
  isCopied,
  onCopy,
  search,
}: {
  card: Card
  id: string
  isCopied: boolean
  onCopy: (id: string, text: string) => void
  search: string
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onCopy(id, card.parecer)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onCopy(id, card.parecer)}
      style={{
        background: BG_CARD,
        border: `1.5px solid ${isCopied ? '#22C55E' : BORDER}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.15s, transform 0.1s',
        boxShadow: isCopied
          ? '0 0 0 3px rgba(34,197,94,0.15)'
          : '0 1px 3px rgba(30,37,61,0.05)',
        transform: isCopied ? 'scale(0.99)' : undefined,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Copy icon + feedback */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          fontSize: 11,
          fontWeight: 600,
          color: isCopied ? '#16A34A' : MUTED,
          transition: 'color 0.2s',
          letterSpacing: 0.3,
        }}
      >
        {isCopied ? '✓ Copiado' : '⧉'}
      </div>

      {/* Motivo tag */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: PRIMARY,
          marginBottom: 5,
          paddingRight: 52,
          lineHeight: 1.3,
        }}
      >
        {highlight(card.motivo, search)}
      </div>

      {/* Parecer text */}
      <div
        style={{
          fontSize: 12,
          color: '#374151',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {highlight(card.parecer, search)}
      </div>
    </div>
  )
}

// ─── Column Component ──────────────────────────────────────────────────────────

function ObsColumn({
  col,
  catKey,
  subtabKey,
  search,
  copiedId,
  onCopy,
}: {
  col: Column
  catKey: string
  subtabKey: string
  search: string
  copiedId: string | null
  onCopy: (id: string, text: string) => void
}) {
  // Group cards by their `group` field
  const { ungrouped, groups } = useMemo(() => {
    const ungrouped: { card: Card; idx: number }[] = []
    const groups: Map<string, { card: Card; idx: number }[]> = new Map()

    col.cards.forEach((card, idx) => {
      if (!matchesSearch(card, search)) return
      if (card.group) {
        const existing = groups.get(card.group) ?? []
        existing.push({ card, idx })
        groups.set(card.group, existing)
      } else {
        ungrouped.push({ card, idx })
      }
    })
    return { ungrouped, groups }
  }, [col.cards, search])

  const totalVisible = ungrouped.length + Array.from(groups.values()).reduce((s, g) => s + g.length, 0)

  if (totalVisible === 0 && search) return null

  const headerBg = col.isFixed
    ? `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`
    : `linear-gradient(135deg, ${PRIMARY} 0%, #1E3A6E 100%)`

  return (
    <div
      style={{
        background: BG_CARD,
        border: `2px solid ${col.isFixed ? ACCENT : PRIMARY}`,
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: col.isFixed
          ? '0 2px 8px rgba(209,174,110,0.18)'
          : '0 2px 8px rgba(42,79,150,0.10)',
      }}
    >
      {/* Column header */}
      <div
        style={{
          background: headerBg,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.7)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.2 }}>
            {col.title}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 20,
            padding: '1px 8px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {totalVisible}
        </span>
      </div>

      {/* Cards */}
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ungrouped.map(({ card, idx }) => {
          const id = cardId(catKey, subtabKey, col.title, idx)
          return (
            <ObsCard
              key={id}
              card={card}
              id={id}
              isCopied={copiedId === id}
              onCopy={onCopy}
              search={search}
            />
          )
        })}

        {Array.from(groups.entries()).map(([groupName, items]) => (
          <div key={groupName}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: MUTED,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '4px 0 4px',
                borderBottom: `1px solid ${BORDER}`,
                marginBottom: 6,
              }}
            >
              {groupName}
            </div>
            {items.map(({ card, idx }) => {
              const id = cardId(catKey, subtabKey, col.title, idx)
              return (
                <ObsCard
                  key={id}
                  card={card}
                  id={id}
                  isCopied={copiedId === id}
                  onCopy={onCopy}
                  search={search}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Client Component ─────────────────────────────────────────────────────

export default function ObservacoesClient() {
  const [activeCatKey, setActiveCatKey] = useState<string>(CATEGORIES[0]?.key ?? '')
  const [activeSubtabKey, setActiveSubtabKey] = useState<string>(CATEGORIES[0]?.subtabs[0]?.key ?? '')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeCategory = useMemo<Category | undefined>(
    () => CATEGORIES.find(c => c.key === activeCatKey),
    [activeCatKey]
  )

  const activeSubtab = useMemo(
    () => activeCategory?.subtabs.find(s => s.key === activeSubtabKey) ?? activeCategory?.subtabs[0],
    [activeCategory, activeSubtabKey]
  )

  const totalResults = useMemo(() => {
    if (!activeSubtab || !search) return null
    return activeSubtab.columns.reduce(
      (sum, col) => sum + col.cards.filter(c => matchesSearch(c, search)).length,
      0
    )
  }, [activeSubtab, search])

  const handleCatChange = useCallback((key: string) => {
    const cat = CATEGORIES.find(c => c.key === key)
    setActiveCatKey(key)
    setActiveSubtabKey(cat?.subtabs[0]?.key ?? '')
    setSearch('')
  }, [])

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
    setCopiedId(id)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 1600)
  }, [])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const hasSubtabs = (activeCategory?.subtabs.length ?? 0) > 1

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: 0,
        minHeight: 'calc(100vh - 140px)',
        borderRadius: 10,
        overflow: 'hidden',
        border: `1px solid ${BORDER}`,
        boxShadow: '0 1px 6px rgba(30,37,61,0.06)',
      }}
    >
      {/* ── Internal category nav ─────────────────────────── */}
      <nav
        style={{
          background: '#fff',
          borderRight: `1px solid ${BORDER}`,
          padding: '14px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            padding: '0 10px 10px',
          }}
        >
          Categorias
        </div>

        {CATEGORIES.map(cat => {
          const isActive = cat.key === activeCatKey
          return (
            <button
              key={cat.key}
              onClick={() => handleCatChange(cat.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 10px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? PRIMARY_LIGHT : 'transparent',
                color: isActive ? PRIMARY : INK,
                fontSize: 13,
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.15s, color 0.15s',
                borderLeft: `3px solid ${isActive ? PRIMARY : 'transparent'}`,
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{cat.icon}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                {cat.label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 20,
                  background: isActive ? PRIMARY : '#F0F4FA',
                  color: isActive ? '#fff' : MUTED,
                  border: `1px solid ${isActive ? PRIMARY : BORDER}`,
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {cat.totalCards}
              </span>
            </button>
          )
        })}
      </nav>

      {/* ── Content area ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', background: BG_PAGE, minWidth: 0 }}>

        {/* Subtabs bar */}
        {hasSubtabs && (
          <div
            style={{
              background: '#fff',
              borderBottom: `1px solid ${BORDER}`,
              padding: '10px 20px',
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 6 }}>
              Subcat.:
            </span>
            {activeCategory?.subtabs.map(st => {
              const isActive = st.key === (activeSubtab?.key ?? '')
              return (
                <button
                  key={st.key}
                  onClick={() => setActiveSubtabKey(st.key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1.5px solid ${isActive ? PRIMARY : BORDER}`,
                    background: isActive ? PRIMARY : '#fff',
                    color: isActive ? '#fff' : MUTED,
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {st.key}
                </button>
              )
            })}
          </div>
        )}

        {/* Search + stat bar */}
        <div
          style={{
            padding: '14px 20px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: MUTED,
                fontSize: 14,
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar observações…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 36px',
                background: '#fff',
                border: `1.5px solid ${search ? PRIMARY : BORDER}`,
                borderRadius: 8,
                fontSize: 13,
                color: INK,
                outline: 'none',
                boxShadow: search ? `0 0 0 3px ${PRIMARY_LIGHT}` : '0 1px 3px rgba(30,37,61,0.05)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                fontFamily: 'inherit',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#F0F4FA',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 5,
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 10,
                  color: MUTED,
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {search && totalResults !== null && (
            <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <strong style={{ color: PRIMARY }}>{totalResults}</strong> resultado{totalResults !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Columns grid */}
        <div style={{ padding: '0 20px 32px', flex: 1 }}>
          {activeSubtab ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              {activeSubtab.columns.map(col => (
                <ObsColumn
                  key={`${activeSubtab.key}|${col.title}`}
                  col={col}
                  catKey={activeCatKey}
                  subtabKey={activeSubtab.key}
                  search={search}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          ) : (
            <div style={{ color: MUTED, fontSize: 14, padding: 32, textAlign: 'center' }}>
              Selecione uma categoria.
            </div>
          )}

          {/* Empty state for search */}
          {search && totalResults === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: MUTED,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>
                Nenhum resultado para "{search}"
              </div>
              <div style={{ fontSize: 13 }}>Tente outros termos ou limpe a busca.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
