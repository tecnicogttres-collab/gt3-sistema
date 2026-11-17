'use client'

// Comparativo entre contratantes: escolhe dois ou mais e le frases do tipo "BSA demanda 2,5× mais tempo que
// Pettenati"; abaixo, a classificacao de todos pela medida escolhida (com filtro e "× mediana").
// Mesma conta do Fechamento: camada 1 (relatorio × tempo-padrao), camada 2 (volumes × tempo da atividade) e
// camada 3 (amostragem × capacidade), projetadas para o mes.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCs } from '../cs-data'
import { brl, brl2, contar, fatorMes, financeiro, fmt, nomeCtt, norm, principalDe, type Ctx } from '../cs-lib'
import { calcCamada2, calcCamada3, tempoC2 } from '../cs-suporte-lib'
import { useTempo } from '../cs-tempo'
import { useSuporte } from './suporte-data'

type Met = 'tot' | 'h1' | 'h2' | 'h3' | 'aval' | 'minAval' | 'docs' | 'custo' | 'rh'
type Linha = {
  c: string; nome: string; ativo: boolean
  h1: number; h2: number; h3: number; tot: number
  min1: number; n1: number          // minutos e avaliacoes do relatorio (sem projecao), para o tempo por avaliacao
  aval: number; minAval: number | null; docs: number; fat: number; custo: number | null; rh: number | null
}

/** Medidas comparaveis. `frase` monta "A ... x× mais ... que B". */
const METRICAS: Record<Met, { label: string; desc: string; frase: (a: string, x: string, b: string) => string; vazioMenor?: boolean }> = {
  tot: { label: 'Tempo total', desc: 'horas/mês nas três camadas', frase: (a, x, b) => `${a} demanda ${x} mais tempo que ${b}` },
  h1: { label: 'Avaliação', desc: 'horas/mês avaliando documentos (camada 1)', frase: (a, x, b) => `${a} demanda ${x} mais tempo de avaliação que ${b}` },
  h2: { label: 'Suporte com rastro', desc: 'horas/mês de cadastro, e-mail, ligação... (camada 2)', frase: (a, x, b) => `${a} demanda ${x} mais suporte (cadastro, e-mail, ligação) que ${b}` },
  h3: { label: 'Fora do portal', desc: 'horas/mês de WhatsApp, orientação... (camada 3)', frase: (a, x, b) => `${a} demanda ${x} mais trabalho fora do portal que ${b}` },
  aval: { label: 'Avaliações', desc: 'documentos avaliados por mês', frase: (a, x, b) => `${a} gera ${x} mais avaliações que ${b}` },
  minAval: { label: 'Tempo por avaliação', desc: 'minutos, em média, por documento avaliado', frase: (a, x, b) => `Cada avaliação de ${a} leva ${x} mais tempo que uma de ${b}` },
  docs: { label: 'Documentos exigidos', desc: 'documentos que o contratante exige (GT0010)', frase: (a, x, b) => `${a} exige ${x} mais documentos que ${b}` },
  custo: { label: 'Custo', desc: 'custo/mês das horas (custo-hora da equipe)', frase: (a, x, b) => `${a} custa ${x} mais que ${b}` },
  rh: { label: 'Receita por hora', desc: 'faturamento ÷ horas totais', frase: (a, x, b) => `${a} paga ${x} mais por hora de trabalho que ${b}` },
}
const ORDEM_MET: Met[] = ['tot', 'h1', 'h2', 'h3', 'aval', 'minAval', 'docs', 'custo', 'rh']
const CORES = { h1: '#2A4F96', h2: '#D1AE6E', h3: '#A86A12' } // mesmas do Fechamento

const vezes = (r: number) => fmt(r, r < 10 ? 1 : 0) + '×'
/** Nome curto para as frases (sem sufixos longos). */
const curto = (nome: string) => (nome.length > 28 ? nome.slice(0, 26).trimEnd() + '…' : nome)

export default function Comparativo() {
  const { ctx, linhas, relSel, meuId } = useCs()
  const s = useSuporte(meuId)
  if (!ctx) return null
  if (s.carregando) return <div className="empty">Carregando…</div>
  return <ComparativoTela ctx={ctx} s={s} linhas={linhas} relSel={relSel} />
}

function ComparativoTela({ ctx, s, linhas, relSel }: {
  ctx: Ctx; s: ReturnType<typeof useSuporte>; linhas: ReturnType<typeof useCs>['linhas']; relSel: ReturnType<typeof useCs>['relSel']
}) {
  const { d } = useCs()
  const tm = useTempo()
  const fin = financeiro(ctx.cfg)
  const [met, setMet] = useState<Met>('tot')
  const [sel, setSel] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [somar, setSomar] = useState(false)
  const [inativos, setInativos] = useState(false)
  const [soComDados, setSoComDados] = useState(true)
  const [topN, setTopN] = useState(20)
  const [qRank, setQRank] = useState('')
  const [asc, setAsc] = useState(false)

  // ── Conta por contratante (igual ao Fechamento) ─────────────────────────────
  const r = useMemo(() => contar(ctx, linhas), [ctx, linhas])
  const f1 = fatorMes(ctx.cfg, relSel)
  const diasMes = ctx.cfg.dias_mes ?? ctx.cfg.dias_uteis
  const f2 = s.loteSel?.dias_uteis && diasMes ? diasMes / s.loteSel.dias_uteis : null
  const c2 = useMemo(() => calcCamada2(s.linhas, s.ativs, tempoC2(ctx, s.meds)), [s.linhas, s.ativs, s.meds, ctx])
  const c3 = useMemo(() => calcCamada3(s.amostras, s.c3), [s.amostras, s.c3])
  const cap = fin.ok ? fin.cap : null

  const base: Linha[] = useMemo(() => {
    const docsDe = new Map<string, Set<string>>()
    for (const x of d.exig) if (x.ativo) { const st = docsDe.get(x.contratante_cod); if (st) st.add(x.documento_id); else docsDe.set(x.contratante_cod, new Set([x.documento_id])) }
    const cods = new Set([...ctx.ctts.keys(), ...Object.keys(r.by), ...Object.keys(c2.porCtt), ...Object.keys(c3.porCttCamada3)])
    // Agrupado: soma no contratante principal (unidades somem da lista)
    const chave = (c: string) => (somar ? principalDe(ctx, c) : c)
    const acc = new Map<string, { min1: number; n1: number; h2: number; h3: number; docs: Set<string>; fat: number }>()
    for (const c of cods) {
      const k = chave(c)
      const a = acc.get(k) ?? { min1: 0, n1: 0, h2: 0, h3: 0, docs: new Set<string>(), fat: 0 }
      a.min1 += r.by[c]?.min ?? 0
      a.n1 += r.by[c]?.n ?? 0
      a.h2 += ((c2.porCtt[c] ?? 0) / 60) * (f2 ?? 1)
      a.h3 += cap && c3.n ? ((c3.porCttCamada3[c] ?? 0) / c3.n) * cap : 0
      for (const doc of docsDe.get(c) ?? []) a.docs.add(doc)
      a.fat += ctx.ctts.get(c)?.faturamento_mensal || 0
      acc.set(k, a)
    }
    return [...acc].map(([c, a]) => {
      const h1 = (a.min1 / 60) * (f1 ?? 1)
      const tot = h1 + a.h2 + a.h3
      const ct = ctx.ctts.get(c)
      return {
        c, nome: nomeCtt(ctx, c), ativo: ct ? ct.ativo !== false : true,
        h1, h2: a.h2, h3: a.h3, tot, min1: a.min1, n1: a.n1,
        aval: a.n1 * (f1 ?? 1), minAval: a.n1 > 0 ? a.min1 / a.n1 : null, docs: a.docs.size, fat: a.fat,
        custo: fin.ok ? tot * fin.ch : null, rh: a.fat && tot > 0 ? a.fat / tot : null,
      }
    })
  }, [ctx, d.exig, r, c2, c3, f1, f2, cap, fin.ok, fin.ch, somar])

  const porCod = useMemo(() => new Map(base.map(x => [x.c, x])), [base])
  const valor = (x: Linha, m: Met): number | null => {
    const v = x[m]
    return v == null || !Number.isFinite(v) ? null : v
  }
  const fmtVal = (v: number | null, m: Met) => {
    if (v == null) return '—'
    if (m === 'tot' || m === 'h1' || m === 'h2' || m === 'h3') return tm.hu(v, 1)
    if (m === 'minAval') return tm.mu(v, 1)
    if (m === 'custo') return brl(v)
    if (m === 'rh') return brl2(v)
    return fmt(v, m === 'aval' ? 0 : 0)
  }

  // Selecionados validos (com o agrupamento ligado, unidade vira o principal)
  const selVal = [...new Set(sel.map(c => (somar ? principalDe(ctx, c) : c)))].filter(c => porCod.has(c))
  const escolhidos = selVal.map(c => porCod.get(c)!)
  const alternar = (c: string) => setSel(p => (p.includes(c) ? p.filter(x => x !== c) : [...p, c]))

  // O resultado fica no fim da pagina: ao mudar a selecao (com 2 ou mais), rola ate ele.
  const resultadoRef = useRef<HTMLDivElement>(null)
  const chaveSel = selVal.join(',')
  const primeiraVez = useRef(true)
  useEffect(() => {
    if (primeiraVez.current) { primeiraVez.current = false; return }
    if (chaveSel.split(',').filter(Boolean).length < 2) return
    const t = setTimeout(() => resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [chaveSel])

  // ── Frases ────────────────────────────────────────────────────────────────────
  function frase(a: Linha, b: Linha, m: Met): string | null {
    const va = valor(a, m), vb = valor(b, m)
    if (va == null || vb == null) return null
    const [maior, menor] = va >= vb ? [a, b] : [b, a]
    const vM = Math.max(va, vb), vm = Math.min(va, vb)
    if (vM <= 0) return null
    if (vm <= 0) return `${curto(maior.nome)} tem ${fmtVal(vM, m)} de ${METRICAS[m].label.toLowerCase()}; ${curto(menor.nome)} não tem registro`
    const ratio = vM / vm
    if (ratio < 1.05) return `${curto(a.nome)} e ${curto(b.nome)} estão praticamente iguais em ${METRICAS[m].label.toLowerCase()} (${fmtVal(va, m)} × ${fmtVal(vb, m)})`
    return `${METRICAS[m].frase(curto(maior.nome), vezes(ratio), curto(menor.nome))} (${fmtVal(vM, m)} × ${fmtVal(vm, m)})`
  }
  const ordenadosSel = [...escolhidos].sort((a, b) => (valor(b, met) ?? -1) - (valor(a, met) ?? -1))
  const lider = ordenadosSel[0]
  const frasesPrincipais = lider ? ordenadosSel.slice(1).map(b => frase(lider, b, met)).filter((x): x is string => !!x) : []
  // Nas outras medidas: maior × menor entre os escolhidos
  const frasesOutras = escolhidos.length >= 2 ? ORDEM_MET.filter(m => m !== met).map(m => {
    const com = escolhidos.filter(x => valor(x, m) != null && valor(x, m)! > 0)
    if (com.length < 2) return null
    const ord = [...com].sort((a, b) => valor(b, m)! - valor(a, m)!)
    return { m, txt: frase(ord[0], ord[ord.length - 1], m) }
  }).filter((x): x is { m: Met; txt: string } => !!x?.txt) : []

  // ── Classificacao ─────────────────────────────────────────────────────────────
  const universo = base.filter(x => (inativos || x.ativo) && (!soComDados || (valor(x, met) ?? 0) > 0))
  const comValor = universo.filter(x => valor(x, met) != null)
  const vals = comValor.map(x => valor(x, met)!).sort((a, b) => a - b)
  const mediana = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null
  const somaMet = vals.reduce((a, v) => a + v, 0)
  const ranking = [...comValor].sort((a, b) => (asc ? valor(a, met)! - valor(b, met)! : valor(b, met)! - valor(a, met)!))
  const posicao = new Map(ranking.map((x, i) => [x.c, i + 1]))
  const rankVis = ranking.filter(x => !qRank || norm(x.c + ' ' + x.nome).includes(norm(qRank))).slice(0, topN || undefined)
  const maxRank = Math.max(1e-9, ...ranking.map(x => valor(x, met)!))
  const somavel = met !== 'minAval' && met !== 'rh'

  // Busca para incluir no comparativo
  const sugestoes = q.trim()
    ? base.filter(x => (inativos || x.ativo) && !selVal.includes(x.c) && norm(x.c + ' ' + x.nome).includes(norm(q))).slice(0, 8)
    : []

  const faltas: string[] = []
  if (!relSel) faltas.push('relatório da Contagem (camada 1)')
  else if (!f1) faltas.push('dias úteis do relatório (aba Resultado): avaliação aparece no período do relatório, não no mês')
  if (!s.loteSel) faltas.push('volumes do Suporte (camada 2)')
  else if (!f2) faltas.push('dias úteis do lote de volumes: suporte aparece no período do lote')
  if (!c3.n) faltas.push('respostas de amostragem (Extra portal, camada 3)')
  if (!fin.ok) faltas.push('parâmetros da equipe (aba Resultado) para custo e camada 3')

  return (
    <>
      <div className="box">
        <div className="row between">
          <div>
            <h2>Quem comparar</h2>
            <p className="note">Escolha dois ou mais contratantes (busque pelo nome ou código, ou marque na classificação abaixo). O resultado aparece no fim da página e a tela rola até ele sozinha.</p>
          </div>
          <div className="row">
            <label className="row note" style={{ gap: 6 }} title="Soma as unidades (ex.: GUTEN, GLOW) no contratante principal">
              <input type="checkbox" checked={somar} onChange={e => setSomar(e.target.checked)} /> Somar unidades no principal
            </label>
            <label className="row note" style={{ gap: 6 }}>
              <input type="checkbox" checked={inativos} onChange={e => setInativos(e.target.checked)} /> Incluir inativos
            </label>
          </div>
        </div>
        <div className="row">
          {escolhidos.map(x => (
            <span key={x.c} className="selbar" style={{ padding: '3px 10px' }}>
              <b className="mono">{x.c}</b> {x.nome}
              <button type="button" className="link" aria-label={`Tirar ${x.nome}`} onClick={() => setSel(sel.filter(c => (somar ? principalDe(ctx, c) : c) !== x.c))}>×</button>
            </span>
          ))}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="+ Adicionar contratante…" aria-label="Adicionar contratante ao comparativo" style={{ width: '100%' }}
              onKeyDown={e => { if (e.key === 'Enter' && sugestoes[0]) { alternar(sugestoes[0].c); setQ('') } }} />
            {sugestoes.length > 0 && (
              <div className="cmp-sug">
                {sugestoes.map(x => (
                  <button key={x.c} type="button" onClick={() => { alternar(x.c); setQ('') }}>
                    <b className="mono">{x.c}</b> {x.nome} <span className="note">· {fmtVal(valor(x, met), met)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {ranking.length >= 2 && (
            <button type="button" className="btn sm" onClick={() => setSel(ranking.slice(0, 3).map(x => x.c))} title={`Os 3 primeiros da classificação por ${METRICAS[met].label.toLowerCase()}`}>Os 3 primeiros</button>
          )}
          {sel.length > 0 && <button type="button" className="btn sm" onClick={() => setSel([])}>Limpar</button>}
        </div>
        <div className="row">
          <span className="note">Comparar por</span>
          <span className="cfgnav" style={{ margin: 0 }}>
            {ORDEM_MET.map(m => <button key={m} type="button" className={m === met ? 'on' : ''} title={METRICAS[m].desc} onClick={() => setMet(m)}>{METRICAS[m].label}</button>)}
          </span>
        </div>
        <p className="note">{METRICAS[met].label}: {METRICAS[met].desc}.</p>
        {faltas.length > 0 && <div className="warnbox" style={{ fontWeight: 500 }}>Ainda falta para a conta completa: {faltas.join('; ')}.</div>}
      </div>

      <div className="box">
        <div className="row between">
          <div>
            <h2>Classificação: {METRICAS[met].label}</h2>
            <p className="note">{ranking.length} contratante(s) com {METRICAS[met].label.toLowerCase()}{mediana != null ? ` · mediana ${fmtVal(mediana, met)}` : ''}{somavel && somaMet > 0 ? ` · total ${fmtVal(somaMet, met)}` : ''}. Marque para comparar.</p>
          </div>
          <div className="row">
            <input type="search" value={qRank} onChange={e => setQRank(e.target.value)} placeholder="Filtrar por nome ou código" aria-label="Filtrar classificação" style={{ width: 200 }} />
            <select value={topN} onChange={e => setTopN(+e.target.value)} aria-label="Quantos mostrar">
              <option value={10}>10 primeiros</option>
              <option value={20}>20 primeiros</option>
              <option value={50}>50 primeiros</option>
              <option value={0}>Todos</option>
            </select>
            <button type="button" className="btn sm" onClick={() => setAsc(!asc)} title="Inverter a ordem">{asc ? '▲ Menor primeiro' : '▼ Maior primeiro'}</button>
            <label className="row note" style={{ gap: 6 }}><input type="checkbox" checked={soComDados} onChange={e => setSoComDados(e.target.checked)} /> Só com dados</label>
          </div>
        </div>
        <div className="tbl scroll" style={{ maxHeight: 620 }}>
          <table>
            <thead><tr>
              <th className="c" style={{ width: 44 }}>#</th><th className="c" style={{ width: 70 }}>Comparar</th><th>Contratante</th>
              <th style={{ width: '32%' }}>{METRICAS[met].label}</th><th className="r">Valor</th>
              <th className="r" title="Quantas vezes a mediana dos contratantes">× mediana</th>
              {somavel && <th className="r" title="Participação no total">% do total</th>}
            </tr></thead>
            <tbody>
              {rankVis.length ? rankVis.map(x => {
                const v = valor(x, met)!
                const marcado = selVal.includes(x.c)
                return (
                  <tr key={x.c} className={marcado ? 'sel' : undefined}>
                    <td className="c mono">{posicao.get(x.c)}</td>
                    <td className="c"><input type="checkbox" checked={marcado} aria-label={`Comparar ${x.nome}`} onChange={() => alternar(x.c)} /></td>
                    <td><span className="mono note">{x.c}</span> · {x.nome}{!x.ativo && <> <span className="pill p-gray">inativo</span></>}</td>
                    <td><div className="cmp-barra" title={`${x.nome}: ${fmtVal(v, met)}`}><i style={{ width: (v / maxRank) * 100 + '%' }} /></div></td>
                    <td className="r mono">{fmtVal(v, met)}</td>
                    <td className="r mono">{mediana && mediana > 0 ? vezes(v / mediana) : '—'}</td>
                    {somavel && <td className="r mono">{somaMet > 0 ? fmt((v / somaMet) * 100, 1) + '%' : '—'}</td>}
                  </tr>
                )
              }) : <tr><td colSpan={7} className="empty">Nenhum contratante com {METRICAS[met].label.toLowerCase()}{qRank ? ' para esse filtro' : ''}.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="note">Horas projetadas para o mês como no Fechamento (relatório da Contagem, volumes do Suporte e amostragem do Extra portal). &quot;Tempo por avaliação&quot; não depende da projeção: é o tempo médio de cada documento avaliado para aquele contratante.</p>
      </div>
      <div ref={resultadoRef} style={{ scrollMarginTop: 12 }} />
      {escolhidos.length < 2 ? (
        <div className="box"><div className="empty">{escolhidos.length === 1 ? `Marque mais um contratante para comparar com ${escolhidos[0].nome}.` : 'Escolha pelo menos dois contratantes (na busca acima ou marcando na classificação) para ver a comparação aqui.'}</div></div>
      ) : (
        <>
          <div className="box cmp-destaque">
            <span className="eyebrow">Em resumo · {METRICAS[met].label}</span>
            {frasesPrincipais.length
              ? frasesPrincipais.map(t => <p key={t} className="cmp-frase">{t}.</p>)
              : <p className="note">Sem dados de {METRICAS[met].label.toLowerCase()} para comparar estes contratantes.</p>}
            {frasesOutras.length > 0 && (
              <details>
                <summary className="note" style={{ cursor: 'pointer' }}>Nas outras medidas ({frasesOutras.length})</summary>
                <ul className="cmp-outras">
                  {frasesOutras.map(f => <li key={f.m}><button type="button" className="link" onClick={() => setMet(f.m)}>{METRICAS[f.m].label}</button>: {f.txt}.</li>)}
                </ul>
              </details>
            )}
          </div>

          <div className="box">
            <h2>Lado a lado</h2>
            <div className="tbl">
              <table>
                <thead><tr><th>Medida</th>{ordenadosSel.map(x => <th key={x.c} className="r" title={x.nome}><span className="mono">{x.c}</span> · {curto(x.nome)}</th>)}</tr></thead>
                <tbody>
                  {ORDEM_MET.map(m => {
                    const vs = ordenadosSel.map(x => valor(x, m))
                    const mx = Math.max(0, ...vs.map(v => v ?? 0))
                    return (
                      <tr key={m} className={m === met ? 'sel' : 'click'} onClick={() => setMet(m)} title={METRICAS[m].desc}>
                        <td><b style={{ fontWeight: m === met ? 800 : 600 }}>{METRICAS[m].label}</b></td>
                        {vs.map((v, i) => (
                          <td key={ordenadosSel[i].c} className="r">
                            <span className="mono" style={{ fontWeight: v != null && v === mx && mx > 0 ? 800 : 400 }}>{fmtVal(v, m)}</span>
                            <div className="cmp-mini" aria-hidden><i style={{ width: mx > 0 && v ? (v / mx) * 100 + '%' : 0 }} /></div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="note">Clique numa linha para comparar por essa medida. Em negrito, o maior valor de cada linha.</p>

            <h3>Onde vai o tempo de cada um</h3>
            <div className="cmp-camadas">
              {(() => {
                const mxT = Math.max(1e-9, ...ordenadosSel.map(x => x.tot))
                return ordenadosSel.map(x => (
                  <div key={x.c} className="cmp-cam-linha">
                    <span className="cmp-cam-nome" title={x.nome}><b className="mono">{x.c}</b> {curto(x.nome)}</span>
                    <div className="cmp-cam-barra" style={{ width: (x.tot / mxT) * 100 + '%' }}>
                      {(['h1', 'h2', 'h3'] as const).map(k => x[k] > 0 && (
                        <i key={k} style={{ flexGrow: x[k], background: CORES[k] }} title={`${METRICAS[k].label}: ${tm.hu(x[k], 1)} (${fmt(x.tot ? (x[k] / x.tot) * 100 : 0)}%)`} />
                      ))}
                    </div>
                    <span className="mono note">{tm.hu(x.tot, 1)}</span>
                  </div>
                ))
              })()}
            </div>
            <p className="note">
              <span style={{ color: CORES.h1 }}>■</span> Avaliação · <span style={{ color: CORES.h2 }}>■</span> Suporte com rastro · <span style={{ color: CORES.h3 }}>■</span> Fora do portal. Passe o mouse para ver as horas.
            </p>
          </div>
        </>
      )}

    </>
  )
}
