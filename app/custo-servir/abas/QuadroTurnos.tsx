'use client'

// Turnos por contratante (GT0130): um cartao por contratante com os turnos dele. Inclua turnos
// (um, varios ou faixa "4-13"), edite codigo e descricao, exclua e arraste um turno para outro
// contratante. Tambem ha a visao em tabela, ordenavel.

import { useState } from 'react'
import { useCs } from '../cs-data'
import { nomeCtt, norm, temCatraca, type Ctx, type Turno } from '../cs-lib'
import { BotaoConfirmar, IconeCatraca, OrdemControle, ordenar, SeloCatraca, useOrdem, type Ordem } from '../cs-ui'

/** "4" | "4-13" | "4, 5; 7" -> ['4','5',...]. Faixa so com numeros e ate 200 turnos. */
export function parseTurnos(s: string): string[] {
  const out: string[] = []
  // "20 a 22", "20 até 22" e "20 - 22" viram "20-22" antes de separar
  const norm = s.replace(/(\d)\s*(?:-|–|\ba\b|\baté\b)\s*(\d)/gi, '$1-$2')
  for (const tok of norm.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean)) {
    const m = tok.match(/^(\d+)-(\d+)$/)
    if (m) {
      const a = +m[1], b = +m[2]
      if (b < a || b - a > 200) throw new Error(`Faixa inválida: ${tok}`)
      for (let i = a; i <= b; i++) out.push(String(i))
    } else out.push(tok)
  }
  return [...new Set(out)]
}

const numOuTexto = (s: string) => (/^\d+$/.test(s) ? +s : s)

export default function QuadroTurnos({ ctx }: { ctx: Ctx }) {
  const { d, adicionarTurnos, salvarTurno, excluirTurno, tentar } = useCs()
  const [visao, setVisao] = useState<'quadro' | 'tabela'>('quadro')
  const [q, setQ] = useState('')
  const [mostrar, setMostrar] = useState<'com' | 'todos'>('com')
  const [fCat, setFCat] = useState<'' | 'com' | 'sem'>('')
  const [ord, setOrd] = useState<Ordem>({ col: 'cod', dir: 'asc' })
  const [drag, setDrag] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  // Barra de inclusao rapida
  const [novoCtt, setNovoCtt] = useState('')
  const [novoTurno, setNovoTurno] = useState('')
  const [novaDesc, setNovaDesc] = useState('')
  const [novoInt, setNovoInt] = useState('')

  const porCtt = new Map<string, Turno[]>()
  for (const t of d.turnos) { const a = porCtt.get(t.contratante_cod); if (a) a.push(t); else porCtt.set(t.contratante_cod, [t]) }
  for (const a of porCtt.values()) a.sort((x, y) => (+x.turno_cod || 0) - (+y.turno_cod || 0) || x.turno_cod.localeCompare(y.turno_cod))

  const qn = norm(q)
  const casa = (cod: string) => {
    if (!qn) return true
    if (norm(cod + ' ' + nomeCtt(ctx, cod)).includes(qn)) return true
    return (porCtt.get(cod) ?? []).some(t => norm(t.turno_cod + ' ' + (t.descricao ?? '')).includes(qn))
  }
  // Durante o arraste mostra todos os contratantes, para poder soltar em qualquer um
  const casaCat = (c: string) => !fCat || (fCat === 'com' ? temCatraca(ctx, c) : !temCatraca(ctx, c))
  let cods = d.ctts.map(c => c.contratante_cod).filter(c => (drag || mostrar === 'todos' || porCtt.has(c)) && (drag || (casa(c) && casaCat(c))))
  cods = ordenar(cods, { cod: c => numOuTexto(c), nome: c => nomeCtt(ctx, c), n: c => porCtt.get(c)?.length ?? 0, cat: c => ctx.catraca.get(c) ?? 0 }, ord)
  const turnosCat = d.turnos.filter(t => t.codigo_integracao?.trim()).length
  const cttsComTurno = porCtt.size
  const ordenadosSelect = [...d.ctts].sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0))

  async function incluir(ctt: string, turnoTxt: string, desc: string, integ = '') {
    let lista: string[]
    try { lista = parseTurnos(turnoTxt) } catch (e) { return tentar(async () => { throw e }) }
    if (!ctt || !lista.length) return false
    return tentar(
      () => adicionarTurnos(lista.map(t => ({ turno_cod: t, contratante_cod: ctt, descricao: desc.trim() || null, codigo_integracao: integ.trim() || null }))),
      `${lista.length} turno(s) incluído(s) em ${ctt} · ${nomeCtt(ctx, ctt)}`,
    )
  }

  async function soltar(destino: string) {
    const t = drag
    setDrag(null); setSobre(null)
    if (!t) return
    const atual = d.turnos.find(x => x.turno_cod === t)
    if (!atual || atual.contratante_cod === destino) return
    await tentar(() => salvarTurno(t, { contratante_cod: destino }), `Turno ${t} → ${destino} · ${nomeCtt(ctx, destino)}`)
  }

  return (
    <div className="box">
      <div className="row between">
        <div>
          <h2>Turnos por contratante (GT0130)</h2>
          <p className="note">Cada turno pertence a um contratante; um contratante pode ter vários turnos. Usado nos documentos de pessoa sem GT0010. Arraste um turno para outro contratante para mudá-lo de lugar. Turno com código de integração (Código Perfil Integração) = catraca de acesso.</p>
        </div>
        <div className="cfgnav">
          <button type="button" className={visao === 'quadro' ? 'on' : ''} onClick={() => setVisao('quadro')}>Quadro</button>
          <button type="button" className={visao === 'tabela' ? 'on' : ''} onClick={() => setVisao('tabela')}>Tabela</button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><b>{d.turnos.length}</b><span>turnos cadastrados</span></div>
        <div className="tile"><b>{cttsComTurno}</b><span>contratantes com turno</span></div>
        <div className="tile cat"><b><IconeCatraca size={18} /> {ctx.catraca.size}</b><span>contratantes com catraca ({cttsComTurno ? Math.round((ctx.catraca.size / cttsComTurno) * 100) : 0}% dos que têm turno)</span></div>
        <div className="tile cat"><b>{turnosCat}</b><span>turnos com código de integração (catraca)</span></div>
      </div>

      <div className="selbar">
        <b>Incluir turnos</b>
        <select value={novoCtt} onChange={e => setNovoCtt(e.target.value)} aria-label="Contratante" style={{ maxWidth: 320 }}>
          <option value="">Contratante…</option>
          {ordenadosSelect.map(c => <option key={c.contratante_cod} value={c.contratante_cod}>{c.contratante_cod} · {c.nome}</option>)}
        </select>
        <input type="text" value={novoTurno} onChange={e => setNovoTurno(e.target.value)} placeholder="Turno(s): 210 · 4-13 · 4, 7" style={{ width: 190 }} aria-label="Turnos" />
        <input type="text" value={novaDesc} onChange={e => setNovaDesc(e.target.value)} placeholder="Descrição (opcional)" style={{ flex: 1, minWidth: 180 }} aria-label="Descrição" />
        <input type="text" value={novoInt} onChange={e => setNovoInt(e.target.value)} placeholder="Cód. integração (catraca)" style={{ width: 170 }} aria-label="Código perfil integração" />
        <button type="button" className="btn sm solid" disabled={!novoCtt || !novoTurno.trim()} onClick={async () => {
          if (await incluir(novoCtt, novoTurno, novaDesc, novoInt)) { setNovoTurno(''); setNovaDesc(''); setNovoInt('') }
        }}>Incluir</button>
      </div>

      {visao === 'quadro' ? <>
        <div className="row between">
          <div className="row">
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar contratante, turno ou descrição" style={{ width: 'min(320px,100%)' }} />
            <select value={mostrar} onChange={e => setMostrar(e.target.value as 'com' | 'todos')} aria-label="Mostrar">
              <option value="com">Só contratantes com turnos</option>
              <option value="todos">Todos os contratantes</option>
            </select>
            <select value={fCat} onChange={e => setFCat(e.target.value as typeof fCat)} aria-label="Catraca">
              <option value="">Com e sem catraca</option>
              <option value="com">Só com catraca</option>
              <option value="sem">Só sem catraca</option>
            </select>
          </div>
          <OrdemControle ord={ord} setOrd={setOrd} opcoes={[{ col: 'cod', label: 'Código' }, { col: 'nome', label: 'Nome' }, { col: 'n', label: 'Nº de turnos' }, { col: 'cat', label: 'Turnos com catraca' }]} />
        </div>
        <p className="note">{d.turnos.length} turnos em {porCtt.size} contratantes.{mostrar === 'com' && ' Para incluir turnos em um contratante sem turnos, use a barra acima ou mostre todos os contratantes.'}</p>
        <div className="board">
          {cods.map(c => (
            <CartaoCtt key={c} ctx={ctx} cod={c} turnos={porCtt.get(c) ?? []} drag={drag} sobre={sobre === c}
              onDragStart={t => setDrag(t)} onDragEnd={() => { setDrag(null); setSobre(null) }}
              onSobre={v => setSobre(v ? c : null)} onSoltar={() => soltar(c)}
              onIncluir={(t, desc) => incluir(c, t, desc)}
              onSalvar={(orig, patch) => tentar(() => salvarTurno(orig, patch), 'Turno atualizado')}
              onExcluir={t => tentar(() => excluirTurno(t), `Turno ${t} excluído`)}
            />
          ))}
          {!cods.length && <div className="empty">Nenhum contratante encontrado.</div>}
        </div>
      </> : <TabelaTurnos ctx={ctx} />}
    </div>
  )
}

function CartaoCtt({ ctx, cod, turnos, drag, sobre, onDragStart, onDragEnd, onSobre, onSoltar, onIncluir, onSalvar, onExcluir }: {
  ctx: Ctx; cod: string; turnos: Turno[]; drag: string | null; sobre: boolean
  onDragStart: (t: string) => void; onDragEnd: () => void; onSobre: (v: boolean) => void; onSoltar: () => void
  onIncluir: (t: string, desc: string) => Promise<boolean>
  onSalvar: (orig: string, patch: Partial<Turno>) => Promise<boolean>
  onExcluir: (t: string) => void
}) {
  const [t, setT] = useState('')
  const [desc, setDesc] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [eCod, setECod] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eInt, setEInt] = useState('')
  const origem = !!drag && turnos.some(x => x.turno_cod === drag)
  const alvo = !!drag && !origem
  const pai = ctx.ctts.get(cod)?.contratante_pai

  async function salvarEdicao(orig: Turno) {
    const nc = eCod.trim(), nd = eDesc.trim() || null, ni = eInt.trim() || null
    if (!nc) return
    const patch: Partial<Turno> = {}
    if (nc !== orig.turno_cod) patch.turno_cod = nc
    if (nd !== orig.descricao) patch.descricao = nd
    if (ni !== orig.codigo_integracao) patch.codigo_integracao = ni
    if (Object.keys(patch).length && !(await onSalvar(orig.turno_cod, patch))) return
    setEditando(null)
  }

  return (
    <div className={'gcol' + (origem ? ' origem' : '')}
      style={alvo && sobre ? { borderStyle: 'dashed', background: 'var(--cs-tint)' } : undefined}
      onDragOver={e => { if (!alvo) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!sobre) onSobre(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onSobre(false) }}
      onDrop={e => { e.preventDefault(); if (alvo) onSoltar() }}>
      <header>
        <div className="t">
          <span className="mono" style={{ fontWeight: 800, color: 'var(--cs-edge)' }}>{cod}</span>
          <b title={nomeCtt(ctx, cod)}>{nomeCtt(ctx, cod)}</b>
          {temCatraca(ctx, cod) && <SeloCatraca n={ctx.catraca.get(cod)} compacto />}
          <span className="pill p-blue" title="Turnos">{turnos.length}</span>
        </div>
        {pai && <span className="note">unidade de {pai} · {nomeCtt(ctx, pai)}</span>}
      </header>
      <div className="body">
        {turnos.length ? turnos.map(x => editando === x.turno_cod ? (
          <div key={x.turno_cod} className="dchip sel" style={{ cursor: 'default', flexWrap: 'wrap' }}>
            <input type="text" value={eCod} onChange={e => setECod(e.target.value)} style={{ width: 70, padding: '3px 6px' }} aria-label="Código do turno" autoFocus />
            <input type="text" value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="Descrição" style={{ flex: 1, minWidth: 120, padding: '3px 6px' }} aria-label="Descrição do turno"
              onKeyDown={e => { if (e.key === 'Enter') void salvarEdicao(x); if (e.key === 'Escape') setEditando(null) }} />
            <input type="text" value={eInt} onChange={e => setEInt(e.target.value)} placeholder="Cód. integração" style={{ width: 110, padding: '3px 6px' }} aria-label="Código de integração"
              onKeyDown={e => { if (e.key === 'Enter') void salvarEdicao(x); if (e.key === 'Escape') setEditando(null) }} />
            <button type="button" className="btn sm solid" onClick={() => salvarEdicao(x)}>Salvar</button>
            <button type="button" className="link" onClick={() => setEditando(null)}>cancelar</button>
          </div>
        ) : (
          <div key={x.turno_cod} className={'dchip' + (drag === x.turno_cod ? ' arrastando' : '')} draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', x.turno_cod); onDragStart(x.turno_cod) }}
            onDragEnd={onDragEnd}
            onDoubleClick={() => { setEditando(x.turno_cod); setECod(x.turno_cod); setEDesc(x.descricao ?? ''); setEInt(x.codigo_integracao ?? '') }}
            title="Arraste para outro contratante · duplo clique para editar">
            <span className="h">⠿</span>
            <b className="mono" style={{ minWidth: 28 }}>{x.turno_cod}</b>
            <span className="n" style={{ fontWeight: 500, color: x.descricao ? undefined : 'var(--cs-muted)' }}>{x.descricao || 'sem descrição'}</span>
            {x.codigo_integracao && <span className="badge-int" title="Código perfil integração: turno com catraca"><IconeCatraca size={11} title="Catraca" />{x.codigo_integracao}</span>}
            <button type="button" className="x" style={{ color: 'var(--cs-edge)' }} title="Editar"
              onClick={() => { setEditando(x.turno_cod); setECod(x.turno_cod); setEDesc(x.descricao ?? ''); setEInt(x.codigo_integracao ?? '') }}>✎</button>
            <BotaoX onConfirm={() => onExcluir(x.turno_cod)} />
          </div>
        )) : <div className="vazio">Arraste turnos pra cá ou inclua abaixo</div>}
      </div>
      <div className="foot">
        <input type="text" value={t} onChange={e => setT(e.target.value)} placeholder="Turno ou 4-13" style={{ maxWidth: 110 }} aria-label={'Turno para ' + cod} />
        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descrição" aria-label={'Descrição para ' + cod}
          onKeyDown={async e => { if (e.key === 'Enter' && t.trim() && await onIncluir(t, desc)) { setT(''); setDesc('') } }} />
        <button type="button" className="btn sm" disabled={!t.trim()} onClick={async () => { if (await onIncluir(t, desc)) { setT(''); setDesc('') } }}>＋</button>
      </div>
    </div>
  )
}

/** ✕ com confirmacao (dois cliques). */
function BotaoX({ onConfirm }: { onConfirm: () => void }) {
  const [armado, setArmado] = useState(false)
  return (
    <button type="button" className="x" title={armado ? 'Clique de novo para excluir' : 'Excluir turno'}
      style={armado ? { background: 'var(--cs-bad)', color: '#fff', borderRadius: 4 } : undefined}
      onClick={e => {
        e.stopPropagation()
        if (!armado) { setArmado(true); setTimeout(() => setArmado(false), 3000); return }
        setArmado(false); onConfirm()
      }}>{armado ? 'excluir?' : '✕'}</button>
  )
}

function TabelaTurnos({ ctx }: { ctx: Ctx }) {
  const { d, salvarTurno, excluirTurno, tentar } = useCs()
  const [q, setQ] = useState('')
  const filtrados = q ? d.turnos.filter(t => norm(t.turno_cod + ' ' + (t.descricao ?? '') + ' ' + (t.codigo_integracao ?? '') + ' ' + t.contratante_cod + ' ' + nomeCtt(ctx, t.contratante_cod)).includes(norm(q))) : d.turnos
  const { sorted, th } = useOrdem(filtrados, {
    turno: t => numOuTexto(t.turno_cod), desc: t => t.descricao, integ: t => t.codigo_integracao, cod: t => numOuTexto(t.contratante_cod), nome: t => nomeCtt(ctx, t.contratante_cod),
  }, { col: 'turno', dir: 'asc' })
  return <>
    <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar" style={{ width: 'min(320px,100%)' }} />
    <div className="tbl scroll">
      <table>
        <thead><tr>{th('turno', 'Turno')}{th('desc', 'Descrição')}{th('integ', 'Cód. integração (catraca)')}{th('cod', 'Cód. contratante')}{th('nome', 'Contratante')}<th /></tr></thead>
        <tbody>
          {sorted.length ? sorted.map(x => (
            <tr key={x.turno_cod}>
              <td><Campo valor={x.turno_cod} largura={80} onSalvar={v => tentar(() => salvarTurno(x.turno_cod, { turno_cod: v }))} /></td>
              <td><Campo valor={x.descricao ?? ''} vazio onSalvar={v => tentar(() => salvarTurno(x.turno_cod, { descricao: v || null }))} /></td>
              <td><Campo valor={x.codigo_integracao ?? ''} vazio largura={110} onSalvar={v => tentar(() => salvarTurno(x.turno_cod, { codigo_integracao: v || null }))} /></td>
              <td>
                <select value={x.contratante_cod} onChange={e => tentar(() => salvarTurno(x.turno_cod, { contratante_cod: e.target.value }))} aria-label="Contratante" style={{ maxWidth: 260 }}>
                  {[...d.ctts].sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0)).map(c => (
                    <option key={c.contratante_cod} value={c.contratante_cod}>{c.contratante_cod} · {c.nome}</option>
                  ))}
                </select>
              </td>
              <td className="note">{nomeCtt(ctx, x.contratante_cod)}{temCatraca(ctx, x.contratante_cod) && <SeloCatraca n={ctx.catraca.get(x.contratante_cod)} compacto />}</td>
              <td><BotaoConfirmar onConfirm={() => tentar(() => excluirTurno(x.turno_cod), `Turno ${x.turno_cod} excluído`)}>Excluir</BotaoConfirmar></td>
            </tr>
          )) : <tr><td colSpan={6} className="empty">Nenhum turno.</td></tr>}
        </tbody>
      </table>
    </div>
  </>
}

function Campo({ valor, onSalvar, vazio, largura }: { valor: string; onSalvar: (v: string) => Promise<boolean>; vazio?: boolean; largura?: number }) {
  const [txt, setTxt] = useState(valor)
  const [ant, setAnt] = useState(valor)
  if (valor !== ant) { setAnt(valor); setTxt(valor) }
  return (
    <input type="text" value={txt} style={largura ? { width: largura } : undefined}
      onChange={e => setTxt(e.target.value)}
      onBlur={async () => {
        const v = txt.trim()
        if (v === valor) return
        if (!v && !vazio) { setTxt(valor); return }
        if (!(await onSalvar(v))) setTxt(valor)
      }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}
