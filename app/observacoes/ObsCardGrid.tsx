'use client'

import { useState, useMemo } from 'react'
import type { Card, Column } from './data'

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRIMARY = '#2A4F96'
const ACCENT = '#D1AE6E'
const ACCENT_DARK = '#B8922A'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const BG_CARD = '#FFFFFF'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CardUI = Card & {
  _id?: string
  _source: 'static' | 'db'
  _imagem_url?: string
  _atualizado_por?: string | null
  _atualizado_em?: string | null
  _status_edicao?: string | null
  _atualizado_por_nome?: string | null
}

export type ColumnUI = Omit<Column, 'cards'> & { cards: CardUI[] }

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function cardId(catKey: string, subtabKey: string, colTitle: string, idx: number) {
  return `${catKey}|${subtabKey}|${colTitle}|${idx}`
}

export function matchesSearch(card: CardUI, term: string): boolean {
  if (!term) return true
  const t = term.toLowerCase()
  return card.motivo.toLowerCase().includes(t) || card.parecer.toLowerCase().includes(t)
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

function formatEditDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── ObsCard ───────────────────────────────────────────────────────────────────

function ObsCard({
  card, id, isCopied, onCopy, search, canManage, onEdit, onDelete, isFixed,
  onInlineSave, onValidate, canValidate, onInlineCreate, imageOnly,
}: {
  card: CardUI
  id: string
  isCopied: boolean
  onCopy: (id: string, text: string) => void
  search: string
  canManage?: boolean
  onEdit?: () => void
  onDelete?: () => void
  isFixed?: boolean
  onInlineSave?: (id: string, parecer: string) => Promise<void>
  onValidate?: (id: string) => Promise<void>
  canValidate?: boolean
  onInlineCreate?: (motivo: string, parecer: string) => Promise<void>
  imageOnly?: boolean
}) {
  const [editingInline, setEditingInline] = useState(false)
  const [inlineText, setInlineText] = useState('')
  const [inlineSaving, setInlineSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [lightbox, setLightbox] = useState(false)

  // ── Modo repositório de imagem ──────────────────────────────────────────────
  if (imageOnly) {
    return (
      <>
        {lightbox && card._imagem_url && (
          <div
            onClick={() => setLightbox(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, cursor: 'zoom-out', padding: 24,
            }}
          >
            <img
              src={card._imagem_url}
              alt=""
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, cursor: 'default' }}
            />
            <button
              onClick={() => setLightbox(false)}
              style={{
                position: 'fixed', top: 18, right: 18, background: 'rgba(255,255,255,0.15)',
                border: 'none', borderRadius: '50%', color: '#fff', fontSize: 18,
                width: 36, height: 36, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        )}
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}`, background: '#F8FAFC' }}>
          {card._imagem_url ? (
            <img
              src={card._imagem_url}
              alt=""
              onClick={() => setLightbox(true)}
              style={{ width: '100%', display: 'block', cursor: 'zoom-in', objectFit: 'contain', maxHeight: 260 }}
            />
          ) : (
            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 12 }}>
              Sem imagem
            </div>
          )}
          {canManage && card._source === 'db' && (
            <button
              onClick={e => { e.stopPropagation(); onDelete?.() }}
              style={{
                position: 'absolute', top: 6, right: 6, background: 'rgba(220,38,38,0.75)',
                border: 'none', borderRadius: 4, color: '#fff', fontSize: 11,
                padding: '3px 7px', cursor: 'pointer', fontWeight: 600,
              }}
            >🗑</button>
          )}
        </div>
      </>
    )
  }

  const isPendente = card._status_edicao === 'pendente_validacao'
  const accentColor = isFixed ? ACCENT : PRIMARY
  const tagBg = isFixed ? 'rgba(209,174,110,0.15)' : 'rgba(42,79,150,0.08)'
  const borderColor = isCopied ? '#22C55E' : accentColor

  function startInlineEdit() {
    setInlineText(card.parecer)
    setEditingInline(true)
  }

  async function saveInlineEdit() {
    if (!inlineText.trim()) return
    setInlineSaving(true)
    setSaveError('')
    try {
      if (card._id) {
        await onInlineSave?.(card._id, inlineText.trim())
      } else {
        await onInlineCreate?.(card.motivo, inlineText.trim())
      }
      setEditingInline(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setInlineSaving(false)
    }
  }

  return (
    <div
      role={editingInline ? undefined : 'button'}
      tabIndex={editingInline ? undefined : 0}
      onClick={editingInline ? undefined : () => onCopy(id, card.parecer)}
      onKeyDown={editingInline ? undefined : e => (e.key === 'Enter' || e.key === ' ') && onCopy(id, card.parecer)}
      style={{
        background: isPendente ? '#EFF6FF' : BG_CARD,
        borderTop: isPendente ? '1px solid #BFDBFE' : `1.5px solid ${borderColor}`,
        borderRight: isPendente ? '1px solid #BFDBFE' : `1.5px solid ${borderColor}`,
        borderBottom: isPendente ? '1px solid #BFDBFE' : `1.5px solid ${borderColor}`,
        borderLeft: isPendente ? '3px solid #2A4F96' : `1.5px solid ${borderColor}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: editingInline ? 'default' : 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.15s, transform 0.1s',
        boxShadow: isCopied
          ? '0 0 0 3px rgba(34,197,94,0.15)'
          : isFixed
            ? '0 1px 3px rgba(209,174,110,0.12)'
            : '0 1px 3px rgba(42,79,150,0.08)',
        transform: isCopied ? 'scale(0.99)' : undefined,
        position: 'relative',
        userSelect: editingInline ? 'text' : 'none',
      }}
    >
      {!editingInline && (
        <div style={{
          position: 'absolute', top: 8, right: 10, fontSize: 11, fontWeight: 600,
          color: isCopied ? '#16A34A' : MUTED, transition: 'color 0.2s', letterSpacing: 0.3,
        }}>
          {isCopied ? '✓ Copiado' : '⧉'}
        </div>
      )}

      <div style={{
        display: 'inline-block', fontSize: 12, fontWeight: 700, color: accentColor,
        background: tagBg, borderRadius: 4, padding: '2px 7px',
        marginBottom: 6, lineHeight: 1.4, maxWidth: 'calc(100% - 52px)',
      }}>
        {highlight(card.motivo, search)}
      </div>

      {editingInline ? (
        <textarea
          value={inlineText}
          onChange={e => setInlineText(e.target.value)}
          autoFocus
          rows={4}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12,
            border: `1.5px solid ${PRIMARY}`, outline: 'none', resize: 'vertical',
            fontFamily: 'inherit', color: INK, boxSizing: 'border-box', display: 'block',
          }}
        />
      ) : (
        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {highlight(card.parecer, search)}
        </div>
      )}

      {!editingInline && card._imagem_url && (
        <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
          <img
            src={card._imagem_url}
            alt=""
            style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 6, border: `1px solid ${BORDER}`, display: 'block' }}
          />
        </div>
      )}

      {!editingInline && isPendente && (
        <div
          style={{ marginTop: 8, fontSize: 11, color: '#4B72C4', lineHeight: 1.6 }}
          onClick={e => e.stopPropagation()}
        >
          {(() => {
            const parts = [
              card._atualizado_por_nome && `por ${card._atualizado_por_nome}`,
              card._atualizado_em && `em ${formatEditDate(card._atualizado_em)}`,
            ].filter(Boolean).join(' ')
            return `✏️ ${parts ? `Atualizado ${parts} — ` : ''}Aguardando validação`
          })()}
          {canValidate && (
            <button
              onClick={() => card._id && onValidate?.(card._id)}
              style={{
                display: 'block', marginTop: 5, fontSize: 11, padding: '3px 10px', borderRadius: 5,
                border: '1px solid #2A4F96', background: '#fff', color: '#2A4F96',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              ✓ Validar atualização
            </button>
          )}
        </div>
      )}

      <div
        style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${isPendente ? '#BFDBFE' : BORDER}`, flexWrap: 'wrap' }}
        onClick={e => e.stopPropagation()}
      >
        {editingInline ? (
          <>
            <button
              onClick={saveInlineEdit}
              disabled={inlineSaving || !inlineText.trim()}
              style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 5, border: 'none',
                background: PRIMARY, color: '#fff', cursor: inlineSaving ? 'default' : 'pointer',
                fontWeight: 600, opacity: (!inlineText.trim() || inlineSaving) ? 0.6 : 1,
              }}
            >
              {inlineSaving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              onClick={() => { setEditingInline(false); setSaveError('') }}
              disabled={inlineSaving}
              style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 5, border: `1px solid ${BORDER}`,
                background: '#fff', color: MUTED, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            {saveError && (
              <span style={{ fontSize: 11, color: '#DC2626', marginLeft: 4 }}>{saveError}</span>
            )}
          </>
        ) : (
          <>
            <button
              onClick={startInlineEdit}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid #BFDBFE',
                background: '#EFF6FF', color: '#2A4F96', cursor: 'pointer', fontWeight: 600,
              }}
            >
              ✏️ Editar
            </button>
            {canManage && card._source === 'db' && (
              <>
                <button
                  onClick={onEdit}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 5, border: `1px solid ${BORDER}`,
                    background: '#F0F4FA', color: PRIMARY, cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  ✎ Editar completo
                </button>
                <button
                  onClick={onDelete}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid #FCA5A5',
                    background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  🗑 Excluir
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── ObsColumn ─────────────────────────────────────────────────────────────────

export function ObsColumn({
  col, catKey, subtabKey, search, copiedId, onCopy,
  papel, onAdd, onEdit, onDelete, onInlineSave, onValidate, onInlineCreate,
}: {
  col: ColumnUI
  catKey: string
  subtabKey: string
  search: string
  copiedId: string | null
  onCopy: (id: string, text: string) => void
  papel: string
  onAdd: (coluna: string, subtabKey: string) => void
  onEdit: (id: string, motivo: string, parecer: string, coluna: string, subtabKey: string, imagemUrl: string) => void
  onDelete: (id: string) => void
  onInlineSave: (id: string, parecer: string) => Promise<void>
  onValidate: (id: string) => Promise<void>
  onInlineCreate: (catKey: string, subtabKey: string, coluna: string, motivo: string, parecer: string) => Promise<void>
}) {
  const { ungrouped, groups } = useMemo(() => {
    const ungrouped: { card: CardUI; idx: number }[] = []
    const groups: Map<string, { card: CardUI; idx: number }[]> = new Map()

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
  const canManage = ['gestor', 'admin'].includes(papel)
  const canAdd = ['colaborador', 'gestor', 'admin'].includes(papel)

  if (totalVisible === 0 && search) return null

  const headerBg = col.isFixed
    ? `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`
    : `linear-gradient(135deg, ${PRIMARY} 0%, #1E3A6E 100%)`

  return (
    <div style={{
      background: BG_CARD,
      border: `2px solid ${col.isFixed ? ACCENT : PRIMARY}`,
      borderRadius: 10,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      boxShadow: col.isFixed
        ? '0 2px 8px rgba(209,174,110,0.18)'
        : '0 2px 8px rgba(42,79,150,0.10)',
    }}>
      <div style={{
        background: headerBg, padding: '10px 14px',
        borderRadius: '8px 8px 0 0',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.2 }}>
            {col.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
            background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 20, padding: '1px 8px', fontVariantNumeric: 'tabular-nums',
          }}>
            {totalVisible}
          </span>
          {canAdd && (
            <button
              onClick={() => onAdd(col.title, subtabKey)}
              title="Nova observação"
              style={{
                fontSize: 15, lineHeight: 1, fontWeight: 700,
                color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.35)', borderRadius: 6,
                width: 24, height: 24, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              ＋
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
        {ungrouped.map(({ card, idx }) => {
          const id = cardId(catKey, subtabKey, col.title, idx)
          return (
            <ObsCard
              key={card._id ?? id}
              card={card}
              id={id}
              isCopied={copiedId === id}
              onCopy={onCopy}
              search={search}
              canManage={canManage}
              isFixed={col.isFixed}
              imageOnly={col.imageOnly}
              onEdit={() => card._id && onEdit(card._id, card.motivo, card.parecer, col.title, subtabKey, card._imagem_url ?? '')}
              onDelete={() => card._id && onDelete(card._id)}
              onInlineSave={onInlineSave}
              onValidate={onValidate}
              canValidate={canManage}
              onInlineCreate={async (motivo, parecer) => onInlineCreate(catKey, subtabKey, col.title, motivo, parecer)}
            />
          )
        })}

        {Array.from(groups.entries()).map(([groupName, items]) => (
          <div key={groupName}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase',
              letterSpacing: '0.08em', padding: '4px 0 4px', borderBottom: `1px solid ${BORDER}`,
              marginBottom: 6,
            }}>
              {groupName}
            </div>
            {items.map(({ card, idx }) => {
              const id = cardId(catKey, subtabKey, col.title, idx)
              return (
                <ObsCard
                  key={card._id ?? id}
                  card={card}
                  id={id}
                  isCopied={copiedId === id}
                  onCopy={onCopy}
                  search={search}
                  canManage={canManage}
                  isFixed={col.isFixed}
                  imageOnly={col.imageOnly}
                  onEdit={() => card._id && onEdit(card._id, card.motivo, card.parecer, col.title, subtabKey, card._imagem_url ?? '')}
                  onDelete={() => card._id && onDelete(card._id)}
                  onInlineSave={onInlineSave}
                  onValidate={onValidate}
                  canValidate={canManage}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
