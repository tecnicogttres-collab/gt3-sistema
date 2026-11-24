'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { temaPorData, TEMA_DEV_KEY, type TemaSazonal } from '../../lib/tema-sazonal'
import './tema-sazonal.css'

const DEV = process.env.NODE_ENV === 'development'

type Ctx = { tema: TemaSazonal | null; devOverride: TemaSazonal | null; setDevOverride: (t: TemaSazonal | null) => void }
const TemaCtx = createContext<Ctx>({ tema: null, devOverride: null, setDevOverride: () => {} })

export const useTemaSazonal = () => useContext(TemaCtx).tema

function lerOverride(): TemaSazonal | null {
  if (!DEV) return null
  try {
    const v = localStorage.getItem(TEMA_DEV_KEY)
    return v === 'natal' || v === 'anonovo' ? v : null
  } catch { return null }
}

/** Decide o tema do dia (ou o escolhido no painel de teste do localhost) e marca o <html> com
 *  data-tema, que é o que o CSS dos módulos usa. */
export function TemaSazonalProvider({ children }: { children: React.ReactNode }) {
  const [porData, setPorData] = useState<TemaSazonal | null>(null)
  const [devOverride, setOverrideState] = useState<TemaSazonal | null>(null)

  // Layout effect: o tema já está decidido antes da 1ª pintura (a tela de entrada usa ele)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data e localStorage do navegador, antes da 1a pintura
    setPorData(temaPorData())
    setOverrideState(lerOverride())
  }, [])

  // Virada de dia com o sistema aberto
  useEffect(() => {
    const id = setInterval(() => setPorData(temaPorData()), 10 * 60_000)
    return () => clearInterval(id)
  }, [])

  const tema = devOverride ?? porData

  useEffect(() => {
    const el = document.documentElement
    if (tema) el.dataset.tema = tema
    else delete el.dataset.tema
  }, [tema])

  const setDevOverride = useCallback((t: TemaSazonal | null) => {
    setOverrideState(t)
    try { if (t) localStorage.setItem(TEMA_DEV_KEY, t); else localStorage.removeItem(TEMA_DEV_KEY) } catch { /* ignore */ }
  }, [])

  return (
    <TemaCtx.Provider value={{ tema, devOverride, setDevOverride }}>
      {children}
      {DEV && <PainelTemaDev />}
    </TemaCtx.Provider>
  )
}

/** Só no localhost: checkboxes para ver os temas fora das datas. Nada disso existe em produção. */
function PainelTemaDev() {
  const { devOverride, setDevOverride } = useContext(TemaCtx)
  const [aberto, setAberto] = useState(true)

  function reverEntrada() {
    try { sessionStorage.removeItem('gt3-intro-v1') } catch { /* ignore */ }
    window.location.reload()
  }

  if (!aberto) {
    return (
      <button className="gt3-tema-dev-min" onClick={() => setAberto(true)} title="Temas (teste no localhost)">🎨</button>
    )
  }
  return (
    <div className="gt3-tema-dev">
      <div className="gt3-tema-dev-head">
        <b>Temas · só localhost</b>
        <button onClick={() => setAberto(false)} title="Minimizar">–</button>
      </div>
      <label>
        <input type="checkbox" checked={devOverride === 'natal'} onChange={e => setDevOverride(e.target.checked ? 'natal' : null)} />
        🎄 Natal <span>(07/12 a 27/12)</span>
      </label>
      <label>
        <input type="checkbox" checked={devOverride === 'anonovo'} onChange={e => setDevOverride(e.target.checked ? 'anonovo' : null)} />
        🥂 Ano Novo <span>(28/12 a 09/01)</span>
      </label>
      <div className="gt3-tema-dev-foot">
        <span>Nenhum marcado = pela data</span>
        <button onClick={reverEntrada}>Rever entrada ↻</button>
      </div>
    </div>
  )
}
