'use client'

// Mapa de competências (Painel): uma linha por competência, alinhada como tabela.
// Coluna central = escala 1–5 com três marcadores (Diretiva ●, Autoavaliação ◆,
// Ambição ○) em faixas separadas e a lacuna (faixa cinza entre o menor e o maior
// valor). Ao lado: andamento das ações, registros e última atividade.
// Paleta validada (scripts/validate_palette.js da skill dataviz): #2A4F96 · #D9730D · #0F9F8F.

import { useState } from 'react'
import type { PdiColaborador } from '../../../../data/pdis/types'
import type { Acompanhamento } from './useAcompanhamento'
import { C, Barra, Vazio, progresso, diasDesde, fmtData } from './pdi-ui'

const SERIES = [
  { k: 'dir', label: 'Diretiva', cor: '#2A4F96', forma: 'circulo' },
  { k: 'auto', label: 'Autoavaliação', cor: '#D9730D', forma: 'losango' },
  { k: 'amb', label: 'Ambição', cor: '#0F9F8F', forma: 'anel' },
] as const
type SerieK = typeof SERIES[number]['k']

type Linha = {
  c: string
  ordem: number
  notas: Partial<Record<SerieK, number>>
  lacuna: number | null       // ambição − diretiva
  acoesAtivas: number
  acoesConcl: number
  etapasPct: number
  etapasTotal: number
  anotacoes: number
  pesquisas: number
  ultima: string | null
}

function Marcador({ forma, cor, size = 12 }: { forma: string; cor: string; size?: number }) {
  const base: React.CSSProperties = { width: size, height: size, boxSizing: 'border-box', display: 'inline-block', flexShrink: 0 }
  if (forma === 'losango') return <span style={{ ...base, background: cor, transform: 'rotate(45deg) scale(.85)', borderRadius: 2, boxShadow: '0 0 0 2px #fff' }} />
  if (forma === 'anel') return <span style={{ ...base, border: `3px solid ${cor}`, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 2px #fff' }} />
  return <span style={{ ...base, background: cor, borderRadius: '50%', boxShadow: '0 0 0 2px #fff' }} />
}

const pos = (v: number) => `${((v - 1) / 4) * 100}%`

function Escala({ l, mostrarValores }: { l: Linha; mostrarValores: boolean }) {
  const vals = SERIES.map(s => l.notas[s.k]).filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return <span style={{ fontSize: 12, color: '#A3B0C4' }}>sem avaliação no ciclo ativo</span>
  const min = Math.min(...vals), max = Math.max(...vals)
  return (
    <div style={{ position: 'relative', height: 34, margin: '0 8px' }}>
      {/* grade 1–5 */}
      {[1, 2, 3, 4, 5].map(v => (
        <span key={v} style={{ position: 'absolute', left: pos(v), top: 2, bottom: 2, width: 1, background: v === 1 || v === 5 ? '#E3E8F0' : '#EEF2F7' }} />
      ))}
      {/* lacuna */}
      {max > min && (
        <span style={{ position: 'absolute', left: pos(min), width: `calc(${pos(max)} - ${pos(min)})`, top: 4, bottom: 4, background: '#E9EEF5', borderRadius: 6, transition: 'all .5s var(--p2-ease-out)' }} />
      )}
      {/* marcadores em três faixas (não se sobrepõem) */}
      {SERIES.map((s, i) => {
        const v = l.notas[s.k]
        if (typeof v !== 'number') return null
        return (
          <span key={s.k} style={{ position: 'absolute', left: pos(v), top: 5 + i * 9, transform: 'translate(-50%, -50%)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3, transition: 'left .5s var(--p2-ease-out)' }}>
            <Marcador forma={s.forma} cor={s.cor} size={11} />
            {mostrarValores && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.TX, position: 'absolute', left: 13 }}>{v}</span>}
          </span>
        )
      })}
    </div>
  )
}

export default function MapaCompetencias({ pdi, dados, onAbrir }: { pdi: PdiColaborador; dados: Acompanhamento; onAbrir: (competencia: string) => void }) {
  const [ordem, setOrdem] = useState<'lacuna' | 'atividade' | 'matriz'>('lacuna')
  const [valores, setValores] = useState(false)
  const [hover, setHover] = useState<string | null>(null)

  const matriz = pdi.matrizAvaliacao.competencias
  const ciclo = dados.ciclos.find(c => c.status === 'ativo') ?? null
  const nota = (arr: number[] | undefined, c: string) => { const i = matriz.indexOf(c); const v = i >= 0 ? arr?.[i] : undefined; return typeof v === 'number' && v > 0 ? v : undefined }

  const nomes = [...new Set([...matriz, ...dados.acoes.map(a => a.competencia), ...dados.anotacoes.map(n => n.competencia), ...dados.vinculos.map(v => v.competencia)])].filter(Boolean)
  const linhas: Linha[] = nomes.map(c => {
    const acs = dados.acoes.filter(a => a.competencia === c)
    const ids = new Set(acs.map(a => a.id))
    const ets = dados.etapas.filter(e => ids.has(e.acao_id) && acs.find(a => a.id === e.acao_id)?.status !== 'Concluído')
    const p = progresso(ets)
    const notas = dados.anotacoes.filter(n => n.competencia === c || (n.acao_id && ids.has(n.acao_id)))
    const vincs = dados.vinculos.filter(v => v.competencia === c)
    const datas = [...acs.map(a => a.updated_at), ...ets.map(e => e.updated_at), ...notas.map(n => n.data), ...vincs.map(v => v.created_at)].filter(Boolean).sort()
    const n: Linha['notas'] = { dir: nota(ciclo?.avaliacao_diretiva, c), auto: nota(ciclo?.autoavaliacao, c), amb: nota(ciclo?.ambicao, c) }
    return {
      c, ordem: matriz.indexOf(c) < 0 ? 999 : matriz.indexOf(c), notas: n,
      lacuna: n.dir !== undefined && n.amb !== undefined ? n.amb - n.dir : null,
      acoesAtivas: acs.filter(a => a.status !== 'Concluído').length, acoesConcl: acs.filter(a => a.status === 'Concluído').length,
      etapasPct: p.pct, etapasTotal: p.total, anotacoes: notas.length, pesquisas: new Set(vincs.map(v => v.convite_id)).size,
      ultima: datas.pop() ?? null,
    }
  }).filter(l => Object.keys(l.notas).some(k => l.notas[k as SerieK] !== undefined) || l.acoesAtivas + l.acoesConcl + l.anotacoes + l.pesquisas > 0)

  const atividade = (l: Linha) => l.acoesAtivas * 3 + l.anotacoes + l.pesquisas
  linhas.sort((a, b) =>
    ordem === 'matriz' ? a.ordem - b.ordem
      : ordem === 'atividade' ? atividade(b) - atividade(a) || a.ordem - b.ordem
        : (b.lacuna ?? -99) - (a.lacuna ?? -99) || atividade(b) - atividade(a))

  const temNotas = linhas.some(l => Object.values(l.notas).some(v => v !== undefined))
  const COLS = 'minmax(150px, 1.1fr) minmax(220px, 2fr) 130px 96px 72px'

  return (
    <div className="p2-card">
      <div className="p2-card-h" style={{ flexWrap: 'wrap' }}>
        <h3>🧭 Mapa de competências</h3>
        <select value={ordem} onChange={e => setOrdem(e.target.value as typeof ordem)} className="p2-input" style={{ padding: '4px 8px', fontSize: 12 }}>
          <option value="lacuna">Ordenar: maior lacuna</option>
          <option value="atividade">Ordenar: mais atividade</option>
          <option value="matriz">Ordenar: ordem da matriz</option>
        </select>
      </div>

      {linhas.length === 0 ? (
        <div className="p2-card-b"><Vazio>Sem avaliações no ciclo ativo e sem ações, anotações ou pesquisas ligadas a competências ainda.</Vazio></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 700 }}>
            {/* Legenda */}
            {temNotas && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '10px 18px 4px', flexWrap: 'wrap', fontSize: 12, color: C.MU }}>
                {SERIES.map(s => <span key={s.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Marcador forma={s.forma} cor={s.cor} size={10} />{s.label}</span>)}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 8, borderRadius: 4, background: '#E9EEF5' }} />lacuna</span>
                <span style={{ color: '#A3B0C4' }}>· ciclo {ciclo?.numero_ciclo ?? '—'}</span>
                <div style={{ flex: 1 }} />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={valores} onChange={e => setValores(e.target.checked)} /> mostrar valores
                </label>
              </div>
            )}

            {/* Cabeçalho */}
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '8px 18px', borderBottom: '1px solid var(--p2-line-soft)' }}>
              <span className="p2-label" style={{ margin: 0 }}>Competência</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0 8px' }}>
                {[1, 2, 3, 4, 5].map(v => <span key={v} className="p2-label" style={{ margin: 0, width: 0, display: 'flex', justifyContent: 'center' }}>{v}</span>)}
              </div>
              <span className="p2-label" style={{ margin: 0 }}>Ações</span>
              <span className="p2-label" style={{ margin: 0 }}>Registros</span>
              <span className="p2-label" style={{ margin: 0, textAlign: 'right' }}>Última</span>
            </div>

            {/* Linhas */}
            {linhas.map(l => {
              const dias = l.ultima ? diasDesde(l.ultima) : null
              const on = hover === l.c
              return (
                <div key={l.c} onClick={() => onAbrir(l.c)} onMouseEnter={() => setHover(l.c)} onMouseLeave={() => setHover(null)}
                  title="Abrir a linha do tempo desta competência"
                  style={{ position: 'relative', display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center', padding: '6px 18px', cursor: 'pointer', borderBottom: '1px solid var(--p2-line-soft)', background: on ? '#F7F9FC' : undefined, transition: 'background-color .2s' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.c}</div>
                    {l.lacuna !== null && l.lacuna > 0 && <div style={{ fontSize: 11, color: C.MU }}>lacuna +{l.lacuna}</div>}
                  </div>
                  <Escala l={l} mostrarValores={valores} />
                  <div style={{ fontSize: 12, color: C.MU }}>
                    {l.acoesAtivas + l.acoesConcl === 0 ? <span style={{ color: '#A3B0C4' }}>—</span> : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Barra pct={l.etapasTotal ? l.etapasPct : l.acoesAtivas ? 0 : 100} />
                          <span style={{ width: 30, textAlign: 'right', color: C.TX, fontWeight: 600 }}>{l.etapasTotal ? `${l.etapasPct}%` : ''}</span>
                        </div>
                        <div style={{ marginTop: 2 }}>{l.acoesAtivas} ativa{l.acoesAtivas === 1 ? '' : 's'}{l.acoesConcl ? ` · ${l.acoesConcl} concl.` : ''}</div>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.MU, display: 'flex', gap: 8 }}>
                    {l.anotacoes + l.pesquisas === 0 ? <span style={{ color: '#A3B0C4' }}>—</span> : (
                      <>
                        {l.anotacoes > 0 && <span title="Anotações do Diário">📓 {l.anotacoes}</span>}
                        {l.pesquisas > 0 && <span title="Pesquisas ligadas">📝 {l.pesquisas}</span>}
                      </>
                    )}
                  </div>
                  <span style={{ fontSize: 12, textAlign: 'right', color: dias !== null && dias > 30 ? C.WARN : C.MU }} title={l.ultima ? fmtData(l.ultima) : undefined}>
                    {dias === null ? '—' : dias === 0 ? 'hoje' : `${dias}d`}
                  </span>

                  {/* Tooltip da linha */}
                  {on && Object.values(l.notas).some(v => v !== undefined) && (
                    <div style={{ position: 'absolute', left: 'calc(150px + 18px + 12px)', bottom: 'calc(100% - 4px)', zIndex: 5, background: '#1E293B', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, boxShadow: '0 6px 16px rgba(15,23,42,.25)', pointerEvents: 'none', whiteSpace: 'nowrap', animation: 'p2In .2s var(--p2-ease-out) both' }}>
                      {SERIES.map(s => <span key={s.k} style={{ marginRight: 10 }}>{s.label} <b>{l.notas[s.k] ?? '—'}</b></span>)}
                      {l.lacuna !== null && <span style={{ color: '#CBD5E1' }}>lacuna {l.lacuna > 0 ? '+' : ''}{l.lacuna}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
