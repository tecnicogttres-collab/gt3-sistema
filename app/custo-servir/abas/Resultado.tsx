'use client'

import { useMemo, useState } from 'react'
import { useCs } from '../cs-data'
import { IconeCatraca, ordenar, SeloCatraca, thOrdem, type Ordem } from '../cs-ui'
import { agruparUnidades, brl, brl2, contar, fatorMes, financeiro, fmt, liberado, nomeCtt, temCatraca, unidadesDe, type Config, type Ctx, type Financeiro } from '../cs-lib'

/** Campo numerico que grava ao sair (blur/Enter). Vazio => null quando permitido. */
export function NumCampo({ valor, onSalvar, permiteVazio = true, min = 0, style, id, ariaLabel }: {
  valor: number | null | undefined; onSalvar: (v: number | null) => Promise<unknown> | void
  permiteVazio?: boolean; min?: number; style?: React.CSSProperties; id?: string; ariaLabel?: string
}) {
  const [txt, setTxt] = useState(valor == null ? '' : String(valor))
  const [anterior, setAnterior] = useState(valor)
  if (valor !== anterior) { setAnterior(valor); setTxt(valor == null ? '' : String(valor)) }
  const commit = () => {
    const t = txt.trim().replace(',', '.')
    if (t === '') {
      if (!permiteVazio) { setTxt(valor == null ? '' : String(valor)); return }
      if (valor != null) void onSalvar(null)
      return
    }
    const n = Number(t)
    if (!Number.isFinite(n) || n < min) { setTxt(valor == null ? '' : String(valor)); return }
    if (n !== valor) void onSalvar(n)
  }
  return (
    <input id={id} aria-label={ariaLabel} type="number" value={txt} min={min} style={style}
      onChange={e => setTxt(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

type Linha = { cod: string; h: number; ev: number; fat: number; rh: number; cs: number; m: number; p: number; has: boolean; soma?: boolean; membro?: boolean }

export default function Resultado() {
  const { ctx, linhas, relSel, salvarConfig, atualizarRelatorio, salvarCtt, tentar } = useCs()
  const r = useMemo(() => (ctx ? contar(ctx, linhas) : null), [ctx, linhas])
  const [ord, setOrd] = useState<Ordem>({ col: 'h', dir: 'desc' })
  const [agrupar, setAgrupar] = useState(false)
  if (!ctx || !r) return null
  const c = ctx.cfg
  const fin = financeiro(c)
  const fator = fatorMes(c, relSel)
  const f = fator ?? 1

  const salvar = (k: keyof Config) => (v: number | null) => tentar(() => salvarConfig({ [k]: v } as Partial<Config>))

  const rows: Linha[] = Object.entries(r.by).map(([cod, o]) => {
    const h = (o.min / 60) * f
    const ct = ctx.ctts.get(cod)
    const fat = ct ? +ct.faturamento_mensal || 0 : 0
    const rh = h > 0 && fator ? fat / h : 0
    const cs = h * fin.ch
    const m = fat - cs
    return { cod, h, ev: (o.ev / 60) * f, fat, rh, cs, m, p: fat ? (m / fat) * 100 : 0, has: !!ct }
  })

  const calcula = fin.ok && !!fator
  // Situacao para ordenar: Deficitario, Reprecificar, Proteger, sem parametros, sem faturamento
  const nivel = (x: Linha) => (!x.fat ? 4 : !calcula ? 3 : x.m < 0 ? 0 : x.rh < fin.hmin ? 1 : 2)
  const getR = {
    ctt: (x: Linha) => nomeCtt(ctx, x.cod), h: (x: Linha) => x.h, ev: (x: Linha) => x.ev, fat: (x: Linha) => x.fat, rh: (x: Linha) => (x.fat && fator ? x.rh : null),
    cs: (x: Linha) => (calcula ? x.cs : null), m: (x: Linha) => (calcula && x.fat ? x.m : null), sit: (x: Linha) => nivel(x),
  }
  const ordenadasSimples = ordenar(rows, getR, ord)
  const temUnidades = ctx.ctts.size > 0 && [...ctx.ctts.values()].some(c => c.contratante_pai)
  // Visao agrupada: principal soma horas e faturamento (dele e de todas as unidades); evitavel = saida conjunta
  const ordenadas: Linha[] = !(agrupar && temUnidades) ? ordenadasSimples : (() => {
    const blocos = [...agruparUnidades(ctx, rows.map(x => x.cod))].map(([p, ms]) => {
      const membros = rows.filter(x => ms.includes(x.cod))
      const unidades = unidadesDe(ctx, p)
      if (membros.length === 1 && membros[0].cod === p && !unidades.length) return { topo: membros[0], filhos: [] as Linha[] }
      const h = membros.reduce((a, x) => a + x.h, 0)
      const fat = [p, ...unidades].reduce((a, c) => a + (ctx.ctts.get(c)?.faturamento_mensal || 0), 0)
      const cs = h * fin.ch, m = fat - cs
      const topo: Linha = { cod: p, h, ev: (liberado(r, new Set(ms)) / 60) * f, fat, rh: h > 0 && fator ? fat / h : 0, cs, m, p: fat ? (m / fat) * 100 : 0, has: true, soma: true }
      return { topo, filhos: ordenar(membros, getR, ord).map(x => ({ ...x, membro: true })) }
    })
    return ordenar(blocos, Object.fromEntries(Object.entries(getR).map(([k, g]) => [k, (b: typeof blocos[number]) => g(b.topo)])), ord)
      .flatMap(b => [b.topo, ...b.filhos])
  })()
  const th = thOrdem(ord, setOrd)
  const per = fator ? '/mês' : ' (período)'

  return (
    <>
      <div className="box">
        <h2>Parâmetros</h2>
        <div className="kv">
          <label>Custo mensal da equipe (R$)<NumCampo valor={c.custo_mensal} onSalvar={salvar('custo_mensal')} /></label>
          <label>Pessoas avaliando<NumCampo valor={c.pessoas} onSalvar={salvar('pessoas')} /></label>
          <label>Dias úteis no mês<NumCampo valor={c.dias_uteis} onSalvar={salvar('dias_uteis')} /></label>
          <label>Horas por dia<NumCampo valor={c.horas_dia} onSalvar={salvar('horas_dia')} /></label>
          <label>Capacidade prática (%)<NumCampo valor={c.pct_capacidade} permiteVazio={false} onSalvar={salvar('pct_capacidade')} /></label>
          <label>Margem desejada (%)<NumCampo valor={c.margem_desejada} permiteVazio={false} onSalvar={salvar('margem_desejada')} /></label>
          <label>Dias úteis cobertos pelo relatório
            {relSel
              ? <NumCampo valor={relSel.dias_uteis} min={1} onSalvar={v => tentar(() => atualizarRelatorio(relSel.id, { dias_uteis: v }))} />
              : <input type="number" disabled placeholder="importe um relatório" />}
          </label>
          <label>Dias úteis para projetar o mês
            <NumCampo valor={c.dias_mes} onSalvar={salvar('dias_mes')} />
          </label>
        </div>
        <p className="note">&quot;Dias úteis para projetar o mês&quot; vazio usa os dias úteis no mês.</p>
        {!fin.ok
          ? <div className="warnbox">Preencha os parâmetros da equipe (custo mensal, pessoas, dias úteis e horas por dia) para calcular o custo-hora, a hora mínima e a margem.</div>
          : (
            <div className="tiles">
              <div className="tile"><b>{fmt(fin.cap)} h</b><span>capacidade prática/mês</span></div>
              <div className="tile"><b>{brl2(fin.ch)}</b><span>custo-hora</span></div>
              <div className="tile"><b>{brl2(fin.hmin)}</b><span>hora mínima</span></div>
              <div className="tile"><b>{fator ? '×' + fmt(fator, 2) : '—'}</b><span>projeção do relatório para o mês</span></div>
            </div>
          )}
        {relSel && !fator && <div className="warnbox">Informe os dias úteis cobertos pelo relatório para projetar as horas para o mês.</div>}
      </div>

      {rows.length > 0 && (() => {
        const com = rows.filter(x => temCatraca(ctx, x.cod)), sem = rows.filter(x => !temCatraca(ctx, x.cod))
        const soma = (l: Linha[], k: 'h' | 'fat' | 'cs') => l.reduce((a, x) => a + x[k], 0)
        const bloco = (titulo: React.ReactNode, l: Linha[], destaque: boolean) => {
          const h = soma(l, 'h'), fat = soma(l, 'fat'), cs = soma(l, 'cs')
          return (
            <div className={'tile' + (destaque ? ' cat' : '')}>
              <span className="eyebrow">{titulo}</span>
              <b>{fmt(h, 1)} h{per}</b>
              <span>{l.length} contratante(s) · faturamento {brl(fat)}</span><br />
              <span>receita/hora {fator && h ? brl2(fat / h) : '—'} · margem {calcula && fat ? `${brl(fat - cs)} (${fmt(((fat - cs) / fat) * 100)}%)` : '—'}</span>
            </div>
          )
        }
        return (
          <div className="box">
            <h2>Catraca de acesso: com × sem</h2>
            <div className="tiles">
              {bloco(<><IconeCatraca /> Com catraca</>, com, true)}
              {bloco('Sem catraca', sem, false)}
            </div>
            <p className="note">Contratante com catraca = pelo menos um turno com código de integração (Configurações › Turnos).</p>
          </div>
        )
      })()}

      <div className="box">
        <div className="row between">
          <h2>Receita por hora e margem</h2>
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
                {th('ctt', 'Contratante')}{th('h', <>Horas{per}</>, 'r')}{th('ev', <>Evitável{per}</>, 'r')}{th('fat', 'Faturamento/mês (R$)', 'r')}
                {th('rh', 'Receita/hora', 'r')}{th('cs', 'Custo de servir', 'r')}{th('m', 'Margem', 'r')}{th('sit', 'Situação')}
              </tr>
            </thead>
            <tbody>
              {ordenadas.length ? ordenadas.map(x => (
                <tr key={(x.soma ? 'soma-' : '') + x.cod} className={x.soma ? 'total' : undefined}>
                  <td>{x.membro && <span className='note' style={{ marginRight: 6 }}>↳</span>}{x.soma ? 'Σ ' : ''}{x.cod} · {nomeCtt(ctx, x.cod)}{x.soma && <span className='note'> (principal + unidades)</span>}{!x.soma && temCatraca(ctx, x.cod) && <SeloCatraca n={ctx.catraca.get(x.cod)} compacto />}</td>
                  <td className="r mono">{fmt(x.h, 1)}</td>
                  <td className="r mono">{fmt(x.ev, 1)}</td>
                  <td className="r">
                    {x.soma
                      ? <span className='mono' title='Soma do faturamento do principal e das unidades'>{brl(x.fat)}</span>
                      : x.has
                      ? <NumCampo valor={x.fat} permiteVazio={false} ariaLabel={'Faturamento ' + x.cod} style={{ width: 130, textAlign: 'right' }}
                        onSalvar={v => tentar(() => salvarCtt(x.cod, { faturamento_mensal: v ?? 0 }))} />
                      : <span className="note">cadastre o contratante</span>}
                  </td>
                  <td className="r mono">{x.fat && fator ? brl2(x.rh) : '—'}</td>
                  <td className="r mono">{calcula ? brl(x.cs) : '—'}</td>
                  <td className="r mono" style={{ color: calcula && x.m < 0 ? 'var(--cs-bad)' : undefined }}>
                    {calcula && x.fat ? `${brl(x.m)} (${fmt(x.p)}%)` : '—'}
                  </td>
                  <td><SituacaoPill x={x} fin={fin} calcula={calcula} /></td>
                </tr>
              )) : <tr><td colSpan={8} className="empty">Importe um relatório na aba Contagem.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="chart">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Receita por hora × custo-hora × hora mínima</div>
          <Grafico ctx={ctx} rows={calcula ? rows.filter(x => x.fat > 0) : []} fin={fin} motivo={
            !fin.ok ? 'Preencha os parâmetros da equipe para ver o gráfico.'
              : !fator ? 'Informe os dias úteis do relatório para ver o gráfico.'
                : 'Informe o faturamento dos contratantes para ver o gráfico.'} />
        </div>
        <p className="note">Horas/mês e margem usam o tempo dividido. Evitável/mês é o que sai junto se o contratante sair. Por enquanto só a camada 1 (avaliação de documentos). Cadastro, e-mail e suporte entram depois e só aumentam as horas, ou seja, a receita por hora real é igual ou menor que esta.</p>
      </div>
    </>
  )
}

function SituacaoPill({ x, fin, calcula }: { x: Linha; fin: Financeiro; calcula: boolean }) {
  if (!x.fat) return <span className="pill p-gray">Sem faturamento</span>
  if (!calcula) return <span className="pill p-gray">Sem parâmetros</span>
  if (x.m < 0) return <span className="pill p-bad">Deficitário</span>
  if (x.rh < fin.hmin) return <span className="pill p-warn">Reprecificar</span>
  return <span className="pill p-good">Proteger</span>
}

function Grafico({ ctx, rows, fin, motivo }: { ctx: Ctx; rows: Linha[]; fin: Financeiro; motivo: string }) {
  if (!rows.length) return <p className="note" style={{ padding: 10 }}>{motivo}</p>
  const W = 760, rowH = 32, T0 = 30, B = 26, L = 220, Rr = 70, H = T0 + B + rows.length * rowH
  const max = Math.max(...rows.map(r => r.rh), fin.hmin, fin.ch) * 1.1 || 1
  const x = (v: number) => L + (v / max) * (W - L - Rr)
  const step = max > 4000 ? 1000 : max > 1500 ? 500 : max > 400 ? 100 : max > 150 ? 50 : 20
  const ticks: number[] = []
  for (let t = 0; t <= max; t += step) ticks.push(t)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Receita por hora por contratante">
      {ticks.map(t => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={T0 - 6} y2={H - B} stroke="#EEF2F8" />
          <text x={x(t)} y={H - B + 16} textAnchor="middle" fontSize="11" fill="#5B6684" fontFamily="ui-monospace,Consolas,monospace">{t}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = T0 + i * rowH
        const col = r.rh < fin.ch ? '#C2412D' : r.rh < fin.hmin ? '#A86A12' : '#1F8A5B'
        return (
          <g key={r.cod}>
            <text x={L - 8} y={y + 19} textAnchor="end" fontSize="12" fontWeight="600" fill="#1A2540">{(r.cod + ' · ' + nomeCtt(ctx, r.cod)).slice(0, 30)}</text>
            <rect x={L} y={y + 6} width={Math.max(0, x(r.rh) - L)} height="19" rx="4" fill={col} />
            <text x={x(r.rh) + 5} y={y + 20} fontSize="11.5" fontFamily="ui-monospace,Consolas,monospace" fill="#1A2540">{fmt(r.rh)}</text>
          </g>
        )
      })}
      <line x1={x(fin.ch)} x2={x(fin.ch)} y1={T0 - 8} y2={H - B} stroke="#1A2540" strokeWidth="2" />
      <text x={x(fin.ch) - 5} y={T0 - 12} textAnchor="end" fontSize="11" fontWeight="700" fill="#1A2540">custo-hora {fmt(fin.ch)}</text>
      <line x1={x(fin.hmin)} x2={x(fin.hmin)} y1={T0 - 8} y2={H - B} stroke="#2A4F96" strokeWidth="2" strokeDasharray="5 4" />
      <text x={x(fin.hmin) + 5} y={T0 - 12} fontSize="11" fontWeight="700" fill="#2A4F96">hora mínima {fmt(fin.hmin)}</text>
    </svg>
  )
}
