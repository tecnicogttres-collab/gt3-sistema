'use client'

// Fechamento: as tres camadas (avaliacao, com rastro, difuso) mais interno e ociosa contra a capacidade
// pratica, e a conta por contratante. Aba propria, a ultima do modulo.

import { useMemo } from 'react'
import { useCs } from '../cs-data'
import { brl, brl2, contar, fatorMes, financeiro, fmt, nomeCtt, type Ctx, type LinhaRel, type Relatorio } from '../cs-lib'
import { calcCamada2, calcCamada3, tempoC2 } from '../cs-suporte-lib'
import { useOrdem } from '../cs-ui'
import { useSuporte, type SuporteApi } from './suporte-data'

type LinhaF = { c: string; h1: number; h2: number; h3: number; tot: number; fat: number; rh: number | null; rh1: number | null }

export default function Fechamento() {
  const { ctx: ctxOu, linhas, relSel, meuId } = useCs()
  const s = useSuporte(meuId)
  if (!ctxOu) return null
  if (s.carregando) return <div className="empty">Carregando…</div>
  return <FechamentoConta ctx={ctxOu} s={s} linhas={linhas} relSel={relSel} />
}

function FechamentoConta({ ctx, s, linhas, relSel }: { ctx: Ctx; s: SuporteApi; linhas: LinhaRel[]; relSel: Relatorio | null }) {
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
  if (!c3.n) faltas.push('Respostas de uma amostragem (aba Extra portal).')

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

