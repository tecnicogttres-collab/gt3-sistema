'use client'

// Diário de acompanhamento (só gestão), dentro da Visão geral: anotações datadas por
// tipo, em texto rico (cor da fonte, grifo, negrito…), ligadas a uma ação ou
// competência. Cada anotação pode ser compartilhada com o colaborador (aparece em
// "Recados" na visão dele). "Investigar" vira pergunta aberta até ser respondida.

import { useState } from 'react'
import type { PdiColaborador } from '../../../../data/pdis/types'
import type { Acompanhamento } from './useAcompanhamento'
import { C, Btn, Pill, Vazio, Collapse, Chev, TIPOS, Autor, api, fmtData, hojeISO, type Anotacao, type TipoAnotacao } from './pdi-ui'
import { RichEditor, RichView } from './RichText'

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type Rascunho = { tipo: TipoAnotacao; data: string; texto: string; visivel: boolean; acao_id: string; competencia: string }
const novoRascunho = (tipo: TipoAnotacao = 'observacao'): Rascunho => ({ tipo, data: hojeISO(), texto: '', visivel: false, acao_id: '', competencia: '' })

export function Visibilidade({ visivel, nome, onChange }: { visivel: boolean; nome: string; onChange?: (v: boolean) => void }) {
  const st = visivel ? { bg: '#E8F7F0', color: '#047857', txt: `👁 ${nome} vê` } : { bg: '#EEF2F7', color: '#475569', txt: '🔒 Só gestão' }
  return (
    <button type="button" disabled={!onChange} onClick={() => onChange?.(!visivel)} title={onChange ? (visivel ? 'Compartilhada com o colaborador. Clique para deixar só com a gestão.' : 'Clique para compartilhar com o colaborador (aparece em Recados).') : undefined}
      className="p2-pill" style={{ background: st.bg, color: st.color, border: 'none', cursor: onChange ? 'pointer' : 'default', transition: 'background-color .25s, color .25s' }}>
      {st.txt}
    </button>
  )
}

/** Campo de nova anotação. Reutilizado na conversa do ciclo (Avaliações) com cicloId e tipos restritos. */
export function Composer({ pdi, dados, primeiroNome, cicloId, tipos, tipoInicial = 'observacao', compacto }: {
  pdi: PdiColaborador; dados: Acompanhamento; primeiroNome: string
  cicloId?: string; tipos?: TipoAnotacao[]; tipoInicial?: TipoAnotacao; compacto?: boolean
}) {
  const [r, setR] = useState<Rascunho>(novoRascunho(tipoInicial))
  const [ligar, setLigar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [chave, setChave] = useState(0) // remonta o editor depois de salvar
  const m = TIPOS[r.tipo]

  async function salvar() {
    if (!r.texto.trim()) { setErro('Escreva a anotação.'); return }
    setSalvando(true); setErro('')
    try {
      // Pauta e conversa ficam ligadas ao ciclo (o informado ou o ativo) e aparecem também em Avaliações
      const ciclo = cicloId ?? ((r.tipo === 'pauta' || r.tipo === 'conversa') ? dados.ciclos.find(c => c.status === 'ativo')?.id : undefined)
      const n = await api<Anotacao>(`/api/pdi/${pdi.id}/anotacoes`, 'POST', { ...r, ciclo_id: ciclo })
      dados.setAnotacoes(l => [n, ...l])
      setR(novoRascunho(r.tipo)); setLigar(false); setChave(k => k + 1)
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  return (
    <div style={compacto ? undefined : { borderBottom: '1px solid var(--p2-line-soft)', padding: '12px 16px 14px' }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {(tipos ?? (Object.keys(TIPOS) as TipoAnotacao[])).map(t => {
          const x = TIPOS[t], on = r.tipo === t
          return (
            <button key={t} type="button" onClick={() => setR({ ...r, tipo: t, visivel: t === 'investigar' ? false : r.visivel })} className="p2-chip"
              title={x.label} style={{ padding: '4px 10px', fontSize: 11.5, ...(on ? { borderColor: x.color, background: x.bg, color: x.color } : {}) }}>
              {x.icon} {on ? x.label : ''}
            </button>
          )
        })}
      </div>
      <div style={{ borderLeft: `3px solid ${m.color}`, borderRadius: 10, transition: 'border-color .3s' }}>
        <RichEditor key={chave} value="" onChange={html => setR(p => ({ ...p, texto: html }))} onCtrlEnter={salvar}
          placeholder={r.tipo === 'investigar' ? 'Pergunta para levar à próxima conversa…' : r.tipo === 'conversa' ? 'O que foi conversado, combinado e próximos passos…' : `${m.label}… (Ctrl+Enter registra)`} />
      </div>
      <Collapse open={ligar}>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <select value={r.acao_id} onChange={e => setR({ ...r, acao_id: e.target.value })} className="p2-input" style={{ flex: 1, minWidth: 150, padding: '5px 8px', fontSize: 12 }}>
            <option value="">Sem ação ligada</option>
            {dados.acoes.map(a => <option key={a.id} value={a.id}>🎯 {a.competencia}</option>)}
          </select>
          {pdi.matrizAvaliacao.competencias.length > 0 && (
            <select value={r.competencia} onChange={e => setR({ ...r, competencia: e.target.value })} className="p2-input" style={{ flex: 1, minWidth: 150, padding: '5px 8px', fontSize: 12 }}>
              <option value="">Sem competência</option>
              {pdi.matrizAvaliacao.competencias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </Collapse>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <input type="date" value={r.data} onChange={e => setR({ ...r, data: e.target.value })} className="p2-input" style={{ width: 128, padding: '4px 7px', fontSize: 12 }} />
        {!cicloId && <button type="button" className={'p2-icon-btn' + (ligar || r.acao_id || r.competencia ? ' is-on' : '')} title="Ligar a uma ação ou competência" onClick={() => setLigar(l => !l)}>🔗</button>}
        {r.tipo !== 'investigar' && <Visibilidade visivel={r.visivel} nome={primeiroNome} onChange={v => setR({ ...r, visivel: v })} />}
        <div style={{ flex: 1 }} />
        <Btn sm onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</Btn>
      </div>
      {erro && <div style={{ fontSize: 12, color: C.NO, marginTop: 6 }}>{erro}</div>}
    </div>
  )
}

function Investigar({ pdi, dados }: { pdi: PdiColaborador; dados: Acompanhamento }) {
  const [respondendo, setRespondendo] = useState<{ id: string; txt: string } | null>(null)
  const [verResolvidos, setVerResolvidos] = useState(false)
  const itens = dados.anotacoes.filter(n => n.tipo === 'investigar')
  const abertos = itens.filter(n => !n.resolvido)
  const resolvidos = itens.filter(n => n.resolvido)
  if (itens.length === 0) return null

  async function resolver(n: Anotacao, resposta: string, resolvido: boolean) {
    try {
      const s = await api<Anotacao>(`/api/pdi/${pdi.id}/anotacoes/${n.id}`, 'PATCH', { resposta, resolvido })
      dados.setAnotacoes(l => l.map(x => x.id === s.id ? s : x)); setRespondendo(null)
    } catch (e) { dados.setErro((e as Error).message) }
  }

  return (
    <div style={{ background: '#FFFDF5', borderBottom: '1px solid #F3E3B0', padding: '10px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ fontSize: 13, color: '#854D0E', flex: 1 }}>❓ A investigar na conversa</b>
        <Pill bg="#FEF3C7" color="#92400E">{abertos.length} em aberto</Pill>
      </div>
      {abertos.map(n => (
        <div key={n.id} style={{ padding: '8px 0', borderTop: '1px dashed #F3E3B0', marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}><RichView html={n.texto} style={{ fontSize: 13 }} /></div>
            {respondendo?.id !== n.id && <button type="button" className="p2-link" onClick={() => setRespondendo({ id: n.id, txt: n.resposta })}>responder</button>}
          </div>
          <Collapse open={respondendo?.id === n.id}>
            <div style={{ marginTop: 6 }}>
              <textarea value={respondendo?.id === n.id ? respondendo.txt : ''} onChange={e => setRespondendo({ id: n.id, txt: e.target.value })} rows={2}
                placeholder="O que se descobriu…" className="p2-input" style={{ width: '100%', fontSize: 12.5 }} />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                <Btn sm v="gho" onClick={() => setRespondendo(null)}>Cancelar</Btn>
                <Btn sm v="ok" onClick={() => respondendo && resolver(n, respondendo.txt, true)}>✓ Respondido</Btn>
              </div>
            </div>
          </Collapse>
        </div>
      ))}
      {resolvidos.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button type="button" onClick={() => setVerResolvidos(v => !v)} className="p2-link" style={{ color: '#92400E', fontSize: 11.5 }}>
            <Chev open={verResolvidos} /> {resolvidos.length} respondido{resolvidos.length > 1 ? 's' : ''}
          </button>
          <Collapse open={verResolvidos}>
            {resolvidos.map(n => (
              <div key={n.id} style={{ fontSize: 12, padding: '5px 0' }}>
                <div style={{ color: C.MU, textDecoration: 'line-through' }}><RichView html={n.texto} style={{ fontSize: 12, color: C.MU }} /></div>
                <div style={{ color: '#166534' }}>✓ {n.resposta || 'Respondido'} · {fmtData(n.resolvido_em)}
                  <button type="button" onClick={() => resolver(n, n.resposta, false)} className="p2-link" style={{ marginLeft: 6, fontSize: 11 }}>reabrir</button>
                </div>
              </div>
            ))}
          </Collapse>
        </div>
      )}
    </div>
  )
}

/** Uma anotação com autoria. Reutilizada na conversa do ciclo (Avaliações). */
export function Nota({ n, pdi, dados, primeiroNome, semCiclo }: { n: Anotacao; pdi: PdiColaborador; dados: Acompanhamento; primeiroNome: string; semCiclo?: boolean }) {
  const [editando, setEditando] = useState(false)
  const [txt, setTxt] = useState(n.texto)
  const [confirma, setConfirma] = useState(false)
  const m = TIPOS[n.tipo] ?? TIPOS.observacao
  const acao = n.acao_id ? dados.acoes.find(a => a.id === n.acao_id) : null
  const ciclo = n.ciclo_id ? dados.ciclos.find(c => c.id === n.ciclo_id) : null

  async function patch(campos: Partial<Anotacao>) {
    try {
      const s = await api<Anotacao>(`/api/pdi/${pdi.id}/anotacoes/${n.id}`, 'PATCH', campos)
      dados.setAnotacoes(l => l.map(x => x.id === s.id ? s : x)); setEditando(false)
    } catch (e) { dados.setErro((e as Error).message) }
  }
  async function excluir() {
    try {
      await api(`/api/pdi/${pdi.id}/anotacoes/${n.id}`, 'DELETE')
      dados.setAnotacoes(l => l.filter(x => x.id !== n.id))
    } catch (e) { dados.setErro((e as Error).message) }
  }

  return (
    <div className="p2-nota" style={{ padding: '11px 16px', borderTop: '1px solid var(--p2-line-soft)', borderLeft: `3px solid ${m.color}` }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Autor nome={n.autor_nome} criado={n.created_at} editado={n.updated_at} referente={n.data} />
        <div style={{ flex: 1 }} />
        <Pill bg={m.bg} color={m.color}>{m.icon} {m.label}</Pill>
        {n.tipo !== 'investigar' && <Visibilidade visivel={n.visivel} nome={primeiroNome} onChange={v => patch({ visivel: v })} />}
        {!editando && (
          <span className="p2-nota-acoes">
            <button type="button" className="p2-icon-btn" title="Editar" onClick={() => setEditando(true)}>✎</button>
            {confirma
              ? <Btn sm v="danger" onClick={excluir}>Excluir</Btn>
              : <button type="button" className="p2-icon-btn" title="Excluir" onClick={() => { setConfirma(true); setTimeout(() => setConfirma(false), 3000) }}>✕</button>}
          </span>
        )}
      </div>
      {editando ? (
        <div style={{ marginTop: 8 }}>
          <RichEditor value={n.texto} onChange={setTxt} autoFocus onCtrlEnter={() => txt.trim() && patch({ texto: txt })} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
            <Btn sm v="gho" onClick={() => { setTxt(n.texto); setEditando(false) }}>Cancelar</Btn>
            <Btn sm onClick={() => txt.trim() && patch({ texto: txt })}>Salvar</Btn>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 5 }}><RichView html={n.texto} /></div>
      )}
      {(acao || n.competencia || (ciclo && !semCiclo)) && (
        <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
          {ciclo && !semCiclo && <Pill bg="var(--p2-gold-bg)" color="#92400E">🔄 Ciclo {ciclo.numero_ciclo}</Pill>}
          {acao && <Pill bg="#EEF2FF" color="#3730A3">🎯 {acao.competencia}</Pill>}
          {n.competencia && <Pill bg="#EEF2F7" color="#334155">{n.competencia}</Pill>}
        </div>
      )}
    </div>
  )
}

/** Diário compacto para a coluna lateral da Visão geral (só gestão). */
export default function DiarioPainel({ pdi, dados }: { pdi: PdiColaborador; dados: Acompanhamento }) {
  const [filtro, setFiltro] = useState<TipoAnotacao | 'todos'>('todos')
  const [limite, setLimite] = useState(6)
  const primeiroNome = pdi.nome.split(' ')[0]

  const semInvestigar = dados.anotacoes.filter(n => n.tipo !== 'investigar')
  const lista = semInvestigar.filter(n => filtro === 'todos' || n.tipo === filtro)
  const tiposUsados = (Object.keys(TIPOS) as TipoAnotacao[]).filter(t => t !== 'investigar' && semInvestigar.some(n => n.tipo === t))

  return (
    <div className="p2-card" style={{ overflow: 'hidden' }}>
      <div className="p2-card-h">
        <h3>📓 Diário de acompanhamento</h3>
        <Pill bg="#EEF2F7" color="#475569">🔒 só gestão</Pill>
      </div>
      <Composer pdi={pdi} dados={dados} primeiroNome={primeiroNome} />
      <Investigar pdi={pdi} dados={dados} />

      {tiposUsados.length > 1 && (
        <div style={{ display: 'flex', gap: 5, padding: '10px 16px 8px', overflowX: 'auto' }}>
          {(['todos', ...tiposUsados] as (TipoAnotacao | 'todos')[]).map(t => {
            const on = filtro === t
            return (
              <button key={t} type="button" onClick={() => { setFiltro(t); setLimite(6) }} className="p2-chip"
                style={{ padding: '3px 9px', fontSize: 11.5, flexShrink: 0, ...(on ? { borderColor: C.P, background: 'var(--p2-blue-bg)', color: C.P } : {}) }}>
                {t === 'todos' ? 'Todas' : `${TIPOS[t].icon} ${TIPOS[t].label}`}
              </button>
            )
          })}
        </div>
      )}

      {lista.length === 0 ? (
        <div style={{ padding: '6px 16px 16px' }}><Vazio>Nada registrado ainda. Use o campo acima para conversas, feedbacks, conquistas e observações do dia a dia.</Vazio></div>
      ) : (
        <div className="p2-stagger" key={filtro}>
          {lista.slice(0, limite).map(n => <Nota key={n.id} n={n} pdi={pdi} dados={dados} primeiroNome={primeiroNome} />)}
          {lista.length > limite && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--p2-line-soft)', textAlign: 'center' }}>
              <button type="button" className="p2-link" onClick={() => setLimite(l => l + 10)}>Ver mais ({lista.length - limite})</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
