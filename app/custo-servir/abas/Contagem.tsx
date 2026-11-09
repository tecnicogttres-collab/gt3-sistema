'use client'

import { useMemo, useRef, useState } from 'react'
import { useCs } from '../cs-data'
import {
  agruparUnidades, baixar, brl, brl2, COLUNAS_MODELO, contar, dt, fatorMes, financeiro, fmt, grupoDe, liberado, nomeCtt, parseLinhas, temCatraca, unidadesDe,
  type Contagem as TContagem, type Ctx,
} from '../cs-lib'
import ContagemDetalhes from './ContagemDetalhes'
import { useTempo } from '../cs-tempo'
import { BotaoConfirmar, IconeCatraca, ordenar, SeloCatraca, thOrdem, type Ordem } from '../cs-ui'

/** Le texto em UTF-8; se nao for UTF-8 valido (CSV salvo pelo Excel em ANSI), usa Windows-1252. */
async function lerTexto(f: File) {
  const buf = await f.arrayBuffer()
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) }
  catch { return new TextDecoder('windows-1252').decode(buf) }
}

export async function lerArquivo(f: File): Promise<unknown[][]> {
  const XLSX = await import('xlsx')
  if (/\.csv$/i.test(f.name)) {
    const txt = (await lerTexto(f)).replace(/^﻿/, '')
    const first = txt.split(/\r?\n/)[0] ?? ''
    const FS = first.split(';').length > first.split(',').length ? ';' : ','
    const wb = XLSX.read(txt, { type: 'string', FS, raw: true } as Parameters<typeof XLSX.read>[1])
    return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false })
  }
  const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true })
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, dateNF: 'dd/mm/yyyy' })
}

export default function Contagem() {
  const api = useCs()
  const { ctx, d, relSel, linhas, carregandoLinhas, selecionarRelatorio, importarRelatorio, excluirRelatorio, tentar, toast, irCronometro } = api
  const [ctSel, setCtSel] = useState<string | null>(null)
  const [dias, setDias] = useState('')
  const [importando, setImportando] = useState(false)
  const [oCtt, setOCtt] = useState<Ordem>({ col: 'div', dir: 'desc' })
  const [oDet, setODet] = useState<Ordem>({ col: 'div', dir: 'desc' })
  const [oPend, setOPend] = useState<Ordem>({ col: 'n', dir: 'desc' })
  const [oUnk, setOUnk] = useState<Ordem>({ col: 'n', dir: 'desc' })
  const [agrupar, setAgrupar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const tm = useTempo()

  const r = useMemo(() => (ctx ? contar(ctx, linhas) : null), [ctx, linhas])
  if (!ctx || !r) return null

  async function onArquivo(f: File) {
    setImportando(true)
    try {
      const ls = parseLinhas(await lerArquivo(f))
      if (!ls.length) throw new Error('Nenhuma linha com documento encontrada.')
      const n = parseInt(dias, 10)
      await importarRelatorio(f.name, n > 0 ? n : null, ls)
      setCtSel(null); setDias('')
      toast(`${ls.length} linhas importadas`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível ler o arquivo')
    } finally {
      setImportando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  type LinhaCtt = { c: string; n: number; int: number; min: number; ev: number; soma?: boolean; membro?: boolean }
  const getC = {
    cod: (x: LinhaCtt) => +x.c || x.c, nome: (x: LinhaCtt) => nomeCtt(ctx, x.c), grupo: (x: LinhaCtt) => (x.soma ? null : grupoDe(ctx, x.c)?.nome),
    n: (x: LinhaCtt) => x.n, int: (x: LinhaCtt) => x.int, div: (x: LinhaCtt) => x.min, ev: (x: LinhaCtt) => x.ev,
    cat: (x: LinhaCtt) => (x.soma ? null : temCatraca(ctx, x.c) ? 0 : 1),
  }
  const lista: LinhaCtt[] = ordenar(Object.entries(r.by).map(([c, o]) => ({ c, n: o.n, int: o.int, min: o.min, ev: o.ev })), getC, oCtt)
  const temUnidades = d.ctts.some(c => c.contratante_pai)
  // Visao agrupada: principal = soma das unidades (e da conta dele mesmo); evitavel do grupo = saida conjunta
  const linhasTab: LinhaCtt[] = !(agrupar && temUnidades) ? lista : (() => {
    const blocos = [...agruparUnidades(ctx, lista.map(x => x.c))].map(([p, ms]) => {
      const membros = lista.filter(x => ms.includes(x.c))
      if (membros.length === 1 && membros[0].c === p && !unidadesDe(ctx, p).length) return { topo: membros[0], filhos: [] as LinhaCtt[] }
      const s = (k: 'n' | 'int' | 'min') => membros.reduce((a, x) => a + x[k], 0)
      const topo: LinhaCtt = { c: p, n: s('n'), int: s('int'), min: s('min'), ev: liberado(r, new Set(ms)), soma: true }
      return { topo, filhos: membros.map(x => ({ ...x, membro: true })) }
    })
    const ord = ordenar(blocos, Object.fromEntries(Object.entries(getC).map(([k, g]) => [k, (b: typeof blocos[number]) => g(b.topo)])), oCtt)
    return ord.flatMap(b => [b.topo, ...b.filhos])
  })()
  const thC = thOrdem(oCtt, setOCtt), thD = thOrdem(oDet, setODet), thP = thOrdem(oPend, setOPend), thU = thOrdem(oUnk, setOUnk)
  const somaInt = lista.reduce((a, x) => a + x.int, 0)
  const somaMin = lista.reduce((a, x) => a + x.min, 0)
  const somaEv = lista.reduce((a, x) => a + x.ev, 0)
  const sel = ctSel ? r.by[ctSel] : null
  const autor = relSel?.created_by ? d.usuarios.find(u => u.id === relSel.created_by) : undefined

  return (
    <>
      <div className="box">
        <div className="row between">
          <div>
            <h2>Relatório</h2>
            <p className="note">
              {relSel
                ? <>{relSel.nome} · {carregandoLinhas ? 'carregando…' : `${linhas.length} linhas`} · importado em {dt(relSel.created_at)}{autor ? ` por ${autor.nome ?? autor.usuario}` : ''}
                  {' · '}{relSel.dias_uteis ? `${relSel.dias_uteis} dias úteis` : 'dias úteis não informados'}</>
                : 'Nenhum relatório importado.'}
            </p>
          </div>
          <div className="row">
            {d.rels.length > 1 && (
              <select aria-label="Relatório" value={relSel?.id ?? ''} onChange={e => { selecionarRelatorio(e.target.value); setCtSel(null) }}>
                {d.rels.map(x => <option key={x.id} value={x.id}>{x.nome ?? 'Relatório'} · {new Date(x.created_at).toLocaleDateString('pt-BR')}</option>)}
              </select>
            )}
            {relSel && <BotaoConfirmar onConfirm={() => tentar(() => excluirRelatorio(relSel.id), 'Relatório excluído')}>Excluir relatório</BotaoConfirmar>}
          </div>
        </div>
        <div className="row">
          <label className="note" htmlFor="cs-dias">Dias úteis cobertos pelo relatório</label>
          <input id="cs-dias" type="number" min={1} value={dias} onChange={e => setDias(e.target.value)} style={{ width: 90 }} placeholder="ex.: 5" />
          <button type="button" className="btn solid" disabled={importando} onClick={() => fileRef.current?.click()}>
            {importando ? 'Importando…' : 'Importar relatório (CSV ou Excel)'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void onArquivo(f) }} />
          <button type="button" className="btn" onClick={() => baixar('modelo-relatorio-custo-servir.csv', '﻿' + COLUNAS_MODELO.join(';') + '\n')}>Baixar modelo</button>
        </div>
        <p className="note">Formato esperado: o relatório EFIDOCEMP-201 com as colunas novas da solicitação de melhoria (Cód. vinculação, Cód. ignorado GT0120, Cód. contratante GT0010, Cód. turno GT0130). Códigos múltiplos separados por vírgula ou ponto e vírgula. Os dias úteis servem para projetar o mês na aba Resultado (podem ser ajustados lá).</p>
      </div>

      <div className="tiles">
        <div className="tile"><b>{r.rows}</b><span>linhas lidas</span></div>
        <div className="tile"><b>{r.ok}</b><span>contabilizadas</span></div>
        <div className="tile"><b style={{ color: r.pend ? 'var(--cs-warn)' : undefined }}>{r.pend}</b><span>sem tempo-padrão</span></div>
        <div className="tile"><b>{r.noCtt}</b><span>sem contratante válido{r.bloqueios.pessoa_sem_turno ? ` (${r.bloqueios.pessoa_sem_turno} pessoa sem turno)` : ''}</span></div>
        <div className="tile"><b>{r.ign}</b><span>não contam (presença)</span></div>
        <div className="tile"><b style={{ color: r.unk ? 'var(--cs-bad)' : undefined }}>{r.unk}</b><span>documento desconhecido</span></div>
      </div>

      <div className="grid2 wide">
        <div className="box">
          <div className="row between">
            <h2>Horas por contratante</h2>
            {temUnidades && (
              <label className="row note" style={{ gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={agrupar} onChange={e => setAgrupar(e.target.checked)} />
                Agrupar unidades no contratante principal
              </label>
            )}
          </div>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  {thC('cod', 'Cód.')}{thC('nome', 'Contratante')}{thC('cat', <IconeCatraca title="Catraca de acesso" />, 'c', 'Catraca de acesso')}{thC('grupo', 'Grupo')}{thC('n', 'Avaliações', 'r')}
                  {thC('int', 'Inteiro (h)', 'r', 'Tempo-padrão inteiro do grupo dele em cada avaliação')}
                  {thC('div', 'Dividido (h)', 'r', 'Divisão por camadas; soma igual ao tempo real')}
                  {thC('ev', 'Evitável (h)', 'r', 'Tempo que some se ele sair')}
                </tr>
              </thead>
              <tbody>
                {lista.length ? <>
                  {linhasTab.map(x => x.soma ? (
                    <tr key={'soma-' + x.c} className="total" title="Soma do contratante principal e das unidades">
                      <td className="mono">{x.c}</td>
                      <td>Σ {nomeCtt(ctx, x.c)} <span className="note">(principal + unidades)</span></td>
                      <td /><td />
                      <td className="r mono">{fmt(x.n, 1)}</td>
                      <td className="r mono">{tm.h(x.int / 60)}</td>
                      <td className="r mono"><b>{tm.h(x.min / 60)}</b></td>
                      <td className="r mono" title="Saída conjunta de todo o grupo">{tm.h(x.ev / 60)}</td>
                    </tr>
                  ) : (
                    <tr key={x.c} className={'click' + (ctSel === x.c ? ' sel' : '')} onClick={() => setCtSel(ctSel === x.c ? null : x.c)}>
                      <td className="mono">{x.c}</td>
                      <td>{x.membro && <span className="note" style={{ marginRight: 6 }}>↳</span>}{nomeCtt(ctx, x.c)}</td>
                      <td className="c">{temCatraca(ctx, x.c) && <SeloCatraca n={ctx.catraca.get(x.c)} compacto />}</td>
                      <td>{grupoDe(ctx, x.c)?.nome}</td>
                      <td className="r mono">{fmt(x.n, 1)}</td>
                      <td className="r mono">{tm.h(x.int / 60)}</td>
                      <td className="r mono"><b>{tm.h(x.min / 60)}</b></td>
                      <td className="r mono">{tm.h(x.ev / 60)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td /><td>Total</td><td /><td /><td />
                    <td className="r mono">{tm.h(somaInt / 60)}</td>
                    <td className="r mono">{tm.h(somaMin / 60)}</td>
                    <td className="r mono">{tm.h(somaEv / 60)}</td>
                  </tr>
                </> : <tr><td colSpan={8} className="empty">Nenhuma linha contabilizada ainda.</td></tr>}
              </tbody>
            </table>
          </div>
          {lista.length > 0 && (
            <div className="tiles">
              <div className="tile"><b>{tm.hu(r.real / 60)}</b><span>tempo real gasto</span></div>
              <div className="tile"><b>{tm.hu((somaInt - r.real) / 60)}</b><span>contagem dupla se usar o inteiro</span></div>
              <div className="tile"><b>{tm.hu((r.real - somaEv) / 60)}</b><span>custo comum (nenhuma saída isolada libera)</span></div>
            </div>
          )}
          {lista.length > 0 && (() => {
            const com = lista.filter(x => temCatraca(ctx, x.c)), sem = lista.filter(x => !temCatraca(ctx, x.c))
            const h = (l: typeof lista) => l.reduce((a, x) => a + x.min, 0)
            const n = (l: typeof lista) => l.reduce((a, x) => a + x.n, 0)
            const pct = somaMin ? (h(com) / somaMin) * 100 : 0
            return (
              <div className="tiles">
                <div className="tile cat"><b><IconeCatraca size={18} /> {tm.hu(h(com) / 60)}</b><span>com catraca · {fmt(pct)}% do dividido · {com.length} contratante(s) · {fmt(n(com), 1)} avaliações</span></div>
                <div className="tile"><b>{tm.hu(h(sem) / 60)}</b><span>sem catraca · {fmt(100 - pct)}% do dividido · {sem.length} contratante(s) · {fmt(n(sem), 1)} avaliações</span></div>
                <div className="tile cat"><b>{com.length && sem.length && n(com) && n(sem) ? fmt((h(com) / n(com)) / (h(sem) / n(sem)), 2) + '×' : '—'}</b><span>minutos por avaliação: com catraca ÷ sem catraca</span></div>
              </div>
            )
          })()}
          <p className="note"><b>Inteiro</b>: quanto custaria atender o contratante sozinho; é a base de preço para cliente novo. <b>Dividido</b>: divisão por camadas (a base é dividida entre todos e o extra de um critério mais rigoroso vai para quem o exige); a soma bate com o tempo real e é o número da margem. <b>Evitável</b>: tempo da avaliação com todos menos o tempo sem ele; é o que uma saída libera. Sempre vale: evitável ≤ dividido ≤ inteiro.</p>
        </div>

        <div className="box">
          <h2>{sel ? 'Detalhe: ' + nomeCtt(ctx, ctSel!) : 'Pendências'}</h2>
          {sel ? <>
            <div className="tbl scroll" style={{ maxHeight: 360 }}>
              <table>
                <thead><tr>{thD('doc', 'Documento')}{thD('div', 'Dividido (min)', 'r')}{thD('ev', 'Evitável (min)', 'r')}</tr></thead>
                <tbody>
                  {ordenar(Object.entries(sel.docs), { doc: ([id]) => ctx.docs.get(id)?.nome, div: ([, m]) => m, ev: ([id]) => sel.evd[id] || 0 }, oDet).map(([id, m]) => (
                    <tr key={id}><td>{ctx.docs.get(id)?.nome}</td><td className="r mono">{tm.min(m, 2)}</td><td className="r mono">{tm.min(sel.evd[id] || 0, 2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setCtSel(null)}>Ver pendências</button>
          </> : <>
            {Object.keys(r.pendList).length ? <>
              <p className="note">Linhas que ainda não têm tempo-padrão. Cronometre para elas entrarem na conta.</p>
              <div className="tbl scroll" style={{ maxHeight: 300 }}>
                <table>
                  <thead><tr>{thP('grupo', 'Grupo')}{thP('doc', 'Documento')}{thP('n', 'Linhas', 'r')}<th /></tr></thead>
                  <tbody>
                    {ordenar(Object.entries(r.pendList), {
                      grupo: ([k]) => ctx.grupos.find(x => x.id === k.split('|')[0])?.nome, doc: ([k]) => ctx.docs.get(k.split('|')[1])?.nome, n: ([, n]) => n,
                    }, oPend).map(([k, n]) => {
                      const [g, doc] = k.split('|')
                      return (
                        <tr key={k}>
                          <td>{ctx.grupos.find(x => x.id === g)?.nome}</td>
                          <td>{ctx.docs.get(doc)?.nome}</td>
                          <td className="r mono">{n}</td>
                          <td><button type="button" className="btn sm solid" onClick={() => irCronometro(g, doc)}>Cronometrar</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </> : <p className="note">Nenhuma pendência de tempo-padrão.</p>}
            {Object.keys(r.unkList).length > 0 && <>
              <h3 style={{ marginTop: 6 }}>Documentos que não estão no catálogo</h3>
              <div className="tbl" style={{ maxHeight: 200, overflow: 'auto' }}>
                <table><thead><tr>{thU('doc', 'Documento')}{thU('n', 'Linhas', 'r')}</tr></thead><tbody>
                  {ordenar(Object.entries(r.unkList), { doc: ([n]) => n, n: ([, c]) => c }, oUnk).map(([n, c]) => <tr key={n}><td>{n}</td><td className="r mono">{c}</td></tr>)}
                </tbody></table>
              </div>
              <p className="note">Inclua-os em Configurações › Catálogo de documentos (ou informe o código do documento lá).</p>
            </>}
          </>}
        </div>
      </div>

      <ContagemDetalhes ctx={ctx} r={r} irCatalogo={() => api.irConfig('catalogo')} irTurnos={() => api.irConfig('turnos')} />

      <Simulador ctx={ctx} r={r} />
    </>
  )
}

function Simulador({ ctx, r }: { ctx: Ctx; r: TContagem }) {
  const { relSel } = useCs()
  const [simSel, setSimSel] = useState<Set<string>>(new Set())
  const tm = useTempo()
  const cods = Object.keys(r.by).sort((a, b) => r.by[b].min - r.by[a].min)
  if (!cods.length) return null

  const fin = financeiro(ctx.cfg)
  const fator = fatorMes(ctx.cfg, relSel)
  const f = fator ?? 1
  const per = fator ? 'por mês' : 'no período do relatório'
  const sel = [...simSel].filter(c => r.by[c])
  const lib = (liberado(r, new Set(sel)) / 60) * f
  const div = (sel.reduce((a, c) => a + r.by[c].min, 0) / 60) * f
  const fat = sel.reduce((a, c) => a + (ctx.ctts.get(c)?.faturamento_mensal || 0), 0)
  const valor = fator ? lib * fin.ch : 0
  // Faturamento e mensal: so compara com horas projetadas para o mes
  const be = lib > 0 && fator ? fat / lib : 0

  // Grupos (principal + unidades) presentes na contagem, para simular a saida do grupo inteiro
  const gruposSim = [...agruparUnidades(ctx, cods)].filter(([p, ms]) => ms.length > 1 || ms[0] !== p)
  const toggle = (c: string) => setSimSel(prev => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n })

  return (
    <div className="box">
      <h2>Simular saída de contratantes</h2>
      <p className="note">Marque um ou mais contratantes. O cálculo usa as horas evitáveis: o que some do trabalho da equipe se eles saírem juntos, já que documentos compartilhados continuam para os demais. {fator ? `Valores projetados para o mês (×${fmt(f, 2)}).` : 'Sem projeção para o mês: informe os dias úteis do relatório e os dias do mês na aba Resultado.'}</p>
      <div className="row">
        {cods.map(c => (
          <button key={c} type="button" className={'btn sm' + (simSel.has(c) ? ' solid' : '')} aria-pressed={simSel.has(c)} onClick={() => toggle(c)}>
            {c} · {nomeCtt(ctx, c).slice(0, 26)}
          </button>
        ))}
        {sel.length > 0 && <button type="button" className="link" onClick={() => setSimSel(new Set())}>limpar</button>}
      </div>
      {gruposSim.length > 0 && (
        <div className="row">
          <span className="note">Grupo inteiro:</span>
          {gruposSim.map(([p, ms]) => {
            const todos = ms.every(c => simSel.has(c))
            return (
              <button key={p} type="button" className={'btn sm' + (todos ? ' solid' : '')} aria-pressed={todos}
                onClick={() => setSimSel(prev => { const n = new Set(prev); ms.forEach(c => (todos ? n.delete(c) : n.add(c))); return n })}>
                Σ {p} · {nomeCtt(ctx, p).slice(0, 22)} ({ms.length})
              </button>
            )
          })}
        </div>
      )}
      {sel.length ? <>
        <div className="tiles">
          <div className="tile"><b>{tm.hu(lib, 1)}</b><span>liberadas {per} (evitável)</span></div>
          <div className="tile"><b>{tm.hu(div, 1)}</b><span>atribuídas hoje (dividido)</span></div>
          <div className="tile"><b>{brl(fat)}</b><span>faturamento mensal que sai</span></div>
          <div className="tile"><b>{fin.ok && fator ? brl(valor) : '—'}</b><span>valor da capacidade liberada</span></div>
          <div className="tile"><b>{be > 0 ? brl2(be) : '—'}</b><span>receita por hora que o substituto precisa superar</span></div>
        </div>
        <p>
          {lib <= 0.001
            ? 'Essa saída não libera horas: todos os documentos continuam necessários para outros contratantes.'
            : !fat
              ? `A saída libera ${fmt(lib, 1)} h ${per}. Informe o faturamento desses contratantes em Resultado para completar a conta.`
              : !fator
                ? `A saída libera ${fmt(lib, 1)} h ${per}. Para comparar com o faturamento mensal, informe os dias úteis do relatório e os dias do mês na aba Resultado.`
                : <>Para a troca valer a pena, quem ocupar essas {fmt(lib, 1)} h precisa pagar mais de {brl(fat)} por mês, ou seja, mais de {brl2(be)} por hora.{' '}
                {!fin.ok
                  ? 'Preencha os parâmetros da equipe em Resultado para comparar com a hora mínima.'
                  : be < fin.hmin
                    ? `Isso fica abaixo da hora mínima (${brl2(fin.hmin)}): qualquer cliente novo dentro da hora mínima já é um negócio melhor.`
                    : `Isso fica acima da hora mínima (${brl2(fin.hmin)}): o substituto precisa ser bem rentável.`}</>}
        </p>
        {div - lib > 0.05 && <p className="note">A diferença de {fmt(div - lib, 1)} h entre o atribuído e o liberado é trabalho compartilhado, que continua para os outros contratantes.</p>}
      </> : <p className="note">Nenhum contratante marcado.</p>}
      <p className="note">Hora liberada é capacidade, não economia. O custo só cai se essas horas forem ocupadas por outro cliente ou se a equipe for reduzida.</p>
    </div>
  )
}
