'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CsProvider, useCs } from './cs-data'
import { ABAS, abaVetada, type AbaId } from './cs-lib'
import { consumirPedidoAbrir, getTimer, onPedidoAbrir, setVendoCronometro, useTimer } from './cs-timer'
import { CS_PATH } from './CsTimerFloat'
import Cronometrar, { type NavCron } from './abas/Cronometrar'
import Tempos from './abas/Tempos'
import Medicoes from './abas/Medicoes'
import Contagem from './abas/Contagem'
import Resultado from './abas/Resultado'
import Configuracoes from './abas/Configuracoes'
import Suporte from './abas/Suporte'
import Bases from './abas/Bases'
import Fechamento from './abas/Fechamento'
import Comparativo from './abas/Comparativo'
import ExtraPortal from './abas/ExtraPortal'
import { prefetchSuporte } from './abas/suporte-data'
import { ModoTempoToggle } from './cs-ui'
import { displayName, useUser } from '../components/UserContext'
import './custo-servir.css'

/** 'inicio' = tela de escolha (cards). O modulo abre nela, a nao ser que a URL ja aponte uma aba. */
type Tela = AbaId | 'inicio'

const abaInicial = (): Tela => {
  if (typeof window === 'undefined') return 'inicio'
  const h = window.location.hash.slice(1)
  return (ABAS.some(a => a.id === h) ? h : 'inicio') as Tela
}

/** Como cada aba aparece na tela inicial e na barra lateral. */
const META: Record<AbaId, { icone: string; desc: string }> = {
  cronometrar: { icone: '⏱', desc: 'Cronometrar a avaliação dos documentos por grupo de critério.' },
  tempos: { icone: '📏', desc: 'Tempo-padrão de cada documento, aprovado e reprovado.' },
  medicoes: { icone: '📋', desc: 'Todas as medições registradas, por avaliador.' },
  contagem: { icone: '🏢', desc: 'Relatório do sistema convertido em volume por contratante.' },
  resultado: { icone: '📊', desc: 'Horas e custo por contratante a partir do volume.' },
  comparativo: { icone: '⚖', desc: 'Compare dois ou mais contratantes e veja o ranking de todos.' },
  suporte: { icone: '🎧', desc: 'Cadastro, e-mail, ligação e demais atendimentos.' },
  extra: { icone: '🧩', desc: 'Atividades fora do portal (WhatsApp, Teams...), medidas por amostragem.' },
  bases: { icone: '📚', desc: 'Modelos de venda, contratantes, pacotes de extras e catálogo.' },
  configuracoes: { icone: '⚙', desc: 'Grupos de critério, documentos de cada grupo, catálogo, contratantes, turnos e parâmetros.' },
  fechamento: { icone: '★', desc: 'A conta inteira: avaliação + suporte contra a capacidade da equipe.' },
}

/** Agrupamento das abas (Fechamento e Definicoes ficam fora: vao no topo da barra).
 *  O Medir se divide nas tres camadas: avaliacao no portal, suporte com rastro e extra portal. */
type GrupoNav = { camada?: string; n?: number; sub?: string; ids: AbaId[] }
const SECOES_NAV: { titulo: string; grupos: GrupoNav[] }[] = [
  {
    titulo: 'Medir', grupos: [
      { camada: 'Camada 1', n: 1, sub: 'Avaliação no portal', ids: ['cronometrar', 'tempos', 'medicoes'] },
      { camada: 'Camada 2', n: 2, sub: 'Suporte com rastro', ids: ['suporte'] },
      { camada: 'Camada 3', n: 3, sub: 'Fora do portal', ids: ['extra'] },
    ],
  },
  { titulo: 'Volume e resultado', grupos: [{ ids: ['contagem', 'resultado', 'comparativo'] }] },
  { titulo: 'Cadastros', grupos: [{ ids: ['bases'] }] },
]
/** Grupos da secao com ao menos uma aba visivel (cada um so com as abas visiveis). */
const gruposVisiveis = (grupos: GrupoNav[], visivel: (id: AbaId) => boolean) =>
  grupos.map(g => ({ ...g, ids: g.ids.filter(visivel) })).filter(g => g.ids.length)

const LS_LATERAL = 'cs_nav_recolhida'
const rotulo = (id: AbaId) => ABAS.find(a => a.id === id)?.label ?? id

export default function CustoServirClient() {
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [aba, setAba] = useState<Tela>(abaInicial)
  const [nav, setNav] = useState<NavCron>({ g: null, d: null, q: '' })
  const [cfgSub, setCfgSub] = useState('inicio')

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
  aba: Tela; setAba: (a: Tela) => void; nav: NavCron; setNav: (n: NavCron) => void
}) {
  const { d, carregando, erro, recarregar, carregarMedicoes, papel, setCfgSub } = useCs()
  const { profile } = useUser()
  const pathname = usePathname()
  const telaVisivel = pathname === CS_PATH
  const T = useTimer()

  // Abas visiveis por perfil (cs_config.abas_perfis). Admin sempre ve todas; vetos fixos (ABAS_VETADAS) valem sempre.
  const mapa = d.cfg?.abas_perfis ?? {}
  const abas = ABAS.filter(a => papel === 'admin' || (!abaVetada(a.id, papel) && (!mapa[a.id] || mapa[a.id].includes(papel))))
  const visivel = (id: AbaId) => abas.some(a => a.id === id)
  const abaAtual: Tela = aba === 'inicio' || visivel(aba) ? aba : 'inicio'

  const trocarAba = (a: Tela) => {
    // Clicar em Cronometrar (mesmo ja estando nela) volta para a tela inicial de grupos
    if (a === 'cronometrar') setNav({ g: null, d: null, q: '' })
    // Definicoes pela barra/inicio abre sempre na tela de escolha
    if (a === 'configuracoes') setCfgSub('inicio')
    setAba(a)
    try { history.replaceState(null, '', a === 'inicio' ? location.pathname + location.search : '#' + a) } catch { /* ignore */ }
    window.scrollTo({ top: 0 })
  }
  const naTelaGrupos = abaAtual === 'cronometrar' && !nav.g

  // Barra lateral recolhida (so icones): preferencia guardada no navegador
  // (a barra so aparece depois do carregamento, entao ler o localStorage aqui nao gera diferenca de hidratacao)
  const [recolhida, setRecolhida] = useState(() => { try { return typeof window !== 'undefined' && localStorage.getItem(LS_LATERAL) === '1' } catch { return false } })
  const alternarLateral = () => setRecolhida(v => { try { localStorage.setItem(LS_LATERAL, v ? '0' : '1') } catch { /* ignore */ } return !v })

  // Medicoes de outros avaliadores: rele ao entrar nas abas que dependem delas
  const ultimaAba = useRef(abaAtual)
  useEffect(() => {
    if (!telaVisivel || carregando) return
    if (ultimaAba.current !== abaAtual && abaAtual !== 'configuracoes' && abaAtual !== 'inicio') void carregarMedicoes().catch(() => {})
    ultimaAba.current = abaAtual
  }, [abaAtual, telaVisivel, carregando, carregarMedicoes])

  // Suporte/Fechamento: comeca a carregar em segundo plano para a aba abrir na hora
  const veSuporte = abas.some(a => a.id === 'suporte' || a.id === 'extra' || a.id === 'fechamento' || a.id === 'comparativo')
  useEffect(() => { if (telaVisivel && !carregando && veSuporte) prefetchSuporte() }, [telaVisivel, carregando, veSuporte])

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

  const nome = d.cfg?.nome_modulo || 'Custo de Operação'

  return (
    <div className="cs">
      <div className="head">
        <div>
          <div className="eyebrow">Tempo-padrão e custo de operação</div>
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
      ) : abaAtual === 'inicio' ? (
        <Inicio visivel={visivel} nMed={d.meds.length} abrir={trocarAba} />
      ) : (
        <div className={'cs-shell' + (recolhida ? ' recolhida' : '')}>
          <nav className="cs-lateral" aria-label="Seções do módulo">
            <div className="lat-topo">
              <button type="button" className="lat-item" onClick={() => trocarAba('inicio')} title="Voltar para a tela inicial">
                <span className="ic">⌂</span><span className="tx">Início</span>
              </button>
              <button type="button" className="lat-recolher" onClick={alternarLateral}
                title={recolhida ? 'Expandir barra lateral' : 'Recolher barra lateral'} aria-label={recolhida ? 'Expandir barra lateral' : 'Recolher barra lateral'}>
                {recolhida ? '»' : '«'}
              </button>
            </div>
            {visivel('fechamento') && (
              <button type="button" className={'lat-item fech' + (abaAtual === 'fechamento' ? ' on' : '')} aria-current={abaAtual === 'fechamento' ? 'page' : undefined}
                onClick={() => trocarAba('fechamento')} title={META.fechamento.desc}>
                <span className="ic">★</span><span className="tx">Fechamento</span>
              </button>
            )}
            {visivel('configuracoes') && (
              <button type="button" className={'lat-item def' + (abaAtual === 'configuracoes' ? ' on' : '')} aria-current={abaAtual === 'configuracoes' ? 'page' : undefined}
                onClick={() => trocarAba('configuracoes')} title={META.configuracoes.desc}>
                <span className="ic">⚙</span><span className="tx">Definições</span>
              </button>
            )}
            {SECOES_NAV.map(s => {
              const grupos = gruposVisiveis(s.grupos, visivel)
              if (!grupos.length) return null
              return (
                <div key={s.titulo} className="lat-sec">
                  <span className="lat-tit">{s.titulo}</span>
                  {grupos.map(g => (
                    <div key={g.camada ?? s.titulo} className={g.camada ? 'lat-cam c' + g.n : 'lat-cam sem'}>
                      {g.camada && <span className="lat-cam-tit"><span className="num">{g.n}</span>{g.camada}</span>}
                      {g.ids.map(id => (
                        <button key={id} type="button" className={'lat-item' + (abaAtual === id ? ' on' : '')} aria-current={abaAtual === id ? 'page' : undefined}
                          onClick={() => trocarAba(id)} title={recolhida ? (g.camada ? g.camada + ' · ' : '') + rotulo(id) : id === 'cronometrar' ? 'Volta para a escolha do grupo' : META[id].desc}>
                          <span className="ic">{META[id].icone}</span>
                          <span className="tx">{rotulo(id)}</span>
                          {id === 'medicoes' && <span className="cnt">{d.meds.length}</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )
            })}
          </nav>

          <div className="cs-conteudo">
            <div className="cs-topo">
              <h2>{abaAtual === 'fechamento' ? '★ ' : META[abaAtual].icone + ' '}{rotulo(abaAtual)}</h2>
              <div className="row" style={{ marginLeft: 'auto' }}>
                {!naTelaGrupos && abaAtual === 'cronometrar' && (
                  <button type="button" className="btn sm" onClick={() => trocarAba('cronometrar')} title="Voltar para a tela inicial de grupos">⌂ Grupos</button>
                )}
                <ModoTempoToggle />
              </div>
            </div>
            {abaAtual === 'cronometrar' && <Cronometrar nav={nav} setNav={setNav} telaVisivel={telaVisivel} />}
            {abaAtual === 'tempos' && <Tempos />}
            {abaAtual === 'medicoes' && <Medicoes />}
            {abaAtual === 'contagem' && <Contagem />}
            {abaAtual === 'resultado' && <Resultado />}
            {abaAtual === 'comparativo' && <Comparativo />}
            {abaAtual === 'suporte' && <Suporte />}
            {abaAtual === 'extra' && <ExtraPortal />}
            {abaAtual === 'bases' && <Bases />}
            {abaAtual === 'configuracoes' && <Configuracoes />}
            {abaAtual === 'fechamento' && <Fechamento />}
          </div>
        </div>
      )}
    </div>
  )
}

/** Tela inicial: cards para escolher a secao, com o Fechamento em destaque. */
function Inicio({ visivel, nMed, abrir }: { visivel: (id: AbaId) => boolean; nMed: number; abrir: (a: AbaId) => void }) {
  return (
    <div className="cs-inicio">
      {visivel('fechamento') && (
        <button type="button" className="ini-fech" onClick={() => abrir('fechamento')}>
          <span className="ic">★</span>
          <span className="tx">
            <span className="eyebrow">Resultado final</span>
            <b>Fechamento</b>
            <span>{META.fechamento.desc}</span>
          </span>
          <span className="ir" aria-hidden>Abrir →</span>
        </button>
      )}
      {visivel('configuracoes') && (
        <button type="button" className="ini-def" onClick={() => abrir('configuracoes')}>
          <span className="ic">⚙</span>
          <span className="tx"><b>Definições</b><span>{META.configuracoes.desc}</span></span>
          <span className="ir" aria-hidden>→</span>
        </button>
      )}
      {SECOES_NAV.map(s => {
        const grupos = gruposVisiveis(s.grupos, visivel)
        if (!grupos.length) return null
        const card = (id: AbaId) => (
          <button key={id} type="button" className="ini-card" onClick={() => abrir(id)}>
            <span className="ic">{META[id].icone}</span>
            <span className="tx">
              <b>{rotulo(id)}{id === 'medicoes' && <span className="cnt">{nMed}</span>}</b>
              <span>{META[id].desc}</span>
            </span>
          </button>
        )
        return (
          <section key={s.titulo} className="ini-sec">
            <h3 className="eyebrow">{s.titulo}</h3>
            {grupos.some(g => g.camada) ? (
              <div className="ini-camadas">
                {grupos.map(g => (
                  <div key={g.camada} className={'ini-camada c' + g.n} style={{ flexGrow: g.ids.length, flexBasis: g.ids.length * 220 }}>
                    <span className="ini-camada-tab">
                      <span className="num">{g.n}</span>
                      <span className="tt"><b>{g.camada}</b><span>{g.sub}</span></span>
                    </span>
                    <div className="ini-grid">{g.ids.map(card)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ini-grid">{grupos.flatMap(g => g.ids).map(card)}</div>
            )}
          </section>
        )
      })}
    </div>
  )
}
