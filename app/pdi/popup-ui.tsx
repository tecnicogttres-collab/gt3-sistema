'use client'

// Formulário de um pop-up do PDI: o mesmo componente no pop-up real (colaborador)
// e na prévia da configuração (gestão). Classes em [id]/acompanhamento/pdi.css.

import { HUMOR, type Pergunta } from '../lib/pdi-popup'
import { SITUACOES, type Situacao } from '../lib/pdi-checkin'

export type AcaoItem = { id: string; competencia: string; proximas: string[] }
export type PerguntaComItens = Pergunta & { itens?: AcaoItem[] }
export type Valores = Record<string, unknown>

type Nota = { valor?: number | string; nota?: string }

function Comentario({ valor, onChange, placeholder, disabled }: { valor: string; onChange: (s: string) => void; placeholder: string; disabled?: boolean }) {
  return <input className="p2-input" style={{ width: '100%', marginTop: 8 }} value={valor} disabled={disabled} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
}

function Bloco({ q, cor, children }: { q: Pergunta; cor: string; children: React.ReactNode }) {
  return (
    <div className="p2-card" style={{ padding: '12px 14px', boxShadow: 'none' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
        {q.texto}{q.obrigatoria && <span style={{ color: cor, marginLeft: 4 }} title="Obrigatória">*</span>}
      </div>
      {children}
    </div>
  )
}

export function PopupFormulario({ perguntas, cor, valores, setValores, disabled }: {
  perguntas: PerguntaComItens[]; cor: string; valores: Valores; setValores: (f: (v: Valores) => Valores) => void; disabled?: boolean
}) {
  const set = (id: string, v: unknown) => setValores(p => ({ ...p, [id]: v }))
  const chipOn = (on: boolean, c = cor): React.CSSProperties => on ? { borderColor: c, background: c + '18', color: c } : {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {perguntas.map(q => {
        const v = valores[q.id]
        switch (q.tipo) {
          case 'acoes': {
            const mapa = (v ?? {}) as Record<string, { situacao: Situacao; nota: string }>
            const itens = q.itens ?? []
            return (
              <Bloco key={q.id} q={q} cor={cor}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {itens.length === 0 && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>(as ações ativas aparecem aqui)</div>}
                  {itens.map(a => {
                    const r = mapa[a.id]
                    return (
                      <div key={a.id} style={{ borderTop: '1px dashed var(--p2-line-soft)', paddingTop: 8 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 650 }}>🎯 {a.competencia}</div>
                        {q.proximoPasso !== false && a.proximas.length > 0 && <div style={{ fontSize: 12, color: 'var(--p2-mu)', marginTop: 2 }}>Próximo passo: {a.proximas.join(' · ')}</div>}
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          {(Object.keys(SITUACOES) as Situacao[]).map(s => {
                            const m = SITUACOES[s], on = r?.situacao === s
                            return (
                              <button key={s} type="button" className="p2-chip" disabled={disabled} style={{ flex: 1, minWidth: 104, ...chipOn(on, m.cor) }}
                                onClick={() => {
                                  const novo = { ...mapa }
                                  if (on) delete novo[a.id]; else novo[a.id] = { situacao: s, nota: mapa[a.id]?.nota ?? '' }
                                  set(q.id, novo)
                                }}>{m.icon} {m.label}</button>
                            )
                          })}
                        </div>
                        {q.nota !== false && r && <Comentario disabled={disabled} valor={r.nota ?? ''} onChange={t => set(q.id, { ...mapa, [a.id]: { ...r, nota: t } })}
                          placeholder={r.situacao === 'travei' ? 'O que travou? Do que você precisa?' : r.situacao === 'avancei' ? 'O que você fez? (opcional)' : 'Algum motivo? (opcional)'} />}
                      </div>
                    )
                  })}
                </div>
              </Bloco>
            )
          }
          case 'humor': {
            const x = (v ?? {}) as Nota
            return (
              <Bloco key={q.id} q={q} cor={cor}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                  {HUMOR.map(h => {
                    const on = x.valor === h.v
                    return (
                      <button key={h.v} type="button" disabled={disabled} title={h.l} onClick={() => set(q.id, on ? undefined : { ...x, valor: h.v })}
                        className="p2-humor" style={on ? { borderColor: cor, background: cor + '18', transform: 'scale(1.08)' } : undefined}>
                        <span style={{ fontSize: 28, filter: x.valor && !on ? 'grayscale(.7)' : undefined, opacity: x.valor && !on ? .55 : 1 }}>{h.e}</span>
                        <span style={{ fontSize: 10.5, color: on ? cor : 'var(--p2-mu)', fontWeight: on ? 700 : 500 }}>{h.l}</span>
                      </button>
                    )
                  })}
                </div>
                {q.nota !== false && !!x.valor && <Comentario disabled={disabled} valor={x.nota ?? ''} onChange={t => set(q.id, { ...x, nota: t })} placeholder="Quer contar mais? (opcional)" />}
              </Bloco>
            )
          }
          case 'escala': {
            const x = (v ?? {}) as Nota
            return (
              <Bloco key={q.id} q={q} cor={cor}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const on = x.valor === n
                    return <button key={n} type="button" disabled={disabled} className="p2-chip" onClick={() => set(q.id, on ? undefined : { ...x, valor: n })} style={{ flex: 1, fontSize: 15, fontWeight: 800, ...chipOn(on) }}>{n}</button>
                  })}
                </div>
                {(q.min || q.max) && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--p2-mu)', marginTop: 4 }}><span>1 · {q.min}</span><span>{q.max} · 5</span></div>}
                {q.nota && !!x.valor && <Comentario disabled={disabled} valor={x.nota ?? ''} onChange={t => set(q.id, { ...x, nota: t })} placeholder="Comentário (opcional)" />}
              </Bloco>
            )
          }
          case 'unica':
          case 'multipla': {
            const multi = q.tipo === 'multipla'
            const sel = multi ? ((v as string[]) ?? []) : v as string | undefined
            return (
              <Bloco key={q.id} q={q} cor={cor}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(q.opcoes ?? []).map(o => {
                    const on = multi ? (sel as string[]).includes(o) : sel === o
                    return (
                      <button key={o} type="button" disabled={disabled} className="p2-chip" style={chipOn(on)}
                        onClick={() => multi ? set(q.id, on ? (sel as string[]).filter(x => x !== o) : [...(sel as string[]), o]) : set(q.id, on ? undefined : o)}>
                        {multi ? (on ? '☑ ' : '☐ ') : (on ? '● ' : '○ ')}{o}
                      </button>
                    )
                  })}
                </div>
              </Bloco>
            )
          }
          case 'simnao': {
            const x = (v ?? {}) as Nota
            return (
              <Bloco key={q.id} q={q} cor={cor}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['sim', '👍 Sim'], ['nao', '👎 Não']].map(([k, l]) => {
                    const on = x.valor === k
                    return <button key={k} type="button" disabled={disabled} className="p2-chip" style={{ flex: 1, fontSize: 13.5, ...chipOn(on) }} onClick={() => set(q.id, on ? undefined : { ...x, valor: k })}>{l}</button>
                  })}
                </div>
                {q.nota !== false && !!x.valor && <Comentario disabled={disabled} valor={x.nota ?? ''} onChange={t => set(q.id, { ...x, nota: t })} placeholder="Quer explicar? (opcional)" />}
              </Bloco>
            )
          }
          case 'texto':
            return (
              <Bloco key={q.id} q={q} cor={cor}>
                <textarea className="p2-input" rows={3} style={{ width: '100%' }} disabled={disabled} value={(v as string) ?? ''} onChange={e => set(q.id, e.target.value)} placeholder="Escreva aqui…" />
              </Bloco>
            )
        }
      })}
    </div>
  )
}

/** Resumo de uma resposta, em texto curto (painel de respostas, Linha do tempo). */
export function resumoResposta(q: Pergunta, v: unknown, nomeAcao?: (id: string) => string): string {
  if (v === undefined || v === null || v === '') return '—'
  switch (q.tipo) {
    case 'acoes': return Object.entries(v as Record<string, { situacao: Situacao; nota?: string }>).map(([id, x]) => `${SITUACOES[x.situacao]?.icon ?? ''} ${nomeAcao?.(id) ?? 'ação'}${x.nota ? ` (${x.nota})` : ''}`).join(' · ')
    case 'humor': { const x = v as Nota; const h = HUMOR.find(h => h.v === x.valor); return `${h?.e ?? ''} ${h?.l ?? ''}${x.nota ? ` · ${x.nota}` : ''}` }
    case 'escala': { const x = v as Nota; return `${x.valor}/5${x.nota ? ` · ${x.nota}` : ''}` }
    case 'simnao': { const x = v as Nota; return `${x.valor === 'sim' ? '👍 Sim' : '👎 Não'}${x.nota ? ` · ${x.nota}` : ''}` }
    case 'multipla': return (v as string[]).join(', ')
    default: return String(v)
  }
}
