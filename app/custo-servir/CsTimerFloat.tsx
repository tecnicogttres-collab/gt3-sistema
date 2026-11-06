'use client'

// Botao flutuante do cronometro do Custo de Servir. Montado no AppShell: aparece em qualquer
// tela enquanto houver cronometro ativo e a tela do proprio cronometro nao estiver visivel.

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ativo, elapsed, pedirAbrirCronometro, useTimer, useVendoCronometro } from './cs-timer'
import { mmss } from './cs-lib'
import './custo-servir.css'

export const CS_PATH = '/custo-servir'

export default function CsTimerFloat() {
  const t = useTimer()
  const vendo = useVendoCronometro()
  const pathname = usePathname()
  const router = useRouter()
  const [, setTick] = useState(0)

  const show = ativo(t) && !(vendo && pathname === CS_PATH)

  useEffect(() => {
    if (!show || !t.run) return
    let raf = 0
    const loop = () => { setTick(x => x + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [show, t.run])

  if (!show) return null
  return (
    <button
      type="button"
      className="cs-float"
      title="Voltar para o cronômetro"
      onClick={() => { pedirAbrirCronometro(); if (pathname !== CS_PATH) router.push(CS_PATH) }}
    >
      <span className={'dot' + (t.run ? '' : ' paused')} />
      <span className="mono">{mmss(elapsed(t))}</span>
      <span className="lbl">{t.docNome.slice(0, 34)}{t.run ? '' : ' · pausado'}</span>
    </button>
  )
}
