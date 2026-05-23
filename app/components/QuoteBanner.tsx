'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'gt3_frases_diarias_v1'
const ROTATION_KEY = 'gt3_frases_rotation_v1'

type Quote = { id: string; text: string; author: string; active: boolean }
type Rotation = { pool: string[]; currentId: string | null; currentDate: string | null }

function todayStr() { return new Date().toISOString().slice(0, 10) }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getQuoteOfDay(): Quote | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const rotRaw = localStorage.getItem(ROTATION_KEY)
    if (!raw) return null
    const quotes: Quote[] = JSON.parse(raw)
    const rotation: Rotation = rotRaw ? JSON.parse(rotRaw) : { pool: [], currentId: null, currentDate: null }
    const today = todayStr()
    const active = quotes.filter(q => q.active)
    if (active.length === 0) return null

    if (rotation.currentDate === today && rotation.currentId) {
      const q = active.find(x => x.id === rotation.currentId)
      if (q) return q
    }

    const activeIds = active.map(q => q.id)
    let pool = rotation.pool.filter(id => activeIds.includes(id))
    if (pool.length === 0) pool = shuffle(activeIds)
    const [nextId, ...rest] = pool
    const newRotation: Rotation = { pool: rest, currentId: nextId, currentDate: today }
    localStorage.setItem(ROTATION_KEY, JSON.stringify(newRotation))
    return active.find(x => x.id === nextId) ?? null
  } catch {
    return null
  }
}

export default function QuoteBanner() {
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    setQuote(getQuoteOfDay())
  }, [])

  if (!quote) return null

  return (
    <div style={{
      background: '#2A4F96',
      borderRadius: 10,
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginTop: 8,
    }}>
      <span style={{ fontSize: 20, opacity: 0.5, flexShrink: 0, color: '#fff' }}>"</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          color: '#fff',
          fontStyle: 'italic',
        }}>
          {quote.text}
        </p>
        {quote.author && (
          <p style={{
            margin: '6px 0 0',
            fontSize: 12,
            color: 'rgba(255,255,255,0.65)',
            fontStyle: 'normal',
          }}>
            — {quote.author}
          </p>
        )}
      </div>
    </div>
  )
}
