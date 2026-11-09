'use client'

// Suporte (material "Medindo o Suporte GT3"): camada 2 (com rastro). A camada 3 (amostragem do
// trabalho) virou a aba Extra portal; o fechamento das tres camadas, a aba Fechamento.

import { useEffect, useRef, useState } from 'react'
import { useCs } from '../cs-data'
import {
  baixar, csvCell, dt, fmt, mmss, nomeCtt, nomeUsuario, norm, unidadesDe,
  type Ctx,
} from '../cs-lib'
import {
  calcCamada2, tempoAtividade, tempoC2,
  type AtivMedicao, type Atividade, type VolumeLinha,
} from '../cs-suporte-lib'
import { BotaoConfirmar, CampoTempo, useOrdem } from '../cs-ui'
import { lerMinutos, useTempo } from '../cs-tempo'
import { lerArquivo } from './Contagem'
import { NumCampo } from './Resultado'
import { useSuporte, type SuporteApi } from './suporte-data'

const SUBS = [['cron', '⏱ Cronometrar atividade'], ['c2', 'Atividades e volumes'], ['metodo', 'Como funciona']] as const
type Sub = typeof SUBS[number][0]

export default function Suporte() {
  const { ctx, meuId } = useCs()
  const s = useSuporte(meuId)
  const [sub, setSub] = useState<Sub>('cron')
  if (!ctx) return null
  if (s.carregando) return <div className="empty">Carregando…</div>
  if (s.faltaSql) {
    return (
      <div className="box">
        <h2>Falta criar as tabelas do suporte</h2>
        <p className="note">Rode <b>sql/custo-servir-suporte.sql</b> no SQL Editor do Supabase e clique em tentar de novo.</p>
        <div className="row"><button type="button" className="btn solid" onClick={() => void s.recarregar()}>Tentar de novo</button></div>
      </div>
    )
  }
  return (
    <>
      <div className="cfgnav">
        {SUBS.map(([k, l]) => <button key={k} type="button" className={k === sub ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}
      </div>
      {sub === 'c2' && <Camada2 ctx={ctx} s={s} />}
      {sub === 'cron' && <CronometroSimples ctx={ctx} s={s} />}
      {sub === 'metodo' && <Metodo />}
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Camada 2
// ═════════════════════════════════════════════════════════════════════════════
function Camada2({ ctx, s }: { ctx: Ctx; s: SuporteApi }) {
  const { tentar } = useCs()
  const base = ctx.cfg.base
  const tempo = (id: string) => tempoAtividade(s.meds, id, base)
  const [novo, setNovo] = useState('')
  const [novaUn, setNovaUn] = useState<Atividade['unidade']>('quantidade')
  return (
    <>
      <div className="box">
        <h2>Atividades com rastro</h2>
        <p className="note">Mesma lógica da avaliação: volume da atividade × tempo-padrão. Cronometre 5 a 10 de cada para ter o tempo; associe a medição a um contratante ou grupo quando o tempo dele for diferente (ex.: faturamento da SEDE / MATRIZ). Ligação usa os minutos que a central já registra (não precisa de tempo-padrão).</p>
        <div className="tbl">
          <table>
            <thead><tr><th>Atividade</th><th>Unidade</th><th>Fonte do volume</th><th>Liga ao contratante por</th><th className="r">Medições</th><th className="r">Tempo-padrão (min)</th><th title="Contratantes ou grupos com o mínimo de medições próprias">Tempos específicos</th><th className="c">Ativa</th><th /></tr></thead>
            <tbody>
              {s.ativs.map(a => <LinhaAtividade key={a.id} ctx={ctx} s={s} a={a} t={tempo(a.id)} />)}
            </tbody>
          </table>
        </div>
        <div className="row">
          <input type="text" value={novo} onChange={e => setNovo(e.target.value)} placeholder="Nova atividade (ex.: Cadastro de veículo)" style={{ flex: 1, minWidth: 220 }} />
          <select value={novaUn} onChange={e => setNovaUn(e.target.value as Atividade['unidade'])} aria-label="Unidade">
            <option value="quantidade">por quantidade</option>
            <option value="minutos">já em minutos</option>
          </select>
          <button type="button" className="btn solid" disabled={!novo.trim()} onClick={async () => { if (await tentar(() => s.adicionarAtividade(novo.trim(), novaUn), 'Atividade criada')) setNovo('') }}>Adicionar</button>
        </div>
      </div>
      <CronometroAtividade ctx={ctx} s={s} />
      <Volumes ctx={ctx} s={s} />
    </>
  )
}

/** Linha da atividade: ver, editar (nome, unidade, fonte, ligacao) e excluir. */
function LinhaAtividade({ ctx, s, a, t }: { ctx: Ctx; s: SuporteApi; a: Atividade; t: ReturnType<typeof tempoAtividade> }) {
  const { tentar } = useCs()
  const tm = useTempo()
  const [ed, setEd] = useState<{ nome: string; unidade: Atividade['unidade']; fonte: string; liga_por: string } | null>(null)
  const nMed = s.meds.filter(m => m.atividade_id === a.id).length
  const nVol = s.linhas.filter(l => l.atividade_id === a.id).length
  if (ed) {
    return (
      <tr className="sel">
        <td><input type="text" value={ed.nome} onChange={e => setEd({ ...ed, nome: e.target.value })} aria-label="Nome" style={{ width: '100%', minWidth: 160 }} /></td>
        <td>
          <select value={ed.unidade} onChange={e => setEd({ ...ed, unidade: e.target.value as Atividade['unidade'] })} aria-label="Unidade">
            <option value="quantidade">quantidade</option>
            <option value="minutos">minutos</option>
          </select>
        </td>
        <td><input type="text" value={ed.fonte} onChange={e => setEd({ ...ed, fonte: e.target.value })} aria-label="Fonte do volume" placeholder="opcional" style={{ width: '100%', minWidth: 140 }} /></td>
        <td><input type="text" value={ed.liga_por} onChange={e => setEd({ ...ed, liga_por: e.target.value })} aria-label="Liga ao contratante por" placeholder="opcional" style={{ width: '100%', minWidth: 140 }} /></td>
        <td colSpan={4} className="note">{ed.unidade !== a.unidade ? (ed.unidade === 'minutos' ? 'Passa a usar o volume como minutos (as medições ficam guardadas, mas não entram).' : 'Passa a usar volume × tempo-padrão cronometrado.') : ''}</td>
        <td>
          <span className="pills">
            <button type="button" className="btn sm solid" disabled={!ed.nome.trim()} onClick={async () => {
              const patch = { nome: ed.nome.trim(), unidade: ed.unidade, fonte: ed.fonte.trim() || null, liga_por: ed.liga_por.trim() || null }
              if (await tentar(() => s.salvarAtividade(a.id, patch), 'Atividade salva')) setEd(null)
            }}>Salvar</button>
            <button type="button" className="btn sm" onClick={() => setEd(null)}>Cancelar</button>
          </span>
        </td>
      </tr>
    )
  }
  return (
    <tr>
      <td><b style={{ fontWeight: 600 }}>{a.nome}</b></td>
      <td className="note">{a.unidade === 'minutos' ? 'minutos' : 'quantidade'}</td>
      <td className="note">{a.fonte ?? '—'}</td>
      <td className="note">{a.liga_por ?? '—'}</td>
      <td className="r mono">{a.unidade === 'minutos' ? '—' : t.n}</td>
      <td className="r mono">{a.unidade === 'minutos' ? <span className="note">duração informada</span> : t.val != null ? tm.min(t.val, 2) : <span className="pill p-warn">cronometrar</span>}</td>
      <td className="note">{a.unidade === 'minutos' ? '—' : especificos(ctx, s.meds, a.id) || '—'}</td>
      <td className="c"><input type="checkbox" checked={a.ativo} aria-label="Ativa" onChange={e => tentar(() => s.salvarAtividade(a.id, { ativo: e.target.checked }))} /></td>
      <td>
        <span className="pills">
          <button type="button" className="btn sm" onClick={() => setEd({ nome: a.nome, unidade: a.unidade, fonte: a.fonte ?? '', liga_por: a.liga_por ?? '' })}>Editar</button>
          <span title={nMed || nVol ? `Exclui também ${nMed} medição(ões) e as linhas de volume dela em todos os lotes${nVol ? ` (${nVol} no lote aberto)` : ''}` : 'Excluir atividade'}>
            <BotaoConfirmar onConfirm={() => void tentar(() => s.excluirAtividade(a.id), 'Atividade excluída')}>Excluir</BotaoConfirmar>
          </span>
        </span>
      </td>
    </tr>
  )
}

/** Tempo decorrido do cronometro de atividade (relogio fora do render puro). */
const decorrido = (t: { run: boolean; acc: number; t0: number }) => t.acc + (t.run ? performance.now() - t.t0 : 0)

/** Contratantes/grupos que ja tem tempo proprio (minimo de medicoes) na atividade. */
function especificos(ctx: Ctx, meds: AtivMedicao[], ativId: string) {
  const cont = new Map<string, number>()
  for (const m of meds) {
    if (m.atividade_id !== ativId || m.situacao !== 'validada' || !m.contratante_cod) continue
    const k = (m.grupo ? 'Σ ' : '') + m.contratante_cod
    cont.set(k, (cont.get(k) ?? 0) + 1)
  }
  return [...cont].filter(([, n]) => n >= ctx.cfg.minimo).map(([k]) => k).join(', ')
}

const rotuloAssoc = (ctx: Ctx, m: AtivMedicao) =>
  !m.contratante_cod ? '—' : (m.grupo ? 'Σ grupo ' : '') + m.contratante_cod + ' · ' + nomeCtt(ctx, m.contratante_cod)

/** Cronometro simples, para quem nao lida bem com sistema: escolhe a atividade, Comecar, Terminei. */
function CronometroSimples({ ctx, s }: { ctx: Ctx; s: SuporteApi }) {
  const { tentar, toast, meuId } = useCs()
  const tm = useTempo()
  const ativs = s.ativs.filter(a => a.ativo && a.unidade === 'quantidade')
  const emMinutos = s.ativs.filter(a => a.ativo && a.unidade === 'minutos')
  const [sel, setSel] = useState<string | null>(null)
  const [cod, setCod] = useState('')
  const [t, setT] = useState<{ run: boolean; acc: number; t0: number }>({ run: false, acc: 0, t0: 0 })
  const [salvo, setSalvo] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!t.run) return
    let raf = 0
    const loop = () => { setTick(x => x + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [t.run])
  const a = ativs.find(x => x.id === sel)
  const ms = decorrido(t)
  const zerar = () => setT({ run: false, acc: 0, t0: 0 })
  const ctts = [...ctx.ctts.values()].sort((x, y) => (+x.contratante_cod || 0) - (+y.contratante_cod || 0))
  const minhas = s.meds.filter(m => m.avaliador_id === meuId).slice(0, 8)

  async function terminar() {
    if (!a || salvando) return
    const total = decorrido(t)
    setT({ run: false, acc: total, t0: 0 })
    if (total < 1000) { toast('Foi muito rápido (menos de 1 segundo). Clique em Começar de novo.'); zerar(); return }
    setSalvando(true)
    const okk = await tentar(() => s.registrarMedAtiv(a.id, total, 'validada', null, cod || null, false))
    setSalvando(false)
    if (okk) { setSalvo(`Salvo: ${a.nome} levou ${mmss(total)}.`); zerar() }
  }

  if (!a) {
    return (
      <>
        <div className="box">
          <h2>O que você vai cronometrar agora?</h2>
          <div className="passos">
            <span><b>1</b> Clique na atividade</span><span><b>2</b> Clique em <b>Começar</b></span><span><b>3</b> Quando terminar, clique em <b>Terminei</b></span>
          </div>
          <div className="atv-grid">
            {ativs.map(x => {
              const tp = tempoAtividade(s.meds, x.id, ctx.cfg.base)
              const falta = Math.max(0, ctx.cfg.minimo - tp.n)
              return (
                <button key={x.id} type="button" className="atv-card" onClick={() => { setSel(x.id); setCod(''); setSalvo(null); zerar() }}>
                  <b>{x.nome}</b>
                  <span className="note">{tp.val != null ? `Leva em média ${tm.mu(tp.val, 1)}` : 'Ainda não cronometrado'}</span>
                  {falta ? <span className="pill p-warn">faltam {falta} medição{falta > 1 ? 'ões' : ''}</span> : <span className="pill p-good">✓ tempo pronto · {tp.n} medições</span>}
                </button>
              )
            })}
          </div>
          {emMinutos.length > 0 && <p className="note">{emMinutos.map(x => x.nome).join(', ')}: não precisam de cronômetro, porque o tempo já vem em minutos no volume (ex.: a central de ligações).</p>}
        </div>
        {minhas.length > 0 && (
          <div className="box">
            <h2>Minhas últimas medições</h2>
            <div className="tbl">
              <table>
                <thead><tr><th>Quando</th><th>Atividade</th><th>Cliente</th><th className="r">Tempo</th><th /></tr></thead>
                <tbody>
                  {minhas.map(m => (
                    <tr key={m.id}>
                      <td className="mono">{dt(m.created_at)}</td>
                      <td>{s.ativs.find(x => x.id === m.atividade_id)?.nome ?? '—'}{m.situacao === 'descartada' && <> <span className="pill p-gray">descartada</span></>}</td>
                      <td className="note">{rotuloAssoc(ctx, m)}</td>
                      <td className="r mono">{mmss(m.duracao_ms)}</td>
                      <td><BotaoConfirmar onConfirm={() => void tentar(() => s.excluirMedAtiv(m.id), 'Medição excluída')}>Excluir</BotaoConfirmar></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">Errou? Exclua a medição e cronometre de novo.</p>
          </div>
        )}
      </>
    )
  }

  const rodando = t.run, pausado = !t.run && t.acc > 0
  return (
    <div className="box simples">
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }} disabled={rodando || pausado}
        onClick={() => { setSel(null); setSalvo(null) }} title={rodando || pausado ? 'Termine ou cancele antes' : undefined}>← Escolher outra atividade</button>
      <span className="eyebrow">Cronometrando</span>
      <h2 className="grande">{a.nome}</h2>
      {salvo && <div className="okbox">✓ {salvo} Quer cronometrar outra vez? É só clicar em Começar.</div>}
      <label className="note" style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 420 }}>
        É de algum cliente específico? (opcional)
        <select value={cod} onChange={e => setCod(e.target.value)} disabled={rodando || pausado} aria-label="Cliente">
          <option value="">Não, é geral</option>
          {ctts.map(c => <option key={c.contratante_cod} value={c.contratante_cod}>{c.contratante_cod} · {c.nome}</option>)}
        </select>
      </label>
      <div className={'disp xl' + (rodando ? ' run' : '')}>{mmss(ms)}</div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {!rodando && !pausado && <button type="button" className="btn solid xl" onClick={() => { setSalvo(null); setT({ run: true, acc: 0, t0: performance.now() }) }}>▶ Começar</button>}
        {rodando && <>
          <button type="button" className="btn good xl" disabled={salvando} onClick={() => void terminar()}>■ Terminei</button>
          <button type="button" className="btn xl" onClick={() => setT(p => ({ run: false, acc: p.acc + performance.now() - p.t0, t0: 0 }))}>❚❚ Pausar</button>
        </>}
        {pausado && <>
          <button type="button" className="btn good xl" disabled={salvando} onClick={() => void terminar()}>■ Terminei</button>
          <button type="button" className="btn xl" onClick={() => setT(p => ({ ...p, run: true, t0: performance.now() }))}>▶ Continuar</button>
        </>}
      </div>
      {(rodando || pausado) && <button type="button" className="link" onClick={zerar}>Cancelar (não salvar)</button>}
      <p className="note">Foi interrompido no meio (telefone, alguém chamou)? Use <b>Pausar</b> e depois <b>Continuar</b>.</p>
    </div>
  )
}

function CronometroAtividade({ ctx, s }: { ctx: Ctx; s: SuporteApi }) {
  const { d, tentar, toast } = useCs()
  const tm = useTempo()
  const cronometraveis = s.ativs.filter(a => a.ativo && a.unidade === 'quantidade')
  const [ativId, setAtivId] = useState('')
  // '' = sem associacao | 'c:<cod>' contratante | 'g:<cod>' grupo do principal
  const [assoc, setAssoc] = useState('')
  const [t, setT] = useState<{ run: boolean; acc: number; t0: number; parado: boolean }>({ run: false, acc: 0, t0: 0, parado: false })
  const [, setTick] = useState(0)
  const raf = useRef(0)
  const sel = cronometraveis.find(a => a.id === ativId) ?? cronometraveis[0]
  useEffect(() => {
    if (!t.run) return
    const loop = () => { setTick(x => x + 1); raf.current = requestAnimationFrame(loop) }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [t.run])
  const ms = decorrido(t)
  const zerar = () => setT({ run: false, acc: 0, t0: 0, parado: false })
  async function registrar(situacao: 'validada' | 'descartada', motivo: string | null) {
    if (!sel) return
    const total = decorrido(t)
    if (total < 1000) { toast('Medição muito curta (menos de 1 s).'); return }
    const cod = assoc ? assoc.slice(2) : null, grupo = assoc.startsWith('g:')
    if (await tentar(() => s.registrarMedAtiv(sel.id, total, situacao, motivo, cod, grupo), situacao === 'validada' ? `Validada: ${mmss(total)}${cod ? ' · ' + (grupo ? 'grupo ' : '') + cod : ''}` : 'Medição descartada e registrada')) zerar()
  }
  const lista = sel ? s.meds.filter(m => m.atividade_id === sel.id) : []
  const tp = sel ? tempoAtividade(s.meds, sel.id, ctx.cfg.base) : null
  const codAssoc = assoc ? assoc.slice(2) : null, grupoAssoc = assoc.startsWith('g:')
  const tpAssoc = sel && codAssoc ? tempoAtividade(s.meds, sel.id, ctx.cfg.base, m => m.contratante_cod === codAssoc && m.grupo === grupoAssoc) : null
  const principais = [...new Set([...ctx.ctts.values()].map(c => c.contratante_pai).filter((x): x is string => !!x))].sort((a, b) => (+a || 0) - (+b || 0))
  const ctts = [...ctx.ctts.values()].sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0))
  return (
    <div className="timer">
      <div className={'clock' + (t.run ? ' run' : t.parado ? ' stop' : '')}>
        <span className="eyebrow">Cronometrar atividade</span>
        <select value={sel?.id ?? ''} onChange={e => { setAtivId(e.target.value); zerar() }} disabled={t.run || t.acc > 0} aria-label="Atividade">
          {cronometraveis.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        <label className="note" style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 360 }}>Associar a
          <select value={assoc} onChange={e => setAssoc(e.target.value)} aria-label="Associar a contratante ou grupo">
            <option value="">Sem associação (entra só no tempo geral)</option>
            {principais.length > 0 && <optgroup label="Grupo (principal + unidades)">
              {principais.map(p => <option key={'g' + p} value={'g:' + p}>Σ {p} · {nomeCtt(ctx, p)} ({unidadesDe(ctx, p).length} unidades)</option>)}
            </optgroup>}
            <optgroup label="Contratante">
              {ctts.map(c => <option key={c.contratante_cod} value={'c:' + c.contratante_cod}>{c.contratante_cod} · {c.nome}</option>)}
            </optgroup>
          </select>
        </label>
        <div className="disp">{mmss(ms)}</div>
        <div className="ctl">
          {!t.run && t.acc === 0 && <button type="button" className="btn solid" disabled={!sel} onClick={() => setT({ run: true, acc: 0, t0: performance.now(), parado: false })}>▶ Iniciar</button>}
          {t.run && <>
            <button type="button" className="btn" onClick={() => setT(p => ({ ...p, run: false, acc: p.acc + performance.now() - p.t0 }))}>❚❚ Pausar</button>
            <button type="button" className="btn solid" onClick={() => setT(p => ({ ...p, run: false, acc: p.acc + performance.now() - p.t0, parado: true }))}>■ Parar</button>
          </>}
          {!t.run && t.acc > 0 && <>
            <button type="button" className="btn good" onClick={() => registrar('validada', null)}>✓ Validar</button>
            <button type="button" className="btn" onClick={() => setT(p => ({ ...p, run: true, t0: performance.now(), parado: false }))}>▶ Continuar</button>
          </>}
        </div>
        {!t.run && t.acc > 0 && (
          <div className="reasons">
            {['Interrupção', 'Atividade atípica', 'Erro de medição'].map(m => <button key={m} type="button" onClick={() => registrar('descartada', m)}>{m}</button>)}
            <button type="button" className="link" onClick={zerar}>Zerar sem registrar</button>
          </div>
        )}
      </div>
      <div className="box">
        <h2>{sel ? sel.nome : 'Medições'}</h2>
        {tp && <div className="stats">
          <div><b>{tp.n}</b><span>validadas</span></div>
          <div><b>{tp.val != null ? tm.min(tp.val, 2) : '—'}</b><span>tempo-padrão ({ctx.cfg.base === 'media' ? 'média' : 'mediana'}, min)</span></div>
          <div><b>{tp.mean != null ? tm.min(tp.mean, 2) : '—'}</b><span>média</span></div>
          {tpAssoc && <>
            <div><b>{tpAssoc.n}/{ctx.cfg.minimo}</b><span>{grupoAssoc ? 'do grupo ' : 'de '}{codAssoc}</span></div>
            <div><b>{tpAssoc.val != null ? tm.min(tpAssoc.val, 2) : '—'}</b><span>tempo {grupoAssoc ? 'do grupo' : 'do contratante'} (min)</span></div>
            <div><b>{tpAssoc.n >= ctx.cfg.minimo ? 'próprio' : 'geral'}</b><span>tempo usado na camada 2</span></div>
          </>}
        </div>}
        <p className="note">Medições associadas também entram no tempo geral. Com {ctx.cfg.minimo} ou mais medições de um contratante (ou do grupo dele), a camada 2 passa a usar esse tempo próprio para ele; antes disso, usa o geral.</p>
        <div className="tbl scroll" style={{ maxHeight: 300 }}>
          <table>
            <thead><tr><th>Data</th><th>Quem</th><th>Associada a</th><th className="r">Tempo</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lista.length ? lista.map(m => (
                <tr key={m.id}>
                  <td className="mono">{dt(m.created_at)}</td>
                  <td>{nomeUsuario(d.usuarios.find(u => u.id === m.avaliador_id))}</td>
                  <td className="note">{rotuloAssoc(ctx, m)}</td>
                  <td className="r mono">{mmss(m.duracao_ms)}</td>
                  <td>{m.situacao === 'validada' ? <span className="pill p-blue">Na média</span> : <span className="pill p-gray" title={m.motivo ?? ''}>Descartada</span>}</td>
                  <td>
                    <span className="pills">
                      <button type="button" className={'btn sm' + (m.situacao === 'validada' ? ' bad' : '')} onClick={() => tentar(() => s.alternarMedAtiv(m))}>{m.situacao === 'validada' ? 'Descartar' : 'Restaurar'}</button>
                      <BotaoConfirmar onConfirm={() => void tentar(() => s.excluirMedAtiv(m.id), 'Medição excluída')}>Excluir</BotaoConfirmar>
                    </span>
                  </td>
                </tr>
              )) : <tr><td colSpan={6} className="empty">Nenhuma medição ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const COLS_VOLUME = ['Atividade', 'Contratantes', 'Quantidade', 'Prestador', 'Referência']

function parseVolumes(aoa: unknown[][], ativs: Atividade[]): { linhas: VolumeLinha[]; ignoradas: string[] } {
  if (!aoa.length) return { linhas: [], ignoradas: [] }
  const h = aoa[0].map(x => norm(x).toLowerCase().replace(/[^a-z0-9]/g, ''))
  const ix = {
    at: h.findIndex(x => x.startsWith('atividade')), ct: h.findIndex(x => x.startsWith('contratante')),
    q: h.findIndex(x => x.startsWith('quantidade') || x.startsWith('volume') || x.startsWith('minutos')),
    p: h.findIndex(x => x.startsWith('prestador')), r: h.findIndex(x => x.startsWith('referencia')),
  }
  if (ix.at < 0 || ix.q < 0) throw new Error('O arquivo precisa das colunas "Atividade" e "Quantidade".')
  const linhas: VolumeLinha[] = [], ignoradas: string[] = []
  for (const r of aoa.slice(1)) {
    const nomeAt = String(r[ix.at] ?? '').trim()
    if (!nomeAt) continue
    const a = ativs.find(x => x.chave === nomeAt || norm(x.nome) === norm(nomeAt))
    const q = Number(String(r[ix.q] ?? '').replace(/\./g, '').replace(',', '.'))
    if (!a || !Number.isFinite(q)) { ignoradas.push(nomeAt); continue }
    linhas.push({
      atividade_id: a.id, quantidade: q,
      contratantes: ix.ct >= 0 ? String(r[ix.ct] ?? '').split(/[;,\s]+/).map(x => x.trim()).filter(Boolean) : [],
      prestador: ix.p >= 0 ? String(r[ix.p] ?? '').trim() || null : null,
      referencia: ix.r >= 0 ? String(r[ix.r] ?? '').trim() || null : null,
    })
  }
  return { linhas, ignoradas }
}

function Volumes({ ctx, s }: { ctx: Ctx; s: SuporteApi }) {
  const { tentar, toast } = useCs()
  const tm = useTempo()
  const [dias, setDias] = useState('')
  const [importando, setImportando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [m, setM] = useState({ at: '', cts: '', q: '', ref: '' })
  // Atividade em minutos (ex.: ligacao): aceita 90 ou 1:30; senao, quantidade inteira
  const emMin = s.ativs.find(a => a.id === m.at)?.unidade === 'minutos'
  const qtdMao = m.q.trim() === '' ? null : emMin ? lerMinutos(m.q) : Number.isFinite(Number(m.q)) ? Number(m.q) : null
  const c2 = calcCamada2(s.linhas, s.ativs, tempoC2(ctx, s.meds))
  const diasMes = ctx.cfg.dias_mes ?? ctx.cfg.dias_uteis
  const fator = s.loteSel?.dias_uteis && diasMes ? diasMes / s.loteSel.dias_uteis : null
  const naoCadastrados = [...new Set(s.linhas.flatMap(l => l.contratantes))].filter(c => !ctx.ctts.has(c))
  const lista = Object.entries(c2.porCtt).map(([c, min]) => ({ c, min }))
  const { sorted, th } = useOrdem(lista, { c: x => +x.c || x.c, nome: x => nomeCtt(ctx, x.c), min: x => x.min }, { col: 'min', dir: 'desc' })

  async function onArquivo(f: File) {
    setImportando(true)
    try {
      const { linhas, ignoradas } = parseVolumes(await lerArquivo(f), s.ativs)
      if (!linhas.length) throw new Error('Nenhuma linha reconhecida.' + (ignoradas.length ? ' Atividades não encontradas: ' + [...new Set(ignoradas)].slice(0, 5).join(', ') : ''))
      const n = parseInt(dias, 10)
      await s.importarLote(f.name, n > 0 ? n : null, linhas)
      toast(`${linhas.length} linha(s) importada(s)${ignoradas.length ? `; ${ignoradas.length} ignorada(s) (atividade não encontrada)` : ''}`)
      setDias('')
    } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível ler o arquivo') }
    finally { setImportando(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className="box">
      <div className="row between">
        <div>
          <h2>Volumes da camada 2</h2>
          <p className="note">{s.loteSel ? <>{s.loteSel.nome} · importado em {dt(s.loteSel.created_at)} · {s.linhas.length} linha(s)</> : 'Nenhum volume importado.'} Quando o volume vem de um prestador que atende vários contratantes, informe todos: divide igual, como na avaliação.</p>
        </div>
        <div className="row">
          {s.lotes.length > 1 && (
            <select value={s.loteSel?.id ?? ''} onChange={e => s.setLoteId(e.target.value)} aria-label="Lote">
              {s.lotes.map(l => <option key={l.id} value={l.id}>{l.nome ?? 'Lote'} · {new Date(l.created_at).toLocaleDateString('pt-BR')}</option>)}
            </select>
          )}
          {s.loteSel && <BotaoConfirmar onConfirm={() => tentar(() => s.excluirLote(s.loteSel!.id), 'Lote excluído')}>Excluir lote</BotaoConfirmar>}
        </div>
      </div>
      <div className="row">
        <label className="note" htmlFor="cs-vdias">Dias úteis cobertos</label>
        <input id="cs-vdias" type="number" min={1} value={dias} onChange={e => setDias(e.target.value)} placeholder="ex.: 22" style={{ width: 90 }} />
        <button type="button" className="btn solid" disabled={importando} onClick={() => fileRef.current?.click()}>{importando ? 'Importando…' : 'Importar volumes (CSV ou Excel)'}</button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void onArquivo(f) }} />
        <button type="button" className="btn" onClick={() => baixar('modelo-volumes-suporte.csv', '﻿' + COLS_VOLUME.join(';') + '\n' + s.ativs.filter(a => a.ativo).map(a => [a.nome, '', '', '', ''].map(csvCell).join(';')).join('\n') + '\n')}>Baixar modelo</button>
        {s.loteSel && <label className="note">Dias do lote <NumCampo valor={s.loteSel.dias_uteis} min={1} style={{ width: 80 }} onSalvar={v => tentar(() => s.atualizarLote(s.loteSel!.id, { dias_uteis: v }))} /></label>}
      </div>
      <p className="note">Colunas: Atividade (nome ou chave), Contratantes (códigos; vários = divide igual), Quantidade (para ligação, os minutos), Prestador e Referência (opcionais: cód. cadastro, remetente, ramal).</p>

      {s.loteSel && (
        <div className="selbar">
          <b>Incluir à mão</b>
          <select value={m.at} onChange={e => setM({ ...m, at: e.target.value })} aria-label="Atividade">
            <option value="">Atividade…</option>
            {s.ativs.filter(a => a.ativo).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <input type="text" value={m.cts} onChange={e => setM({ ...m, cts: e.target.value })} placeholder="Contratantes (ex.: 1, 9)" style={{ width: 160 }} />
          {emMin
            ? <CampoTempo valor={m.q} onChange={t => setM({ ...m, q: t })} ariaLabel="Minutos" placeholder="Minutos: 90 ou 1:30" />
            : <input type="number" value={m.q} onChange={e => setM({ ...m, q: e.target.value })} placeholder="Quantidade" style={{ width: 110 }} />}
          <input type="text" value={m.ref} onChange={e => setM({ ...m, ref: e.target.value })} placeholder="Referência (opcional)" style={{ width: 170 }} />
          <button type="button" className="btn sm solid" disabled={!m.at || qtdMao == null || qtdMao < 0} onClick={async () => {
            const linha: VolumeLinha = { atividade_id: m.at, contratantes: m.cts.split(/[;,\s]+/).filter(Boolean), quantidade: qtdMao!, prestador: null, referencia: m.ref.trim() || null }
            if (await tentar(() => s.adicionarLinhas(s.loteSel!.id, [linha]), 'Volume incluído')) setM({ at: m.at, cts: '', q: '', ref: '' })
          }}>Incluir</button>
        </div>
      )}

      {s.linhas.length > 0 && <>
        <div className="tiles">
          <div className="tile"><b>{tm.hu(c2.total / 60, 1)}</b><span>no período do lote</span></div>
          <div className="tile"><b>{fator ? tm.hu((c2.total / 60) * fator, 1) : '—'}</b><span>projetado para o mês{fator ? ` (×${fmt(fator, 2)})` : ': informe os dias do lote'}</span></div>
          <div className="tile"><b style={{ color: Object.keys(c2.semTempo).length ? 'var(--cs-warn)' : undefined }}>{Object.keys(c2.semTempo).length}</b><span>atividades sem tempo-padrão</span></div>
          <div className="tile"><b>{c2.semContratante}</b><span>linhas sem contratante</span></div>
          <div className="tile"><b>{c2.especificos}</b><span>partes com tempo próprio do contratante/grupo</span></div>
        </div>
        {(Object.keys(c2.semTempo).length > 0 || naoCadastrados.length > 0) && (
          <div className="warnbox">
            {Object.keys(c2.semTempo).length > 0 && <div>Sem tempo-padrão (cronometre acima): {Object.entries(c2.semTempo).map(([id, q]) => `${s.ativs.find(a => a.id === id)?.nome} (${fmt(q)})`).join(', ')}.</div>}
            {naoCadastrados.length > 0 && <div>Contratantes não cadastrados: {naoCadastrados.join(', ')}.</div>}
          </div>
        )}
        <div className="grid2">
          <div className="tbl scroll" style={{ maxHeight: 360 }}>
            <table>
              <thead><tr>{th('c', 'Cód.')}{th('nome', 'Contratante')}{th('min', 'Horas no período', 'r')}<th className="r">Horas/mês</th></tr></thead>
              <tbody>
                {sorted.map(x => (
                  <tr key={x.c}><td className="mono">{x.c}</td><td>{nomeCtt(ctx, x.c)}</td><td className="r mono">{tm.h(x.min / 60)}</td><td className="r mono">{fator ? tm.h((x.min / 60) * fator) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tbl">
            <table>
              <thead><tr><th>Atividade</th><th className="r">Horas no período</th></tr></thead>
              <tbody>
                {s.ativs.filter(a => c2.porAtiv[a.id]).map(a => <tr key={a.id}><td>{a.nome}</td><td className="r mono">{tm.h(c2.porAtiv[a.id] / 60)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </div>
  )
}


function Metodo() {
  return (
    <div className="box">
      <h2>Como o suporte é medido</h2>
      <ol className="note" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <li><b>Camada 1 · Avaliação</b> (precisão alta): relatório EFIDOCEMP-201 × tempo-padrão do documento no grupo de critério (abas Contagem e Resultado).</li>
        <li><b>Camada 2 · Com rastro</b> (precisão boa): cadastro, e-mail e ligação. Volume de um relatório ou contagem × tempo-padrão cronometrado da atividade. Volume de prestador com vários contratantes divide igual.</li>
        <li><b>Camada 3 · Difuso</b> (precisão suficiente): WhatsApp e orientação, medidos por amostragem do trabalho. Avisos sorteados, 2 cliques, de 2 a 4 semanas. % × capacidade prática = horas.</li>
        <li><b>Fechamento</b>: as três camadas, mais interno e ociosa, devem somar a capacidade prática. Interno entra no custo-hora; ociosa mostra quanto cabe de cliente novo.</li>
        <li><b>Depois</b>: com os dados da amostragem, o suporte pode virar fórmula (equação de tempo): base + a × terceiros ativos + b × terceiros novos + c × documentos reprovados. Uma nova amostragem por ano recalibra os pesos.</li>
      </ol>
      <p className="note">Cuidados: mede contratante, não pessoa; não é ponto eletrônico; WhatsApp centralizado (Business com etiquetas por contratante) ajuda a medir. Comece levando a camada 1 à diretoria.</p>
    </div>
  )
}
