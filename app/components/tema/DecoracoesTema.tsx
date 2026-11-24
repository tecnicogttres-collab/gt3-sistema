'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTemaSazonal } from './TemaSazonal'
import { anoNovoAlvo } from '../../lib/tema-sazonal'
import { estourarRolha } from './champagne'

export const CORES_LUZ = ['#FF4D5E', '#FFC94D', '#FFF1C9', '#6FA8FF', '#FF8FB1']

/* ─── Faixa do topo (abaixo do cabeçalho, em todas as telas) ─────────────── */

const ESPACO = 46 // px entre lâmpadas
const RAIO_ACENDE = 52 // distância (px) da linha vertical do mouse que acende a lâmpada
const APAGA_EM = 900 // ms acesa depois que o mouse passa

/** Varal de luzinhas. Interativo (Dashboard): acende a lâmpada cuja coluna está sob o mouse, em
 *  qualquer altura da tela. Calmo (módulos): todas acesas, piscando devagar. */
function GuirlandaTopo({ interativa }: { interativa: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(0)
  const lampadas = useRef<(HTMLSpanElement | null)[]>([])
  const timers = useRef<number[]>([])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setLargura(el.clientWidth))
    ro.observe(el)
    setLargura(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const n = Math.max(0, Math.floor(largura / ESPACO))
  const passo = n ? largura / n : ESPACO

  // Mexe direto nas classes (sem estado do React): resposta imediata ao mouse
  useEffect(() => {
    if (!interativa || !n) return
    let raf = 0
    let ultimoX = -1
    const aplicar = () => {
      raf = 0
      const el = ref.current
      if (!el) return
      const x = ultimoX - el.getBoundingClientRect().left
      for (let i = 0; i < n; i++) {
        const cx = i * passo + passo / 2
        if (Math.abs(cx - x) > RAIO_ACENDE) continue
        const l = lampadas.current[i]
        if (!l) continue
        l.classList.add('on')
        window.clearTimeout(timers.current[i])
        timers.current[i] = window.setTimeout(() => l.classList.remove('on'), APAGA_EM)
      }
    }
    const onMove = (e: PointerEvent) => {
      ultimoX = e.clientX
      if (!raf) raf = requestAnimationFrame(aplicar)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    const ts = timers.current
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
      ts.forEach(t => window.clearTimeout(t))
    }
  }, [interativa, n, passo])

  // Fio em "ondas": um arco entre cada gancho, a lâmpada pendurada no ponto mais baixo
  const fio = useMemo(() => {
    if (!n) return ''
    let d = `M0 3`
    for (let i = 0; i < n; i++) {
      const x0 = i * passo
      d += ` Q${x0 + passo / 2} 17 ${x0 + passo} 3`
    }
    return d
  }, [n, passo])

  return (
    <div ref={ref} className={`gt3-guirlanda${interativa ? '' : ' calma'}`} aria-hidden>
      <svg width={largura} height="24" style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d={fio} fill="none" stroke="#E8B84A" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          ref={e => { lampadas.current[i] = e }}
          className="gt3-lampada"
          style={{ left: i * passo + passo / 2, ['--c' as string]: CORES_LUZ[i % CORES_LUZ.length], ['--d' as string]: `${(i * 0.37) % 2.4}s` } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

function FaixaAnoNovo() {
  return (
    <div className="gt3-faixa-anonovo" aria-hidden>
      {[8, 23, 41, 58, 74, 91].map((l, i) => (
        <span key={l} className="gt3-brilho" style={{ left: `${l}%`, animationDelay: `${i * 0.55}s` }}>✦</span>
      ))}
    </div>
  )
}

/** Decoração do topo de todas as telas. Só a do Dashboard reage ao mouse. */
export function DecoracaoTopo({ dashboard }: { dashboard: boolean }) {
  const tema = useTemaSazonal()
  if (tema === 'natal') return <GuirlandaTopo interativa={dashboard} />
  if (tema === 'anonovo') return <FaixaAnoNovo />
  return null
}

/* ─── Gorrinho de Papai Noel (cards) ─────────────────────────────────────── */

export function Gorro({ className = 'gt3-gorro', size = 34 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size * 0.82} viewBox="0 0 44 36" aria-hidden>
      <defs>
        <linearGradient id="gt3-gorro-v" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E23A4A" /><stop offset="1" stopColor="#A3162A" />
        </linearGradient>
      </defs>
      <path d="M6 27 C8 14 16 4 27 3 C33 2.6 37 6 39 11 C35 9 31 9.5 29 12 C33 16 35 21 36 27 Z" fill="url(#gt3-gorro-v)" />
      <path d="M27 3.5 C30 4 33 6.5 34.5 9" stroke="#fff" strokeOpacity=".25" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <rect x="3" y="25" width="36" height="8.5" rx="4.25" fill="#FFFDF8" />
      <rect x="3" y="25" width="36" height="8.5" rx="4.25" fill="none" stroke="#E9E2D3" strokeWidth=".8" />
      <circle cx="39.5" cy="12" r="4.2" fill="#FFFDF8" stroke="#E9E2D3" strokeWidth=".8" />
    </svg>
  )
}

/* ─── Árvore de Natal (lateral esquerda do Dashboard) ────────────────────── */

const ARVORE_KEY = 'gt3-arvore-acesa'

type P = [number, number]
const quad = (p0: P, c: P, p2: P, t: number): P => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p2[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p2[1],
]

// Fios de luz que atravessam cada andar: [início, controle, fim, nº de lâmpadas]
const FIOS: [P, P, P, number][] = [
  [[80, 72], [100, 90], [121, 68], 6],
  [[65, 126], [100, 148], [134, 121], 8],
  [[51, 180], [100, 208], [150, 175], 10],
  [[38, 236], [100, 264], [160, 231], 12],
]

const ENFEITES: { x: number; y: number; r: number; cor: 'vermelho' | 'ouro' }[] = [
  { x: 92, y: 55, r: 4.2, cor: 'ouro' },
  { x: 112, y: 104, r: 5, cor: 'vermelho' }, { x: 78, y: 108, r: 4.5, cor: 'ouro' },
  { x: 70, y: 160, r: 5.5, cor: 'vermelho' }, { x: 122, y: 162, r: 5, cor: 'ouro' }, { x: 98, y: 170, r: 4.2, cor: 'vermelho' },
  { x: 60, y: 215, r: 5.5, cor: 'ouro' }, { x: 138, y: 212, r: 6, cor: 'vermelho' }, { x: 100, y: 224, r: 4.6, cor: 'ouro' },
  { x: 48, y: 256, r: 6, cor: 'vermelho' }, { x: 128, y: 258, r: 5.5, cor: 'ouro' }, { x: 84, y: 262, r: 5, cor: 'ouro' }, { x: 154, y: 252, r: 5, cor: 'vermelho' },
]

/** Andar da árvore: triângulo com a barra em "babados". */
function andar(topo: number, base: number, meia: number, babados: number) {
  const cx = 100
  const w = (meia * 2) / babados
  let d = `M${cx} ${topo} L${cx + meia} ${base}`
  for (let i = 0; i < babados; i++) {
    const x1 = cx + meia - w * (i + 1)
    d += ` Q${x1 + w / 2} ${base + 7} ${x1} ${base}`
  }
  return d + ' Z'
}

function ArvoreNatal() {
  const [acesa, setAcesa] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no navegador (evita divergir da renderização do servidor)
    try { setAcesa(localStorage.getItem(ARVORE_KEY) === '1') } catch { /* ignore */ }
  }, [])
  function alternar() {
    setAcesa(a => {
      try { localStorage.setItem(ARVORE_KEY, a ? '0' : '1') } catch { /* ignore */ }
      return !a
    })
  }

  const luzes = useMemo(() => {
    const out: { x: number; y: number; c: string; i: number }[] = []
    let k = 0
    FIOS.forEach(([p0, c, p2, n]) => {
      for (let j = 0; j < n; j++) {
        const [x, y] = quad(p0, c, p2, (j + 0.5) / n)
        out.push({ x, y, c: CORES_LUZ[k % CORES_LUZ.length], i: k })
        k++
      }
    })
    return out
  }, [])

  return (
    <div className={`gt3-arvore${acesa ? ' acesa' : ''}`}>
      <svg viewBox="0 0 200 305" onClick={alternar} role="button" aria-label={acesa ? 'Apagar as luzes da árvore' : 'Deixar as luzes da árvore acesas'}>
        <defs>
          <linearGradient id="gt3-arv-verde" x1="0" x2="1">
            <stop offset="0" stopColor="#2F8556" /><stop offset=".55" stopColor="#1F6340" /><stop offset="1" stopColor="#123D28" />
          </linearGradient>
          <linearGradient id="gt3-arv-ouro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFE9A8" /><stop offset=".5" stopColor="#E8B84A" /><stop offset="1" stopColor="#B8863D" />
          </linearGradient>
          <radialGradient id="gt3-arv-verm" cx=".35" cy=".35" r=".7">
            <stop offset="0" stopColor="#FF8A95" /><stop offset=".45" stopColor="#D7263D" /><stop offset="1" stopColor="#8E1B2C" />
          </radialGradient>
          <radialGradient id="gt3-arv-bola-ouro" cx=".35" cy=".35" r=".7">
            <stop offset="0" stopColor="#FFF3C4" /><stop offset=".45" stopColor="#E8B84A" /><stop offset="1" stopColor="#9C6F2B" />
          </radialGradient>
          <radialGradient id="gt3-arv-halo" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFE9A8" stopOpacity=".55" /><stop offset="1" stopColor="#FFE9A8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* brilho de fundo quando acesa */}
        <ellipse className="gt3-arv-halo" cx="100" cy="160" rx="100" ry="140" fill="url(#gt3-arv-halo)" />

        {/* presentes */}
        <g>
          <rect x="30" y="281" width="30" height="22" rx="2" fill="#C4283C" />
          <rect x="42" y="281" width="6" height="22" fill="#F6D47A" />
          <rect x="28" y="277" width="34" height="7" rx="1.5" fill="#A51E31" />
          <path d="M45 277 c-6 -7 -12 -3 -7 0 z M45 277 c6 -7 12 -3 7 0 z" fill="#F6D47A" />
          <rect x="140" y="286" width="24" height="17" rx="2" fill="#F2E6D0" />
          <rect x="149" y="286" width="5" height="17" fill="#C4283C" />
          <rect x="138" y="283" width="28" height="6" rx="1.5" fill="#E7D7BA" />
          <path d="M151.5 283 c-5 -6 -10 -2 -6 0 z M151.5 283 c5 -6 10 -2 6 0 z" fill="#C4283C" />
          <rect x="164" y="292" width="16" height="11" rx="1.5" fill="#1F6340" />
          <rect x="170" y="292" width="4" height="11" fill="#F6D47A" />
        </g>

        {/* tronco e vaso */}
        <rect x="90" y="262" width="20" height="22" rx="2" fill="#6B4227" />
        <path d="M70 280 h60 l-6 22 h-48 z" fill="#8E1B2C" />
        <rect x="68" y="277" width="64" height="7" rx="2" fill="url(#gt3-arv-ouro)" />

        {/* andares — de baixo para cima, o de cima fica na frente */}
        <path d={andar(150, 265, 88, 7)} fill="url(#gt3-arv-verde)" />
        <path d={andar(105, 215, 72, 6)} fill="url(#gt3-arv-verde)" />
        <path d={andar(60, 155, 55, 5)} fill="url(#gt3-arv-verde)" />
        <path d={andar(28, 95, 38, 4)} fill="url(#gt3-arv-verde)" />
        {/* luz lateral suave nos andares */}
        <path d="M100 28 L70 90 L100 60 Z M100 60 L56 150 L100 105 Z M100 105 L40 210 L100 150 Z M100 150 L24 260 L100 200 Z" fill="#fff" opacity=".06" />

        {/* festões dourados */}
        {FIOS.map(([p0, c, p2], i) => (
          <path key={i} d={`M${p0[0]} ${p0[1]} Q${c[0]} ${c[1]} ${p2[0]} ${p2[1]}`} fill="none" stroke="url(#gt3-arv-ouro)" strokeWidth="1.3" strokeDasharray="0.1 3.2" strokeLinecap="round" opacity=".9" />
        ))}

        {/* bolas */}
        {ENFEITES.map((e, i) => (
          <g key={i}>
            <line x1={e.x} y1={e.y - e.r - 3} x2={e.x} y2={e.y - e.r} stroke="#E8B84A" strokeWidth=".8" />
            <circle cx={e.x} cy={e.y} r={e.r} fill={e.cor === 'ouro' ? 'url(#gt3-arv-bola-ouro)' : 'url(#gt3-arv-verm)'} />
          </g>
        ))}

        {/* luzinhas */}
        {luzes.map(l => (
          <circle key={l.i} className="gt3-arv-luz" cx={l.x} cy={l.y} r="2.6"
            style={{ ['--c' as string]: l.c, ['--i' as string]: l.i } as React.CSSProperties} />
        ))}

        {/* estrela */}
        <g className="gt3-arv-estrela">
          <path d="M100 4 L105.3 17.2 L119.5 18 L108.5 27 L112 40.8 L100 33 L88 40.8 L91.5 27 L80.5 18 L94.7 17.2 Z" fill="url(#gt3-arv-ouro)" stroke="#B8863D" strokeWidth=".6" />
        </g>
      </svg>
      <div className="gt3-arvore-dica">{acesa ? 'clique para apagar' : 'passe o mouse ✨ clique para deixar acesa'}</div>
    </div>
  )
}

/* ─── Ano Novo (lateral esquerda do Dashboard): garrafa + taças ──────────── */

/** Garrafa de champanhe: o mouse passa por cima e a rolha estoura. Recarrega depois de ~2,5 s. */
function GarrafaInterativa() {
  const [estourada, setEstourada] = useState(false)
  const rolhaRef = useRef<SVGGElement>(null)
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function estourar() {
    if (estourada || !rolhaRef.current) return
    const r = rolhaRef.current.getBoundingClientRect()
    estourarRolha(r.left + r.width / 2, r.top + r.height / 2, 16)
    setEstourada(true)
    timer.current = window.setTimeout(() => setEstourada(false), 2500)
  }

  return (
    <svg className={`gt3-garrafa${estourada ? ' estourada' : ''}`} viewBox="-4 -2 52 148" onMouseEnter={estourar}
      role="img" aria-label="Garrafa de champanhe — passe o mouse para estourar">
      <defs>
        {/* vidro verde translúcido */}
        <linearGradient id="gt3-gar-vidro" x1="0" x2="1">
          <stop offset="0" stopColor="#1F6B4A" stopOpacity=".55" />
          <stop offset=".3" stopColor="#7FC4A0" stopOpacity=".28" />
          <stop offset=".62" stopColor="#2E8A60" stopOpacity=".32" />
          <stop offset="1" stopColor="#0F3D2A" stopOpacity=".6" />
        </linearGradient>
        <linearGradient id="gt3-gar-liquido" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE9A8" stopOpacity=".75" /><stop offset="1" stopColor="#D9A441" stopOpacity=".8" />
        </linearGradient>
        <linearGradient id="gt3-gar-ouro" x1="0" x2="1">
          <stop offset="0" stopColor="#A9772F" /><stop offset=".35" stopColor="#F6D47A" /><stop offset=".55" stopColor="#FFF3C4" /><stop offset="1" stopColor="#9C6F2B" />
        </linearGradient>
        <clipPath id="gt3-gar-forma">
          <path d="M17 14 h10 v28 c0 8 11 14 11 28 v52 a6 6 0 0 1 -6 6 H12 a6 6 0 0 1 -6 -6 V70 c0 -14 11 -20 11 -28 z" />
        </clipPath>
      </defs>
      <g className="gt3-garrafa-corpo">
        {/* rolha (cogumelo) + gaiola: some quando estoura */}
        <g ref={rolhaRef} className="gt3-garrafa-rolha">
          <path d="M16.5 9 c0 -5 11 -5 11 0 v4 h-11 z" fill="#D9B77E" />
          <path d="M18 13 v-4 M22 13 v-5 M26 13 v-4" stroke="#BDBDBD" strokeWidth=".7" />
        </g>

        {/* champanhe dentro, visto através do vidro */}
        <g clipPath="url(#gt3-gar-forma)">
          <rect x="0" y="56" width="44" height="80" fill="url(#gt3-gar-liquido)" />
          <ellipse cx="22" cy="56" rx="16" ry="1.6" fill="#FFF3C4" opacity=".9" />
          {[[13, 0], [19, 0.7], [25, 1.4], [30, 0.35], [16, 1.9], [28, 2.3]].map(([x, d], i) => (
            <circle key={i} className="gt3-gar-bolha" cx={x} cy="122" r={i % 2 ? 0.9 : 1.3} style={{ animationDelay: `${d}s` }} />
          ))}
        </g>

        {/* vidro */}
        <path d="M17 14 h10 v28 c0 8 11 14 11 28 v52 a6 6 0 0 1 -6 6 H12 a6 6 0 0 1 -6 -6 V70 c0 -14 11 -20 11 -28 z"
          fill="url(#gt3-gar-vidro)" stroke="#2E7A56" strokeOpacity=".45" strokeWidth=".7" />

        {/* reflexos */}
        <path d="M10.5 76 c-1 12 -1 30 0 44" stroke="#fff" strokeOpacity=".55" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M33.5 80 c.6 10 .6 24 0 36" stroke="#fff" strokeOpacity=".22" strokeWidth="1" fill="none" strokeLinecap="round" />
        <path d="M19 18 v22" stroke="#fff" strokeOpacity=".3" strokeWidth="1" strokeLinecap="round" />

        {/* papel dourado no gargalo */}
        <path d="M16.6 12.5 h10.8 v28 c0 2 -1.4 3.5 -3 4 h-4.8 c-1.6 -.5 -3 -2 -3 -4 z" fill="url(#gt3-gar-ouro)" />
        <path d="M18.5 16 l1 22 M24.5 16 l-.8 22" stroke="#fff" strokeOpacity=".35" strokeWidth=".6" />
        <rect x="16.6" y="38" width="10.8" height="2.2" fill="#9C6F2B" opacity=".55" />

        {/* rótulo GT3 */}
        <rect x="8.2" y="84" width="27.6" height="27" rx="2" fill="#FFFBF0" opacity=".96" />
        <rect x="9.6" y="85.4" width="24.8" height="24.2" rx="1.4" fill="none" stroke="#D9A441" strokeWidth=".6" />
        <text x="22" y="100.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1E3A6E" fontFamily="Georgia, serif" letterSpacing=".5">GT3</text>
        <path d="M14 104 h16" stroke="#D9A441" strokeWidth=".5" />

        {/* espuma escorrendo depois do estouro */}
        <path className="gt3-garrafa-espuma" d="M16 13 c1 -5 11 -5 12 0 c1 3 -1 4 -1 9 c0 3 -2 3 -2 0 c0 -3 -1 -3 -2 0 c0 5 -3 5 -3 0 c0 -3 -1 -2 -2 1 c-1 3 -3 2 -3 -2 c0 -4 -1 -5 0 -8 z" fill="#FFF6DA" opacity=".95" />
      </g>
    </svg>
  )
}

function BrindeAnoNovo() {
  const [ano, setAno] = useState<number | null>(null)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- data do navegador, depois da hidratação
  useEffect(() => { setAno(anoNovoAlvo()) }, [])
  return (
    <div className="gt3-brinde">
      <div className="gt3-brinde-cena">
      <GarrafaInterativa />
      <svg className="gt3-tacas" viewBox="40 0 85 140" aria-hidden>
        <defs>
          <linearGradient id="gt3-taca-vidro" x1="0" x2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity=".9" /><stop offset="1" stopColor="#DCE6F5" stopOpacity=".6" />
          </linearGradient>
          <linearGradient id="gt3-taca-champ" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFE9A8" /><stop offset="1" stopColor="#E8B84A" />
          </linearGradient>
        </defs>
        <g className="gt3-taca esq">
          <path d="M52 30 h26 l-3 46 c-1 9 -6 13 -10 13 c-4 0 -9 -4 -10 -13 z" fill="url(#gt3-taca-vidro)" stroke="#B8C7DE" strokeWidth="1.2" />
          <path d="M53.6 46 h22.8 l-1.9 30 c-1 7.5 -5 10.5 -9.5 10.5 c-4.5 0 -8.5 -3 -9.5 -10.5 z" fill="url(#gt3-taca-champ)" />
          <line x1="65" y1="89" x2="65" y2="128" stroke="#B8C7DE" strokeWidth="2" />
          <ellipse cx="65" cy="130" rx="13" ry="3.2" fill="#DCE6F5" stroke="#B8C7DE" />
        </g>
        <g className="gt3-taca dir">
          <path d="M82 30 h26 l-3 46 c-1 9 -6 13 -10 13 c-4 0 -9 -4 -10 -13 z" fill="url(#gt3-taca-vidro)" stroke="#B8C7DE" strokeWidth="1.2" />
          <path d="M83.6 46 h22.8 l-1.9 30 c-1 7.5 -5 10.5 -9.5 10.5 c-4.5 0 -8.5 -3 -9.5 -10.5 z" fill="url(#gt3-taca-champ)" />
          <line x1="95" y1="89" x2="95" y2="128" stroke="#B8C7DE" strokeWidth="2" />
          <ellipse cx="95" cy="130" rx="13" ry="3.2" fill="#DCE6F5" stroke="#B8C7DE" />
        </g>
        {[[62, 70, 0], [68, 60, 0.8], [92, 72, 0.4], [98, 62, 1.2], [65, 52, 1.6], [95, 54, 2]].map(([x, y, d], i) => (
          <circle key={i} className="gt3-bolha" cx={x} cy={y} r="1.4" style={{ animationDelay: `${d}s` }} />
        ))}
        <text className="gt3-tim" x="80" y="20" textAnchor="middle">✦</text>
      </svg>
      </div>
      <div className="gt3-brinde-sub">Feliz</div>
      {ano && <div className="gt3-brinde-ano">{ano}</div>}
    </div>
  )
}

/** Decoração da faixa vazia à esquerda do Dashboard. */
export function LateralTema() {
  const tema = useTemaSazonal()
  if (!tema) return null
  return (
    <div className="gt3-lateral-tema">
      <div className="gt3-lateral-sticky">
        {tema === 'natal' ? <ArvoreNatal /> : <BrindeAnoNovo />}
      </div>
    </div>
  )
}
