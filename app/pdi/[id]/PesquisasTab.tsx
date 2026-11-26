'use client'

// Aba "Pesquisas" do PDI: respostas das pesquisas internas identificadas, lidas direto do módulo
// Questionários (/api/pdi/[id]/pesquisas). O colaborador vê só as próprias; gestor/admin, de todos.
// A gestão pode ligar a pesquisa inteira ou uma pergunta a uma competência do PDI, com uma
// "leitura" (interpretação) que só a gestão vê. As ligações aparecem na Linha do tempo e no Painel.

import { useState } from 'react'
import type { PdiColaborador } from '../../../data/pdis/types'
import { perguntaVisivel, valoresResposta, PREFIRO_NAO, PREFIRO_NAO_LABEL, type Pergunta, type ValorResposta } from '../../questionarios/types'
import type { Acompanhamento } from './acompanhamento/useAcompanhamento'
import { C, Btn, Pill, Vazio, Collapse, Chev, Carregando, api, fmtData, type Pesquisa, type Vinculo } from './acompanhamento/pdi-ui'

function Resposta({ q, v }: { q: Pergunta; v: ValorResposta | undefined }) {
  const vals = valoresResposta(v)
  if (!vals.length) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Sem resposta</span>
  if (vals[0] === PREFIRO_NAO) return <span style={{ color: C.MU, fontStyle: 'italic', fontSize: 13 }}>{PREFIRO_NAO_LABEL}</span>
  if (q.type === 'escala') {
    const n = Number(vals[0])
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} style={{
              width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
              background: i === n ? C.P : '#F1F5F9', color: i === n ? '#fff' : '#94A3B8',
            }}>{i}</span>
          ))}
        </div>
        {(q.min || q.max) && <span style={{ fontSize: 11.5, color: C.MU }}>1 = {q.min ?? '—'} · 5 = {q.max ?? '—'}</span>}
      </div>
    )
  }
  if (q.type === 'multipla') {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {vals.map(x => <span key={String(x)} className="p2-pill" style={{ fontSize: 12.5, background: '#EBF4FF', color: '#1E40AF', padding: '3px 11px' }}>{String(x)}</span>)}
      </div>
    )
  }
  return <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, background: 'var(--p2-sunken)', borderRadius: 8, padding: '8px 12px' }}>{String(vals[0])}</div>
}

/** Chips das competências ligadas + botão para ligar (gestão). */
function Ligacoes({ pdiId, convite, perguntaId, titulo, dados, gestao, competencias }: {
  pdiId: string; convite: string; perguntaId: string; titulo: string; dados: Acompanhamento; gestao: boolean; competencias: string[]
}) {
  const [aberto, setAberto] = useState(false)
  const [comp, setComp] = useState('')
  const [leitura, setLeitura] = useState('')
  const [salvando, setSalvando] = useState(false)
  const ligs = dados.vinculos.filter(v => v.convite_id === convite && v.pergunta_id === perguntaId)

  async function ligar() {
    if (!comp) return
    setSalvando(true)
    try {
      const v = await api<Vinculo>(`/api/pdi/${pdiId}/vinculos`, 'POST', { convite_id: convite, pergunta_id: perguntaId, competencia: comp, leitura, titulo })
      dados.setVinculos(l => [...l.filter(x => x.id !== v.id), v])
      setComp(''); setLeitura(''); setAberto(false)
    } catch (e) { dados.setErro((e as Error).message) } finally { setSalvando(false) }
  }
  async function desligar(v: Vinculo) {
    try {
      await api(`/api/pdi/${pdiId}/vinculos?v=${v.id}`, 'DELETE')
      dados.setVinculos(l => l.filter(x => x.id !== v.id))
    } catch (e) { dados.setErro((e as Error).message) }
  }

  if (!gestao && ligs.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {ligs.map(v => (
          <span key={v.id} className="p2-pill" style={{ background: '#F5F3FF', color: '#5B21B6' }} title={v.leitura || undefined}>
            🔗 {v.competencia}
            {gestao && <button type="button" onClick={() => desligar(v)} style={{ background: 'none', border: 'none', color: '#8B5CF6', cursor: 'pointer', padding: 0, marginLeft: 2 }} title="Desfazer ligação">×</button>}
          </span>
        ))}
        {gestao && <button type="button" className="p2-link" onClick={() => setAberto(a => !a)}>{aberto ? 'cancelar' : '🔗 ligar a competência'}</button>}
      </div>
      {gestao && ligs.some(v => v.leitura) && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ligs.filter(v => v.leitura).map(v => (
            <div key={v.id} style={{ fontSize: 12.5, color: '#475569', borderLeft: '3px solid #C4B5FD', paddingLeft: 8 }}>
              <b style={{ color: '#5B21B6' }}>{v.competencia}:</b> {v.leitura} <span style={{ color: '#94A3B8' }}>🔒</span>
            </div>
          ))}
        </div>
      )}
      <Collapse open={aberto}>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <select value={comp} onChange={e => setComp(e.target.value)} className="p2-input" style={{ padding: '6px 9px', minWidth: 200 }}>
            <option value="">Escolha a competência…</option>
            {competencias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={leitura} onChange={e => setLeitura(e.target.value)} placeholder="Leitura da gestão (opcional, só gestão vê)" className="p2-input" style={{ flex: 1, minWidth: 220, padding: '6px 9px' }} />
          <Btn sm onClick={ligar} disabled={!comp || salvando}>Ligar</Btn>
        </div>
      </Collapse>
    </div>
  )
}

export default function PesquisasTab({ pdi, papel, dados }: { pdi: PdiColaborador; papel: string; dados: Acompanhamento }) {
  const gestao = papel === 'gestor' || papel === 'admin'
  const [aberta, setAberta] = useState<string | null>(null)
  const competencias = [...new Set([...pdi.matrizAvaliacao.competencias, ...dados.acoes.map(a => a.competencia)])].filter(Boolean).sort()

  if (dados.carregando) return <Carregando txt="Carregando pesquisas…" />
  if (!dados.pesquisasVinculado) return <Vazio>Este PDI ainda não está ligado a um usuário do sistema, então não há pesquisas para mostrar.</Vazio>
  if (!dados.pesquisas.length) return <Vazio><div style={{ fontSize: 30, marginBottom: 8 }}>📝</div>Nenhuma pesquisa interna {gestao ? 'enviada para esta pessoa' : 'enviada para você'} ainda.</Vazio>

  const abertaId = aberta ?? dados.pesquisas.find(p => p.status === 'respondido')?.id ?? null

  return (
    <div>
      <p style={{ fontSize: 13, color: C.MU, margin: '0 0 14px' }}>
        {gestao
          ? 'Respostas desta pessoa nas pesquisas internas identificadas (vêm do módulo Questionários). Ligue perguntas a competências para que apareçam na Linha do tempo e no Painel. A pesquisa anônima nunca aparece aqui.'
          : 'Suas respostas nas pesquisas internas identificadas. Só você, sua liderança e a administração veem estas respostas. A pesquisa anônima nunca aparece aqui.'}
      </p>
      <div className="p2-stagger">
        {dados.pesquisas.map((p: Pesquisa) => {
          const respondida = p.status === 'respondido'
          const isOpen = abertaId === p.id
          const visiveis = respondida ? p.perguntas.filter(q => perguntaVisivel(q, p.perguntas, p.respostas)) : []
          const nLig = dados.vinculos.filter(v => v.convite_id === p.id).length
          return (
            <div key={p.id} className="p2-card is-hover" style={{ marginBottom: 12, overflow: 'hidden' }}>
              <div onClick={() => respondida && setAberta(isOpen ? '' : p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: respondida ? 'pointer' : 'default', padding: '15px 18px' }}>
                {respondida && <Chev open={isOpen} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p.titulo}</div>
                  <div style={{ fontSize: 12, color: C.MU, marginTop: 2 }}>
                    {respondida ? `Respondida em ${fmtData(p.respondido_em)} · ${visiveis.length} pergunta(s)`
                      : p.status === 'enviado' ? `Enviada em ${fmtData(p.enviado_em)} · aguardando resposta`
                        : 'Ainda não enviada'}
                  </div>
                </div>
                {nLig > 0 && <Pill bg="#F5F3FF" color="#5B21B6">🔗 {nLig}</Pill>}
                <Pill bg={respondida ? 'var(--p2-ok-bg)' : '#FFFBEB'} color={respondida ? '#166534' : '#92400E'}>{respondida ? '✔ Respondida' : 'Pendente'}</Pill>
              </div>
              {respondida && (
                <Collapse open={isOpen}>
                  <div style={{ borderTop: '1px solid var(--p2-line-soft)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Ligacoes pdiId={pdi.id} convite={p.id} perguntaId="" titulo={p.titulo} dados={dados} gestao={gestao} competencias={competencias} />
                    {visiveis.map((q, i) => (
                      <div key={q.id} style={{ paddingTop: 12, borderTop: '1px dashed var(--p2-line-soft)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>{i + 1}. {q.label}</div>
                        <Resposta q={q} v={p.respostas[q.id]} />
                        <Ligacoes pdiId={pdi.id} convite={p.id} perguntaId={q.id} titulo={`${p.titulo} · ${q.label}`} dados={dados} gestao={gestao} competencias={competencias} />
                      </div>
                    ))}
                  </div>
                </Collapse>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
