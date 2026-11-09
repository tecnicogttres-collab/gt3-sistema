'use client'

// Custo de Servir — como os tempos aparecem (decimal "12,5" ou hora/minuto "12min30s", "2h30") e leitura de
// campos de tempo que aceitam numero inteiro (minutos) ou hora:minuto ("90" = "1:30" = "1h30").
// A escolha fica no navegador de cada pessoa.

import { useSyncExternalStore } from 'react'
import { fmt } from './cs-lib'

export type ModoTempo = 'decimal' | 'hm'
const CHAVE = 'cs_modo_tempo'
let modo: ModoTempo = 'decimal'
let lido = false
const subs = new Set<() => void>()

function ler(): ModoTempo {
  if (!lido && typeof window !== 'undefined') {
    lido = true
    try { const v = localStorage.getItem(CHAVE); if (v === 'hm' || v === 'decimal') modo = v } catch { /* ignore */ }
  }
  return modo
}
export function setModoTempo(m: ModoTempo) {
  modo = m
  try { localStorage.setItem(CHAVE, m) } catch { /* ignore */ }
  subs.forEach(f => f())
}
const assinar = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb) } }
export const useModoTempo = () => useSyncExternalStore(assinar, ler, () => 'decimal' as ModoTempo)

const dois = (n: number) => String(n).padStart(2, '0')

/** Minutos em texto. hm: "45s", "12min30s", "1h05". */
export function txtMin(min: number, m: ModoTempo, casas = 1): string {
  if (m === 'decimal') return fmt(min, casas)
  const seg = Math.round(Math.max(0, min) * 60)
  if (seg < 60) return seg + 's'
  if (seg < 3600) { const mm = Math.floor(seg / 60), ss = seg % 60; return mm + 'min' + (ss ? dois(ss) + 's' : '') }
  const tot = Math.round(seg / 60)
  return Math.floor(tot / 60) + 'h' + dois(tot % 60)
}
/** Horas em texto. hm: "45min", "2h30", "120h05". */
export function txtH(h: number, m: ModoTempo, casas = 2): string {
  if (m === 'decimal') return fmt(h, casas)
  const neg = h < 0
  const tot = Math.round(Math.abs(h) * 60)
  const s = tot < 60 ? tot + 'min' : Math.floor(tot / 60).toLocaleString('pt-BR') + 'h' + dois(tot % 60)
  return (neg ? '−' : '') + s
}

/** Hook com os formatadores no modo atual. */
export function useTempo() {
  const m = useModoTempo()
  return {
    modo: m,
    /** Minutos sem unidade no modo decimal (a coluna ja diz "min"). */
    min: (v: number, casas = 1) => txtMin(v, m, casas),
    /** Horas sem unidade no modo decimal (a coluna ja diz "h"). */
    h: (v: number, casas = 2) => txtH(v, m, casas),
    /** Horas sempre com unidade: "2,50 h" ou "2h30". */
    hu: (v: number, casas = 2) => txtH(v, m, casas) + (m === 'decimal' ? ' h' : ''),
    /** Minutos sempre com unidade: "12,5 min" ou "12min30s". */
    mu: (v: number, casas = 1) => txtMin(v, m, casas) + (m === 'decimal' ? ' min' : ''),
  }
}

/** Le um tempo digitado e devolve MINUTOS. Aceita "90", "90,5", "1:30", "1h30", "1h", "30min", "2:30:15" (h:m:s).
 *  null = vazio ou invalido. */
export function lerMinutos(txt: string): number | null {
  const s = txt.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  let m = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/)
  if (m) return +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0)
  m = s.match(/^(?:(\d+(?:[.,]\d+)?)h)?(?:(\d+(?:[.,]\d+)?)(?:min|m)?)?$/)
  if (!m || (!m[1] && !m[2])) return null
  const h = m[1] ? +m[1].replace(',', '.') : 0
  const mi = m[2] ? +m[2].replace(',', '.') : 0
  return h * 60 + mi
}
