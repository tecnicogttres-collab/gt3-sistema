'use client'

import { useEffect, useRef, useState } from 'react'
import { anoNovoAlvo, type TemaSazonal } from '../../lib/tema-sazonal'
import { CORES_LUZ } from './DecoracoesTema'

/* Entradas temáticas (nome da pessoa). Natal no mesmo tempo da entrada normal (~0,9 s);
   Ano Novo um pouco mais longa para dar tempo dos fogos (~1,85 s). */

const FONTE = "'Refinery', 'Stardos Stencil', 'Courier New', monospace"

const CSS_BASE = `
  @import url('https://fonts.googleapis.com/css2?family=Stardos+Stencil:wght@400;700&display=swap');
  @font-face { font-family: 'Refinery'; src: local('Refinery'), local('Refinery 75'), local('Refinery25'), local('Refinery75'); font-display: swap; }
  @keyframes gt3-from-top { 0% { transform: translateY(-60px); opacity: 0; filter: blur(6px); } 100% { transform: translateY(0); opacity: 1; filter: blur(0); } }
  @keyframes gt3-from-bottom { 0% { transform: translateY(60px); opacity: 0; filter: blur(8px); letter-spacing: .26em; } 100% { transform: translateY(0); opacity: 1; filter: blur(0); letter-spacing: .06em; } }
  @keyframes gt3-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }
`

type Fase = 'in' | 'text' | 'exit' | 'done'
function useFases(textAt: number, exitAt: number, doneAt: number, onDone?: () => void): Fase {
  const [fase, setFase] = useState<Fase>('in')
  const cb = useRef(onDone)
  useEffect(() => { cb.current = onDone }, [onDone])
  useEffect(() => {
    const t1 = setTimeout(() => setFase('text'), textAt)
    const t2 = setTimeout(() => setFase('exit'), exitAt)
    const t3 = setTimeout(() => { setFase('done'); cb.current?.() }, doneAt)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [textAt, exitAt, doneAt])
  return fase
}

export default function IntroTema({ tema, name, onDone }: { tema: TemaSazonal; name: string; onDone?: () => void }) {
  return tema === 'natal' ? <IntroNatal name={name} onDone={onDone} /> : <IntroAnoNovo name={name} onDone={onDone} />
}

/* ─── Natal: luz quente, bokeh dourado e varal acendendo em onda ─────────── */

type Bokeh = { left: number; top: number; size: number; color: string; blur: number; delay: number }
function buildBokeh(): Bokeh[] {
  const cores = ['rgba(255,201,77,.42)', 'rgba(255,170,90,.32)', 'rgba(255,214,150,.38)', 'rgba(255,120,110,.22)', 'rgba(255,241,201,.5)']
  return Array.from({ length: 24 }, () => ({
    left: Math.random() * 100, top: Math.random() * 100,
    size: 30 + Math.random() * 90,
    color: cores[Math.floor(Math.random() * cores.length)],
    blur: 6 + Math.random() * 14,
    delay: Math.random() * 0.25,
  }))
}

function IntroNatal({ name, onDone }: { name: string; onDone?: () => void }) {
  const fase = useFases(20, 750, 900, onDone)
  const [bokeh] = useState<Bokeh[]>(buildBokeh)
  if (fase === 'done') return null
  const texto = fase === 'text' || fase === 'exit'
  const nL = 22
  const fio = Array.from({ length: nL }, (_, i) => `${i === 0 ? 'M0 4 ' : ''}Q${i * 10 + 5} 22 ${i * 10 + 10} 4`).join(' ')

  return (
    <>
      <style>{CSS_BASE + `
        @keyframes gt3-bokeh-in { 0% { opacity: 0; transform: scale(.5); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes gt3-lamp-on { 0% { opacity: .25; box-shadow: none; } 100% { opacity: 1; box-shadow: 0 0 8px 2px var(--c), 0 0 22px 5px var(--c); } }
        @keyframes gt3-estrela-pop { 0% { opacity: 0; transform: scale(.2) rotate(-90deg); } 70% { opacity: 1; transform: scale(1.2) rotate(10deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 46%, #B3283C 0%, #8A1A2B 48%, #5A0E1B 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: fase === 'exit' ? 'gt3-fade-out .15s ease forwards' : 'none',
      }}>
        {bokeh.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${b.left}%`, top: `${b.top}%`, width: b.size, height: b.size,
            marginLeft: -b.size / 2, marginTop: -b.size / 2, borderRadius: '50%', background: b.color, filter: `blur(${b.blur}px)`,
            animation: `gt3-bokeh-in .45s ease-out ${b.delay}s both`,
          }} />
        ))}

        <svg width="100%" height="40" preserveAspectRatio="none" viewBox={`0 0 ${nL * 10} 40`} style={{ position: 'absolute', top: 0, left: 0 }}>
          <path d={fio} fill="none" stroke="#1F4D35" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
        {Array.from({ length: nL }, (_, i) => (
          <span key={i} style={{
            position: 'absolute', top: 15, left: `${((i + 0.5) / nL) * 100}%`, width: 9, height: 14, marginLeft: -4.5,
            borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%', background: CORES_LUZ[i % CORES_LUZ.length],
            ['--c' as string]: CORES_LUZ[i % CORES_LUZ.length],
            animation: `gt3-lamp-on .2s ease-out ${0.05 + i * 0.018}s both`,
          } as React.CSSProperties} />
        ))}

        {texto && (
          <div style={{ position: 'relative', zIndex: 3, textAlign: 'center', fontFamily: FONTE }}>
            <div style={{ fontSize: 30, lineHeight: 1, color: '#E8B84A', textShadow: '0 0 14px rgba(255,201,77,.8)', marginBottom: 8, animation: 'gt3-estrela-pop .4s cubic-bezier(.3,1.4,.5,1) both' }}>✦</div>
            <div style={{
              fontSize: 'clamp(15px, 2vw, 22px)', color: '#F6D47A', letterSpacing: '.18em', textTransform: 'uppercase', lineHeight: 1.4,
              animation: 'gt3-from-top .4s cubic-bezier(.2,.7,.3,1) forwards', opacity: 0,
            }}>
              Feliz Natal
            </div>
            <div style={{
              fontSize: 'clamp(32px, 5.4vw, 64px)', fontWeight: 700, color: '#FFF4E0', letterSpacing: '.06em', textTransform: 'uppercase',
              lineHeight: 1.1, marginTop: 12, opacity: 0, textShadow: '0 0 26px rgba(255,201,77,.45), 0 2px 10px rgba(60,5,15,.5)',
              animation: 'gt3-from-bottom .45s cubic-bezier(.2,.7,.3,1) .08s forwards',
            }}>
              {name}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ─── Ano Novo: céu noturno com fogos dourados ───────────────────────────── */

type Fogo = { x: number; y: number; delay: number; cores: string[]; parts: { dx: number; dy: number; s: number }[] }
function buildFogos(): Fogo[] {
  const paletas = [['#F6D47A', '#FFF3C4'], ['#FFFFFF', '#9CC2FF'], ['#E8B84A', '#FF8FB1'], ['#F6D47A', '#FFFFFF'], ['#9CC2FF', '#F6D47A'], ['#FFF3C4', '#E8B84A']]
  const pos: [number, number, number][] = [[22, 30, 0], [76, 24, 0.18], [50, 16, 0.42], [30, 66, 0.62], [70, 62, 0.8], [88, 40, 1.0]]
  return pos.map(([x, y, delay], k) => {
    const n = 28
    const raio = 70 + Math.random() * 60
    return {
      x, y, delay, cores: paletas[k % paletas.length],
      parts: Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.15
        const r = raio * (0.75 + Math.random() * 0.3)
        return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, s: 3 + Math.random() * 2.5 }
      }),
    }
  })
}
type Estrela = { left: number; top: number; s: number; d: number }
const buildEstrelas = (): Estrela[] =>
  Array.from({ length: 50 }, () => ({ left: Math.random() * 100, top: Math.random() * 100, s: 1 + Math.random() * 2, d: Math.random() * 2 }))

function IntroAnoNovo({ name, onDone }: { name: string; onDone?: () => void }) {
  const fase = useFases(120, 1650, 1850, onDone)
  const [fogos] = useState<Fogo[]>(buildFogos)
  const [estrelas] = useState<Estrela[]>(buildEstrelas)
  const [ano] = useState(() => anoNovoAlvo())
  if (fase === 'done') return null
  const texto = fase === 'text' || fase === 'exit'

  return (
    <>
      <style>{CSS_BASE + `
        @keyframes gt3-sobe { 0% { transform: translateY(var(--sobe)); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(0); opacity: 0; } }
        @keyframes gt3-estoura { 0% { transform: translate(0,0) scale(1); opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(var(--dx), calc(var(--dy) + 28px)) scale(.3); opacity: 0; } }
        @keyframes gt3-clarao { 0% { transform: scale(.2); opacity: 0; } 30% { opacity: .9; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes gt3-pisca-ceu { 0%, 100% { opacity: .2; } 50% { opacity: .9; } }
        @keyframes gt3-ouro-txt { from { background-position: 0 0; } to { background-position: 200% 0; } }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 60%, #1B2F5C 0%, #0F1D3D 55%, #08112A 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: fase === 'exit' ? 'gt3-fade-out .2s ease forwards' : 'none',
      }}>
        {estrelas.map((e, i) => (
          <div key={i} style={{ position: 'absolute', left: `${e.left}%`, top: `${e.top}%`, width: e.s, height: e.s, borderRadius: '50%', background: '#fff', animation: `gt3-pisca-ceu 1.6s ease-in-out ${e.d}s infinite` }} />
        ))}

        {fogos.map((f, k) => (
          <div key={k} style={{ position: 'absolute', left: `${f.x}%`, top: `${f.y}%`, width: 0, height: 0 }}>
            <div style={{
              position: 'absolute', left: -1.5, top: 0, width: 3, height: 14, borderRadius: 2,
              background: `linear-gradient(to bottom, ${f.cores[0]}, transparent)`,
              ['--sobe' as string]: `${100 - f.y}vh`,
              animation: `gt3-sobe .32s ease-out ${f.delay}s both`,
            } as React.CSSProperties} />
            <div style={{
              position: 'absolute', left: -30, top: -30, width: 60, height: 60, borderRadius: '50%',
              background: `radial-gradient(circle, ${f.cores[1]} 0%, transparent 65%)`,
              animation: `gt3-clarao .5s ease-out ${f.delay + 0.3}s both`,
            }} />
            {f.parts.map((p, i) => (
              <div key={i} style={{
                position: 'absolute', left: -p.s / 2, top: -p.s / 2, width: p.s, height: p.s, borderRadius: '50%',
                background: f.cores[i % 2], boxShadow: `0 0 6px ${f.cores[i % 2]}, 0 0 12px ${f.cores[0]}`,
                ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`,
                animation: `gt3-estoura 1s cubic-bezier(.15,.75,.35,1) ${f.delay + 0.3}s both`,
              } as React.CSSProperties} />
            ))}
          </div>
        ))}

        {texto && (
          <div style={{ position: 'relative', zIndex: 3, textAlign: 'center', fontFamily: FONTE }}>
            <div style={{
              fontSize: 'clamp(15px, 2vw, 22px)', color: '#F6D47A', letterSpacing: '.18em', textTransform: 'uppercase', lineHeight: 1.4,
              animation: 'gt3-from-top .5s cubic-bezier(.2,.7,.3,1) forwards', opacity: 0,
            }}>
              Feliz {ano}
            </div>
            <div style={{
              fontSize: 'clamp(32px, 5.4vw, 64px)', fontWeight: 700, color: '#FFFFFF', letterSpacing: '.06em', textTransform: 'uppercase',
              lineHeight: 1.1, marginTop: 12, opacity: 0, textShadow: '0 0 24px rgba(246,212,122,.35)',
              animation: 'gt3-from-bottom .55s cubic-bezier(.2,.7,.3,1) .1s forwards',
            }}>
              {name}
            </div>
            <div style={{
              marginTop: 14, fontSize: 'clamp(14px, 1.8vw, 20px)', letterSpacing: '.6em', color: '#F6D47A',
              opacity: 0, animation: 'gt3-from-bottom .5s cubic-bezier(.2,.7,.3,1) .3s forwards',
            }}>
              ✦ ✦ ✦
            </div>
          </div>
        )}
      </div>
    </>
  )
}
