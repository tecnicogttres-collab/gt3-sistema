'use client'

// Avaliações (ciclos): matriz Diretiva · Autoavaliação · Ambição por competência,
// datas do ciclo, agendamento da conversa e pauta/anotações da gestão.
// Mesmas regras de antes; visual novo. Cores = as do Mapa de competências.

import { useEffect, useRef, useState } from 'react'
import type { PdiColaborador } from '../../../../data/pdis/types'
import { C, Btn, Pill, Vazio, Modal, Collapse, Chev, Alerta, Carregando, cx, Autor } from './pdi-ui'
import type { Acompanhamento } from './useAcompanhamento'
import { Composer, Nota as NotaDiario } from './DiarioTab'

type OutroRascunho = { user_nome: string | null; texto: string | null; updated_at: string }
type Ciclo = {
  id: string; pdi_id: string; colaborador_id: string; numero_ciclo: number; status: 'ativo' | 'arquivado'
  avaliacao_diretiva: number[]; autoavaliacao: number[]; ambicao: number[]; autoavaliacao_salva: boolean
  data_conversa: string | null; conversa_confirmada_em: string | null
  meu_rascunho: string | null; outros_rascunhos: OutroRascunho[]
  criado_em: string; arquivado_em: string | null; data_inicio: string | null; data_fim: string | null
}

const SERIES = {
  dir: { label: 'Diretiva', cor: '#2A4F96', bg: '#EEF3FB' },
  auto: { label: 'Autoavaliação', cor: '#D9730D', bg: '#FFF4E8' },
  amb: { label: 'Ambição', cor: '#0F9F8F', bg: '#E7F6F4' },
} as const

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function periodo(ini: string | null, fim: string | null) {
  if (!ini) return '—'
  const f = (s: string) => { const d = new Date(s + 'T12:00:00'); return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}` }
  return `${f(ini)} – ${fim ? f(fim) : 'em aberto'}`
}
const CURTO: Record<string, string> = {
  'Relacionamento Interpessoal': 'Rel. Interpessoal', 'Inteligência Emocional no Trabalho': 'Int. Emocional',
  'Inteligência Emocional': 'Int. Emocional', 'Cadastro e itens relacionados': 'Cadastro', 'Atendimento ao cliente': 'Atend. Cliente',
}
const primeiroDoMes = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01` }

/** Nota 0–5 como 5 bolinhas. Editável: clicar define; clicar na mesma zera. */
function Nota({ v, cor, editavel, onChange }: { v: number; cor: string; editavel: boolean; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} title={`${v} de 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={!editavel} onClick={() => onChange(v === n ? 0 : n)} aria-label={`${n}`}
          style={{
            width: 15, height: 15, borderRadius: '50%', padding: 0, border: `1.5px solid ${n <= v ? cor : '#D5DDEA'}`,
            background: n <= v ? cor : '#fff', cursor: editavel ? 'pointer' : 'default',
            transition: 'background-color .2s, border-color .2s, transform .15s',
          }}
          onMouseEnter={e => { if (editavel) e.currentTarget.style.transform = 'scale(1.2)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = '' }} />
      ))}
      <b style={{ fontSize: 12, color: v ? cor : '#A3B0C4', width: 14, textAlign: 'right', marginLeft: 4 }}>{v || '–'}</b>
    </div>
  )
}

function Total({ k, valor, max }: { k: keyof typeof SERIES; valor: number; max: number }) {
  const s = SERIES[k]
  const pct = max ? Math.round((valor / max) * 100) : 0
  return (
    <div style={{ flex: 1, minWidth: 150, background: s.bg, borderRadius: 12, padding: '10px 14px' }}>
      <span className="p2-label" style={{ color: s.cor, marginBottom: 2 }}>{s.label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: s.cor }}>{valor}</span>
        <span style={{ fontSize: 12, color: C.MU }}>/ {max}</span>
      </div>
      <div className="p2-bar" style={{ marginTop: 6, background: '#ffffffaa' }}><i style={{ width: `${pct}%`, background: s.cor }} /></div>
    </div>
  )
}

function CicloCard({ ciclo, pdi, dados, papel, colaboradorId, onUpdate, onUpdateOthers, onDelete, isFirst, isDbPdi, propComps, onCompsUpdated }: {
  ciclo: Ciclo; pdi: PdiColaborador; dados: Acompanhamento; papel: string; colaboradorId: string | null
  onUpdate: (c: Ciclo) => void
  onUpdateOthers: (p: Array<{ id: string; status: 'ativo' | 'arquivado'; arquivado_em: string | null }>) => void
  onDelete: (id: string) => void
  isFirst: boolean; isDbPdi?: boolean; propComps: string[]; onCompsUpdated?: (c: string[]) => void
}) {
  const gestao = ['gestor', 'admin'].includes(papel)
  const isColab = papel === 'colaborador' || papel === 'trainee'
  const ativo = ciclo.status === 'ativo'

  const [comps, setComps] = useState<string[]>(propComps)
  const [compsText, setCompsText] = useState('')
  const editorComps = isDbPdi && isFirst && gestao && comps.length === 0
  const templateBuscado = useRef(false)
  useEffect(() => {
    if (!editorComps || templateBuscado.current) return
    templateBuscado.current = true
    fetch('/api/pdi/competencias-template').then(r => r.ok ? r.json() : []).then((c: string[]) => { if (c.length) setCompsText(c.join('\n')) }).catch(() => {})
  }, [editorComps])

  const zeros = (n: number) => Array.from({ length: n }, () => 0)
  const [dir, setDir] = useState<number[]>(ciclo.avaliacao_diretiva.length ? ciclo.avaliacao_diretiva : zeros(comps.length))
  const [auto, setAuto] = useState<number[]>(ciclo.autoavaliacao.length ? ciclo.autoavaliacao : zeros(comps.length))
  const [amb, setAmb] = useState<number[]>(ciclo.ambicao.length ? ciclo.ambicao : zeros(comps.length))
  const [autoSalva, setAutoSalva] = useState(ciclo.autoavaliacao_salva)
  const [dataConversa, setDataConversa] = useState(ciclo.data_conversa ? ciclo.data_conversa.slice(0, 16) : '')
  const [saving, setSaving] = useState<'diretiva' | 'auto' | 'conversa' | 'datas' | null>(null)
  const [editDatas, setEditDatas] = useState(false)
  const [ini, setIni] = useState(ciclo.data_inicio ?? '')
  const [fim, setFim] = useState(ciclo.data_fim ?? '')
  const [ok, setOk] = useState<'' | 'diretiva' | 'conversa'>('')
  const okTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [aberto, setAberto] = useState(ativo)
  const [confirma, setConfirma] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => () => clearTimeout(okTimer.current), [])
  const marcarOk = (k: 'diretiva' | 'conversa') => { setOk(k); clearTimeout(okTimer.current); okTimer.current = setTimeout(() => setOk(''), 2500) }

  const max = comps.length * 5
  const soma = (a: number[]) => a.reduce((x, y) => x + (y || 0), 0)
  const patch = (body: Record<string, unknown>) => fetch(`/api/pdi/${ciclo.pdi_id}/ciclos/${ciclo.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  function aplicarComps() {
    const novas = compsText.split('\n').map(s => s.trim()).filter(Boolean)
    if (!novas.length) return
    setComps(novas); setDir(zeros(novas.length)); setAuto(zeros(novas.length)); setAmb(zeros(novas.length))
  }

  async function salvarDiretiva() {
    setSaving('diretiva'); setErr('')
    try {
      if (isDbPdi && isFirst && comps.length > 0) {
        const r = await fetch(`/api/pdi/${ciclo.pdi_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ competencias: comps }) })
        if (!r.ok) throw new Error()
        onCompsUpdated?.(comps)
      }
      const body: Record<string, unknown> = { avaliacao_diretiva: dir }
      if (isFirst) body.ambicao = amb
      if (!(await patch(body)).ok) throw new Error()
      onUpdate({ ...ciclo, avaliacao_diretiva: dir, ...(isFirst ? { ambicao: amb } : {}) })
      marcarOk('diretiva')
    } catch { setErr('Erro ao salvar avaliação diretiva.') } finally { setSaving(null) }
  }
  async function salvarAuto() {
    setSaving('auto'); setErr('')
    try {
      if (!(await patch({ autoavaliacao: auto, ambicao: amb, autoavaliacao_salva: true })).ok) throw new Error()
      setAutoSalva(true); onUpdate({ ...ciclo, autoavaliacao: auto, ambicao: amb, autoavaliacao_salva: true })
    } catch { setErr('Erro ao salvar autoavaliação.') } finally { setSaving(null) }
  }
  async function salvarConversa() {
    if (!dataConversa) { setErr('Informe a data e hora.'); return }
    setSaving('conversa'); setErr('')
    try {
      const iso = new Date(dataConversa).toISOString()
      if (!(await patch({ data_conversa: iso, colaborador_id: colaboradorId })).ok) throw new Error()
      onUpdate({ ...ciclo, data_conversa: iso }); marcarOk('conversa')
    } catch { setErr('Erro ao agendar conversa.') } finally { setSaving(null) }
  }
  async function salvarDatas() {
    if (!ini) { setErr('Informe a data de início.'); return }
    setSaving('datas'); setErr('')
    try {
      const r = await patch({ data_inicio: ini || null, data_fim: fim || null })
      if (!r.ok) throw new Error()
      const b = await r.json() as { status: 'ativo' | 'arquivado'; arquivado_em: string | null; outros_fechados?: Array<{ id: string; arquivado_em: string }> }
      onUpdate({ ...ciclo, data_inicio: ini || null, data_fim: fim || null, status: b.status, arquivado_em: b.arquivado_em })
      if (b.outros_fechados?.length) onUpdateOthers(b.outros_fechados.map(o => ({ id: o.id, status: 'arquivado' as const, arquivado_em: o.arquivado_em })))
      setEditDatas(false)
    } catch { setErr('Erro ao salvar datas.') } finally { setSaving(null) }
  }

  const sd = soma(dir), sa = soma(auto), sm = soma(amb)
  const conversaTxt = ciclo.data_conversa ? new Date(ciclo.data_conversa).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : null

  // Pauta e anotações da conversa = anotações do Diário ligadas a este ciclo (autor, dia e hora).
  // Editável também em ciclo arquivado. Pautas antigas (antes da unificação) aparecem só leitura
  // enquanto o ciclo não tiver nenhuma anotação no Diário.
  const notasCiclo = dados.anotacoes.filter(n => n.ciclo_id === ciclo.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const antigas = notasCiclo.length ? [] : [
    ...(ciclo.meu_rascunho?.trim() ? [{ user_nome: 'Você', texto: ciclo.meu_rascunho, updated_at: '' }] : []),
    ...ciclo.outros_rascunhos,
  ]
  const primeiroNome = pdi.nome.split(' ')[0]
  const pauta = gestao && (
    <div className="p2-card" style={{ boxShadow: 'none', overflow: 'hidden' }}>
      <div className="p2-card-h" style={{ padding: '10px 14px' }}>
        <h3 style={{ fontSize: 13 }}>🗒️ Pauta e anotações da conversa</h3>
        <span style={{ fontSize: 11.5, color: C.MU }}>também no Diário</span>
      </div>
      {notasCiclo.map(n => <NotaDiario key={n.id} n={n} pdi={pdi} dados={dados} primeiroNome={primeiroNome} semCiclo />)}
      {antigas.map((r, i) => (
        <div key={i} style={{ padding: '10px 14px', borderTop: '1px solid var(--p2-line-soft)', borderLeft: '3px solid var(--p2-gold)' }}>
          {r.updated_at ? <Autor nome={r.user_nome ?? 'Gestor'} criado={r.updated_at} /> : <b style={{ fontSize: 12.5 }}>{r.user_nome}</b>}
          <div style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 6 }}>{r.texto}</div>
        </div>
      ))}
      {notasCiclo.length === 0 && antigas.length === 0 && <div style={{ padding: '10px 14px', fontSize: 12.5, color: '#A3B0C4' }}>Nada anotado para esta conversa ainda.</div>}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--p2-line-soft)', background: '#FAFBFD' }}>
        <Composer pdi={pdi} dados={dados} primeiroNome={primeiroNome} cicloId={ciclo.id} tipos={['pauta', 'conversa', 'feedback', 'investigar']} tipoInicial="pauta" compacto />
      </div>
    </div>
  )

  return (
    <div className={cx('p2-card', 'is-hover')} style={{ marginBottom: 14, overflow: 'hidden', borderColor: ativo ? '#C9D8F0' : undefined }}>
      {/* Cabeçalho */}
      <div onClick={() => setAberto(a => !a)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', cursor: 'pointer', flexWrap: 'wrap', background: ativo ? 'linear-gradient(90deg,#F3F7FD,#fff)' : undefined }}>
        <Chev open={aberto} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Ciclo {ciclo.numero_ciclo} <span style={{ fontWeight: 500, color: C.MU, fontSize: 13 }}>· {periodo(ciclo.data_inicio, ciclo.data_fim)}</span></div>
          {ciclo.arquivado_em && <div style={{ fontSize: 11.5, color: '#94A3B8' }}>arquivado em {new Date(ciclo.arquivado_em).toLocaleDateString('pt-BR')}</div>}
        </div>
        {comps.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {(['dir', 'auto', 'amb'] as const).map(k => {
              const v = k === 'dir' ? sd : k === 'auto' ? sa : sm
              return <Pill key={k} bg={SERIES[k].bg} color={SERIES[k].cor} title={SERIES[k].label}>{SERIES[k].label[0]} {v}/{max}</Pill>
            })}
          </div>
        )}
        {conversaTxt && <Pill bg="var(--p2-gold-bg)" color="#92400E" title="Conversa agendada">💬 {conversaTxt}{ciclo.conversa_confirmada_em ? ' ✓' : ''}</Pill>}
        <Pill bg={ativo ? 'var(--p2-ok-bg)' : '#EEF2F7'} color={ativo ? '#166534' : '#64748B'}>{ativo ? '● Ativo' : 'Arquivado'}</Pill>
        {gestao && <button type="button" className="p2-icon-btn" title="Excluir ciclo" onClick={e => { e.stopPropagation(); setConfirma(true) }}>🗑</button>}
      </div>

      <Collapse open={aberto}>
        <div style={{ borderTop: '1px solid var(--p2-line-soft)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {err && <Alerta>{err}</Alerta>}

          {/* Datas do ciclo */}
          {gestao && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              {editDatas ? (
                <>
                  <div><span className="p2-label">Início</span><input type="date" value={ini} onChange={e => setIni(e.target.value)} className="p2-input" /></div>
                  <div><span className="p2-label">Fim</span><input type="date" value={fim} onChange={e => setFim(e.target.value)} className="p2-input" /></div>
                  <Btn sm onClick={salvarDatas} disabled={saving === 'datas'}>{saving === 'datas' ? 'Salvando…' : 'Salvar'}</Btn>
                  <Btn sm v="gho" onClick={() => { setEditDatas(false); setIni(ciclo.data_inicio ?? ''); setFim(ciclo.data_fim ?? '') }}>Cancelar</Btn>
                </>
              ) : (
                <span style={{ fontSize: 13, color: C.MU, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📅 Período <b style={{ color: C.TX }}>{periodo(ciclo.data_inicio, ciclo.data_fim)}</b>
                  <button type="button" className="p2-link" onClick={() => { setEditDatas(true); setIni(ciclo.data_inicio ?? ''); setFim(ciclo.data_fim ?? '') }}>editar datas</button>
                </span>
              )}
            </div>
          )}

          {/* Definir competências (ciclo 1 sem matriz) */}
          {editorComps && (
            <div style={{ background: 'var(--p2-blue-bg)', border: '1px solid #C9D8F0', borderRadius: 12, padding: '14px 16px' }}>
              <b style={{ fontSize: 13, color: '#1E40AF' }}>📊 Definir competências da matriz</b>
              <p style={{ fontSize: 12.5, color: '#374151', margin: '4px 0 10px' }}>Lista pré-preenchida com as competências do último PDI. Uma por linha; edite antes de aplicar.</p>
              <textarea value={compsText} onChange={e => setCompsText(e.target.value)} rows={8} className="p2-input" style={{ width: '100%' }} placeholder={'Proatividade\nRelacionamento Interpessoal\nComunicação'} />
              <div style={{ marginTop: 8 }}><Btn sm onClick={aplicarComps} disabled={!compsText.trim()}>Aplicar e preencher matriz</Btn></div>
            </div>
          )}
          {comps.length === 0 && !editorComps && <Vazio>{isDbPdi && isFirst ? 'Aguardando a gestão definir as competências.' : 'Competências não configuradas.'}</Vazio>}

          {comps.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Total k="dir" valor={sd} max={max} />
                <Total k="auto" valor={sa} max={max} />
                <Total k="amb" valor={sm} max={max} />
              </div>

              {/* Matriz */}
              <div style={{ border: '1px solid var(--p2-line)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 620 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.3fr) repeat(3, minmax(130px,1fr)) 64px', gap: 8, padding: '9px 14px', background: '#FAFBFD', borderBottom: '1px solid var(--p2-line)' }}>
                      <span className="p2-label" style={{ margin: 0 }}>Competência</span>
                      {(['dir', 'auto', 'amb'] as const).map(k => <span key={k} className="p2-label" style={{ margin: 0, color: SERIES[k].cor }}>{SERIES[k].label}</span>)}
                      <span className="p2-label" style={{ margin: 0, textAlign: 'right' }} title="Ambição − Diretiva">Lacuna</span>
                    </div>
                    {comps.map((c, i) => {
                      const lac = (amb[i] ?? 0) && (dir[i] ?? 0) ? (amb[i] ?? 0) - (dir[i] ?? 0) : null
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.3fr) repeat(3, minmax(130px,1fr)) 64px', gap: 8, padding: '8px 14px', alignItems: 'center', borderBottom: i < comps.length - 1 ? '1px solid var(--p2-line-soft)' : 'none' }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }} title={c}>{CURTO[c] ?? c}</span>
                          <Nota v={dir[i] ?? 0} cor={SERIES.dir.cor} editavel={gestao && ativo} onChange={v => setDir(p => { const a = [...p]; a[i] = v; return a })} />
                          <Nota v={auto[i] ?? 0} cor={SERIES.auto.cor} editavel={isColab && ativo && !autoSalva} onChange={v => setAuto(p => { const a = [...p]; a[i] = v; return a })} />
                          <Nota v={amb[i] ?? 0} cor={SERIES.amb.cor} editavel={ativo && isFirst && (gestao || (isColab && !autoSalva))} onChange={v => setAmb(p => { const a = [...p]; a[i] = v; return a })} />
                          <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: lac === null ? '#A3B0C4' : lac > 0 ? '#9A3412' : '#166534' }}>{lac === null ? '—' : lac > 0 ? `+${lac}` : lac}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {gestao && ativo && <Btn onClick={salvarDiretiva} disabled={saving === 'diretiva'}>{saving === 'diretiva' ? 'Salvando…' : 'Salvar avaliação diretiva'}</Btn>}
                {ok === 'diretiva' && <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>✓ Salvo</span>}
                {isColab && ativo && !autoSalva && <Btn onClick={salvarAuto} disabled={saving === 'auto'} style={{ background: SERIES.auto.cor }}>{saving === 'auto' ? 'Salvando…' : 'Confirmar autoavaliação'}</Btn>}
                {isColab && autoSalva && <Pill bg="var(--p2-ok-bg)" color="#166534">✓ Autoavaliação registrada</Pill>}
                {isColab && ativo && !autoSalva && <span style={{ fontSize: 12, color: C.MU }}>Clique nas bolinhas para marcar de 1 a 5. Depois de confirmar, não dá mais para alterar.</span>}
              </div>
            </>
          )}

          {/* Conversa + pauta */}
          {gestao && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
              {ativo && (
                <div className="p2-card" style={{ boxShadow: 'none' }}>
                  <div className="p2-card-h" style={{ padding: '10px 14px' }}><h3 style={{ fontSize: 13 }}>💬 Conversa do ciclo</h3>{ok === 'conversa' && <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>✓ Salvo</span>}</div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input type="datetime-local" value={dataConversa} onChange={e => setDataConversa(e.target.value)} className="p2-input" />
                      <Btn sm onClick={salvarConversa} disabled={saving === 'conversa'}>{saving === 'conversa' ? 'Salvando…' : ciclo.data_conversa ? 'Remarcar' : 'Agendar'}</Btn>
                    </div>
                    {ciclo.data_conversa && (
                      <div style={{ fontSize: 12.5, marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>Agendada para <b>{conversaTxt}</b></span>
                        {ciclo.conversa_confirmada_em ? <Pill bg="var(--p2-ok-bg)" color="#166534">✓ Confirmada</Pill> : <Pill bg="#FFFBEB" color="#92400E">⏳ Aguardando confirmação</Pill>}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {pauta}
            </div>
          )}
          {isColab && ciclo.data_conversa && (
            <div style={{ background: 'var(--p2-gold-bg)', borderRadius: 12, padding: '12px 14px', fontSize: 13 }}>
              💬 Sua conversa está agendada para <b>{conversaTxt}</b>
              {ciclo.conversa_confirmada_em && <Pill bg="var(--p2-ok-bg)" color="#166534">✓ Confirmada</Pill>}
            </div>
          )}
        </div>
      </Collapse>

      {confirma && (
        <Modal titulo={`Excluir o ciclo ${ciclo.numero_ciclo}?`} onClose={() => setConfirma(false)} largura={440}>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: C.MU }}>As notas e a conversa deste ciclo ({periodo(ciclo.data_inicio, ciclo.data_fim)}) serão removidas permanentemente. A pauta e as anotações continuam no Diário, sem o vínculo com o ciclo.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn v="gho" onClick={() => setConfirma(false)}>Cancelar</Btn>
            <Btn v="danger" onClick={() => { setConfirma(false); onDelete(ciclo.id) }}>Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** Evolução dos totais entre ciclos (só quando há 2+ ciclos com nota). */
function Evolucao({ ciclos, n }: { ciclos: Ciclo[]; n: number }) {
  const com = [...ciclos].filter(c => c.avaliacao_diretiva.some(v => v > 0) || c.autoavaliacao.some(v => v > 0)).sort((a, b) => a.numero_ciclo - b.numero_ciclo)
  if (com.length < 2 || !n) return null
  const max = n * 5
  const tot = (a: number[]) => a.reduce((x, y) => x + (y || 0), 0)
  return (
    <div className="p2-card" style={{ marginBottom: 14 }}>
      <div className="p2-card-h"><h3>📈 Evolução entre ciclos</h3>
        <span style={{ display: 'flex', gap: 12, fontSize: 12, color: C.MU }}>
          {(['dir', 'auto'] as const).map(k => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: SERIES[k].cor }} />{SERIES[k].label}</span>)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 18, padding: '14px 18px', alignItems: 'flex-end', overflowX: 'auto' }}>
        {com.map(c => {
          const d = tot(c.avaliacao_diretiva), a = tot(c.autoavaliacao)
          return (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 74 }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 90 }}>
                {[{ v: d, cor: SERIES.dir.cor, l: 'Diretiva' }, { v: a, cor: SERIES.auto.cor, l: 'Auto' }].map(b => (
                  <div key={b.l} title={`${b.l}: ${b.v}/${max}`} style={{ width: 18, height: `${Math.max(4, (b.v / max) * 90)}px`, background: b.cor, borderRadius: '4px 4px 0 0', transition: 'height .6s var(--p2-ease-out)' }} />
                ))}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700 }}>Ciclo {c.numero_ciclo}</div>
              <div style={{ fontSize: 11, color: C.MU }}>{d} · {a}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AvaliacoesTab({ pdi, papel, isDbPdi, dados }: { pdi: PdiColaborador; papel: string; isDbPdi?: boolean; dados: Acompanhamento }) {
  const [ciclos, setCiclos] = useState<Ciclo[]>([])
  const [loading, setLoading] = useState(true)
  const [colaboradorId, setColaboradorId] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [criando, setCriando] = useState(false)
  const [erroNovo, setErroNovo] = useState('')
  const [novoInicio, setNovoInicio] = useState(primeiroDoMes)
  const [comps, setComps] = useState<string[]>(pdi.matrizAvaliacao.competencias)
  const gestao = ['gestor', 'admin'].includes(papel)

  useEffect(() => {
    let vivo = true
    fetch(`/api/pdi/${pdi.id}/ciclos`).then(r => r.ok ? r.json() : Promise.reject()).then((d: Ciclo[]) => {
      if (!vivo) return
      setColaboradorId(d[0]?.colaborador_id ?? null); setCiclos(d)
    }).catch(() => {}).finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [pdi.id])

  async function criar() {
    setCriando(true); setErroNovo('')
    try {
      const r = await fetch(`/api/pdi/${pdi.id}/ciclos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colaborador_id: colaboradorId, data_inicio: novoInicio }) })
      if (!r.ok) { const b = await r.json().catch(() => ({})) as { error?: string }; throw new Error(b.error ?? 'Erro ao criar ciclo') }
      const c: Ciclo = await r.json()
      const d = new Date(novoInicio + 'T12:00:00'); d.setDate(d.getDate() - 1)
      const fimAnterior = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      setCiclos(p => [{ ...c, meu_rascunho: null, outros_rascunhos: [] }, ...p.map(x => x.status === 'ativo' ? { ...x, status: 'arquivado' as const, arquivado_em: new Date().toISOString(), data_fim: fimAnterior } : x)])
      setNovo(false)
    } catch (e) { setErroNovo(e instanceof Error ? e.message : 'Erro ao criar ciclo') } finally { setCriando(false) }
  }

  function excluir(id: string) {
    setCiclos(p => {
      const resto = p.filter(c => c.id !== id)
      if (p.find(c => c.id === id)?.status === 'ativo' && resto.length > 0) resto[0] = { ...resto[0], status: 'ativo' }
      return resto
    })
    fetch(`/api/pdi/${pdi.id}/ciclos/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  if (loading) return <Carregando txt="Carregando avaliações…" />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: C.MU, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span><b style={{ color: C.TX }}>{ciclos.length}</b> ciclo{ciclos.length !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 12 }}>Escala: 1 não possui · 2 básico · 3 com alguma assistência · 4 sem acompanhamento · 5 domina e compartilha</span>
        </div>
        {gestao && <Btn onClick={() => setNovo(true)}>＋ Novo ciclo</Btn>}
      </div>

      <Evolucao ciclos={ciclos} n={comps.length} />

      {ciclos.length === 0 && <Vazio>Nenhum ciclo de avaliação iniciado.</Vazio>}
      <div className="p2-stagger">
        {ciclos.map(c => (
          <CicloCard key={c.id} ciclo={c} pdi={pdi} dados={dados} papel={papel} colaboradorId={colaboradorId}
            onUpdate={u => setCiclos(p => p.map(x => x.id === u.id ? u : x))}
            onUpdateOthers={ps => setCiclos(p => p.map(x => { const q = ps.find(y => y.id === x.id); return q ? { ...x, status: q.status, arquivado_em: q.arquivado_em } : x }))}
            onDelete={excluir} isFirst={c.numero_ciclo === 1} isDbPdi={isDbPdi} propComps={comps} onCompsUpdated={setComps} />
        ))}
      </div>

      {novo && (
        <Modal titulo="🔄 Iniciar novo ciclo" onClose={() => { setNovo(false); setErroNovo(''); setNovoInicio(primeiroDoMes()) }} largura={460}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: C.MU, lineHeight: 1.6 }}>
            O ciclo atual será arquivado com encerramento no dia anterior ao início do novo. A autoavaliação começa em branco e a ambição continua a do ciclo inicial.
          </p>
          <span className="p2-label">Início do novo ciclo</span>
          <input type="date" value={novoInicio} onChange={e => setNovoInicio(e.target.value)} className="p2-input" style={{ width: '100%' }} />
          {erroNovo && <div style={{ marginTop: 12 }}><Alerta>{erroNovo}</Alerta></div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <Btn v="gho" onClick={() => { setNovo(false); setErroNovo(''); setNovoInicio(primeiroDoMes()) }}>Cancelar</Btn>
            <Btn onClick={criar} disabled={criando}>{criando ? 'Criando…' : 'Confirmar'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
