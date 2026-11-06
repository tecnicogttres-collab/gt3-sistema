'use client'

// Cronometro do Custo de Servir em escopo de modulo: continua rodando se o usuario trocar de
// aba interna, de modulo ou fechar a aba do modulo no Tabbar. O botao flutuante le daqui.

import { useSyncExternalStore } from 'react'
import type { Resultado } from './cs-lib'

export type TimerState = {
  g: string | null          // grupo
  d: string | null          // documento
  grupoNome: string
  docNome: string
  run: boolean
  acc: number               // ms acumulados ate a ultima pausa
  t0: number                // performance.now() do ultimo inicio
  res: Resultado
  stopped: boolean
}

const VAZIO: TimerState = { g: null, d: null, grupoNome: '', docNome: '', run: false, acc: 0, t0: 0, res: 'aprovado', stopped: false }

let state: TimerState = VAZIO
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(fn => fn())

export const getTimer = () => state
export function setTimer(next: Partial<TimerState>) { state = { ...state, ...next }; emit() }
export function resetTimer() { state = { ...VAZIO, res: state.res }; emit() }
export const elapsed = (s: TimerState = state) => s.acc + (s.run ? performance.now() - s.t0 : 0)
/** Ha cronometro ativo (rodando ou pausado com tempo)? */
export const ativo = (s: TimerState = state) => !!s.g && (s.run || s.acc > 0)

function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
export function useTimer() { return useSyncExternalStore(subscribe, getTimer, getTimer) }

// Pedido para abrir a tela do cronometro (vindo do botao flutuante fora do modulo)
let abrirPendente = false
const abrirListeners = new Set<() => void>()
export function pedirAbrirCronometro() { abrirPendente = true; abrirListeners.forEach(fn => fn()) }
export function consumirPedidoAbrir() { const p = abrirPendente; abrirPendente = false; return p }
export function onPedidoAbrir(fn: () => void) { abrirListeners.add(fn); return () => { abrirListeners.delete(fn) } }

// A tela do cronometro do documento em andamento esta visivel? (esconde o botao flutuante)
let vendo = false
const vendoListeners = new Set<() => void>()
export function setVendoCronometro(v: boolean) { if (vendo !== v) { vendo = v; vendoListeners.forEach(fn => fn()) } }
export function useVendoCronometro() {
  return useSyncExternalStore(
    fn => { vendoListeners.add(fn); return () => { vendoListeners.delete(fn) } },
    () => vendo, () => vendo,
  )
}

// Aviso ao fechar o navegador com cronometro rodando
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', e => { if (state.run) { e.preventDefault(); e.returnValue = '' } })
}
