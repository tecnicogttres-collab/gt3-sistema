'use client'

// Suporte (material "Medindo o Suporte GT3"): camada 2 (com rastro), camada 3 (amostragem do
// trabalho) e o fechamento das tres camadas contra a capacidade pratica.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCs } from '../cs-data'
import {
  baixar, brl, brl2, contar, csvCell, dt, fatorMes, financeiro, fmt, mmss, nomeCtt, nomeUsuario, norm, principalDe, unidadesDe,
  type Ctx,
} from '../cs-lib'
import {
  avisosPrevistosAte, calcCamada2, calcCamada3, CLASSES, hojeIso, horariosDoDia, margemErro, margemPiorCaso,
  OPCOES_AMOSTRA, participa, tempoAtividade, tempoPara, type AtivMedicao, type Atividade, type Classe, type VolumeLinha,
} from '../cs-suporte-lib'
import { BotaoConfirmar, useOrdem } from '../cs-ui'
import { lerArquivo } from './Contagem'
import { NumCampo } from './Resultado'
import { useSuporte, type SuporteApi } from './suporte-data'

/** Tempo da atividade para o contratante (especifico do contratante/grupo, senao geral). */
const tempoC2 = (ctx: Ctx, meds: AtivMedicao[]) => (id: string, cod: string | null) =>
  tempoPara(meds, id, cod, ctx.cfg.base, ctx.cfg.minimo, c => principalDe(ctx, c))

const SUBS = [['c2', 'Camada 2 · Com rastro'], ['c3', 'Camada 3 · Amostragem'], ['fech', 'Fechamento'], ['metodo', 'Como funciona']] as const
type Sub = typeof SUBS[number][0]

export default function Suporte() {
  const { ctx, meuId } = useCs()
  const s = useSuporte(meuId)
  const [sub, setSub] = useState<Sub>('c2')
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
      {sub === 'c3' && <Camada3 ctx={ctx} s={s} />}
      {sub === 'fech' && <Fechamento ctx={ctx} s={s} />}
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
            <thead><tr><th>Atividade</th><th>Unidade</th><th>Fonte do volume</th><th>Liga ao contratante por</th><th className="r">Medições</th><th className="r">Tempo-padrão (min)</th><th title="Contratantes ou grupos com o mínimo de medições próprias">Tempos específicos</th><th className="c">Ativa</th></tr></thead>
            <tbody>
              {s.ativs.map(a => {
                const t = tempo(a.id)
                return (
                  <tr key={a.id}>
                    <td><b style={{ fontWeight: 600 }}>{a.nome}</b></td>
                    <td className="note">{a.unidade === 'minutos' ? 'minutos' : 'quantidade'}</td>
                    <td className="note">{a.fonte ?? '—'}</td>
                    <td className="note">{a.liga_por ?? '—'}</td>
                    <td className="r mono">{a.unidade === 'minutos' ? '—' : t.n}</td>
                    <td className="r mono">{a.unidade === 'minutos' ? <span className="note">duração da central</span> : t.val != null ? fmt(t.val, 2) : <span className="pill p-warn">cronometrar</span>}</td>
                    <td className="note">{a.unidade === 'minutos' ? '—' : especificos(ctx, s.meds, a.id) || '—'}</td>
                    <td className="c"><input type="checkbox" checked={a.ativo} aria-label="Ativa" onChange={e => tentar(() => s.salvarAtividade(a.id, { ativo: e.target.checked }))} /></td>
                  </tr>
                )
              })}
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

function CronometroAtividade({ ctx, s }: { ctx: Ctx; s: SuporteApi }) {
  const { d, tentar, toast } = useCs()
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
          <div><b>{tp.val != null ? fmt(tp.val, 2) : '—'}</b><span>tempo-padrão ({ctx.cfg.base === 'media' ? 'média' : 'mediana'}, min)</span></div>
          <div><b>{tp.mean != null ? fmt(tp.mean, 2) : '—'}</b><span>média</span></div>
          {tpAssoc && <>
            <div><b>{tpAssoc.n}/{ctx.cfg.minimo}</b><span>{grupoAssoc ? 'do grupo ' : 'de '}{codAssoc}</span></div>
            <div><b>{tpAssoc.val != null ? fmt(tpAssoc.val, 2) : '—'}</b><span>tempo {grupoAssoc ? 'do grupo' : 'do contratante'} (min)</span></div>
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
                  <td><button type="button" className={'btn sm' + (m.situacao === 'validada' ? ' bad' : '')} onClick={() => tentar(() => s.alternarMedAtiv(m))}>{m.situacao === 'validada' ? 'Descartar' : 'Restaurar'}</button></td>
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
  const [dias, setDias] = useState('')
  const [importando, setImportando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [m, setM] = useState({ at: '', cts: '', q: '', ref: '' })
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
          <input type="number" value={m.q} onChange={e => setM({ ...m, q: e.target.value })} placeholder="Quantidade" style={{ width: 110 }} />
          <input type="text" value={m.ref} onChange={e => setM({ ...m, ref: e.target.value })} placeholder="Referência (opcional)" style={{ width: 170 }} />
          <button type="button" className="btn sm solid" disabled={!m.at || !(Number(m.q) >= 0) || m.q === ''} onClick={async () => {
            const linha: VolumeLinha = { atividade_id: m.at, contratantes: m.cts.split(/[;,\s]+/).filter(Boolean), quantidade: Number(m.q), prestador: null, referencia: m.ref.trim() || null }
            if (await tentar(() => s.adicionarLinhas(s.loteSel!.id, [linha]), 'Volume incluído')) setM({ at: m.at, cts: '', q: '', ref: '' })
          }}>Incluir</button>
        </div>
      )}

      {s.linhas.length > 0 && <>
        <div className="tiles">
          <div className="tile"><b>{fmt(c2.total / 60, 1)} h</b><span>no período do lote</span></div>
          <div className="tile"><b>{fator ? fmt((c2.total / 60) * fator, 1) + ' h' : '—'}</b><span>projetado para o mês{fator ? ` (×${fmt(fator, 2)})` : ': informe os dias do lote'}</span></div>
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
                  <tr key={x.c}><td className="mono">{x.c}</td><td>{nomeCtt(ctx, x.c)}</td><td className="r mono">{fmt(x.min / 60, 2)}</td><td className="r mono">{fator ? fmt((x.min / 60) * fator, 2) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tbl">
            <table>
              <thead><tr><th>Atividade</th><th className="r">Horas no período</th></tr></thead>
              <tbody>
                {s.ativs.filter(a => c2.porAtiv[a.id]).map(a => <tr key={a.id}><td>{a.nome}</td><td className="r mono">{fmt(c2.porAtiv[a.id] / 60, 2)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Camada 3
// ═════════════════════════════════════════════════════════════════════════════
function Camada3({ ctx, s }: { ctx: Ctx; s: SuporteApi }) {
  const { d, tentar, meuId, papel } = useCs()
  const gerencia = papel === 'admin' || papel === 'gestor'
  const ativos = d.usuarios.filter(u => !u.desativado)
  const [f, setF] = useState({ nome: '', inicio: hojeIso(), fim: '', avisos: 6, ini: '08:00', fim_h: '18:00', todos: true, pessoas: [] as string[] })
  const a = s.amSel
  const c3 = calcCamada3(s.amostras)
  const fin = financeiro(ctx.cfg)
  const previstas = a ? avisosPrevistosAte(a, ativos.map(u => u.id)) : 0
  const meusHoje = a && participa(a, meuId) && hojeIso() >= a.inicio && hojeIso() <= a.fim ? horariosDoDia(a, meuId, hojeIso()) : []
  const pct = (n: number) => (c3.n ? n / c3.n : 0)

  return (
    <>
      <div className="box">
        <h2>Amostragens do trabalho</h2>
        <p className="note">Em horários sorteados de dias úteis, cada participante recebe no GT3 Sistema o aviso &quot;O que você está fazendo agora?&quot; e responde em 2 cliques (atividade + contratante). Aviso não respondido em 20 min expira. Mede contratante, não pessoa: os resultados não mostram quem respondeu o quê.</p>
        {gerencia ? (
          <div className="kv">
            <label>Nome<input type="text" value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="ex.: Amostragem nov/2026" /></label>
            <label>Início<input type="date" value={f.inicio} onChange={e => setF({ ...f, inicio: e.target.value })} /></label>
            <label>Fim<input type="date" value={f.fim} onChange={e => setF({ ...f, fim: e.target.value })} /></label>
            <label>Avisos por dia<input type="number" min={1} max={20} value={f.avisos} onChange={e => setF({ ...f, avisos: +e.target.value || 6 })} /></label>
            <label>Das<input type="time" value={f.ini} onChange={e => setF({ ...f, ini: e.target.value })} /></label>
            <label>Até<input type="time" value={f.fim_h} onChange={e => setF({ ...f, fim_h: e.target.value })} /></label>
          </div>
        ) : <p className="note">Só gestor ou admin cria amostragens.</p>}
        {gerencia && <>
          <div className="row">
            <label className="row note" style={{ gap: 6 }}><input type="checkbox" checked={f.todos} onChange={e => setF({ ...f, todos: e.target.checked })} /> Todos os usuários ativos</label>
            {!f.todos && <span className="note">{f.pessoas.length} selecionado(s)</span>}
          </div>
          {!f.todos && (
            <div className="row">
              {ativos.map(u => (
                <label key={u.id} className={'pill ' + (f.pessoas.includes(u.id) ? 'p-blue' : 'p-gray')} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" style={{ display: 'none' }} checked={f.pessoas.includes(u.id)}
                    onChange={e => setF({ ...f, pessoas: e.target.checked ? [...f.pessoas, u.id] : f.pessoas.filter(x => x !== u.id) })} />
                  {nomeUsuario(u)}
                </label>
              ))}
            </div>
          )}
          <div className="row">
            <button type="button" className="btn solid" disabled={!f.nome.trim() || !f.inicio || !f.fim || f.fim < f.inicio || f.fim_h <= f.ini || (!f.todos && !f.pessoas.length)}
              onClick={async () => {
                const ok = await tentar(() => s.criarAmostragem({
                  nome: f.nome.trim(), inicio: f.inicio, fim: f.fim, avisos_dia: f.avisos, hora_ini: f.ini, hora_fim: f.fim_h,
                  participantes: f.todos ? null : f.pessoas, ativa: true,
                }), 'Amostragem criada')
                if (ok) setF({ ...f, nome: '' })
              }}>Criar amostragem</button>
            <span className="note">Referência do material: 2 semanas (≈480 observações com 8 pessoas) decidem; 4 semanas permitem abrir por contratante.</span>
          </div>
        </>}
        {s.amostragens.length > 0 && (
          <div className="tbl">
            <table>
              <thead><tr><th>Amostragem</th><th>Período</th><th className="r">Avisos/dia</th><th>Horário</th><th>Participantes</th><th className="c">Ativa</th><th /></tr></thead>
              <tbody>
                {s.amostragens.map(x => (
                  <tr key={x.id} className={'click' + (a?.id === x.id ? ' sel' : '')} onClick={() => s.setAmId(x.id)}>
                    <td><b style={{ fontWeight: 600 }}>{x.nome}</b></td>
                    <td className="mono">{x.inicio.split('-').reverse().join('/')} a {x.fim.split('-').reverse().join('/')}</td>
                    <td className="r mono">{x.avisos_dia}</td>
                    <td className="mono">{x.hora_ini.slice(0, 5)}–{x.hora_fim.slice(0, 5)}</td>
                    <td className="note">{x.participantes ? `${x.participantes.length} pessoa(s)` : 'todos'}</td>
                    <td className="c" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={x.ativa} disabled={!gerencia} aria-label="Ativa" onChange={e => tentar(() => s.salvarAmostragem(x.id, { ativa: e.target.checked }))} />
                    </td>
                    <td onClick={e => e.stopPropagation()}>{gerencia && <BotaoConfirmar onConfirm={() => tentar(() => s.excluirAmostragem(x.id), 'Amostragem excluída')}>Excluir</BotaoConfirmar>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {a && (
        <div className="box">
          <div className="row between">
            <h2>Resultado: {a.nome}</h2>
            <button type="button" className="btn sm" onClick={() => s.recarregarAmostras(a.id)}>Atualizar</button>
          </div>
          {meusHoje.length > 0 && <p className="note">Seus avisos de hoje: {meusHoje.map(h => h.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })).join(' · ')}</p>}
          <div className="tiles">
            <div className="tile"><b>{c3.n}</b><span>observações</span></div>
            <div className="tile"><b>±{fmt(margemPiorCaso(c3.n), 1)} p.p.</b><span>margem de erro (95%, pior caso)</span></div>
            <div className="tile"><b>{previstas ? fmt((c3.n / previstas) * 100) + '%' : '—'}</b><span>taxa de resposta ({previstas} avisos até agora)</span></div>
            <div className="tile"><b>{fin.ok ? fmt(fin.cap) + ' h' : '—'}</b><span>capacidade prática/mês (para converter % em horas)</span></div>
          </div>
          {c3.n === 0 ? <p className="note">Nenhuma resposta ainda.</p> : <>
            <h3>Para onde vai o tempo</h3>
            <div className="tbl">
              <table>
                <thead><tr><th>Atividade</th><th>Classe</th><th className="r">Obs.</th><th className="r">%</th><th className="r">± p.p.</th><th style={{ width: '30%' }} /><th className="r">h/mês</th></tr></thead>
                <tbody>
                  {OPCOES_AMOSTRA.map(o => {
                    const p = pct(c3.porOpcao[o.chave])
                    const me = margemErro(p, c3.n)
                    return (
                      <tr key={o.chave}>
                        <td>{o.label}</td>
                        <td className="note">{CLASSES[o.classe]}</td>
                        <td className="r mono">{c3.porOpcao[o.chave]}</td>
                        <td className="r mono">{fmt(p * 100, 1)}%</td>
                        <td className="r mono">±{fmt(me, 1)}</td>
                        <td><Barra p={p} me={me / 100} /></td>
                        <td className="r mono">{fin.ok ? fmt(p * fin.cap, 0) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ConferenciaCamadas ctx={ctx} s={s} pctClasse={k => pct(c3.porClasse[k])} />
            <h3>Camada 3 (WhatsApp e orientação) por contratante</h3>
            <PorContratanteC3 ctx={ctx} porCtt={c3.porCttCamada3} n={c3.n} semCtt={c3.camada3SemCtt} cap={fin.ok ? fin.cap : null} />
          </>}
        </div>
      )}
    </>
  )
}

function Barra({ p, me }: { p: number; me: number }) {
  return (
    <div style={{ position: 'relative', height: 12, background: 'var(--cs-tint)', borderRadius: 4 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, p * 100)}%`, background: 'var(--cs-edge)', borderRadius: 4 }} />
      <div title="margem de erro" style={{ position: 'absolute', top: 5, height: 2, left: `${Math.max(0, (p - me) * 100)}%`, width: `${Math.min(100, (p + me) * 100) - Math.max(0, (p - me) * 100)}%`, background: 'var(--cs-gold)' }} />
    </div>
  )
}

function PorContratanteC3({ ctx, porCtt, n, semCtt, cap }: { ctx: Ctx; porCtt: Record<string, number>; n: number; semCtt: number; cap: number | null }) {
  const lista = Object.entries(porCtt).map(([c, k]) => ({ c, k }))
  const { sorted, th } = useOrdem(lista, { c: x => +x.c || x.c, nome: x => nomeCtt(ctx, x.c), k: x => x.k }, { col: 'k', dir: 'desc' })
  if (!lista.length) return <p className="note">Nenhuma observação de camada 3 com contratante ainda.</p>
  return (
    <div className="tbl scroll" style={{ maxHeight: 340 }}>
      <table>
        <thead><tr>{th('c', 'Cód.')}{th('nome', 'Contratante')}{th('k', 'Obs.', 'r')}<th className="r">% do tempo</th><th className="r">± p.p.</th><th className="r">h/mês</th></tr></thead>
        <tbody>
          {sorted.map(x => {
            const p = x.k / n
            return <tr key={x.c}><td className="mono">{x.c}</td><td>{nomeCtt(ctx, x.c)}</td><td className="r mono">{x.k}</td><td className="r mono">{fmt(p * 100, 1)}%</td><td className="r mono">±{fmt(margemErro(p, n), 1)}</td><td className="r mono">{cap ? fmt(p * cap, 1) : '—'}</td></tr>
          })}
          {semCtt > 0 && <tr><td /><td className="note">Sem contratante</td><td className="r mono">{semCtt}</td><td className="r mono">{fmt((semCtt / n) * 100, 1)}%</td><td /><td className="r mono">{cap ? fmt((semCtt / n) * cap, 1) : '—'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

/** Conferencia: a amostragem confere as camadas 1 e 2 (se os % batem com as horas medidas). */
function ConferenciaCamadas({ ctx, s, pctClasse }: { ctx: Ctx; s: SuporteApi; pctClasse: (k: Classe) => number }) {
  const { linhas, relSel } = useCs()
  const fin = financeiro(ctx.cfg)
  const r = useMemo(() => contar(ctx, linhas), [ctx, linhas])
  if (!fin.ok) return <div className="warnbox">Preencha os parâmetros da equipe (aba Resultado) para comparar a amostragem com as camadas 1 e 2.</div>
  const f1 = fatorMes(ctx.cfg, relSel)
  const h1 = f1 ? (r.real / 60) * f1 : null
  const diasMes = ctx.cfg.dias_mes ?? ctx.cfg.dias_uteis
  const f2 = s.loteSel?.dias_uteis && diasMes ? diasMes / s.loteSel.dias_uteis : null
  const c2 = calcCamada2(s.linhas, s.ativs, tempoC2(ctx, s.meds))
  const h2 = f2 && s.linhas.length ? (c2.total / 60) * f2 : null
  const linha = (titulo: string, amostra: number, medido: number | null) => {
    const dif = medido != null && amostra ? (medido - amostra) / amostra : null
    return (
      <tr>
        <td>{titulo}</td>
        <td className="r mono">{fmt(amostra, 0)} h</td>
        <td className="r mono">{medido != null ? fmt(medido, 0) + ' h' : '—'}</td>
        <td>{dif == null ? <span className="note">sem dado medido</span> : Math.abs(dif) <= 0.15 ? <span className="pill p-good">bate ({fmt(dif * 100)}%)</span> : <span className="pill p-warn">revisar tempos ({dif > 0 ? '+' : ''}{fmt(dif * 100)}%)</span>}</td>
      </tr>
    )
  }
  return <>
    <h3>Conferência com as camadas medidas</h3>
    <div className="tbl">
      <table>
        <thead><tr><th>Camada</th><th className="r">Pela amostragem (h/mês)</th><th className="r">Pela medição (h/mês)</th><th>Leitura</th></tr></thead>
        <tbody>
          {linha('Camada 1 · Avaliação (relatório × tempo-padrão)', pctClasse('camada1') * fin.cap, h1)}
          {linha('Camada 2 · Com rastro (volumes × tempo-padrão)', pctClasse('camada2') * fin.cap, h2)}
        </tbody>
      </table>
    </div>
    <p className="note">Se a amostragem e a medição ficam perto (até ±15%), os tempos-padrão estão bem calibrados.</p>
  </>
}

// ═════════════════════════════════════════════════════════════════════════════
// Fechamento
// ═════════════════════════════════════════════════════════════════════════════
type LinhaF = { c: string; h1: number; h2: number; h3: number; tot: number; fat: number; rh: number | null; rh1: number | null }

function Fechamento({ ctx, s }: { ctx: Ctx; s: SuporteApi }) {
  const { linhas, relSel } = useCs()
  const fin = financeiro(ctx.cfg)
  const r = useMemo(() => contar(ctx, linhas), [ctx, linhas])
  const f1 = fatorMes(ctx.cfg, relSel)
  const diasMes = ctx.cfg.dias_mes ?? ctx.cfg.dias_uteis
  const f2 = s.loteSel?.dias_uteis && diasMes ? diasMes / s.loteSel.dias_uteis : null
  const c2 = calcCamada2(s.linhas, s.ativs, tempoC2(ctx, s.meds))
  const c3 = calcCamada3(s.amostras)
  const cap = fin.ok ? fin.cap : null

  const cods = [...new Set([...Object.keys(r.by), ...Object.keys(c2.porCtt), ...Object.keys(c3.porCttCamada3)])]
  const rows: LinhaF[] = cods.map(c => {
    const h1 = f1 ? ((r.by[c]?.min ?? 0) / 60) * f1 : 0
    const h2 = f2 ? ((c2.porCtt[c] ?? 0) / 60) * f2 : 0
    const h3 = cap && c3.n ? ((c3.porCttCamada3[c] ?? 0) / c3.n) * cap : 0
    const tot = h1 + h2 + h3
    const fat = ctx.ctts.get(c)?.faturamento_mensal || 0
    return { c, h1, h2, h3, tot, fat, rh: tot > 0 && fat ? fat / tot : null, rh1: h1 > 0 && fat ? fat / h1 : null }
  })
  const { sorted, th } = useOrdem(rows, {
    c: x => +x.c || x.c, nome: x => nomeCtt(ctx, x.c), h1: x => x.h1, h2: x => x.h2, h3: x => x.h3, tot: x => x.tot, fat: x => x.fat, rh: x => x.rh, rh1: x => x.rh1,
  }, { col: 'tot', dir: 'desc' })

  const T1 = rows.reduce((a, x) => a + x.h1, 0), T2 = rows.reduce((a, x) => a + x.h2, 0)
  const T3 = cap && c3.n ? (c3.porClasse.camada3 / c3.n) * cap : 0
  const Ti = cap && c3.n ? (c3.porClasse.interno / c3.n) * cap : 0
  const To = cap && c3.n ? (c3.porClasse.ociosa / c3.n) * cap : 0
  const soma = T1 + T2 + T3 + Ti + To
  const maxTot = Math.max(1, ...rows.map(x => x.tot))

  const faltas: string[] = []
  if (!fin.ok) faltas.push('Parâmetros da equipe (aba Resultado) para a capacidade prática e o custo-hora.')
  if (!relSel) faltas.push('Relatório EFIDOCEMP-201 importado (aba Contagem) para a camada 1.')
  else if (!f1) faltas.push('Dias úteis do relatório (aba Resultado) para projetar a camada 1.')
  if (!s.loteSel) faltas.push('Volumes da camada 2 (Suporte › Camada 2).')
  else if (!f2) faltas.push('Dias úteis do lote de volumes da camada 2.')
  if (!c3.n) faltas.push('Respostas de uma amostragem (Suporte › Camada 3).')

  return (
    <>
      {faltas.length > 0 && (
        <div className="warnbox">
          <div>Para fechar a conta inteira ainda falta:</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{faltas.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      <div className="box">
        <h2>A conta inteira da capacidade</h2>
        <p className="note">Capacidade prática = avaliação + com rastro + difuso + interno + ociosa. Se a soma não bater com a capacidade, algum tempo-padrão está errado.</p>
        <div className="tiles">
          <div className="tile"><b>{fmt(T1, 0)} h</b><span>Camada 1 · Avaliação{cap ? ` · ${fmt((T1 / cap) * 100)}%` : ''}</span></div>
          <div className="tile"><b>{fmt(T2, 0)} h</b><span>Camada 2 · Com rastro{cap ? ` · ${fmt((T2 / cap) * 100)}%` : ''}</span></div>
          <div className="tile"><b>{fmt(T3, 0)} h</b><span>Camada 3 · Difuso{cap ? ` · ${fmt((T3 / cap) * 100)}%` : ''}</span></div>
          <div className="tile"><b>{fmt(Ti, 0)} h</b><span>Interno (entra no custo-hora)</span></div>
          <div className="tile"><b>{fmt(To, 0)} h</b><span>Ociosa (cabe mais cliente)</span></div>
          <div className="tile"><b>{cap ? fmt(cap, 0) + ' h' : '—'}</b><span>capacidade prática/mês</span></div>
        </div>
        {cap != null && c3.n > 0 && (
          <p>{Math.abs(soma - cap) / cap <= 0.1
            ? <span className="pill p-good">Fecha: soma {fmt(soma, 0)} h × capacidade {fmt(cap, 0)} h</span>
            : <span className="pill p-warn">Não fecha: soma {fmt(soma, 0)} h × capacidade {fmt(cap, 0)} h ({soma > cap ? '+' : ''}{fmt(((soma - cap) / cap) * 100)}%). Revise os tempos-padrão.</span>}</p>
        )}
      </div>

      <div className="box">
        <h2>Por contratante: as três camadas</h2>
        <div className="tbl scroll" style={{ maxHeight: 560 }}>
          <table>
            <thead><tr>
              {th('c', 'Cód.')}{th('nome', 'Contratante')}{th('h1', 'Avaliação h/mês', 'r')}{th('h2', 'Com rastro h/mês', 'r')}{th('h3', 'Difuso h/mês', 'r')}
              {th('tot', 'Total h/mês', 'r')}<th style={{ width: 160 }} />{th('fat', 'Faturamento', 'r')}{th('rh1', 'Receita/h só avaliação', 'r')}{th('rh', 'Receita/h total', 'r')}<th>Situação</th>
            </tr></thead>
            <tbody>
              {sorted.length ? sorted.map(x => (
                <tr key={x.c}>
                  <td className="mono">{x.c}</td>
                  <td>{nomeCtt(ctx, x.c)}</td>
                  <td className="r mono">{fmt(x.h1, 1)}</td>
                  <td className="r mono">{fmt(x.h2, 1)}</td>
                  <td className="r mono">{fmt(x.h3, 1)}</td>
                  <td className="r mono"><b>{fmt(x.tot, 1)}</b></td>
                  <td>
                    <div style={{ display: 'flex', height: 10, borderRadius: 3, overflow: 'hidden', background: 'var(--cs-tint)', width: `${(x.tot / maxTot) * 100}%`, minWidth: 2 }} title="Avaliação · com rastro · difuso">
                      <div style={{ width: `${x.tot ? (x.h1 / x.tot) * 100 : 0}%`, background: '#2A4F96' }} />
                      <div style={{ width: `${x.tot ? (x.h2 / x.tot) * 100 : 0}%`, background: '#D1AE6E' }} />
                      <div style={{ width: `${x.tot ? (x.h3 / x.tot) * 100 : 0}%`, background: '#A86A12' }} />
                    </div>
                  </td>
                  <td className="r mono">{x.fat ? brl(x.fat) : '—'}</td>
                  <td className="r mono">{x.rh1 != null ? brl2(x.rh1) : '—'}</td>
                  <td className="r mono">{x.rh != null ? brl2(x.rh) : '—'}</td>
                  <td>{x.rh == null || !fin.ok ? <span className="pill p-gray">—</span> : x.rh < fin.ch ? <span className="pill p-bad">Deficitário</span> : x.rh < fin.hmin ? <span className="pill p-warn">Reprecificar</span> : <span className="pill p-good">Proteger</span>}</td>
                </tr>
              )) : <tr><td colSpan={11} className="empty">Sem dados das camadas ainda.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="note">Barra: <span style={{ color: '#2A4F96' }}>■</span> avaliação · <span style={{ color: '#D1AE6E' }}>■</span> com rastro · <span style={{ color: '#A86A12' }}>■</span> difuso. Quem mais demanda suporte é quem mais perde receita por hora quando o suporte entra na conta.</p>
      </div>
    </>
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
