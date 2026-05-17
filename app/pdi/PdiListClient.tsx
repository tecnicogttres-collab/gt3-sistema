'use client'

import Link from 'next/link'
import * as allPdis from '../../data/pdis/index'
import type { PdiColaborador } from '../../data/pdis/types'

const pdis = Object.values(allPdis) as PdiColaborador[]

const STATUS_COLORS: Record<string, string> = {
  'Concluído': '#16A34A',
  'Em evolução': '#D97706',
  'Em andamento': '#2A4F96',
  'Não iniciado': '#94A3B8',
}

function avatarInitials(nome: string) {
  const parts = nome.trim().split(' ')
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')
}

function progresso(pdi: PdiColaborador) {
  const total = pdi.planoDeAcao.length
  if (!total) return { pct: 0, concluidos: 0, total: 0 }
  const concluidos = pdi.planoDeAcao.filter(a => a.status === 'Concluído').length
  return { pct: Math.round((concluidos / total) * 100), concluidos, total }
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7A99', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: '#1E293B' }}>{value}/{max}</span>
      </div>
      <div style={{ height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

export default function PdiListClient() {
  const sorted = [...pdis].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1E293B' }}>PDI</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7A99' }}>
          {pdis.length} colaboradores com plano de desenvolvimento individual
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {sorted.map(pdi => {
          const { pct, concluidos, total } = progresso(pdi)
          const totais = pdi.matrizAvaliacao.totais
          const hasData = totais.max > 0 && (totais.diretiva > 0 || totais.auto > 0)
          const semDados = !pdi.funcao && !pdi.periodo

          return (
            <Link
              key={pdi.id}
              href={`/pdi/${pdi.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, transform 0.15s',
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = '0 4px 16px rgba(42,79,150,0.13)'
                  el.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'
                  el.style.transform = 'translateY(0)'
                }}
              >
                {/* Top accent */}
                <div style={{ height: 3, backgroundColor: '#D1AE6E' }} />

                <div style={{ padding: '16px 18px 18px' }}>
                  {/* Avatar + nome */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      backgroundColor: '#1E3A6E', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: '#D1AE6E', fontSize: 14, fontWeight: 700, flexShrink: 0,
                    }}>
                      {avatarInitials(pdi.nome).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pdi.nome}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>
                        {pdi.funcao || 'Função não informada'}
                      </div>
                    </div>
                  </div>

                  {/* Período */}
                  {pdi.periodo && (
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>📅</span>
                      <span>{pdi.periodo}</span>
                    </div>
                  )}

                  {semDados ? (
                    <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                      Dados pendentes de preenchimento
                    </div>
                  ) : (
                    <>
                      {/* Score bars */}
                      {hasData && (
                        <div style={{ marginBottom: 12 }}>
                          <ScoreBar label="Avaliação diretiva" value={totais.diretiva} max={totais.max} color="#2A4F96" />
                          <ScoreBar label="Autoavaliação" value={totais.auto} max={totais.max} color="#D1AE6E" />
                          <ScoreBar label="Ambição realista" value={totais.ambicao} max={totais.max} color="#16A34A" />
                        </div>
                      )}

                      {/* Progresso ações */}
                      {total > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7A99', marginBottom: 4 }}>
                            <span>Plano de ações</span>
                            <span style={{ fontWeight: 600, color: '#1E293B' }}>{concluidos}/{total} concluídas</span>
                          </div>
                          <div style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#16A34A', borderRadius: 3 }} />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Eneagrama badges */}
                  {pdi.perfilComportamental.eneagrama.ranking.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
                      {pdi.perfilComportamental.eneagrama.ranking.slice(0, 3).map((e, i) => (
                        <span key={i} style={{
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 7px', borderRadius: 20,
                          backgroundColor: i === 0 ? '#FEF3C7' : i === 1 ? '#EBF4FF' : '#F0FFF4',
                          color: i === 0 ? '#92400E' : i === 1 ? '#1E40AF' : '#166534',
                        }}>
                          {e.tipo.replace('Tipo ', 'T')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Animal dominante + MBTI */}
                  {(pdi.perfilComportamental.animais.length > 0 || pdi.perfilComportamental.mbti?.tipo) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {pdi.perfilComportamental.animais.length > 0 && (() => {
                        const top = [...pdi.perfilComportamental.animais].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0))[0]
                        return (
                          <span style={{ fontSize: 11, color: '#475569' }}>
                            {top.emoji} {top.animal}{top.percentual ? ` ${top.percentual}%` : ''}
                          </span>
                        )
                      })()}
                      {pdi.perfilComportamental.mbti?.tipo && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: '2px 7px', borderRadius: 20,
                          backgroundColor: '#1E3A6E', color: '#D1AE6E',
                          letterSpacing: '0.05em',
                        }}>
                          {pdi.perfilComportamental.mbti.tipo}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
