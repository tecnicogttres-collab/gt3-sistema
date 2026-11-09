'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCs } from '../cs-data'
import {
  fmt, mmss, MOTIVOS, nomeCtt, norm, situacaoDoc, stat,
  type Ctx, type Grupo, type Situacao,
} from '../cs-lib'
import { ativo, elapsed, resetTimer, setTimer, useTimer } from '../cs-timer'
import { BotaoExcluirMedicao, OrdemControle, ordenar, PillMedicao, PillOrigem, PillResultado, PillSituacao, useOrdem, type Ordem } from '../cs-ui'
import { dt, nomeUsuario } from '../cs-lib'
import type { Medicao, Usuario } from '../cs-lib'
import QuadroDocumentos from './QuadroDocumentos'
import TransportarTempo, { type ModoTransporte } from './TransportarTempo'

export type NavCron = { g: string | null; d: string | null; q: string }

const pausar = () => setTimer({ acc: elapsed(), run: false })
const continuar = () => setTimer({ t0: performance.now(), run: true, stopped: false })
const parar = () => setTimer({ acc: elapsed(), run: false, stopped: true })

export default function Cronometrar({ nav, setNav, telaVisivel }: {
  nav: NavCron; setNav: (n: NavCron) => void; telaVisivel: boolean
}) {
  const { ctx, d } = useCs()
  if (!ctx) return null
  const g = nav.g ? d.grupos.find(x => x.id === nav.g) : null
  const doc = nav.d ? d.docs.find(x => x.id === nav.d) : null
  if (g && doc) return <Timer ctx={ctx} g={g} docId={doc.id} docNome={doc.nome} nav={nav} setNav={setNav} telaVisivel={telaVisivel} />
  if (g) return <Documentos ctx={ctx} g={g} nav={nav} setNav={setNav} />
  return <Grupos ctx={ctx} setNav={setNav} />
}

function Grupos({ ctx, setNav }: { ctx: Ctx; setNav: (n: NavCron) => void }) {
  const [organizar, setOrganizar] = useState(false)
  const [busca, setBusca] = useState('')
  // Busca por nome do grupo, codigo ou nome de contratante; o padrao sempre aparece primeiro
  const grupos = ctx.grupos.filter(g => !busca || norm(g.nome + ' ' + g.contratantes.map(c => c + ' ' + nomeCtt(ctx, c)).join(' ')).includes(norm(busca)))
    .sort((a, b) => (a.padrao === b.padrao ? a.nome.localeCompare(b.nome, 'pt-BR') : a.padrao ? -1 : 1))
  return (
    <div className="box">
      {organizar && (
        <div className="cs-modal" onClick={e => { if (e.target === e.currentTarget) setOrganizar(false) }}>
          <div className="cs">
            <div className="row between">
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--cs-edge-2)' }}>Organizar documentos nos grupos</h2>
              <button type="button" className="btn" onClick={() => setOrganizar(false)}>Fechar</button>
            </div>
            <QuadroDocumentos ctx={ctx} />
          </div>
        </div>
      )}
      <div className="row between">
        <h2>1. Escolha o grupo de critério</h2>
        <div className="row" style={{ flex: '1 1 480px', justifyContent: 'flex-end' }}>
          <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder={`Buscar grupo ou contratante (${ctx.grupos.length} grupos)`} style={{ flex: '0 1 320px' }} />
          <button type="button" className="btn" onClick={() => setOrganizar(true)}>⠿ Organizar documentos nos grupos</button>
        </div>
      </div>
      <p className="note">Os documentos nascem no grupo padrão. Um grupo específico só tem os documentos em que o critério dele é diferente (copiados ou movidos em Configurações).</p>
      <div className="groups">
        {grupos.map(g => {
          const ds = [...(ctx.gd.get(g.id) ?? [])]
          const prontos = ds.filter(id => situacaoDoc(ctx, g.id, id) === 'pronto')
          const vol = ds.reduce((a, id) => a + (ctx.docs.get(id)?.volume_ref ?? 0), 0)
          const volOk = prontos.reduce((a, id) => a + (ctx.docs.get(id)?.volume_ref ?? 0), 0)
          const pct = vol ? (volOk / vol) * 100 : 0
          return (
            <button key={g.id} type="button" className="gcard" onClick={() => setNav({ g: g.id, d: null, q: '' })}>
              <span className="eyebrow">{g.padrao ? 'Grupo padrão' : 'Grupo específico'}</span>
              <b>{g.nome}</b>
              <div className="chips">
                {g.padrao
                  ? <span className="chip">todos os demais contratantes</span>
                  : g.contratantes.length
                    ? g.contratantes.map(c => <span key={c} className="chip">{c} · {nomeCtt(ctx, c).slice(0, 22)}</span>)
                    : <span className="note">nenhum contratante ainda</span>}
              </div>
              <span className="note">{ds.length} documento{ds.length === 1 ? '' : 's'} · {prontos.length} com tempo pronto</span>
              <div className="prog" title="Cobertura do volume de referência"><i style={{ width: pct + '%' }} /></div>
              <span className="note">{fmt(pct)}% do volume coberto</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Documentos({ ctx, g, nav, setNav }: { ctx: Ctx; g: Grupo; nav: NavCron; setNav: (n: NavCron) => void }) {
  const { d } = useCs()
  const [ord, setOrd] = useState<Ordem>({ col: 'nome', dir: 'asc' })
  let ds = [...(ctx.gd.get(g.id) ?? [])].map(id => ctx.docs.get(id)!).filter(Boolean)
  if (nav.q) ds = ds.filter(x => norm(x.nome).includes(norm(nav.q)))
  const ordemSit = { pronto: 0, andamento: 1, sem: 2 }
  ds = ordenar(ds, {
    nome: x => x.nome, vol: x => x.volume_ref, an: x => stat(ctx, g.id, x.id, 'aprovado').n,
    tempo: x => stat(ctx, g.id, x.id, 'aprovado').val, sit: x => ordemSit[situacaoDoc(ctx, g.id, x.id)],
  }, ord)
  const min = ctx.cfg.minimo
  const tp = new Set(d.meds.filter(m => m.grupo_id === g.id && m.origem_id && m.situacao === 'validada').map(m => m.documento_id))
  return (
    <>
      <div className="crumbs">
        <button type="button" className="voltar" onClick={() => setNav({ g: null, d: null, q: '' })}>← Voltar aos grupos</button>
        <button type="button" onClick={() => setNav({ g: null, d: null, q: '' })}>Grupos</button>›<span>{g.nome}</span>
      </div>
      <div className="box">
        <div className="row between">
          <h2>2. Escolha o documento</h2>
          <input type="search" placeholder="Buscar documento" value={nav.q} onChange={e => setNav({ ...nav, q: e.target.value })} style={{ width: 'min(320px,100%)' }} />
        </div>
        <div className="row between">
          <p className="note">O volume de referência aparece em cada documento.</p>
          <OrdemControle ord={ord} setOrd={setOrd} opcoes={[
            { col: 'nome', label: 'Nome' }, { col: 'vol', label: 'Volume de referência' }, { col: 'an', label: 'Medições de aprovado' },
            { col: 'tempo', label: 'Tempo-padrão aprovado' }, { col: 'sit', label: 'Situação' },
          ]} />
        </div>
        {ds.length ? (
          <div className="dlist">
            {ds.map(x => {
              const a = stat(ctx, g.id, x.id, 'aprovado'), r = stat(ctx, g.id, x.id, 'reprovado'), s = situacaoDoc(ctx, g.id, x.id)
              return (
                <button key={x.id} type="button" className={'dcard' + (s === 'pronto' ? ' ready' : '')} onClick={() => setNav({ ...nav, d: x.id })}>
                  <b>{x.nome}</b>
                  <span className="meta">
                    <span className="mono">{fmt(x.volume_ref)} no volume de ref.</span>
                    <PillSituacao s={s} />
                    {x.nao_conta && <span className="pill p-gray">Não conta</span>}
                    {tp.has(x.id) && <span className="pill p-tp" title="Tem medições transportadas de outro grupo">Tempo padrão</span>}
                  </span>
                  <span className="meta">
                    <span>Aprov. <b className="mono">{a.n}/{min}</b>{a.val != null ? ` · ${fmt(a.val, 1)} min` : ''}</span>
                    <span>Reprov. <b className="mono">{r.n}</b>{r.val != null ? ` · ${fmt(r.val, 1)} min` : ''}</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="empty">{nav.q ? 'Nada encontrado.' : 'Nenhum documento neste grupo. Copie ou mova documentos em Configurações › Documentos por grupo.'}</div>
        )}
      </div>
    </>
  )
}

function Timer({ ctx, g, docId, docNome, nav, setNav, telaVisivel }: {
  ctx: Ctx; g: Grupo; docId: string; docNome: string; nav: NavCron; setNav: (n: NavCron) => void; telaVisivel: boolean
}) {
  const { d, registrarMedicao, toast } = useCs()
  const T = useTimer()
  const [, setTick] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [transp, setTransp] = useState<ModoTransporte | null>(null)
  const salvandoRef = useRef(false)

  const same = T.g === g.id && T.d === docId
  const busy = ativo(T) && !same
  const ms = same ? elapsed(T) : 0

  useEffect(() => {
    if (!same || !T.run || !telaVisivel) return
    let raf = 0
    const loop = () => { setTick(x => x + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [same, T.run, telaVisivel])

  const iniciar = useCallback(() => setTimer({
    g: g.id, d: docId, grupoNome: g.nome, docNome, run: true, acc: 0, t0: performance.now(), stopped: false,
  }), [g.id, g.nome, docId, docNome])
  const registrar = useCallback(async (situacao: Situacao, motivo: string | null) => {
    if (salvandoRef.current) return
    const s = { ...T, acc: elapsed(T), run: false, stopped: true }
    if (s.acc < 1000) { setTimer(s); toast('Medição muito curta (menos de 1 s). Use "Zerar sem registrar".'); return }
    setTimer(s)
    salvandoRef.current = true; setSalvando(true)
    try {
      await registrarMedicao({ g: s.g!, d: s.d!, ms: s.acc, res: s.res, situacao, motivo })
      toast(situacao === 'validada' ? `Validada: ${mmss(s.acc)} · ${s.res}` : 'Medição descartada e registrada')
      resetTimer()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível salvar. O tempo continua na tela.')
    } finally {
      salvandoRef.current = false; setSalvando(false)
    }
  }, [T, registrarMedicao, toast])

  // Atalhos: Espaco inicia/pausa, Enter para e valida, Esc descarta
  useEffect(() => {
    if (!telaVisivel) return
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest('input,select,textarea,[contenteditable=true]') || e.ctrlKey || e.metaKey || e.altKey) return
      if (busy) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!same || (!T.run && T.acc === 0 && !T.stopped)) iniciar()
        else if (T.run) pausar()
        else continuar()
      } else if (e.key === 'Enter' && same && (T.run || T.acc > 0)) {
        e.preventDefault()
        void registrar('validada', null)
      } else if (e.key === 'Escape' && same && T.stopped) {
        e.preventDefault()
        void registrar('descartada', 'Descartada pelo avaliador')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [telaVisivel, busy, same, T, iniciar, registrar])

  const sA = stat(ctx, g.id, docId, 'aprovado'), sR = stat(ctx, g.id, docId, 'reprovado')
  const meds = d.meds.filter(m => m.grupo_id === g.id && m.documento_id === docId)
  const nTp = meds.filter(m => m.origem_id && m.situacao === 'validada').length
  const base = ctx.cfg.base === 'media' ? 'média' : 'mediana'
  const cls = same && T.run ? 'run' : same && T.stopped ? 'stop' : ''
  const res = T.res

  let ctl: React.ReactNode
  if (busy) ctl = <>
    <p className="note">Há um cronômetro em andamento em outro documento ({T.docNome}).</p>
    <button type="button" className="btn solid" onClick={() => setNav({ g: T.g, d: T.d, q: '' })}>Voltar para ele</button>
  </>
  else if (!same || (!T.run && T.acc === 0 && !T.stopped)) ctl = <button type="button" className="btn solid" onClick={iniciar}>▶ Iniciar</button>
  else if (T.run) ctl = <>
    <button type="button" className="btn" onClick={pausar}>❚❚ Pausar</button>
    <button type="button" className="btn solid" onClick={parar}>■ Parar</button>
  </>
  else if (!T.stopped) ctl = <>
    <button type="button" className="btn solid" onClick={continuar}>▶ Continuar</button>
    <button type="button" className="btn" onClick={parar}>■ Parar</button>
  </>
  else ctl = <>
    <button type="button" className="btn good" disabled={salvando} onClick={() => registrar('validada', null)}>✓ Validar para média</button>
    <button type="button" className="btn" disabled={salvando} onClick={continuar}>▶ Retomar</button>
  </>

  return (
    <>
      <div className="crumbs">
        <button type="button" className="voltar" onClick={() => setNav({ g: null, d: null, q: '' })}>← Voltar aos grupos</button>
        <button type="button" onClick={() => setNav({ g: null, d: null, q: '' })}>Grupos</button>›
        <button type="button" onClick={() => setNav({ ...nav, d: null })}>{g.nome}</button>›
        <span>{docNome}</span>
      </div>
      <div className="timer">
        <div className={'clock ' + cls}>
          <span className="eyebrow">{g.nome}</span>
          <span className="doc">{docNome}</span>
          <div className="seg" role="group" aria-label="Resultado da avaliação">
            <button type="button" disabled={busy} className={'A' + (res === 'aprovado' ? ' on' : '')} onClick={() => setTimer({ res: 'aprovado' })}>Aprovado</button>
            <button type="button" disabled={busy} className={'R' + (res === 'reprovado' ? ' on' : '')} onClick={() => setTimer({ res: 'reprovado' })}>Reprovado</button>
          </div>
          <div className="disp">{mmss(ms)}</div>
          <div className="ctl">{ctl}</div>
          {same && T.stopped && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <span className="note">Ou descarte, informando o motivo:</span>
              <div className="reasons">
                {MOTIVOS.map(m => <button type="button" key={m} disabled={salvando} onClick={() => registrar('descartada', m)}>{m}</button>)}
              </div>
              <button type="button" className="link" style={{ fontSize: 12.5 }} onClick={() => resetTimer()}>Zerar sem registrar</button>
            </div>
          )}
          <span className="keys"><kbd>Espaço</kbd> inicia e pausa · <kbd>Enter</kbd> para e valida · <kbd>Esc</kbd> descarta</span>
        </div>
        <div className="box">
          <div className="row between">
            <h2>Medições deste documento</h2>
            <div className="row">
              {g.padrao ? <>
                <button type="button" className="btn sm solid" disabled={!sA.n && !sR.n} onClick={() => setTransp('enviar')} title="Usar as medições do padrão como tempo padrão em outros grupos">Usar em outros grupos</button>
                <button type="button" className="btn sm" onClick={() => setTransp('trazer')}>Trazer de outro grupo</button>
              </> : <>
                <button type="button" className="btn sm solid" onClick={() => setTransp('trazer')} title="Trazer as medições do grupo padrão (ou de outro grupo) como tempo padrão">Trazer do padrão</button>
                <button type="button" className="btn sm" disabled={!sA.n && !sR.n} onClick={() => setTransp('enviar')}>Usar em outros grupos</button>
              </>}
            </div>
          </div>
          {nTp > 0 && <p className="note"><span className="pill p-tp">Tempo padrão</span> {nTp} de {sA.n + sR.n} medição(ões) validada(s) vieram de outro grupo; as demais foram medidas aqui.</p>}
          <div className="stats">
            <div><b>{sA.n}/{ctx.cfg.minimo}</b><span>aprovado validadas</span></div>
            <div><b>{sA.val != null ? fmt(sA.val, 2) : '—'}</b><span>tempo-padrão aprov. ({base}, min)</span></div>
            <div><b>{sR.val != null ? fmt(sR.val, 2) : '—'}</b><span>tempo-padrão reprov. (min)</span></div>
            <div><b>{sA.mean != null ? fmt(sA.mean, 2) : '—'}</b><span>média aprov.</span></div>
            <div><b>{sA.med != null ? fmt(sA.med, 2) : '—'}</b><span>mediana aprov.</span></div>
            <div><b>{sA.min != null ? fmt(sA.min, 1) + '–' + fmt(sA.max!, 1) : '—'}</b><span>mín.–máx. aprov.</span></div>
          </div>
          <MedicoesDoc meds={meds} usuarios={d.usuarios} />
          <p className="note">Cada mudança fica registrada com quem fez e quando. Excluir tira a medição do cálculo na hora. O histórico completo está na aba Medições.</p>
        </div>
      </div>
      {transp && <TransportarTempo ctx={ctx} g={g} docId={docId} docNome={docNome} modo={transp} fechar={() => setTransp(null)} />}
    </>
  )
}

function MedicoesDoc({ meds, usuarios }: { meds: Medicao[]; usuarios: Usuario[] }) {
  const { alternarMedicao, tentar } = useCs()
  const { sorted, th } = useOrdem(meds, {
    data: m => m.created_at, av: m => nomeUsuario(usuarios.find(u => u.id === m.avaliador_id)),
    res: m => m.resultado, tempo: m => m.duracao_ms, sit: m => m.situacao,
  }, { col: 'data', dir: 'desc' })
  return (
    <div className="tbl scroll" style={{ maxHeight: 330 }}>
      <table>
        <thead><tr>{th('data', 'Data')}{th('av', 'Avaliador')}{th('res', 'Resultado')}{th('tempo', 'Tempo', 'r')}{th('sit', 'Situação')}<th /></tr></thead>
        <tbody>
          {sorted.length ? sorted.map(m => (
            <tr key={m.id}>
              <td className="mono">{dt(m.created_at)}</td>
              <td>{nomeUsuario(usuarios.find(u => u.id === m.avaliador_id))}</td>
              <td><PillResultado r={m.resultado} /></td>
              <td className="r mono">{mmss(m.duracao_ms)}</td>
              <td><span className="pills"><PillMedicao m={m} /><PillOrigem m={m} /></span></td>
              <td>
                <span className="pills">
                  <button type="button" className={'btn sm' + (m.situacao === 'validada' ? ' bad' : '')}
                    onClick={() => tentar(() => alternarMedicao(m), m.situacao === 'validada' ? 'Medição descartada' : 'Medição restaurada')}>
                    {m.situacao === 'validada' ? 'Descartar' : 'Restaurar'}
                  </button>
                  <BotaoExcluirMedicao m={m} />
                </span>
              </td>
            </tr>
          )) : <tr><td colSpan={6} className="empty">Nenhuma medição ainda.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
