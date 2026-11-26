'use client'

// Plano de Ações: resumo no topo e Quadro por status; clicar numa ação abre o
// painel lateral com tudo dela. Cada ação tem etapas (checklist com status,
// responsável, prazo, anotação e ordem), anel de progresso, status rápido,
// trava para concluir (resultado + evidência), registros rápidos e histórico.

import { useEffect, useState } from 'react'
import type { PdiColaborador } from '../../../../data/pdis/types'
import type { Acompanhamento } from './useAcompanhamento'
import {
  C, Btn, Pill, Dots, Historico, Vazio, Modal, Collapse, Alerta, Carregando, TIPOS, api, cx,
  STATUS_OPCOES, progresso, prazoVencido, fmtData,
  type Acao, type Etapa, type EtapaStatus,
} from './pdi-ui'
import { CheckinStrip } from './RegistroRapido'
import PopupsCard from './Popups'
import { textoPlano } from './RichText'

type FormAcao = { competencia: string; desenvolver: string; acoes: string; resultados_esperados: string; inicio: string; termino: string; status: string }
const FORM_VAZIO: FormAcao = { competencia: '', desenvolver: '', acoes: '', resultados_esperados: '', inicio: '', termino: '', status: 'Não iniciado' }

// Cor de cada status (faixa lateral, colunas do quadro, anel)
const COR_STATUS: Record<string, { cor: string; bg: string; icon: string }> = {
  'Não iniciado': { cor: '#94A3B8', bg: '#F1F5F9', icon: '○' },
  'Em andamento': { cor: '#2A4F96', bg: '#EEF3FB', icon: '◔' },
  'Em evolução': { cor: '#D9730D', bg: '#FFF4E8', icon: '◑' },
  'Concluído': { cor: '#1E9E6A', bg: '#EAF7F1', icon: '●' },
}
const corStatus = (s: string) => COR_STATUS[s] ?? COR_STATUS['Não iniciado']

const TINT: Record<EtapaStatus, { bg: string; edge: string }> = {
  '': { bg: '#fff', edge: '#D5DDEA' },
  ok: { bg: '#F4FBF8', edge: C.OK },
  parcial: { bg: '#FFF9F2', edge: C.WARN },
  travada: { bg: '#FEF6F6', edge: C.NO },
  na: { bg: '#F8FAFC', edge: C.NA },
}

/** Anel de progresso (SVG). */
function Anel({ pct, cor, size = 46, sem }: { pct: number; cor: string; size?: number; sem?: boolean }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} title={sem ? 'Sem etapas' : `${pct}% das etapas`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F7" strokeWidth={5} />
        {!sem && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .7s var(--p2-ease-out)' }} />}
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: size > 40 ? 11.5 : 10, fontWeight: 800, color: sem ? '#A3B0C4' : C.TX }}>{sem ? '—' : `${pct}%`}</span>
    </div>
  )
}

/** Status da ação como pílula; para a gestão, vira um seletor. */
function StatusAcao({ acao, editavel, onMudar }: { acao: Acao; editavel: boolean; onMudar: (s: string) => void }) {
  const s = corStatus(acao.status || 'Não iniciado')
  if (!editavel) return <Pill bg={s.bg} color={s.cor}>{s.icon} {acao.status || 'Não iniciado'}</Pill>
  return (
    <select value={acao.status || 'Não iniciado'} onClick={e => e.stopPropagation()} onChange={e => onMudar(e.target.value)} title="Mudar status"
      className="p2-pill" style={{ background: s.bg, color: s.cor, border: `1px solid ${s.cor}33`, cursor: 'pointer', fontFamily: 'inherit', appearance: 'none', paddingRight: 18, backgroundImage: `linear-gradient(45deg, transparent 50%, ${s.cor} 50%), linear-gradient(135deg, ${s.cor} 50%, transparent 50%)`, backgroundPosition: 'calc(100% - 9px) 52%, calc(100% - 5px) 52%', backgroundSize: '4px 4px', backgroundRepeat: 'no-repeat' }}>
      {STATUS_OPCOES.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ── Etapa ────────────────────────────────────────────────────────────

function EtapaRow({ etapa, canEdit, primeira, ultima, onPatch, onDelete, onMover }: {
  etapa: Etapa; canEdit: boolean; primeira: boolean; ultima: boolean
  onPatch: (c: Partial<Etapa>) => void; onDelete: () => void; onMover: (dir: -1 | 1) => void
}) {
  const [titulo, setTitulo] = useState(etapa.titulo)
  const [obs, setObs] = useState(etapa.obs)
  const [obsAberta, setObsAberta] = useState(false)
  const [confirma, setConfirma] = useState(false)
  const mostraObs = obsAberta || !!etapa.obs || etapa.status === 'parcial' || etapa.status === 'travada'
  const t = TINT[etapa.status]
  const vencida = prazoVencido(etapa)

  return (
    <div className="p2-etapa p2-etapa-row" style={{ background: t.bg, borderLeftColor: t.edge }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {canEdit && (
          <span className="p2-ordem">
            <button type="button" disabled={primeira} onClick={() => onMover(-1)} title="Subir">▲</button>
            <button type="button" disabled={ultima} onClick={() => onMover(1)} title="Descer">▼</button>
          </span>
        )}
        <Dots value={etapa.status} disabled={!canEdit} onChange={v => onPatch({ status: v })} />
        {canEdit ? (
          <input value={titulo} onChange={e => setTitulo(e.target.value)} className="p2-input ghost"
            onBlur={() => { if (titulo.trim() && titulo !== etapa.titulo) onPatch({ titulo: titulo.trim() }) }}
            style={{ flex: 1, minWidth: 160, fontWeight: 500, textDecoration: etapa.status === 'na' ? 'line-through' : 'none', color: etapa.status === 'ok' ? '#166534' : undefined }} />
        ) : (
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, textDecoration: etapa.status === 'na' ? 'line-through' : 'none' }}>{etapa.titulo}</span>
        )}
        {vencida && <Pill bg="var(--p2-no-bg)" color={C.NO}>⏰ vencida</Pill>}
        {canEdit ? (
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input list="pdi-responsaveis" defaultValue={etapa.responsavel} placeholder="👤 Responsável" className="p2-input"
              onBlur={e => { if (e.target.value !== etapa.responsavel) onPatch({ responsavel: e.target.value }) }}
              style={{ width: 118, fontSize: 12, padding: '5px 8px' }} />
            <input type="date" defaultValue={etapa.prazo ?? ''} title="Prazo" className="p2-input"
              onBlur={e => { if ((e.target.value || null) !== etapa.prazo) onPatch({ prazo: e.target.value || null }) }}
              style={{ width: 132, fontSize: 12, padding: '5px 8px', color: vencida ? C.NO : undefined, borderColor: vencida ? '#F5C9C9' : undefined }} />
            <button type="button" title="Anotação da etapa" onClick={() => setObsAberta(o => !o)} className={cx('p2-icon-btn', (etapa.obs || obsAberta) && 'is-on')}>📝</button>
            {confirma
              ? <Btn sm v="danger" onClick={onDelete}>Excluir</Btn>
              : <button type="button" title="Excluir etapa" className="p2-icon-btn" onClick={() => { setConfirma(true); setTimeout(() => setConfirma(false), 3000) }}>✕</button>}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: C.MU, display: 'flex', gap: 10 }}>
            {etapa.responsavel && <span>👤 {etapa.responsavel}</span>}
            {etapa.prazo && <span style={{ color: vencida ? C.NO : C.MU }}>📅 {fmtData(etapa.prazo)}</span>}
          </span>
        )}
      </div>
      <Collapse open={mostraObs && (canEdit || !!etapa.obs)}>
        {canEdit ? (
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className="p2-input"
            onBlur={() => { if (obs !== etapa.obs) onPatch({ obs }) }}
            placeholder={etapa.status === 'travada' ? 'O que está travando? O que precisa para destravar?' : 'Anotação sobre esta etapa…'}
            style={{ width: '100%', marginTop: 8, fontSize: 12.5 }} />
        ) : <div style={{ marginTop: 6, fontSize: 12.5, color: '#475569', whiteSpace: 'pre-wrap' }}>{etapa.obs}</div>}
      </Collapse>
    </div>
  )
}

// ── Detalhe da ação (painel lateral aberto a partir do Quadro) ───────

function AcaoDetalhe({ acao, etapas, dados, pdi, canEdit, onFechar, onStatus, onEditar, onConcluir, onExcluir, onReabrir }: {
  acao: Acao; etapas: Etapa[]; dados: Acompanhamento; pdi: PdiColaborador; canEdit: boolean
  onFechar: () => void; onStatus: (s: string) => void; onEditar: () => void; onConcluir: () => void; onExcluir: () => void; onReabrir: () => void
}) {
  const [nova, setNova] = useState('')
  const [salvando, setSalvando] = useState(false)
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])

  const prog = progresso(etapas)
  const concluida = acao.status === 'Concluído'
  const sc = corStatus(acao.status || 'Não iniciado')
  const notas = dados.anotacoes.filter(n => n.acao_id === acao.id)
  const regs = dados.checkins.filter(c => c.acao_id === acao.id)
  const vencidas = etapas.filter(prazoVencido).length
  const travadas = etapas.filter(e => e.status === 'travada').length

  async function addEtapa() {
    if (!nova.trim()) return
    setSalvando(true)
    try {
      const e = await api<Etapa>(`/api/pdi/${pdi.id}/etapas`, 'POST', { acao_id: acao.id, titulo: nova.trim() })
      dados.setEtapas(l => [...l, e]); setNova('')
    } catch (err) { dados.setErro((err as Error).message) } finally { setSalvando(false) }
  }
  async function patchEtapa(id: string, campos: Partial<Etapa>) {
    dados.setEtapas(l => l.map(e => e.id === id ? { ...e, ...campos } : e))
    try {
      const e = await api<Etapa>(`/api/pdi/${pdi.id}/etapas/${id}`, 'PATCH', campos)
      dados.setEtapas(l => l.map(x => x.id === id ? e : x))
    } catch (err) { dados.setErro((err as Error).message); dados.recarregar() }
  }
  async function excluirEtapa(id: string) {
    try { await api(`/api/pdi/${pdi.id}/etapas/${id}`, 'DELETE'); dados.setEtapas(l => l.filter(e => e.id !== id)) }
    catch (err) { dados.setErro((err as Error).message) }
  }
  async function mover(i: number, dir: -1 | 1) {
    const a = etapas[i], b = etapas[i + dir]
    if (!a || !b) return
    const seq = [...etapas]; seq[i] = b; seq[i + dir] = a
    const mudou = seq.map((e, k) => ({ id: e.id, ordem: k })).filter(x => etapas.find(e => e.id === x.id)?.ordem !== x.ordem)
    dados.setEtapas(l => l.map(e => { const m = mudou.find(x => x.id === e.id); return m ? { ...e, ordem: m.ordem } : e }))
    try { await Promise.all(mudou.map(m => api(`/api/pdi/${pdi.id}/etapas/${m.id}`, 'PATCH', { ordem: m.ordem }))) }
    catch (err) { dados.setErro((err as Error).message); dados.recarregar() }
  }

  return (
    <div className="p2-drawer-bg" onClick={onFechar}>
      <div className="p2-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label={acao.competencia}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', borderBottom: '1px solid var(--p2-line-soft)', borderTop: `4px solid ${sc.cor}`, position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
          <Anel pct={prog.pct} cor={prog.pct === 100 ? C.OK : sc.cor} size={54} sem={!prog.total} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{acao.competencia}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 5 }}>
              <StatusAcao acao={acao} editavel={canEdit && !concluida} onMudar={onStatus} />
              {prog.total > 0 && <span style={{ fontSize: 12, color: C.MU }}>{prog.feitas}/{prog.total} etapas</span>}
              {travadas > 0 && <Pill bg="var(--p2-no-bg)" color={C.NO}>✕ {travadas} travada{travadas > 1 ? 's' : ''}</Pill>}
              {vencidas > 0 && <Pill bg="var(--p2-warn-bg)" color="#9A3412">⏰ {vencidas} vencida{vencidas > 1 ? 's' : ''}</Pill>}
              {(acao.inicio || acao.termino) && <span style={{ fontSize: 12, color: C.MU }}>📅 {acao.inicio || '—'} → {acao.termino || '—'}</span>}
            </div>
          </div>
          <button type="button" className="p2-icon-btn" onClick={onFechar} title="Fechar (Esc)" style={{ fontSize: 18 }}>×</button>
        </div>

        {/* Resultado (concluída) */}
        {concluida && (
          <div style={{ margin: '16px 22px 0', background: 'var(--p2-ok-bg)', borderRadius: 12, padding: '12px 14px', borderLeft: `4px solid ${C.OK}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#166534' }}>🏁 Concluída em {fmtData(acao.concluido_em)}</div>
            <div style={{ marginTop: 8 }}><span className="p2-label">Resultado alcançado</span><div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{acao.resultado_alcancado || '—'}</div></div>
            {acao.evidencia && <div style={{ marginTop: 8 }}><span className="p2-label">Evidência</span><div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{acao.evidencia}</div></div>}
          </div>
        )}

        <div className="p2-acao-corpo">
          <div style={{ padding: '16px 22px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span className="p2-label" style={{ margin: 0, flex: 1 }}>Etapas {prog.total > 0 && `· ${prog.feitas} de ${prog.total}`}</span>
              {canEdit && <span style={{ fontSize: 11, color: '#A3B0C4' }}>✓ feita · ◐ andamento · ✕ travada · – n/a</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {etapas.length === 0 && !canEdit && <div style={{ fontSize: 13, color: '#94A3B8' }}>Nenhuma etapa definida.</div>}
              {etapas.map((e, i) => (
                <EtapaRow key={e.id} etapa={e} canEdit={canEdit} primeira={i === 0} ultima={i === etapas.length - 1}
                  onPatch={c => patchEtapa(e.id, c)} onDelete={() => excluirEtapa(e.id)} onMover={d => mover(i, d)} />
              ))}
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addEtapa() }} autoFocus={etapas.length === 0}
                  placeholder="＋ Nova etapa (Enter para adicionar)" className="p2-input" style={{ flex: 1, borderStyle: 'dashed', background: 'var(--p2-sunken)' }} />
                {nova.trim() && <Btn sm onClick={addEtapa} disabled={salvando}>Adicionar</Btn>}
              </div>
            )}
            <CheckinStrip checkins={regs} />
          </div>

          <aside className="p2-acao-lado">
            {([['🎯 O que desenvolver', acao.desenvolver], ['🛠 Ações', acao.acoes], ['🏁 Resultados esperados', acao.resultados_esperados]] as const).map(([l, v]) => v ? (
              <div key={l}>
                <span className="p2-label">{l}</span>
                <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{v}</div>
              </div>
            ) : null)}
            {notas.length > 0 && (
              <div>
                <span className="p2-label">📓 Do Diário ({notas.length})</span>
                {notas.slice(0, 4).map(n => (
                  <div key={n.id} style={{ fontSize: 12.5, color: '#475569', padding: '4px 0', borderTop: '1px dashed var(--p2-line-soft)' }}>
                    <span style={{ color: C.MU }}>{TIPOS[n.tipo]?.icon} {n.autor_nome?.replace(/\s+Admin$/i, '').split(' ')[0]} · {fmtData(n.data)}</span>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{textoPlano(n.texto)}</div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>

        {canEdit && (
          <div className="p2-card-f" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', borderRadius: 0, position: 'sticky', bottom: 0, padding: '12px 22px' }}>
            <Historico pdiId={pdi.id} acaoId={acao.id} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn sm v="gho" onClick={onEditar}>✎ Editar</Btn>
              <Btn sm v="danger" onClick={onExcluir}>Excluir</Btn>
              {concluida ? <Btn sm v="gho" onClick={onReabrir}>↺ Reabrir</Btn> : <Btn sm v="ok" onClick={onConcluir}>✓ Concluir ação</Btn>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Quadro (colunas por status) ──────────────────────────────────────

function Quadro({ acoes, dados, canEdit, onAbrir, onStatus }: {
  acoes: Acao[]; dados: Acompanhamento; canEdit: boolean; onAbrir: (id: string) => void; onStatus: (a: Acao, s: string) => void
}) {
  return (
    <div className="p2-quadro">
      {STATUS_OPCOES.map(st => {
        const sc = corStatus(st)
        const col = acoes.filter(a => (a.status || 'Não iniciado') === st)
        return (
          <div key={st} className="p2-col-quadro">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `2px solid ${sc.cor}` }}>
              <span style={{ color: sc.cor, fontWeight: 800 }}>{sc.icon}</span>
              <b style={{ fontSize: 13, flex: 1 }}>{st}</b>
              <Pill bg={sc.bg} color={sc.cor}>{col.length}</Pill>
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
              {col.length === 0 && <div style={{ fontSize: 12, color: '#A3B0C4', textAlign: 'center', padding: '16px 0' }}>—</div>}
              {col.map(a => {
                const ets = dados.etapas.filter(e => e.acao_id === a.id).sort((x, y) => x.ordem - y.ordem)
                const p = progresso(ets)
                const prox = ets.find(e => e.status !== 'ok' && e.status !== 'na')
                const trav = ets.filter(e => e.status === 'travada').length
                const venc = ets.filter(prazoVencido).length
                return (
                  <div key={a.id} className="p2-card is-hover is-click" onClick={() => onAbrir(a.id)} style={{ padding: '10px 12px', boxShadow: 'none' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Anel pct={p.pct} cor={p.pct === 100 ? C.OK : sc.cor} size={36} sem={!p.total} />
                      <b style={{ fontSize: 13, flex: 1, lineHeight: 1.3 }}>{a.competencia}</b>
                    </div>
                    {prox && <div style={{ fontSize: 12, color: C.MU, marginTop: 6 }}>→ {prox.titulo}</div>}
                    {a.status === 'Concluído' && a.concluido_em && <div style={{ fontSize: 12, color: '#166534', marginTop: 6 }}>🏁 {fmtData(a.concluido_em)}</div>}
                    <div style={{ display: 'flex', gap: 5, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {trav > 0 && <Pill bg="var(--p2-no-bg)" color={C.NO}>✕ {trav}</Pill>}
                      {venc > 0 && <Pill bg="var(--p2-warn-bg)" color="#9A3412">⏰ {venc}</Pill>}
                      <div style={{ flex: 1 }} />
                      {canEdit && a.status !== 'Concluído' && (
                        <select value={a.status || 'Não iniciado'} onClick={e => e.stopPropagation()} onChange={e => onStatus(a, e.target.value)} className="p2-input" title="Mover para…" style={{ padding: '2px 6px', fontSize: 11.5 }}>
                          {STATUS_OPCOES.map(o => <option key={o} value={o}>{o === a.status ? `• ${o}` : `→ ${o}`}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Aba ──────────────────────────────────────────────────────────────

export default function AcoesTab({ pdi, canEdit, dados }: { pdi: PdiColaborador; canEdit: boolean; dados: Acompanhamento }) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [form, setForm] = useState<{ id: string | null; f: FormAcao } | null>(null)
  const [concluir, setConcluir] = useState<{ acao: Acao; resultado: string; evidencia: string } | null>(null)
  const [excluir, setExcluir] = useState<Acao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroModal, setErroModal] = useState('')

  const responsaveis = [pdi.nome.split(' ')[0], 'Gestor', 'Rodrigo', 'Marcio']
  const ativas = dados.acoes.filter(a => a.status !== 'Concluído')
  const concluidas = dados.acoes.filter(a => a.status === 'Concluído')
  const etapasDe = (id: string) => dados.etapas.filter(e => e.acao_id === id).sort((a, b) => a.ordem - b.ordem)
  const etapasAtivas = dados.etapas.filter(e => ativas.some(a => a.id === e.acao_id))
  const prog = progresso(etapasAtivas)
  const travadas = etapasAtivas.filter(e => e.status === 'travada').length
  const vencidas = etapasAtivas.filter(prazoVencido).length
  const acaoAberta = aberta ? dados.acoes.find(a => a.id === aberta) ?? null : null

  async function mudarStatus(a: Acao, s: string) {
    if (s === a.status) return
    if (s === 'Concluído') { setErroModal(''); setConcluir({ acao: a, resultado: a.resultado_alcancado ?? '', evidencia: a.evidencia ?? '' }); return }
    try {
      const salvo = await api<Acao>(`/api/pdi/${pdi.id}/acoes/${a.id}`, 'PUT', { status: s })
      dados.setAcoes(l => l.map(x => x.id === salvo.id ? salvo : x))
    } catch (e) { dados.setErro((e as Error).message) }
  }
  async function salvarForm() {
    if (!form) return
    if (!form.f.competencia.trim()) { setErroModal('Competência é obrigatória.'); return }
    setSalvando(true); setErroModal('')
    try {
      const salvo = form.id ? await api<Acao>(`/api/pdi/${pdi.id}/acoes/${form.id}`, 'PUT', form.f) : await api<Acao>(`/api/pdi/${pdi.id}/acoes`, 'POST', form.f)
      dados.setAcoes(l => form.id ? l.map(a => a.id === form.id ? salvo : a) : [...l, salvo])
      if (!form.id) setAberta(salvo.id) // abre a ação nova para já quebrar em etapas
      setForm(null)
    } catch (e) { setErroModal((e as Error).message) } finally { setSalvando(false) }
  }
  async function salvarConclusao() {
    if (!concluir) return
    if (!concluir.resultado.trim()) { setErroModal('Registre o resultado alcançado.'); return }
    setSalvando(true); setErroModal('')
    try {
      const salvo = await api<Acao>(`/api/pdi/${pdi.id}/acoes/${concluir.acao.id}`, 'PUT', { status: 'Concluído', resultado_alcancado: concluir.resultado.trim(), evidencia: concluir.evidencia.trim() })
      dados.setAcoes(l => l.map(a => a.id === salvo.id ? salvo : a)); setConcluir(null)
    } catch (e) { setErroModal((e as Error).message) } finally { setSalvando(false) }
  }
  async function confirmarExclusao() {
    if (!excluir) return
    try {
      await api(`/api/pdi/${pdi.id}/acoes/${excluir.id}`, 'DELETE')
      dados.setAcoes(l => l.filter(a => a.id !== excluir.id)); dados.setEtapas(l => l.filter(e => e.acao_id !== excluir.id))
      if (aberta === excluir.id) setAberta(null)
      setExcluir(null)
    } catch (e) { dados.setErro((e as Error).message) }
  }

  if (dados.carregando) return <Carregando txt="Carregando ações…" />

  const pendentes = concluir ? etapasDe(concluir.acao.id).filter(e => e.status !== 'ok' && e.status !== 'na') : []
  const setF = (k: keyof FormAcao, v: string) => form && setForm({ ...form, f: { ...form.f, [k]: v } })
  const editarForm = (a: Acao) => { setErroModal(''); setForm({ id: a.id, f: { competencia: a.competencia, desenvolver: a.desenvolver, acoes: a.acoes, resultados_esperados: a.resultados_esperados, inicio: a.inicio, termino: a.termino, status: a.status || 'Não iniciado' } }) }

  return (
    <div>
      <datalist id="pdi-responsaveis">{responsaveis.map(r => <option key={r} value={r} />)}</datalist>

      {/* Resumo */}
      <div className="p2-card" style={{ marginBottom: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <Anel pct={prog.pct} cor={C.OK} size={56} sem={!prog.total} />
        <div style={{ minWidth: 150 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{prog.total ? `${prog.feitas} de ${prog.total} etapas feitas` : 'Sem etapas definidas'}</div>
          <div style={{ fontSize: 12.5, color: C.MU }}>nas ações ativas</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          {[
            { l: 'Ativas', v: ativas.length, cor: '#2A4F96', bg: '#EEF3FB' },
            { l: 'Concluídas', v: concluidas.length, cor: '#166534', bg: '#EAF7F1' },
            { l: 'Travadas', v: travadas, cor: C.NO, bg: '#FDEEEE' },
            { l: 'Vencidas', v: vencidas, cor: '#9A3412', bg: '#FFF4E8' },
          ].map(k => (
            <div key={k.l} style={{ background: k.bg, borderRadius: 10, padding: '6px 12px', minWidth: 84, opacity: k.v || k.l === 'Ativas' ? 1 : .55, transition: 'opacity .3s' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.cor }}>{k.v}</div>
              <div style={{ fontSize: 11, color: C.MU, fontWeight: 600 }}>{k.l}</div>
            </div>
          ))}
        </div>
        {canEdit && <Btn onClick={() => { setErroModal(''); setForm({ id: null, f: { ...FORM_VAZIO } }) }}>＋ Nova ação</Btn>}
      </div>

      {canEdit && <PopupsCard pdi={pdi} dados={dados} />}
      {dados.erro && <div style={{ marginBottom: 12 }}><Alerta>{dados.erro}</Alerta></div>}

      {dados.acoes.length === 0
        ? <Vazio>Nenhuma ação ainda.{canEdit && ' Clique em "＋ Nova ação" para começar.'}</Vazio>
        : <Quadro acoes={dados.acoes} dados={dados} canEdit={canEdit} onStatus={mudarStatus} onAbrir={setAberta} />}

      {acaoAberta && (
        <AcaoDetalhe acao={acaoAberta} etapas={etapasDe(acaoAberta.id)} dados={dados} pdi={pdi} canEdit={canEdit}
          onFechar={() => setAberta(null)} onStatus={s => mudarStatus(acaoAberta, s)} onEditar={() => editarForm(acaoAberta)}
          onConcluir={() => { setErroModal(''); setConcluir({ acao: acaoAberta, resultado: acaoAberta.resultado_alcancado ?? '', evidencia: acaoAberta.evidencia ?? '' }) }}
          onExcluir={() => setExcluir(acaoAberta)} onReabrir={() => mudarStatus(acaoAberta, 'Em andamento')} />
      )}

      {/* Modais (acima do painel lateral) */}
      {form && (
        <Modal titulo={form.id ? '✎ Editar ação' : '＋ Nova ação'} onClose={() => setForm(null)} largura={620}>
          {erroModal && <div style={{ marginBottom: 14 }}><Alerta>{erroModal}</Alerta></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span className="p2-label">Competência *</span>
              <input list="pdi-competencias" value={form.f.competencia} onChange={e => setF('competencia', e.target.value)} className="p2-input" style={{ width: '100%' }} placeholder="Ex.: Comunicação" autoFocus />
              <datalist id="pdi-competencias">{pdi.matrizAvaliacao.competencias.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            {([['desenvolver', '🎯 O que desenvolver'], ['acoes', '🛠 Ações'], ['resultados_esperados', '🏁 Resultados esperados']] as const).map(([k, l]) => (
              <div key={k}><span className="p2-label">{l}</span><textarea value={form.f[k]} onChange={e => setF(k, e.target.value)} rows={3} className="p2-input" style={{ width: '100%' }} /></div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><span className="p2-label">Início</span><input value={form.f.inicio} onChange={e => setF('inicio', e.target.value)} placeholder="DD/MM/AAAA" className="p2-input" style={{ width: '100%' }} /></div>
              <div><span className="p2-label">Término</span><input value={form.f.termino} onChange={e => setF('termino', e.target.value)} placeholder="DD/MM/AAAA" className="p2-input" style={{ width: '100%' }} /></div>
              <div><span className="p2-label">Status</span>
                <select value={form.f.status} onChange={e => setF('status', e.target.value)} className="p2-input" style={{ width: '100%' }}>
                  {STATUS_OPCOES.filter(s => s !== 'Concluído').map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {!form.id && <div style={{ fontSize: 12, color: C.MU }}>Ao salvar, a ação abre para você quebrar em etapas.</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Btn v="gho" onClick={() => setForm(null)} disabled={salvando}>Cancelar</Btn>
            <Btn onClick={salvarForm} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn>
          </div>
        </Modal>
      )}

      {concluir && (
        <Modal titulo={`🏁 Concluir: ${concluir.acao.competencia}`} onClose={() => setConcluir(null)}>
          {pendentes.length > 0 && <div style={{ marginBottom: 14 }}><Alerta tipo="warn">{pendentes.length} etapa{pendentes.length > 1 ? 's' : ''} ainda sem ✓: {pendentes.map(e => e.titulo).join(' · ')}. Dá para concluir mesmo assim, mas vale registrar o porquê no resultado.</Alerta></div>}
          {erroModal && <div style={{ marginBottom: 14 }}><Alerta>{erroModal}</Alerta></div>}
          <div style={{ fontSize: 12.5, color: C.MU, marginBottom: 14, background: 'var(--p2-sunken)', borderRadius: 10, padding: '10px 12px' }}><b>Esperado:</b> {concluir.acao.resultados_esperados || '—'}</div>
          <span className="p2-label">Resultado alcançado *</span>
          <textarea value={concluir.resultado} onChange={e => setConcluir({ ...concluir, resultado: e.target.value })} rows={4} className="p2-input" style={{ width: '100%', marginBottom: 12 }} placeholder="O que de fato mudou? Compare com o esperado." />
          <span className="p2-label">Evidência</span>
          <textarea value={concluir.evidencia} onChange={e => setConcluir({ ...concluir, evidencia: e.target.value })} rows={3} className="p2-input" style={{ width: '100%' }} placeholder="Ex.: indicador, relatório, caso concreto, retorno das referências…" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Btn v="gho" onClick={() => setConcluir(null)} disabled={salvando}>Cancelar</Btn>
            <Btn v="ok" onClick={salvarConclusao} disabled={salvando}>{salvando ? 'Salvando…' : 'Concluir ação'}</Btn>
          </div>
        </Modal>
      )}

      {excluir && (
        <Modal titulo="Excluir ação" onClose={() => setExcluir(null)} largura={420}>
          <p style={{ margin: '0 0 20px', fontSize: 13.5, color: C.MU }}>A ação <b>{excluir.competencia}</b> e suas {etapasDe(excluir.id).length} etapa(s) serão removidas. As anotações do Diário ligadas a ela ficam, sem o vínculo.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn v="gho" onClick={() => setExcluir(null)}>Cancelar</Btn>
            <Btn v="danger" onClick={confirmarExclusao}>Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
