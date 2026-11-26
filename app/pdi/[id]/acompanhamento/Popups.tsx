'use client'

// Pop-ups de acompanhamento (gestão): vários por PDI, cada um com perguntas e agenda
// próprias. Lista com ligar/pausar, modelos prontos, editor (Conteúdo · Quando ·
// Aparência e comportamento · Prévia) e painel de respostas.

import { useMemo, useState } from 'react'
import type { PdiColaborador } from '../../../../data/pdis/types'
import type { Acompanhamento } from './useAcompanhamento'
import { C, Btn, Pill, Modal, Alerta, Vazio, api, type PopupGestao } from './pdi-ui'
import {
  TIPOS_PERGUNTA, TIPOS_AGENDA, DIAS_CURTOS, CORES_POPUP, ICONES_POPUP, HUMOR,
  perguntaPadrao, modelos, proximasAberturas, resumoAgenda, fmtQuando, hojeSP,
  type Popup, type Pergunta, type TipoPergunta, type TipoAgenda,
} from '../../../lib/pdi-popup'
import { PopupFormulario, resumoResposta, type Valores } from '../../popup-ui'

type Rascunho = Omit<Popup, 'id' | 'pdi_id'> & { id?: string }

// ── Peças ────────────────────────────────────────────────────────────

function Interruptor({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} title={on ? 'Ligado: clique para pausar' : 'Pausado: clique para ligar'}
      style={{ width: 38, height: 22, borderRadius: 99, border: 'none', padding: 2, cursor: 'pointer', background: on ? C.OK : '#CBD5E1', transition: 'background-color .25s', flexShrink: 0 }}>
      <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transform: on ? 'translateX(16px)' : 'none', transition: 'transform .25s var(--p2-ease-out)' }} />
    </button>
  )
}

function DiasSemana({ valor, onChange }: { valor: number[]; onChange: (d: number[]) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5, 6, 0].map(d => {
        const on = valor.includes(d)
        return <button key={d} type="button" className="p2-chip" onClick={() => onChange(on ? valor.filter(x => x !== d) : [...valor, d])}
          style={{ padding: '5px 10px', ...(on ? { borderColor: C.P, background: 'var(--p2-blue-bg)', color: C.P } : {}) }}>{DIAS_CURTOS[d]}</button>
      })}
    </div>
  )
}

// ── Editor ───────────────────────────────────────────────────────────

function EditorPergunta({ q, acoes, onChange, onRemover, onMover, primeira, ultima }: {
  q: Pergunta; acoes: { id: string; competencia: string }[]; onChange: (q: Pergunta) => void; onRemover: () => void; onMover: (d: -1 | 1) => void; primeira: boolean; ultima: boolean
}) {
  const t = TIPOS_PERGUNTA[q.tipo]
  const set = (c: Partial<Pergunta>) => onChange({ ...q, ...c })
  return (
    <div className="p2-card" style={{ boxShadow: 'none', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="p2-ordem" style={{ opacity: 1 }}>
          <button type="button" disabled={primeira} onClick={() => onMover(-1)}>▲</button>
          <button type="button" disabled={ultima} onClick={() => onMover(1)}>▼</button>
        </span>
        <Pill bg="var(--p2-sunken)" color="#334155">{t.icon} {t.label}</Pill>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: C.MU, display: 'inline-flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={q.obrigatoria} onChange={e => set({ obrigatoria: e.target.checked })} /> obrigatória
        </label>
        <button type="button" className="p2-icon-btn" onClick={onRemover} title="Remover pergunta">✕</button>
      </div>
      <input className="p2-input" style={{ width: '100%', marginTop: 8, fontWeight: 600 }} value={q.texto} onChange={e => set({ texto: e.target.value })} placeholder="Texto da pergunta" />

      {(q.tipo === 'unica' || q.tipo === 'multipla') && (
        <div style={{ marginTop: 8 }}>
          <span className="p2-label">Opções (uma por linha)</span>
          <textarea className="p2-input" rows={3} style={{ width: '100%' }} value={(q.opcoes ?? []).join('\n')} onChange={e => set({ opcoes: e.target.value.split('\n') })} />
        </div>
      )}
      {q.tipo === 'escala' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <input className="p2-input" value={q.min ?? ''} onChange={e => set({ min: e.target.value })} placeholder="Rótulo do 1 (ex.: Muito difícil)" />
          <input className="p2-input" value={q.max ?? ''} onChange={e => set({ max: e.target.value })} placeholder="Rótulo do 5 (ex.: Excelente)" />
        </div>
      )}
      {q.tipo === 'acoes' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5 }}>
            <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><input type="radio" checked={!q.acoes} onChange={() => set({ acoes: null })} /> Todas as ações ativas (inclui as criadas depois)</label>
            <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><input type="radio" checked={!!q.acoes} onChange={() => set({ acoes: acoes.map(a => a.id) })} /> Só algumas</label>
          </div>
          {q.acoes && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {acoes.length === 0 && <span style={{ fontSize: 12, color: C.MU }}>Nenhuma ação ativa.</span>}
              {acoes.map(a => {
                const on = q.acoes!.includes(a.id)
                return <button key={a.id} type="button" className="p2-chip" onClick={() => set({ acoes: on ? q.acoes!.filter(x => x !== a.id) : [...q.acoes!, a.id] })}
                  style={on ? { borderColor: C.P, background: 'var(--p2-blue-bg)', color: C.P } : undefined}>{on ? '☑' : '☐'} {a.competencia}</button>
              })}
            </div>
          )}
          <label style={{ fontSize: 12, color: C.MU, display: 'inline-flex', gap: 5, alignItems: 'center', marginTop: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={q.proximoPasso !== false} onChange={e => set({ proximoPasso: e.target.checked })} /> mostrar o próximo passo de cada ação como lembrete
          </label>
        </div>
      )}
      {(q.tipo === 'acoes' || q.tipo === 'humor' || q.tipo === 'escala' || q.tipo === 'simnao') && (
        <label style={{ fontSize: 12, color: C.MU, display: 'flex', gap: 5, alignItems: 'center', marginTop: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={q.tipo === 'escala' ? !!q.nota : q.nota !== false} onChange={e => set({ nota: e.target.checked })} /> permitir comentário
        </label>
      )}
    </div>
  )
}

function Editor({ pdi, dados, inicial, onFechar, onSalvo }: { pdi: PdiColaborador; dados: Acompanhamento; inicial: Rascunho; onFechar: () => void; onSalvo: (p: PopupGestao) => void }) {
  const [r, setR] = useState<Rascunho>(inicial)
  const [aba, setAba] = useState<'conteudo' | 'quando' | 'aparencia' | 'previa'>('conteudo')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [valoresPrevia, setValoresPrevia] = useState<Valores>({})
  const [novaData, setNovaData] = useState('')
  const ativas = dados.acoes.filter(a => a.status !== 'Concluído')
  const ag = r.agenda
  const setAg = (c: Partial<typeof ag>) => setR({ ...r, agenda: { ...ag, ...c } })
  const proximas = useMemo(() => proximasAberturas({ id: r.id ?? 'previa', agenda: ag }, 6), [r.id, ag])

  const problemas = [
    !r.titulo.trim() && 'Dê um título.',
    r.perguntas.length === 0 && 'Adicione pelo menos uma pergunta.',
    r.perguntas.some(q => !q.texto.trim()) && 'Há pergunta sem texto.',
    r.perguntas.some(q => (q.tipo === 'unica' || q.tipo === 'multipla') && (q.opcoes ?? []).filter(o => o.trim()).length < 2) && 'Escolha única/múltipla precisa de 2 opções ou mais.',
    ['semanal', 'quinzenal', 'aleatoria'].includes(ag.tipo) && ag.dias.length === 0 && 'Escolha ao menos um dia da semana.',
    ag.tipo === 'datas' && ag.datas.length === 0 && 'Marque ao menos uma data.',
    ag.hora_fim <= ag.hora_ini && 'O fim da janela precisa ser depois do início.',
  ].filter(Boolean) as string[]

  async function salvar(ligar?: boolean) {
    if (problemas.length) { setErro(problemas[0]); return }
    setSalvando(true); setErro('')
    try {
      const body = { ...r, ativo: ligar ?? r.ativo }
      const p = r.id ? await api<Popup>(`/api/pdi/${pdi.id}/popups/${r.id}`, 'PATCH', body) : await api<Popup>(`/api/pdi/${pdi.id}/popups`, 'POST', body)
      // recarrega a lista para vir com aberturas calculadas no servidor
      const lista = await api<PopupGestao[]>(`/api/pdi/${pdi.id}/popups`, 'GET')
      onSalvo(lista.find(x => x.id === p.id) ?? (p as PopupGestao))
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  const previaPerguntas = r.perguntas.map(q => q.tipo !== 'acoes' ? q : {
    ...q, itens: ativas.filter(a => !q.acoes || q.acoes.includes(a.id)).map(a => ({
      id: a.id, competencia: a.competencia,
      proximas: dados.etapas.filter(e => e.acao_id === a.id && e.status !== 'ok' && e.status !== 'na').sort((x, y) => x.ordem - y.ordem).slice(0, 2).map(e => e.titulo),
    })),
  })

  const ABAS = [['conteudo', '1 · Conteúdo'], ['quando', '2 · Quando'], ['aparencia', '3 · Aparência e comportamento'], ['previa', '👁 Prévia']] as const

  return (
    <Modal titulo={`${r.icone} ${r.id ? 'Editar pop-up' : 'Novo pop-up'}`} onClose={onFechar} largura={860}>
      <div className="p2-seg" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {ABAS.map(([k, l]) => <button key={k} type="button" aria-pressed={aba === k} onClick={() => setAba(k)}>{l}</button>)}
      </div>

      <div className="p2-view" key={aba} style={{ minHeight: 360 }}>
        {aba === 'conteudo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><span className="p2-label">Título (aparece em destaque)</span><input className="p2-input" style={{ width: '100%', fontWeight: 700 }} value={r.titulo} onChange={e => setR({ ...r, titulo: e.target.value })} /></div>
            <div><span className="p2-label">Texto de abertura (opcional)</span><textarea className="p2-input" rows={2} style={{ width: '100%' }} value={r.intro} onChange={e => setR({ ...r, intro: e.target.value })} placeholder="Ex.: Leva menos de um minuto. Sem certo ou errado." /></div>
            <span className="p2-label" style={{ marginTop: 4, marginBottom: 0 }}>Perguntas ({r.perguntas.length})</span>
            {r.perguntas.map((q, i) => (
              <EditorPergunta key={q.id} q={q} acoes={ativas} primeira={i === 0} ultima={i === r.perguntas.length - 1}
                onChange={nq => setR({ ...r, perguntas: r.perguntas.map(x => x.id === q.id ? nq : x) })}
                onRemover={() => setR({ ...r, perguntas: r.perguntas.filter(x => x.id !== q.id) })}
                onMover={d => { const l = [...r.perguntas]; [l[i], l[i + d]] = [l[i + d], l[i]]; setR({ ...r, perguntas: l }) }} />
            ))}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 10, border: '1px dashed var(--p2-line)', borderRadius: 12, background: 'var(--p2-sunken)' }}>
              <span style={{ fontSize: 12, color: C.MU, alignSelf: 'center', marginRight: 4 }}>＋ Adicionar:</span>
              {(Object.keys(TIPOS_PERGUNTA) as TipoPergunta[]).map(t => (
                <button key={t} type="button" className="p2-chip" title={TIPOS_PERGUNTA[t].desc} disabled={t === 'acoes' && r.perguntas.some(q => q.tipo === 'acoes')}
                  onClick={() => setR({ ...r, perguntas: [...r.perguntas, perguntaPadrao(t)] })}>{TIPOS_PERGUNTA[t].icon} {TIPOS_PERGUNTA[t].label}</button>
              ))}
            </div>
          </div>
        )}

        {aba === 'quando' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(240px, 1fr)', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span className="p2-label">Frequência</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.keys(TIPOS_AGENDA) as TipoAgenda[]).map(t => (
                    <button key={t} type="button" className="p2-chip" onClick={() => setAg({ tipo: t, validade: t === 'aleatoria' ? 'janela' : ag.validade })}
                      style={ag.tipo === t ? { borderColor: C.P, background: 'var(--p2-blue-bg)', color: C.P } : undefined}>{TIPOS_AGENDA[t].icon} {TIPOS_AGENDA[t].label}</button>
                  ))}
                </div>
              </div>

              {(ag.tipo === 'semanal' || ag.tipo === 'quinzenal' || ag.tipo === 'aleatoria') && (
                <div><span className="p2-label">{ag.tipo === 'aleatoria' ? 'Dias em que pode aparecer' : 'Dias da semana'}</span><DiasSemana valor={ag.dias} onChange={d => setAg({ dias: d })} /></div>
              )}
              {ag.tipo === 'mensal' && (
                <div><span className="p2-label">Dia do mês</span>
                  <select className="p2-input" value={ag.dia_mes} onChange={e => setAg({ dia_mes: Number(e.target.value) })}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}{d >= 29 ? ' (ou o último dia do mês)' : ''}</option>)}
                  </select>
                </div>
              )}
              {ag.tipo === 'datas' && (
                <div>
                  <span className="p2-label">Datas</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {ag.datas.map(d => <Pill key={d} bg="var(--p2-blue-bg)" color={C.P}>📌 {d.split('-').reverse().join('/')} <button type="button" onClick={() => setAg({ datas: ag.datas.filter(x => x !== d) })} style={{ border: 'none', background: 'none', color: C.P, cursor: 'pointer', padding: 0 }}>×</button></Pill>)}
                    <input type="date" className="p2-input" value={novaData} min={hojeSP()} onChange={e => setNovaData(e.target.value)} style={{ padding: '5px 8px' }} />
                    <Btn sm v="gho" disabled={!novaData} onClick={() => { if (!ag.datas.includes(novaData)) setAg({ datas: [...ag.datas, novaData].sort() }); setNovaData('') }}>＋ Data</Btn>
                  </div>
                </div>
              )}
              {ag.tipo === 'aleatoria' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="p2-label" style={{ margin: 0 }}>Quantas vezes</span>
                  <input type="number" min={1} max={14} className="p2-input" style={{ width: 70 }} value={ag.vezes} onChange={e => setAg({ vezes: Number(e.target.value) })} />
                  <span style={{ fontSize: 13 }}>por</span>
                  <select className="p2-input" value={ag.por} onChange={e => setAg({ por: e.target.value as 'semana' | 'mes' })}><option value="semana">semana</option><option value="mes">mês</option></select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div><span className="p2-label">{ag.tipo === 'aleatoria' ? 'Sorteia entre' : 'Abre às'}</span><input type="time" className="p2-input" value={ag.hora_ini} onChange={e => setAg({ hora_ini: e.target.value })} /></div>
                <div><span className="p2-label">{ag.tipo === 'aleatoria' ? 'e' : 'Janela até'}</span><input type="time" className="p2-input" value={ag.hora_fim} onChange={e => setAg({ hora_fim: e.target.value })} /></div>
                <span style={{ fontSize: 11.5, color: C.MU, paddingBottom: 8 }}>horário de Brasília</span>
              </div>

              <div>
                <span className="p2-label">Fica disponível</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="radio" checked={ag.validade === 'janela'} onChange={() => setAg({ validade: 'janela' })} /> Só até o fim da janela do dia ({ag.hora_fim})</label>
                  <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="radio" checked={ag.validade === 'proxima'} onChange={() => setAg({ validade: 'proxima' })} /> Até a próxima abertura (fica pendente até responder)</label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div><span className="p2-label">Vale a partir de</span><input type="date" className="p2-input" value={ag.inicio} onChange={e => setAg({ inicio: e.target.value || hojeSP() })} /></div>
                <div><span className="p2-label">Até (opcional)</span><input type="date" className="p2-input" value={ag.fim ?? ''} onChange={e => setAg({ fim: e.target.value || null })} /></div>
              </div>
            </div>

            <div style={{ background: 'var(--p2-sunken)', borderRadius: 14, padding: '14px 16px', alignSelf: 'start' }}>
              <span className="p2-label">Resumo</span>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{resumoAgenda(ag)}</div>
              <span className="p2-label">Próximas aberturas</span>
              {proximas.length === 0 ? <div style={{ fontSize: 12.5, color: C.MU }}>Nenhuma com esta configuração.</div> : proximas.map((d, i) => (
                <div key={i} style={{ fontSize: 13, padding: '4px 0', borderTop: i ? '1px dashed var(--p2-line)' : 'none', display: 'flex', gap: 8 }}>
                  <span style={{ color: r.cor }}>●</span> {fmtQuando(d)}
                </div>
              ))}
              {ag.tipo === 'aleatoria' && <div style={{ fontSize: 11.5, color: C.MU, marginTop: 8 }}>O sorteio é fixo por {ag.por === 'mes' ? 'mês' : 'semana'}: a prévia mostra os horários que de fato vão sair{!r.id ? ' (depois de salvar, o sorteio é refeito uma única vez)' : ''}.</div>}
            </div>
          </div>
        )}

        {aba === 'aparencia' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><span className="p2-label">Ícone</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ICONES_POPUP.map(i => <button key={i} type="button" className="p2-chip" onClick={() => setR({ ...r, icone: i })} style={{ fontSize: 18, padding: '4px 10px', ...(r.icone === i ? { borderColor: r.cor, background: r.cor + '18' } : {}) }}>{i}</button>)}
              </div>
            </div>
            <div><span className="p2-label">Cor</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {CORES_POPUP.map(c => <button key={c} type="button" onClick={() => setR({ ...r, cor: c })} title={c} style={{ width: 30, height: 30, borderRadius: 10, background: c, border: r.cor === c ? '3px solid #fff' : 'none', boxShadow: r.cor === c ? `0 0 0 2px ${c}` : 'none', cursor: 'pointer', transition: 'box-shadow .2s' }} />)}
              </div>
            </div>
            <div>
              <span className="p2-label">Adiar</span>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <Interruptor on={r.comportamento.adiar} onChange={v => setR({ ...r, comportamento: { ...r.comportamento, adiar: v } })} />
                {r.comportamento.adiar ? 'Mostrar "agora não"' : 'Sem "agora não": a pessoa precisa responder para seguir'}
              </label>
              {r.comportamento.adiar && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: C.MU }}>volta depois de</span>
                  {[15, 30, 60, 120, 180, 240].map(m => (
                    <button key={m} type="button" className="p2-chip" onClick={() => setR({ ...r, comportamento: { ...r.comportamento, adiar_min: m } })}
                      style={r.comportamento.adiar_min === m ? { borderColor: C.P, background: 'var(--p2-blue-bg)', color: C.P } : undefined}>{m < 60 ? `${m} min` : `${m / 60}h`}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: C.MU, background: 'var(--p2-sunken)', borderRadius: 10, padding: '10px 12px' }}>
              O pop-up aparece sobre qualquer tela do sistema, um por vez. Não envia e-mail nem notificação. As respostas ficam no PDI (painel de respostas, Linha do tempo e, para “status das ações”, em cada ação).
            </div>
          </div>
        )}

        {aba === 'previa' && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="p2-card" style={{ width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: 'var(--p2-sh-hover)' }}>
              <div style={{ height: 5, background: r.cor }} />
              <div style={{ padding: '16px 18px', display: 'flex', gap: 12, borderBottom: '1px solid var(--p2-line-soft)' }}>
                <span style={{ fontSize: 24, width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: r.cor + '18' }}>{r.icone}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: r.cor }}>Seu PDI</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{r.titulo || 'Sem título'}</div>
                  {r.intro && <div style={{ fontSize: 13, color: C.MU, marginTop: 4 }}>{r.intro}</div>}
                </div>
                {r.comportamento.adiar && <span className="p2-link" style={{ color: C.MU }}>agora não</span>}
              </div>
              <div style={{ padding: '14px 18px', maxHeight: 420, overflowY: 'auto' }}>
                {r.perguntas.length ? <PopupFormulario perguntas={previaPerguntas} cor={r.cor} valores={valoresPrevia} setValores={setValoresPrevia} /> : <Vazio>Adicione perguntas na aba Conteúdo.</Vazio>}
              </div>
              <div className="p2-card-f" style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="p2-btn pri" style={{ background: r.cor }} disabled>Enviar</button></div>
            </div>
          </div>
        )}
      </div>

      {erro && <div style={{ marginTop: 12 }}><Alerta>{erro}</Alerta></div>}
      {!erro && problemas.length > 0 && <div style={{ marginTop: 12, fontSize: 12, color: '#9A3412' }}>Falta: {problemas.join(' · ')}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--p2-line-soft)' }}>
        <Btn v="gho" onClick={onFechar} disabled={salvando}>Cancelar</Btn>
        <Btn v="gho" onClick={() => salvar()} disabled={salvando}>{r.ativo ? 'Salvar' : 'Salvar pausado'}</Btn>
        {!r.ativo && <Btn v="ok" onClick={() => salvar(true)} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar e ligar'}</Btn>}
        {r.ativo && <Btn onClick={() => salvar()} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar (continua ligado)'}</Btn>}
      </div>
    </Modal>
  )
}

// ── Respostas ────────────────────────────────────────────────────────

function Respostas({ popup, dados, onFechar }: { popup: PopupGestao; dados: Acompanhamento; onFechar: () => void }) {
  const lista = dados.popupRespostas.filter(r => r.popup_id === popup.id)
  const nomeAcao = (id: string) => dados.acoes.find(a => a.id === id)?.competencia ?? 'ação'
  const humorQ = popup.perguntas.find(q => q.tipo === 'humor' || q.tipo === 'escala')
  const serie = humorQ ? [...lista].reverse().map(r => ({ d: r.ocorrencia, v: (r.respostas[humorQ.id] as { valor?: number } | undefined)?.valor })).filter(x => x.v) : []
  return (
    <Modal titulo={`${popup.icone} Respostas · ${popup.titulo}`} onClose={onFechar} largura={760}>
      {serie.length > 1 && humorQ && (
        <div style={{ marginBottom: 14, background: 'var(--p2-sunken)', borderRadius: 12, padding: '12px 14px' }}>
          <span className="p2-label">{humorQ.tipo === 'humor' ? 'Humor ao longo do tempo' : `${humorQ.texto} (1 a 5)`}</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 70, overflowX: 'auto' }}>
            {serie.map((x, i) => (
              <div key={i} title={`${fmtQuando(x.d)}: ${x.v}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 22 }}>
                {humorQ.tipo === 'humor' && <span style={{ fontSize: 12 }}>{HUMOR.find(h => h.v === x.v)?.e}</span>}
                <span style={{ width: 14, height: (x.v! / 5) * 44, borderRadius: '4px 4px 0 0', background: x.v! <= 2 ? C.NO : x.v === 3 ? '#C9A227' : C.OK }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {lista.length === 0 ? <Vazio>Nenhuma resposta ainda.</Vazio> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
          {lista.map(r => (
            <div key={r.id} className="p2-card" style={{ boxShadow: 'none', padding: '10px 14px' }}>
              <div style={{ display: 'flex', gap: 8, fontSize: 12, color: C.MU, marginBottom: 6, flexWrap: 'wrap' }}>
                <b style={{ color: C.TX }}>Abertura de {fmtQuando(r.ocorrencia)}</b>
                <span>· respondido {fmtQuando(r.created_at)} por {r.usuario_nome}</span>
              </div>
              {(r.perguntas.length ? r.perguntas : popup.perguntas).map(q => (
                <div key={q.id} style={{ fontSize: 13, padding: '3px 0' }}>
                  <span style={{ color: C.MU }}>{TIPOS_PERGUNTA[q.tipo]?.icon} {q.texto}</span>
                  <div style={{ fontWeight: 600, paddingLeft: 22 }}>{resumoResposta(q, r.respostas[q.id], nomeAcao)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ── Card da aba Plano de Ações ───────────────────────────────────────

export default function PopupsCard({ pdi, dados }: { pdi: PdiColaborador; dados: Acompanhamento }) {
  const [editor, setEditor] = useState<Rascunho | null>(null)
  const [escolher, setEscolher] = useState(false)
  const [respostas, setRespostas] = useState<PopupGestao | null>(null)
  const [excluir, setExcluir] = useState<PopupGestao | null>(null)
  const [aberto, setAberto] = useState(false)
  const primeiro = pdi.nome.split(' ')[0]
  const ligados = dados.popups.filter(p => p.ativo)
  const aguardando = dados.popups.filter(p => p.atual && !p.atual.respondida).length

  async function alternar(p: PopupGestao, ativo: boolean) {
    dados.setPopups(l => l.map(x => x.id === p.id ? { ...x, ativo } : x))
    try {
      await api(`/api/pdi/${pdi.id}/popups/${p.id}`, 'PATCH', { ativo })
      dados.setPopups(await api<PopupGestao[]>(`/api/pdi/${pdi.id}/popups`, 'GET'))
    } catch (e) { dados.setErro((e as Error).message); dados.recarregar() }
  }
  async function confirmarExclusao() {
    if (!excluir) return
    try { await api(`/api/pdi/${pdi.id}/popups/${excluir.id}`, 'DELETE'); dados.setPopups(l => l.filter(x => x.id !== excluir.id)); setExcluir(null) }
    catch (e) { dados.setErro((e as Error).message) }
  }
  const paraRascunho = (p: PopupGestao, copia?: boolean): Rascunho => ({
    id: copia ? undefined : p.id, titulo: copia ? `${p.titulo} (cópia)` : p.titulo, intro: p.intro, icone: p.icone, cor: p.cor,
    ativo: copia ? false : p.ativo, perguntas: p.perguntas, agenda: p.agenda, comportamento: p.comportamento,
  })

  return (
    <>
      <div className="p2-card" style={{ marginBottom: 14, overflow: 'hidden' }}>
        <div onClick={() => setAberto(a => !a)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}>
              Pop-ups de acompanhamento
              {ligados.length > 0 ? <Pill bg="var(--p2-ok-bg)" color="#166534">● {ligados.length} ligado{ligados.length > 1 ? 's' : ''}</Pill> : <Pill bg="#EEF2F7" color="#64748B">nenhum ligado</Pill>}
              {aguardando > 0 && <Pill bg="var(--p2-warn-bg)" color="#9A3412">{aguardando} aguardando {primeiro}</Pill>}
            </div>
            <div style={{ fontSize: 12, color: C.MU, marginTop: 2 }}>Perguntas curtas que aparecem para {primeiro} no sistema, na frequência que você escolher: status das ações, humor, escalas, escolhas…</div>
          </div>
          <Btn sm onClick={e => { e.stopPropagation(); setEscolher(true) }}>＋ Novo pop-up</Btn>
          <span className={'p2-chev' + (aberto ? ' is-open' : '')}>▶</span>
        </div>

        <div className={'p2-collapse' + (aberto ? ' is-open' : '')}><div>
          <div style={{ borderTop: '1px solid var(--p2-line-soft)' }}>
            {dados.popups.length === 0 && <div style={{ padding: 16 }}><Vazio>Nenhum pop-up ainda. Comece por um modelo pronto.</Vazio></div>}
            {dados.popups.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: '1px solid var(--p2-line-soft)', flexWrap: 'wrap', opacity: p.ativo ? 1 : .75 }}>
                <Interruptor on={p.ativo} onChange={v => alternar(p, v)} />
                <span style={{ fontSize: 18, width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: p.cor + '18', flexShrink: 0 }}>{p.icone}</span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.titulo} <span style={{ fontWeight: 400, color: C.MU, fontSize: 12 }}>· {p.perguntas.length} pergunta{p.perguntas.length === 1 ? '' : 's'}</span></div>
                  <div style={{ fontSize: 12, color: C.MU }}>{resumoAgenda(p.agenda)}</div>
                  {p.ativo && (
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      {p.atual
                        ? (p.atual.respondida ? <span style={{ color: '#166534' }}>✓ Respondido (aberto desde {fmtQuando(p.atual.abre)})</span> : <span style={{ color: '#9A3412' }}>● Aberto agora, aguardando resposta (até {fmtQuando(p.atual.fecha)})</span>)
                        : p.proximas[0] ? <span style={{ color: C.MU }}>Próxima abertura: <b style={{ color: C.TX }}>{fmtQuando(p.proximas[0])}</b></span> : <span style={{ color: C.MU }}>Sem próximas aberturas</span>}
                    </div>
                  )}
                </div>
                <Btn sm v="gho" onClick={() => setRespostas(p)}>📊 {p.total_respostas}</Btn>
                <Btn sm v="gho" onClick={() => setEditor(paraRascunho(p))}>✎ Editar</Btn>
                <button type="button" className="p2-icon-btn" title="Duplicar" onClick={() => setEditor(paraRascunho(p, true))}>⧉</button>
                <button type="button" className="p2-icon-btn" title="Excluir" onClick={() => setExcluir(p)}>🗑</button>
              </div>
            ))}
          </div>
        </div></div>
      </div>

      {escolher && (
        <Modal titulo="⚡ Novo pop-up: comece por um modelo" onClose={() => setEscolher(false)} largura={640}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {modelos().map(m => (
              <div key={m.id} className="p2-card is-hover is-click" style={{ padding: '12px 14px', boxShadow: 'none' }}
                onClick={() => { setEscolher(false); setAberto(true); setEditor(m.criar()) }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{m.nome}</div>
                <div style={{ fontSize: 12.5, color: C.MU, marginTop: 3 }}>{m.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.MU, marginTop: 12 }}>Tudo pode ser ajustado depois: perguntas, dias, horários, cor e ícone. O pop-up começa pausado até você ligar.</div>
        </Modal>
      )}
      {editor && <Editor pdi={pdi} dados={dados} inicial={editor} onFechar={() => setEditor(null)}
        onSalvo={p => { dados.setPopups(l => l.some(x => x.id === p.id) ? l.map(x => x.id === p.id ? p : x) : [...l, p]); setEditor(null); setAberto(true) }} />}
      {respostas && <Respostas popup={respostas} dados={dados} onFechar={() => setRespostas(null)} />}
      {excluir && (
        <Modal titulo="Excluir pop-up" onClose={() => setExcluir(null)} largura={420}>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: C.MU }}>O pop-up <b>{excluir.icone} {excluir.titulo}</b> e suas {excluir.total_respostas} resposta(s) serão removidos. Os registros de status das ações continuam nas ações. Se quiser só parar, use o interruptor para pausar.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn v="gho" onClick={() => setExcluir(null)}>Cancelar</Btn>
            <Btn v="danger" onClick={confirmarExclusao}>Excluir</Btn>
          </div>
        </Modal>
      )}
    </>
  )
}
