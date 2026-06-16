'use client'

import { useEffect, useState } from 'react'

const INTRO_KEY = 'gt3-intro-v1'

export function shouldShowIntro(): boolean {
  try { return !sessionStorage.getItem(INTRO_KEY) } catch { return false }
}

function markIntroShown(): void {
  try { sessionStorage.setItem(INTRO_KEY, '1') } catch { /* noop */ }
}

// Família de azuis do sistema
const DEEP = '#1E3A6E'
const MID  = '#2A4F96'
const HOT  = '#5A82CC'

type Col = {
  left: number; w: number; up: boolean; dur: number; delay: number
  tone: string; op: number; bar: number; gap: number; h: number
}

function buildColumns(): Col[] {
  const tones = [MID, DEEP, MID, HOT, DEEP]
  const n = 56
  const cols: Col[] = []
  for (let i = 0; i < n; i++) {
    cols.push({
      left: (i / n) * 100 + Math.random() * (100 / n) * 0.6,
      w: 2 + Math.round(Math.random() * 3),          // 2–5px
      up: Math.random() < 0.5,
      dur: 2.3 + Math.random() * 2.4,                 // 2.3–4.7s
      delay: -Math.random() * 4,                      // negativo → chuva já em andamento no t0
      tone: tones[Math.floor(Math.random() * tones.length)],
      op: 0.32 + Math.random() * 0.55,
      bar: 6 + Math.round(Math.random() * 5),         // altura da barrinha 6–11px
      gap: 8 + Math.round(Math.random() * 9),         // espaço entre barrinhas
      h: 48 + Math.round(Math.random() * 28),         // altura do feixe em vh
    })
  }
  return cols
}

export default function IntroScreen({ name, onDone }: { name: string; onDone?: () => void }) {
  const [phase, setPhase] = useState<'in' | 'text' | 'exit' | 'done'>('in')
  const [cols] = useState<Col[]>(buildColumns)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('text'), 400)
    const t2 = setTimeout(() => setPhase('exit'), 1250)
    const t3 = setTimeout(() => { setPhase('done'); markIntroShown(); onDone?.() }, 1600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  if (phase === 'done') return null

  const isExit = phase === 'exit'
  const showText = phase === 'text' || phase === 'exit'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Stardos+Stencil:wght@400;700&display=swap');
        @font-face {
          font-family: 'Refinery';
          src: local('Refinery'), local('Refinery 75'), local('Refinery25'), local('Refinery75');
          font-display: swap;
        }

        @keyframes gt3-fall { 0% { transform: translateY(-80vh); } 100% { transform: translateY(110vh); } }
        @keyframes gt3-rise { 0% { transform: translateY(110vh); } 100% { transform: translateY(-80vh); } }

        @keyframes gt3-from-top {
          0%   { transform: translateY(-60px); opacity: 0; filter: blur(6px); }
          100% { transform: translateY(0);     opacity: 1; filter: blur(0); }
        }
        @keyframes gt3-from-bottom {
          0%   { transform: translateY(60px); opacity: 0; filter: blur(8px); letter-spacing: .26em; }
          100% { transform: translateY(0);    opacity: 1; filter: blur(0);   letter-spacing: .06em; }
        }
        @keyframes gt3-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#ffffff',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          animation: isExit ? 'gt3-fade-out 0.35s ease forwards' : 'none',
        }}
      >
        {/* Chuva Matrix — barrinhas azuis subindo e descendo */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {cols.map((c, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${c.left}%`,
                top: 0,
                width: c.w,
                height: `${c.h}vh`,
                opacity: c.op,
                background: `repeating-linear-gradient(to bottom, ${c.tone} 0 ${c.bar}px, transparent ${c.bar}px ${c.bar + c.gap}px)`,
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)',
                animation: `${c.up ? 'gt3-rise' : 'gt3-fall'} ${c.dur}s linear ${c.delay}s infinite`,
                willChange: 'transform',
              }}
            >
              {/* cabeça brilhante (estilo Matrix) na ponta do feixe */}
              <div
                style={{
                  position: 'absolute', left: 0, width: '100%',
                  [c.up ? 'top' : 'bottom']: 0,
                  height: c.bar + 2,
                  background: HOT,
                  boxShadow: `0 0 8px ${HOT}, 0 0 14px ${MID}`,
                  borderRadius: 1,
                }}
              />
            </div>
          ))}
        </div>

        {/* Textos */}
        {showText && (
          <div
            style={{
              position: 'relative', zIndex: 3,
              textAlign: 'center',
              fontFamily: "'Refinery', 'Stardos Stencil', 'Courier New', monospace",
            }}
          >
            {/* Bem-vindo — vem de cima */}
            <div style={{
              fontSize: 'clamp(15px, 2vw, 22px)',
              fontWeight: 400,
              color: MID,
              letterSpacing: '.18em',
              textTransform: 'uppercase',
              lineHeight: 1.4,
              animation: 'gt3-from-top .8s cubic-bezier(.2,.7,.3,1) forwards',
              opacity: 0,
            }}>
              Bem-vindo de volta
            </div>
            {/* Nome — vem de baixo */}
            <div style={{
              fontSize: 'clamp(32px, 5.4vw, 64px)',
              fontWeight: 700,
              color: DEEP,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              lineHeight: 1.1,
              marginTop: 12,
              animation: 'gt3-from-bottom .95s cubic-bezier(.2,.7,.3,1) .25s forwards',
              opacity: 0,
              textShadow: '0 2px 20px rgba(42,79,150,.18)',
            }}>
              {name}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
