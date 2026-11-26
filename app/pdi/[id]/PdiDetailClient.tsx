'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PdiColaborador } from '../../../data/pdis/types'
import VisaoGeral from './acompanhamento/VisaoGeral'
import AcoesTab from './acompanhamento/AcoesTab'
import HistoricoTab from './acompanhamento/HistoricoTab'
import AvaliacoesTab from './acompanhamento/AvaliacoesTab'
import PerfilTab from './acompanhamento/PerfilTab'
import { useAcompanhamento } from './acompanhamento/useAcompanhamento'
import { progresso } from './acompanhamento/pdi-ui'
import './acompanhamento/pdi.css'

type Tab = 'visao' | 'acoes' | 'avaliacoes' | 'perfil' | 'historico'

// Cinco abas. O Diário fica dentro da Visão geral (só gestão); Eneagrama, MBTI e
// Conclusões viraram "Perfil"; Linha do tempo e Pesquisas viraram "Histórico".
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'visao', label: 'Visão geral', icon: '◉' },
  { id: 'acoes', label: 'Plano de Ações', icon: '🎯' },
  { id: 'avaliacoes', label: 'Avaliações', icon: '📊' },
  { id: 'perfil', label: 'Perfil', icon: '🧩' },
  { id: 'historico', label: 'Histórico', icon: '🕒' },
]
// Links antigos (?tab=...) continuam funcionando
const TAB_ANTIGA: Record<string, Tab> = {
  painel: 'visao', diario: 'visao', linha: 'historico', pesquisas: 'historico',
  eneagrama: 'perfil', mbti: 'perfil', conclusoes: 'perfil',
}

function avatarInitials(nome: string) {
  const p = nome.trim().split(' ')
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? p[0]?.[1] ?? '')).toUpperCase()
}

// ── Main Component ─────────────────────────────────────────────────────

export default function PdiDetailClient({ pdi, papel, isDbPdi }: { pdi: PdiColaborador; papel: string; isDbPdi?: boolean }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('visao')
  const canEdit = ['gestor', 'admin'].includes(papel)
  const acompanhamento = useAcompanhamento(pdi, canEdit)
  const [focoComp, setFocoComp] = useState<string | undefined>(undefined)
  const tabsRef = useRef<HTMLDivElement>(null)
  const indRef = useRef<HTMLDivElement>(null)

  function irPara(tab: Tab, competencia?: string) {
    setFocoComp(competencia)
    setActiveTab(tab)
  }

  // Indicador deslizante das abas: posiciona direto no DOM (sem setState no efeito)
  useLayoutEffect(() => {
    const bar = tabsRef.current, ind = indRef.current
    const btn = bar?.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`)
    if (!bar || !ind || !btn) return
    ind.style.width = `${btn.offsetWidth}px`
    ind.style.transform = `translateX(${btn.offsetLeft}px)`
  }, [activeTab])

  const [editHeader, setEditHeader] = useState(false)
  const [headerNome, setHeaderNome] = useState(pdi.nome)
  const [headerFuncao, setHeaderFuncao] = useState(pdi.funcao)
  const [headerSaving, setHeaderSaving] = useState(false)
  const [headerErr, setHeaderErr] = useState('')
  const [displayNome, setDisplayNome] = useState(pdi.nome)
  const [displayFuncao, setDisplayFuncao] = useState(pdi.funcao)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const bruto = params.get('tab')
    const tab = bruto ? (TAB_ANTIGA[bruto] ?? bruto) as Tab : null
    if (!tab || !TABS.some(t => t.id === tab)) return
    const t = setTimeout(() => setActiveTab(tab), 0) // fora do corpo do efeito
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (papel === 'colaborador') {
      fetch(`/api/pdi/${pdi.id}/notificacoes/vista`, { method: 'POST' }).catch(() => {})
    }
  }, [pdi.id, papel])

  async function saveHeader() {
    if (!headerNome.trim()) return
    setHeaderSaving(true); setHeaderErr('')
    try {
      if (!isDbPdi) {
        // PDI estático: migra para o banco e redireciona para o novo UUID
        const res = await fetch('/api/pdi/migrar-estatico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staticId: pdi.id, nome: headerNome.trim(), funcao: headerFuncao.trim() }),
        })
        if (!res.ok) {
          const b = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(b.error ?? 'Erro ao migrar PDI')
        }
        const { id: newId } = await res.json() as { id: string }
        // Atualiza display local imediatamente antes de navegar
        setDisplayNome(headerNome.trim())
        setDisplayFuncao(headerFuncao.trim())
        setEditHeader(false)
        router.replace(`/pdi/${newId}`)
        return
      }

      const res = await fetch(`/api/pdi/${pdi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: headerNome.trim(), funcao: headerFuncao.trim() }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(b.error ?? 'Erro ao salvar')
      }
      setDisplayNome(headerNome.trim())
      setDisplayFuncao(headerFuncao.trim())
      setEditHeader(false)
    } catch (e) {
      setHeaderErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setHeaderSaving(false)
    }
  }

  const ativasHero = acompanhamento.acoes.filter(a => a.status !== 'Concluído')
  const progHero = progresso(acompanhamento.etapas.filter(e => ativasHero.some(a => a.id === e.acao_id)))
  const ultConversa = acompanhamento.anotacoes.filter(n => n.tipo === 'conversa').map(n => n.data).sort().pop()

  return (
    <div className="pdi2">
      <div style={{ marginBottom: 14, fontSize: 13, color: '#6B7A99' }}>
        <Link href="/pdi" style={{ color: '#6B7A99', textDecoration: 'none' }}>PDI</Link>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: '#1E293B', fontWeight: 500 }}>{displayNome}</span>
      </div>

      <div className="p2-hero">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div className="p2-avatar">{avatarInitials(displayNome)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editHeader ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
                <input value={headerNome} onChange={e => setHeaderNome(e.target.value)} placeholder="Nome" className="p2-input" style={{ fontSize: 16, fontWeight: 700 }} />
                <input value={headerFuncao} onChange={e => setHeaderFuncao(e.target.value)} placeholder="Cargo / Função" className="p2-input" />
                {headerErr && <div style={{ fontSize: 12, color: '#DC2626' }}>{headerErr}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button type="button" className="p2-btn gho sm" onClick={() => { setHeaderNome(displayNome); setHeaderFuncao(displayFuncao); setEditHeader(false) }} disabled={headerSaving}>Cancelar</button>
                  <button type="button" className="p2-btn pri sm" onClick={saveHeader} disabled={headerSaving}>{headerSaving ? 'Salvando…' : 'Salvar'}</button>
                </div>
              </div>
            ) : (
              <>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-.01em' }}>{displayNome}</h1>
                <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap', fontSize: 13 }}>
                  {displayFuncao && <span style={{ color: '#6B7A99' }}>{displayFuncao}</span>}
                  {pdi.periodo && <span style={{ color: '#94A3B8' }}>📅 na GT3 desde {pdi.periodo}</span>}
                </div>
                {pdi.perfilComportamental.eneagrama.ranking.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {pdi.perfilComportamental.eneagrama.ranking.slice(0, 3).map((e, i) => (
                      <span key={i} className="p2-pill" style={{ backgroundColor: ['#FEF3C7', '#EBF4FF', '#E8F7F0'][i], color: ['#92400E', '#1E40AF', '#166534'][i] }}>
                        {['🥇', '🥈', '🥉'][i]} {e.tipo.split(' (')[0]}
                      </span>
                    ))}
                    {pdi.perfilComportamental.mbti?.tipo && <span className="p2-pill" style={{ background: '#F5F3FF', color: '#5B21B6' }}>{pdi.perfilComportamental.mbti.tipo}</span>}
                  </div>
                )}
              </>
            )}
          </div>
          {canEdit && !editHeader && (
            <button type="button" className="p2-icon-btn" onClick={() => setEditHeader(true)} title="Editar nome e cargo" style={{ border: '1px solid var(--p2-line)' }}>✏</button>
          )}
        </div>

        {!acompanhamento.carregando && (
          <div className="p2-hero-stats">
            <span className="p2-hero-stat">🎯 <b>{ativasHero.length}</b> ação{ativasHero.length === 1 ? '' : 'ões'} ativa{ativasHero.length === 1 ? '' : 's'}</span>
            {progHero.total > 0 && (
              <span className="p2-hero-stat" style={{ minWidth: 180 }}>
                <b>{progHero.pct}%</b>
                <span className="p2-bar" style={{ minWidth: 70 }}><i style={{ width: `${progHero.pct}%`, background: 'var(--p2-ok)' }} /></span>
                das etapas
              </span>
            )}
            {canEdit ? (
              <>
                <span className="p2-hero-stat">💬 última conversa <b>{ultConversa ? new Date(ultConversa + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</b></span>
                <span className="p2-hero-stat">📓 <b>{acompanhamento.anotacoes.length}</b> no Diário</span>
              </>
            ) : (() => {
              const c = acompanhamento.ciclos.find(x => x.status === 'ativo')
              const prox = c?.data_conversa && c.data_conversa.slice(0, 10) >= new Date().toISOString().slice(0, 10) ? c.data_conversa : null
              return <span className="p2-hero-stat">💬 próxima conversa <b>{prox ? new Date(prox).toLocaleDateString('pt-BR') : 'a agendar'}</b></span>
            })()}
          </div>
        )}
      </div>

      <div className="p2-tabs" ref={tabsRef} role="tablist">
        <div className="p2-tab-ind" ref={indRef} />
        {TABS.map(tab => (
          <button key={tab.id} type="button" role="tab" data-tab={tab.id} aria-selected={activeTab === tab.id} className="p2-tab"
            onClick={() => irPara(tab.id)}>
            <span style={{ marginRight: 6, opacity: .8 }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      <div className="p2-view" key={activeTab + (focoComp ?? '')}>
        {activeTab === 'visao' && <VisaoGeral pdi={pdi} canEdit={canEdit} dados={acompanhamento} irPara={irPara} />}
        {activeTab === 'acoes' && <AcoesTab pdi={pdi} canEdit={canEdit} dados={acompanhamento} />}
        {activeTab === 'avaliacoes' && <AvaliacoesTab pdi={pdi} papel={papel} isDbPdi={isDbPdi} dados={acompanhamento} />}
        {activeTab === 'perfil' && <PerfilTab pdi={pdi} isDbPdi={isDbPdi} canEdit={canEdit} />}
        {activeTab === 'historico' && <HistoricoTab pdi={pdi} papel={papel} canEdit={canEdit} dados={acompanhamento} competenciaInicial={focoComp} />}
      </div>
    </div>
  )
}
