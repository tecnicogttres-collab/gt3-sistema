'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Quote = { id: string; texto: string; autor: string }

function todayStr() { return new Date().toISOString().slice(0, 10) }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function fetchOrCreateTodayQuote(): Promise<Quote | null> {
  try {
    const supabase = createClient()
    const today = todayStr()

    // 1. Check if today's rotation entry exists
    const { data: entry } = await supabase
      .from('frases_rotacao')
      .select('frase_id')
      .eq('data', today)
      .maybeSingle()

    if (entry?.frase_id) {
      const { data: frase } = await supabase
        .from('frases')
        .select('id, texto, autor')
        .eq('id', entry.frase_id)
        .eq('ativo', true)
        .maybeSingle()
      if (frase) return frase
    }

    // 2. No entry or the quote is now inactive — pick a new one
    const { data: active } = await supabase
      .from('frases')
      .select('id, texto, autor')
      .eq('ativo', true)
    if (!active?.length) return null

    // Pool-based: skip frases already used in the last full cycle
    const { data: recent } = await supabase
      .from('frases_rotacao')
      .select('frase_id')
      .order('data', { ascending: false })
      .limit(active.length)
    const usedIds = new Set((recent ?? []).map(r => r.frase_id))
    const pool = active.filter(f => !usedIds.has(f.id))
    const candidates = pool.length > 0 ? pool : shuffle(active)
    const picked = candidates[Math.floor(Math.random() * candidates.length)]

    // Upsert — ignoreDuplicates so concurrent users don't override each other
    await supabase.from('frases_rotacao').upsert(
      { data: today, frase_id: picked.id },
      { onConflict: 'data', ignoreDuplicates: true }
    )

    // Re-query to get the actual winner (may differ from picked if race occurred)
    const { data: winner } = await supabase
      .from('frases_rotacao')
      .select('frase_id')
      .eq('data', today)
      .maybeSingle()

    if (winner?.frase_id && winner.frase_id !== picked.id) {
      const { data: winnerFrase } = await supabase
        .from('frases')
        .select('id, texto, autor')
        .eq('id', winner.frase_id)
        .maybeSingle()
      return winnerFrase ?? picked
    }
    return picked
  } catch {
    return null
  }
}

export default function QuoteBanner() {
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    void fetchOrCreateTodayQuote().then(setQuote)
  }, [])

  if (!quote) return null

  return (
    <div style={{
      background: '#1E3A6E',
      padding: '14px 32px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
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
          {quote.texto}
        </p>
        {quote.autor && (
          <p style={{
            margin: '6px 0 0',
            fontSize: 12,
            color: 'rgba(255,255,255,0.65)',
            fontStyle: 'normal',
          }}>
            — {quote.autor}
          </p>
        )}
      </div>
    </div>
  )
}
