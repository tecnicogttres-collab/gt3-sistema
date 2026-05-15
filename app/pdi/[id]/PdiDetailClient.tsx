'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PdiColaborador } from '../../../data/pdis/types'

type Tab = 'acoes' | 'avaliacoes' | 'eneagrama' | 'mbti' | 'conclusoes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'acoes', label: 'Plano de Ações' },
  { id: 'avaliacoes', label: 'Avaliações' },
  { id: 'eneagrama', label: 'Eneagrama' },
  { id: 'mbti', label: 'MBTI' },
  { id: 'conclusoes', label: 'Conclusões' },
]

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'Concluído':    { bg: '#F0FFF4', color: '#166534' },
  'Em evolução':  { bg: '#FFFBEB', color: '#92400E' },
  'Em andamento': { bg: '#EBF4FF', color: '#1E40AF' },
  'Não iniciado': { bg: '#F8FAFC', color: '#64748B' },
}

const COMP_SHORT: Record<string, string> = {
  'Relacionamento Interpessoal': 'Rel. Interpessoal',
  'Inteligência Emocional no Trabalho': 'Int. Emocional',
  'Inteligência Emocional': 'Int. Emocional',
  'Cadastro e itens relacionados': 'Cadastro',
  'Atendimento ao cliente': 'Atend. Cliente',
  'PGR/PCMSO/LTCAT': 'PGR/PCMSO',
}

function shorten(s: string) { return COMP_SHORT[s] || s }

function avatarInitials(nome: string) {
  const p = nome.trim().split(' ')
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? p[0]?.[1] ?? '')).toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────

function AcoesTab({ pdi }: { pdi: PdiColaborador }) {
  const acoes = pdi.planoDeAcao
  if (!acoes.length) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
      Nenhuma ação registrada.
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
            {['Competência', 'A desenvolver', 'Ações', 'Resultados esperados', 'Início', 'Status'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {acoes.map((a, i) => {
            const st = STATUS_STYLE[a.status] ?? STATUS_STYLE['Não iniciado']
            return (
              <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>{a.competencia}</td>
                <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 220 }}>{a.desenvolver || '—'}</td>
                <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 260 }}>{a.acoes || '—'}</td>
                <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 220 }}>{a.resultadosEsperados || '—'}</td>
                <td style={{ padding: '11px 14px', color: '#6B7A99', whiteSpace: 'nowrap' }}>{a.inicio || '—'}</td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  {a.status ? (
                    <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: st.bg, color: st.color }}>
                      {a.status}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AvaliacoesTab({ pdi }: { pdi: PdiColaborador }) {
  const { competencias, diretiva, auto, ambicao, totais } = pdi.matrizAvaliacao
  const max = totais.max

  return (
    <div>
      {/* Totais */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Avaliação diretiva', value: totais.diretiva, color: '#2A4F96', bg: '#EBF4FF' },
          { label: 'Autoavaliação', value: totais.auto, color: '#D1AE6E', bg: '#FFFBEB' },
          { label: 'Ambição realista', value: totais.ambicao, color: '#16A34A', bg: '#F0FFF4' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ flex: 1, minWidth: 160, backgroundColor: bg, borderRadius: 10, padding: '14px 18px', border: `1px solid ${color}22` }}>
            <div style={{ fontSize: 11, color: '#6B7A99', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>
              {value}
              <span style={{ fontSize: 14, fontWeight: 400, color: '#94A3B8', marginLeft: 4 }}>/ {max}</span>
            </div>
            <div style={{ height: 4, backgroundColor: '#fff', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Per-competencia bars */}
      <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Competência</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#2A4F96', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Diretiva</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Auto</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ambição</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Visualização</th>
            </tr>
          </thead>
          <tbody>
            {competencias.map((comp, i) => {
              const d = diretiva[i] ?? 0
              const a = auto[i] ?? 0
              const am = ambicao[i] ?? 0
              return (
                <tr key={i} style={{ borderBottom: i < competencias.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td style={{ padding: '10px 16px', color: '#1E293B', fontWeight: 500 }}>{shorten(comp)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#2A4F96' }}>{d}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#92400E' }}>{a}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>{am}</td>
                  <td style={{ padding: '10px 16px', minWidth: 180 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {[{ v: d, c: '#2A4F96' }, { v: a, c: '#D1AE6E' }, { v: am, c: '#16A34A' }].map(({ v, c }, j) => (
                        <div key={j} style={{ height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(v / 5) * 100}%`, backgroundColor: c, borderRadius: 3 }} />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 20, fontSize: 11, color: '#6B7A99' }}>
        {[['#2A4F96', 'Avaliação diretiva'], ['#D1AE6E', 'Autoavaliação'], ['#16A34A', 'Ambição realista']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 4, backgroundColor: c, borderRadius: 2 }} />
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EneagramaTab({ pdi }: { pdi: PdiColaborador }) {
  const { ranking, pontosFortes, pontosAtencao, comoDesenvolver } = pdi.perfilComportamental.eneagrama
  const animais = pdi.perfilComportamental.animais
  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Ranking */}
      {ranking.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ranking Eneagrama</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {ranking.map((e, i) => (
              <div key={i} style={{ flex: 1, minWidth: 180, backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{MEDALS[i] ?? `#${e.rank}`}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 2 }}>{e.tipo}</div>
                <div style={{ fontSize: 12, color: '#6B7A99' }}>Pontuação: {e.pontuacao}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pontos fortes / atenção / como desenvolver */}
      {(pontosFortes.length > 0 || pontosAtencao.length > 0 || comoDesenvolver.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {pontosFortes.length > 0 && (
            <div style={{ backgroundColor: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>✅ Pontos fortes</div>
              {pontosFortes.map((p, i) => <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5 }}>• {p}</div>)}
            </div>
          )}
          {pontosAtencao.length > 0 && (
            <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>⚠️ Pontos de atenção</div>
              {pontosAtencao.map((p, i) => <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5 }}>• {p}</div>)}
            </div>
          )}
          {comoDesenvolver.length > 0 && (
            <div style={{ backgroundColor: '#EBF4FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>🎯 Como desenvolver</div>
              {comoDesenvolver.map((p, i) => <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5 }}>• {p}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Animais */}
      {animais.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Perfil dos Animais</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {animais.map((a, i) => (
              <div key={i} style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{a.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>{a.animal}</div>
                {a.pontoForte && (
                  <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#166534' }}>Ponto forte: </span>{a.pontoForte}
                  </div>
                )}
                {a.tendencia && (
                  <div style={{ fontSize: 12, color: '#374151' }}>
                    <span style={{ fontWeight: 600, color: '#92400E' }}>Tendência: </span>{a.tendencia}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {ranking.length === 0 && animais.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
          Dados de eneagrama não disponíveis.
        </div>
      )}
    </div>
  )
}

function MbtiTab({ pdi }: { pdi: PdiColaborador }) {
  const mbti = pdi.perfilComportamental.mbti
  if (!mbti) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
      Avaliação MBTI não disponível para este colaborador.
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {mbti.tipo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ backgroundColor: '#1E3A6E', color: '#D1AE6E', borderRadius: 12, padding: '10px 22px', fontSize: 28, fontWeight: 800, letterSpacing: 4 }}>
            {mbti.tipo}
          </div>
          <div style={{ fontSize: 13, color: '#6B7A99' }}>Tipo predominante</div>
        </div>
      )}
      {mbti.nucleo && (
        <div style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: '16px 18px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>🧭 Núcleo de funcionamento</div>
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{mbti.nucleo}</p>
        </div>
      )}
      {mbti.veredito && (
        <div style={{ backgroundColor: '#fff', borderRadius: 10, padding: '16px 18px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>🧠 Veredito organizacional</div>
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{mbti.veredito}</p>
        </div>
      )}
    </div>
  )
}

function ConclusoesTab({ pdi }: { pdi: PdiColaborador }) {
  const c = pdi.conclusoes
  const isEmpty = !c.forcas.length && !c.pontosAtencao.length && !c.ondeAgrega.length && !c.comoLiderar.length

  if (isEmpty) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
      Conclusões não disponíveis.
    </div>
  )

  const sections = [
    { title: '✅ Forças visíveis', items: c.forcas, bg: '#F0FFF4', border: '#BBF7D0', titleColor: '#166534' },
    { title: '⚠️ Pontos de atenção', items: c.pontosAtencao, bg: '#FFFBEB', border: '#FDE68A', titleColor: '#92400E' },
    { title: '📌 Onde agrega mais', items: c.ondeAgrega, bg: '#EBF4FF', border: '#BFDBFE', titleColor: '#1E40AF' },
    { title: '🤝 Pode apoiar bem', items: c.comoPodeApoiar, bg: '#F5F3FF', border: '#DDD6FE', titleColor: '#5B21B6' },
    { title: '🚀 Como liderar', items: c.comoLiderar, bg: '#FEF3C7', border: '#FDE68A', titleColor: '#92400E' },
    { title: '⚡ Riscos se mal alocado', items: c.riscos, bg: '#FEF2F2', border: '#FECACA', titleColor: '#DC2626' },
  ].filter(s => s.items.length > 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {sections.map(({ title, items, bg, border, titleColor }) => (
        <div key={title} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: titleColor, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
          {items.map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: i < items.length - 1 ? 6 : 0, lineHeight: 1.5 }}>
              • {item}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function PdiDetailClient({ pdi }: { pdi: PdiColaborador }) {
  const [activeTab, setActiveTab] = useState<Tab>('acoes')
  const hasMbti = !!pdi.perfilComportamental.mbti

  const visibleTabs = TABS.filter(t => t.id !== 'mbti' || hasMbti)

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20, fontSize: 13, color: '#6B7A99' }}>
        <Link href="/pdi" style={{ color: '#6B7A99', textDecoration: 'none' }}>PDI</Link>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: '#1E293B', fontWeight: 500 }}>{pdi.nome}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', backgroundColor: '#1E3A6E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#D1AE6E', fontSize: 18, fontWeight: 700, flexShrink: 0,
        }}>
          {avatarInitials(pdi.nome)}
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1E293B' }}>{pdi.nome}</h1>
          <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
            {pdi.funcao && (
              <span style={{ fontSize: 13, color: '#6B7A99' }}>{pdi.funcao}</span>
            )}
            {pdi.periodo && (
              <span style={{ fontSize: 13, color: '#94A3B8' }}>📅 {pdi.periodo}</span>
            )}
          </div>
          {/* Eneagrama pills */}
          {pdi.perfilComportamental.eneagrama.ranking.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {pdi.perfilComportamental.eneagrama.ranking.map((e, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                  backgroundColor: ['#FEF3C7', '#EBF4FF', '#F0FFF4'][i],
                  color: ['#92400E', '#1E40AF', '#166534'][i],
                }}>
                  {['🥇', '🥈', '🥉'][i]} {e.tipo}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #E2E8F0', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 18px',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? '#2A4F96' : 'transparent'}`,
                backgroundColor: 'transparent',
                color: activeTab === tab.id ? '#2A4F96' : '#6B7A99',
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'acoes' && <AcoesTab pdi={pdi} />}
        {activeTab === 'avaliacoes' && <AvaliacoesTab pdi={pdi} />}
        {activeTab === 'eneagrama' && <EneagramaTab pdi={pdi} />}
        {activeTab === 'mbti' && <MbtiTab pdi={pdi} />}
        {activeTab === 'conclusoes' && <ConclusoesTab pdi={pdi} />}
      </div>
    </div>
  )
}
