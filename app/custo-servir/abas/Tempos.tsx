'use client'

import { useState } from 'react'
import { useCs } from '../cs-data'
import { fmt, grupoPadrao, nomeUsuario, norm, situacaoDoc, stat, type SituacaoDoc } from '../cs-lib'
import { ordenar, PillSituacao, TabelaMedicoes, thOrdem, type Ordem } from '../cs-ui'

export default function Tempos() {
  const { ctx, d, irCronometro } = useCs()
  const [gSel, setGSel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'todos' | SituacaoDoc>('todos')
  const [sel, setSel] = useState<string | null>(null)
  const [ord, setOrd] = useState<Ordem>({ col: 'doc', dir: 'asc' })
  if (!ctx) return null

  const g = ctx.grupos.find(x => x.id === gSel) ?? grupoPadrao(ctx)
  if (!g) return <div className="empty">Nenhum grupo cadastrado.</div>
  const todos = [...(ctx.gd.get(g.id) ?? [])].map(id => ctx.docs.get(id)!).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  let ds = todos
  if (q) ds = ds.filter(x => norm(x.nome).includes(norm(q)))
  if (filtro !== 'todos') ds = ds.filter(x => situacaoDoc(ctx, g.id, x.id) === filtro)
  const avaliadoresDe = (doc: string) =>
    [...new Set(d.meds.filter(m => m.grupo_id === g.id && m.documento_id === doc && m.situacao === 'validada').map(m => m.avaliador_id))]
  const ordemSit = { pronto: 0, andamento: 1, sem: 2 }
  const A = (doc: string) => stat(ctx, g.id, doc, 'aprovado'), R = (doc: string) => stat(ctx, g.id, doc, 'reprovado')
  ds = ordenar(ds, {
    doc: x => x.nome, vol: x => x.volume_ref, an: x => A(x.id).n, at: x => A(x.id).val,
    rn: x => R(x.id).n, rt: x => R(x.id).val ?? A(x.id).val, media: x => A(x.id).mean, min: x => A(x.id).min,
    av: x => avaliadoresDe(x.id).length, sit: x => ordemSit[situacaoDoc(ctx, g.id, x.id)],
  }, ord)
  const th = thOrdem(ord, setOrd)
  const prontos = todos.filter(x => situacaoDoc(ctx, g.id, x.id) === 'pronto')
  const andamento = todos.filter(x => situacaoDoc(ctx, g.id, x.id) === 'andamento')
  const vol = todos.reduce((a, x) => a + x.volume_ref, 0), volOk = prontos.reduce((a, x) => a + x.volume_ref, 0)
  const mm = d.meds.filter(m => m.grupo_id === g.id)
  const docSel = sel ? ctx.docs.get(sel) : null
  const base = ctx.cfg.base === 'media' ? 'média' : 'mediana'

  return (
    <>
      <div className="row">
        <label className="note" htmlFor="cs-tp-grupo">Grupo de critério</label>
        <select id="cs-tp-grupo" value={g.id} onChange={e => { setGSel(e.target.value); setSel(null) }} style={{ minWidth: 280 }}>
          {[...ctx.grupos].sort((a, b) => (a.padrao === b.padrao ? a.nome.localeCompare(b.nome, 'pt-BR') : a.padrao ? -1 : 1)).map(x => (
            <option key={x.id} value={x.id}>{x.nome}{x.contratantes.length ? ' · ' + x.contratantes.join(', ') : ''}</option>
          ))}
        </select>
      </div>
      <div className="tiles">
        <div className="tile"><b>{todos.length}</b><span>documentos no grupo</span></div>
        <div className="tile"><b>{prontos.length}</b><span>com tempo pronto (≥ {ctx.cfg.minimo} medições)</span></div>
        <div className="tile"><b>{andamento.length}</b><span>em andamento</span></div>
        <div className="tile"><b>{fmt(vol ? (volOk / vol) * 100 : 0)}%</b><span>do volume de referência coberto</span></div>
        <div className="tile"><b>{mm.filter(m => m.situacao === 'validada').length}</b><span>medições validadas</span></div>
        <div className="tile"><b>{mm.filter(m => m.situacao === 'descartada').length}</b><span>descartadas</span></div>
      </div>
      <div className="box">
        <div className="row between">
          <h2>{g.nome}: tempos por documento</h2>
          <div className="row">
            <select aria-label="Filtro" value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)}>
              <option value="todos">Todos</option>
              <option value="pronto">Prontos</option>
              <option value="andamento">Em andamento</option>
              <option value="sem">Sem medição</option>
            </select>
            <input type="search" placeholder="Buscar documento" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="tbl scroll">
          <table>
            <thead>
              <tr>
                {th('doc', 'Documento')}{th('vol', 'Volume', 'r')}{th('an', 'Aprov. (n)', 'r')}{th('at', 'Tempo aprov.', 'r')}
                {th('rn', 'Reprov. (n)', 'r')}{th('rt', 'Tempo reprov.', 'r')}{th('media', 'Média · mediana', 'r')}
                {th('min', 'Mín–máx', 'r')}{th('av', 'Avaliadores')}{th('sit', 'Situação')}
              </tr>
            </thead>
            <tbody>
              {ds.length ? ds.map(x => {
                const a = stat(ctx, g.id, x.id, 'aprovado'), r = stat(ctx, g.id, x.id, 'reprovado')
                const us = avaliadoresDe(x.id)
                const nomes = us.map(id => nomeUsuario(d.usuarios.find(u => u.id === id)))
                return (
                  <tr key={x.id} className={'click' + (sel === x.id ? ' sel' : '')} onClick={() => setSel(sel === x.id ? null : x.id)}>
                    <td style={{ maxWidth: 340 }}><b style={{ fontWeight: 600 }}>{x.nome}</b></td>
                    <td className="r mono">{fmt(x.volume_ref)}</td>
                    <td className="r mono">{a.n}</td>
                    <td className="r mono">{a.val != null ? fmt(a.val, 2) : '—'}</td>
                    <td className="r mono">{r.n}</td>
                    <td className="r mono">
                      {r.val != null ? fmt(r.val, 2)
                        : a.val != null ? <span title="Sem medição de reprovado: usa o tempo de aprovado">{fmt(a.val, 2)}*</span> : '—'}
                    </td>
                    <td className="r mono">{a.n ? fmt(a.mean!, 2) + ' · ' + fmt(a.med!, 2) : '—'}</td>
                    <td className="r mono">{a.n ? fmt(a.min!, 1) + '–' + fmt(a.max!, 1) : '—'}</td>
                    <td title={nomes.join(', ')}>{us.length ? `${us.length} pessoa${us.length > 1 ? 's' : ''}` : '—'}</td>
                    <td><PillSituacao s={situacaoDoc(ctx, g.id, x.id)} /></td>
                  </tr>
                )
              }) : <tr><td colSpan={10} className="empty">Nada encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="note">Tempos em minutos. Tempo-padrão = {base} das medições validadas (altere em Configurações › Parâmetros). * Sem medição de reprovado: usa o tempo de aprovado até haver medições.</p>
      </div>
      {docSel && (
        <div className="box">
          <div className="row between">
            <h2>Rastreio: {docSel.nome}</h2>
            <div className="row">
              <button type="button" className="btn solid" onClick={() => irCronometro(g.id, docSel.id)}>Cronometrar este documento</button>
              <button type="button" className="btn" onClick={() => setSel(null)}>Fechar</button>
            </div>
          </div>
          <TabelaMedicoes lista={d.meds.filter(m => m.grupo_id === g.id && m.documento_id === docSel.id)} compacta />
        </div>
      )}
    </>
  )
}
