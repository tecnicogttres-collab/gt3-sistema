'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CsProvider, useCs } from './cs-data'
import { ABAS, type AbaId } from './cs-lib'
import { consumirPedidoAbrir, getTimer, onPedidoAbrir, setVendoCronometro, useTimer } from './cs-timer'
import { CS_PATH } from './CsTimerFloat'
import Cronometrar, { type NavCron } from './abas/Cronometrar'
import Tempos from './abas/Tempos'
import Medicoes from './abas/Medicoes'
import Contagem from './abas/Contagem'
import Resultado from './abas/Resultado'
import Configuracoes from './abas/Configuracoes'
import Suporte from './abas/Suporte'
import { displayName, useUser } from '../components/UserContext'
import './custo-servir.css'

const abaInicial = (): AbaId => {
  if (typeof window === 'undefined') return 'cronometrar'
  const h = window.location.hash.slice(1)
  return (ABAS.some(a => a.id === h) ? h : 'cronometrar') as AbaId
}

export default function CustoServirClient() {
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [aba, setAba] = useState<AbaId>(abaInicial)
  const [nav, setNav] = useState<NavCron>({ g: null, d: null, q: '' })
  const [cfgSub, setCfgSub] = useState('grupos')

  const toast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMsg(msg)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }, [])

  const irCronometro = useCallback((g: string, d: string) => {
    setNav({ g, d, q: '' })
    setAba('cronometrar')
    window.scrollTo({ top: 0 })
  }, [])

  const irConfig = useCallback((sub: string) => {
    setCfgSub(sub)
    setAba('configuracoes')
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <CsProvider toast={toast} irCronometro={irCronometro} irConfig={irConfig} cfgSub={cfgSub} setCfgSub={setCfgSub}>
      <Modulo aba={aba} setAba={setAba} nav={nav} setNav={setNav} />
      {toastMsg && <div className="cs-toast" role="status">{toastMsg}</div>}
    </CsProvider>
  )
}

function Modulo({ aba, setAba, nav, setNav }: {
  aba: AbaId; setAba: (a: AbaId) => void; nav: NavCron; setNav: (n: NavCron) => void
}) {
  const { d, carregando, erro, recarregar, carregarMedicoes, papel } = useCs()
  const { profile } = useUser()
  const pathname = usePathname()
  const telaVisivel = pathname === CS_PATH
  const T = useTimer()

  // Abas visiveis por perfil (cs_config.abas_perfis). Admin sempre ve todas.
  const mapa = d.cfg?.abas_perfis ?? {}
  const abas = ABAS.filter(a => papel === 'admin' || !mapa[a.id] || mapa[a.id].includes(papel))
  const abaAtual: AbaId = abas.some(a => a.id === aba) ? aba : (abas[0]?.id ?? 'cronometrar')

  const trocarAba = (a: AbaId) => {
    setAba(a)
    try { history.replaceState(null, '', '#' + a) } catch { /* ignore */ }
  }

  // Medicoes de outros avaliadores: rele ao entrar nas abas que dependem delas
  const ultimaAba = useRef(abaAtual)
  useEffect(() => {
    if (!telaVisivel || carregando) return
    if (ultimaAba.current !== abaAtual && abaAtual !== 'configuracoes') void carregarMedicoes().catch(() => {})
    ultimaAba.current = abaAtual
  }, [abaAtual, telaVisivel, carregando, carregarMedicoes])

  // Esconde o botao flutuante quando a tela do cronometro em andamento esta aberta
  useEffect(() => {
    setVendoCronometro(telaVisivel && abaAtual === 'cronometrar' && !!T.g && nav.g === T.g && nav.d === T.d)
  }, [telaVisivel, abaAtual, nav.g, nav.d, T.g, T.d])
  useEffect(() => () => setVendoCronometro(false), [])

  // Botao flutuante pediu para voltar ao cronometro
  useEffect(() => {
    const abrir = () => {
      if (!consumirPedidoAbrir()) return
      const t = getTimer()
      if (t.g && t.d) { setNav({ g: t.g, d: t.d, q: '' }); setAba('cronometrar') }
    }
    abrir()
    return onPedidoAbrir(abrir)
  }, [setNav, setAba])

  const nome = d.cfg?.nome_modulo || 'Custo de Servir'

  return (
    <div className="cs">
      <div className="head">
        <div>
          <div className="eyebrow">Tempo-padrão e custo de servir</div>
          <h1>{nome}</h1>
          <p>Cronometre os documentos por grupo de critério, acompanhe os tempos-padrão e transforme o relatório do sistema em horas por contratante.</p>
        </div>
        <span className="who">Avaliador: {displayName(profile)}</span>
      </div>

      {carregando ? (
        <div className="empty">Carregando…</div>
      ) : erro || !d.cfg ? (
        <div className="box">
          <h2>Não foi possível carregar o módulo</h2>
          <p className="note">{erro ?? 'Configuração do módulo não encontrada (cs_config).'}</p>
          <div className="row"><button type="button" className="btn solid" onClick={() => void recarregar()}>Tentar de novo</button></div>
        </div>
      ) : (
        <>
          <div className="tabs" role="tablist">
            {abas.map(a => (
              <button key={a.id} type="button" role="tab" aria-selected={a.id === abaAtual} className={a.id === abaAtual ? 'on' : ''} onClick={() => trocarAba(a.id)}>
                {a.label}{a.id === 'medicoes' && <span className="cnt">{d.meds.length}</span>}
              </button>
            ))}
          </div>
          {abaAtual === 'cronometrar' && <Cronometrar nav={nav} setNav={setNav} telaVisivel={telaVisivel} />}
          {abaAtual === 'tempos' && <Tempos />}
          {abaAtual === 'medicoes' && <Medicoes />}
          {abaAtual === 'contagem' && <Contagem />}
          {abaAtual === 'resultado' && <Resultado />}
          {abaAtual === 'suporte' && <Suporte />}
          {abaAtual === 'configuracoes' && <Configuracoes />}
        </>
      )}
    </div>
  )
}
