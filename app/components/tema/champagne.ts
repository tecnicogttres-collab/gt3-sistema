/** Champagne estourando no ponto do clique (tema de Ano Novo).
 *  Monta os elementos direto no <body>: a animação continua mesmo quando o clique troca de página. */

const OURO = ['#F6D47A', '#E8B84A', '#FFF3C4', '#D9A441', '#FFFFFF']

function el(tag: string, style: Partial<CSSStyleDeclaration>, html = ''): HTMLElement {
  const e = document.createElement(tag)
  Object.assign(e.style, style)
  if (html) e.innerHTML = html
  return e
}

const GARRAFA = `
<svg width="30" height="78" viewBox="0 0 30 78" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gt3gv" x1="0" x2="1">
      <stop offset="0" stop-color="#0E3B2A"/><stop offset=".45" stop-color="#1F6B4A"/><stop offset="1" stop-color="#0A2A1E"/>
    </linearGradient>
    <linearGradient id="gt3gf" x1="0" x2="1">
      <stop offset="0" stop-color="#B8863D"/><stop offset=".5" stop-color="#F6D47A"/><stop offset="1" stop-color="#A9772F"/>
    </linearGradient>
  </defs>
  <path d="M11 4h8v16c0 5 7 9 7 18v34a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V38c0-9 7-13 7-18z" fill="url(#gt3gv)"/>
  <path d="M11 4h8v14h-8z" fill="url(#gt3gf)"/>
  <rect x="4.6" y="44" width="20.8" height="16" rx="2" fill="#FFF8E6"/>
  <rect x="4.6" y="46.5" width="20.8" height="2" fill="#D9A441"/>
  <text x="15" y="56.5" text-anchor="middle" font-size="5.5" font-weight="700" fill="#1E3A6E" font-family="Georgia,serif">GT3</text>
  <path d="M7 24c-1 4-2 8-2 14" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</svg>`

export function estourarChampagne(x: number, y: number) {
  if (typeof document === 'undefined') return
  const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const raiz = el('div', { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '10001', pointerEvents: 'none' })
  document.body.appendChild(raiz)

  // Garrafa inclinada para a direita, com a base logo abaixo do clique
  const ang = 22
  const baseX = x - 6
  const baseY = y + 34
  const garrafa = el('div', {
    position: 'absolute', left: `${baseX - 15}px`, top: `${baseY - 78}px`, width: '30px', height: '78px',
    transformOrigin: '50% 100%', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.25))',
  }, GARRAFA)
  raiz.appendChild(garrafa)

  // Ponta do gargalo depois da rotação
  const rad = (ang * Math.PI) / 180
  const bocaX = baseX + 74 * Math.sin(rad)
  const bocaY = baseY - 74 * Math.cos(rad)

  const dur = reduz ? 400 : 1300
  garrafa.animate([
    { transform: `rotate(0deg) scale(.2)`, opacity: 0 },
    { transform: `rotate(${ang - 6}deg) scale(1.05)`, opacity: 1, offset: .14 },
    { transform: `rotate(${ang + 4}deg) scale(1)`, offset: .2 },
    { transform: `rotate(${ang - 3}deg) scale(1)`, offset: .25 },
    { transform: `rotate(${ang}deg) scale(1)`, offset: .3 },
    { transform: `rotate(${ang}deg) scale(1)`, opacity: 1, offset: .72 },
    { transform: `rotate(${ang + 6}deg) scale(.9) translateY(10px)`, opacity: 0 },
  ], { duration: dur, easing: 'ease-out', fill: 'forwards' })

  if (!reduz) espirrar(raiz, bocaX, bocaY, ang, 360)

  setTimeout(() => raiz.remove(), dur + 400)
}

/** Rolha + clarão + espuma dourada saindo da boca da garrafa (coordenadas da tela). */
function espirrar(raiz: HTMLElement, bocaX: number, bocaY: number, ang: number, atraso: number) {
  // Rolha
  const rolha = el('div', {
    position: 'absolute', left: `${bocaX - 4}px`, top: `${bocaY - 5}px`, width: '8px', height: '10px',
    borderRadius: '3px 3px 2px 2px', background: 'linear-gradient(90deg,#C9A46A,#E9CF9B,#B98F52)',
    opacity: '0',
  })
  raiz.appendChild(rolha)
  rolha.animate([
    { transform: `translate(0,0) rotate(${ang}deg)`, opacity: 1 },
    { transform: `translate(70px,-150px) rotate(${ang + 400}deg)`, opacity: 1, offset: .7 },
    { transform: `translate(95px,-120px) rotate(${ang + 560}deg)`, opacity: 0 },
  ], { duration: 650, delay: atraso, easing: 'cubic-bezier(.15,.7,.4,1)', fill: 'both' })

  // Clarão do "pop"
  const flash = el('div', {
    position: 'absolute', left: `${bocaX - 18}px`, top: `${bocaY - 18}px`, width: '36px', height: '36px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,243,196,.95) 0%, rgba(246,212,122,.5) 40%, transparent 70%)', opacity: '0',
  })
  raiz.appendChild(flash)
  flash.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.4)', opacity: 1, offset: .3 }, { transform: 'scale(2)', opacity: 0 }],
    { duration: 420, delay: atraso, easing: 'ease-out', fill: 'both' })

  // Espuma / bolhas douradas em leque
  const n = 34
  for (let i = 0; i < n; i++) {
    const a = ((-90 + ang) + (Math.random() * 70 - 35)) * Math.PI / 180
    const dist = 70 + Math.random() * 120
    const dx = Math.cos(a) * dist
    const dy = Math.sin(a) * dist
    const s = 3 + Math.random() * 6
    const bolha = Math.random() < .35
    const cor = OURO[Math.floor(Math.random() * OURO.length)]
    const p = el('div', {
      position: 'absolute', left: `${bocaX - s / 2}px`, top: `${bocaY - s / 2}px`, width: `${s}px`, height: `${s}px`, borderRadius: '50%',
      background: bolha ? 'transparent' : cor, border: bolha ? `1.2px solid ${cor}` : 'none',
      boxShadow: bolha ? 'none' : `0 0 6px ${cor}`, opacity: '0',
    })
    raiz.appendChild(p)
    p.animate([
      { transform: 'translate(0,0) scale(.4)', opacity: 1 },
      { transform: `translate(${dx * .7}px,${dy * .7}px) scale(1)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx}px,${dy + 45}px) scale(.6)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 400, delay: atraso + 20 + Math.random() * 120, easing: 'cubic-bezier(.2,.8,.4,1)', fill: 'both' })
  }
}

/** Só o estouro (a garrafa já está desenhada na página): usado pela garrafa da lateral. */
export function estourarRolha(bocaX: number, bocaY: number, ang = 20) {
  if (typeof document === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const raiz = el('div', { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '10001', pointerEvents: 'none' })
  document.body.appendChild(raiz)
  espirrar(raiz, bocaX, bocaY, ang, 0)
  setTimeout(() => raiz.remove(), 1700)
}
