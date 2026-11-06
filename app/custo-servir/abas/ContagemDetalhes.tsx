'use client'

// Conferencia da atribuicao (Mapa da Atribuicao, EFIDOCEMP-201): regras aplicadas, motivos de
// bloqueio, avisos (documento sem tipo, turno nao cadastrado), visao por prestador (Cod. cadastro)
// e a conferencia linha a linha do relatorio.

import { useState } from 'react'
import { BLOQUEIOS, fmt, nomeCtt, norm, REGRAS, type Bloqueio, type Contagem, type Ctx, type Regra } from '../cs-lib'
import { useOrdem } from '../cs-ui'

export default function ContagemDetalhes({ ctx, r, irCatalogo, irTurnos }: {
  ctx: Ctx; r: Contagem; irCatalogo: () => void; irTurnos: () => void
}) {
  if (!r.rows) return null
  const regras = Object.entries(r.regras) as [Regra, number][]
  const bloqueios = (Object.entries(r.bloqueios) as [Bloqueio, number][]).sort((a, b) => b[1] - a[1])
  const semTipo = Object.entries(r.semTipo).sort((a, b) => b[1] - a[1])
  const turnosDesc = Object.entries(r.turnosDesc).sort((a, b) => b[1] - a[1])
  const gtSemCad = Object.entries(r.gt0010SemCadastro).sort((a, b) => b[1] - a[1])

  return (
    <>
      <div className="grid2">
        <div className="box">
          <h2>Como cada linha foi atribuída</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Regra</th><th className="r">Linhas</th><th className="r">%</th></tr></thead>
              <tbody>
                {regras.length ? regras.sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <tr key={k}>
                    <td>{REGRAS[k]}{(k === 'sem_tipo_turno' || k === 'sem_tipo_vinc') && <span className="pill p-warn" style={{ marginLeft: 6 }}>classificar</span>}</td>
                    <td className="r mono">{n}</td>
                    <td className="r mono">{fmt((n / r.rows) * 100, 1)}%</td>
                  </tr>
                )) : <tr><td colSpan={3} className="empty">Nenhuma linha contabilizada.</td></tr>}
              </tbody>
            </table>
          </div>
          <h3>Linhas que ficaram fora da conta</h3>
          <div className="tbl">
            <table>
              <thead><tr><th>Motivo</th><th className="r">Linhas</th></tr></thead>
              <tbody>
                {bloqueios.length ? bloqueios.map(([k, n]) => (
                  <tr key={k}><td>{BLOQUEIOS[k]}</td><td className="r mono">{n}</td></tr>
                )) : <tr><td colSpan={2} className="empty">Nenhuma.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="box">
          <h2>Avisos para a conta ficar certa</h2>
          {!semTipo.length && !turnosDesc.length && !gtSemCad.length && <p className="note">Nenhum aviso: todos os documentos usados têm tipo e todos os turnos do relatório estão cadastrados.</p>}
          {semTipo.length > 0 && <>
            <h3>Documentos sem tipo (empresa ou pessoa)</h3>
            <p className="note">Foram contados pela regra antiga (turno se houver, senão vinculação). Documento de pessoa sem turno não deveria contar para ninguém. Classifique no catálogo.</p>
            <div className="tbl scroll" style={{ maxHeight: 220 }}>
              <table><tbody>
                {semTipo.map(([id, n]) => <tr key={id}><td>{ctx.docs.get(id)?.nome}</td><td className="r mono">{n}</td></tr>)}
              </tbody></table>
            </div>
            <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={irCatalogo}>Abrir o catálogo</button>
          </>}
          {turnosDesc.length > 0 && <>
            <h3>Turnos do relatório que não estão cadastrados</h3>
            <p className="note">Sem cadastro não dá para saber o contratante do turno, e ele não entra na conta.</p>
            <div className="row">{turnosDesc.map(([t, n]) => <span key={t} className="pill p-warn">turno {t} · {n} linha(s)</span>)}</div>
            <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={irTurnos}>Cadastrar turnos</button>
          </>}
          {gtSemCad.length > 0 && <>
            <h3>GT0010 no relatório sem vínculo no cadastro</h3>
            <p className="note">A linha veio com Cód. GT0010 de um contratante que não tem esse documento em Documentos por contratante. Conta normalmente (100% para ele), mas vale conferir o cadastro.</p>
            <div className="tbl scroll" style={{ maxHeight: 200 }}>
              <table><tbody>
                {gtSemCad.map(([k, n]) => { const [doc, c] = k.split('|'); return <tr key={k}><td>{ctx.docs.get(doc)?.nome}</td><td className="mono">{c} · {nomeCtt(ctx, c)}</td><td className="r mono">{n}</td></tr> })}
              </tbody></table>
            </div>
          </>}
          <details>
            <summary className="link" style={{ textDecoration: 'none' }}>Ver as regras de atribuição</summary>
            <ol className="note" style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><b>Cód. GT0010 preenchido</b>: 100% para o contratante do requisito. Cada requisito é uma avaliação própria.</li>
              <li><b>Empresa, requisito comum</b> (questionário ou GT0100 manual): contratantes com vinculação ativa no GT0120, menos os que ignoram o documento.</li>
              <li><b>Pessoa, requisito comum</b> (função, como o ASO, ou GT0100 manual): contratantes dos turnos ativos no GT0130 que também têm vinculação ativa, menos os que ignoram. Sem turno, não conta.</li>
              <li><b>Item de presença</b> (por Treinamento/Contratante): não conta.</li>
              <li><b>Divisão</b>: igual entre os válidos quando o tempo é o mesmo; com tempos diferentes por grupo, a base é dividida entre todos e o extra vai para quem exige mais. Reprovado usa o tempo de reprovado.</li>
            </ol>
          </details>
        </div>
      </div>

      <Prestadores ctx={ctx} r={r} />
      <LinhaALinha ctx={ctx} r={r} />
    </>
  )
}

function Prestadores({ ctx, r }: { ctx: Ctx; r: Contagem }) {
  const [q, setQ] = useState('')
  const lista = Object.values(r.cadastros).filter(c => !q || norm(c.cod + ' ' + c.razao + ' ' + c.cnpj).includes(norm(q)))
  const top = (c: typeof lista[number]) => Object.entries(c.ctts).sort((a, b) => b[1] - a[1])
  const { sorted, th } = useOrdem(lista, {
    cod: c => +c.cod || c.cod, razao: c => c.razao, cnpj: c => c.cnpj, n: c => c.n, ok: c => c.ok, min: c => c.min,
    ctt: c => top(c).length,
  }, { col: 'min', dir: 'desc' })
  const mesmoCnpj = new Map<string, number>()
  for (const c of Object.values(r.cadastros)) if (c.cnpj) mesmoCnpj.set(c.cnpj, (mesmoCnpj.get(c.cnpj) ?? 0) + 1)
  if (!Object.keys(r.cadastros).length) {
    return (
      <div className="box">
        <h2>Por prestador (Cód. cadastro)</h2>
        <p className="note">O relatório importado não tem a coluna Cód. cadastro. Ela vem na versão nova do EFIDOCEMP-201 e separa cada unidade, mesmo com o mesmo CNPJ.</p>
      </div>
    )
  }
  return (
    <div className="box">
      <div className="row between">
        <div>
          <h2>Por prestador (Cód. cadastro)</h2>
          <p className="note">Cada cadastro aparece separado, mesmo quando o CNPJ é o mesmo (ex.: as unidades da GLOW). Horas = tempo real das avaliações do cadastro.</p>
        </div>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cadastro, razão social ou CNPJ" style={{ width: 'min(300px,100%)' }} />
      </div>
      <div className="tbl scroll" style={{ maxHeight: 420 }}>
        <table>
          <thead><tr>{th('cod', 'Cód. cadastro')}{th('razao', 'Razão social')}{th('cnpj', 'CNPJ')}{th('n', 'Linhas', 'r')}{th('ok', 'Contabilizadas', 'r')}{th('min', 'Horas', 'r')}{th('ctt', 'Contratantes')}</tr></thead>
          <tbody>
            {sorted.map(c => (
              <tr key={c.cod}>
                <td className="mono">{c.cod}</td>
                <td>{c.razao}</td>
                <td className="mono">{c.cnpj}{(mesmoCnpj.get(c.cnpj) ?? 0) > 1 && <span className="pill p-blue" style={{ marginLeft: 6 }} title="Outros cadastros com o mesmo CNPJ">{mesmoCnpj.get(c.cnpj)} cadastros</span>}</td>
                <td className="r mono">{c.n}</td>
                <td className="r mono">{c.ok}</td>
                <td className="r mono">{fmt(c.min / 60, 2)}</td>
                <td className="note">{top(c).slice(0, 4).map(([k, m]) => `${k} · ${nomeCtt(ctx, k).slice(0, 18)} (${fmt(m, 1)} min)`).join('; ')}{top(c).length > 4 ? ' …' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const LIMITE = 300

function LinhaALinha({ ctx, r }: { ctx: Ctx; r: Contagem }) {
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const [f, setF] = useState('')
  const lista = r.rastro
    .filter(x => !f || (f === 'ok' ? !!x.regra && !x.bloqueio : f.startsWith('r:') ? x.regra === f.slice(2) : x.bloqueio === f.slice(2)))
    .filter(x => !q || norm(x.documento + ' ' + x.empresa + ' ' + Object.keys(x.partes).join(' ')).includes(norm(q)))
  return (
    <div className="box">
      <div className="row between">
        <div>
          <h2>Conferir linha a linha</h2>
          <p className="note">Para cada linha do relatório: a regra aplicada (ou o motivo de ter ficado fora) e quanto foi para cada contratante.</p>
        </div>
        <button type="button" className="btn" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : `Abrir (${r.rows} linhas)`}</button>
      </div>
      {aberto && <>
        <div className="row">
          <select value={f} onChange={e => setF(e.target.value)} aria-label="Filtrar">
            <option value="">Todas as linhas</option>
            <option value="ok">Só as contabilizadas</option>
            <optgroup label="Regra">{(Object.keys(REGRAS) as Regra[]).map(k => <option key={k} value={'r:' + k}>{REGRAS[k]}</option>)}</optgroup>
            <optgroup label="Ficou fora">{(Object.keys(BLOQUEIOS) as Bloqueio[]).map(k => <option key={k} value={'b:' + k}>{BLOQUEIOS[k]}</option>)}</optgroup>
          </select>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar documento, empresa/pessoa ou código do contratante" style={{ flex: 1, minWidth: 240 }} />
          <span className="note">{lista.length} linha(s){lista.length > LIMITE ? `, mostrando ${LIMITE}` : ''}</span>
        </div>
        <div className="tbl scroll" style={{ maxHeight: 480 }}>
          <table>
            <thead><tr><th className="r">#</th><th>Documento</th><th>Empresa/Pessoa</th><th>Status</th><th>Regra ou motivo</th><th>Contratantes (min)</th></tr></thead>
            <tbody>
              {lista.slice(0, LIMITE).map(x => (
                <tr key={x.i}>
                  <td className="r mono">{x.i}</td>
                  <td style={{ maxWidth: 280 }}>{x.documento}</td>
                  <td style={{ maxWidth: 220 }}>{x.empresa}</td>
                  <td>{/REPROV/i.test(x.status) ? <span className="pill p-bad">Reprov.</span> : <span className="pill p-good">Aprov.</span>}</td>
                  <td>{x.bloqueio ? <span className="pill p-gray" title={BLOQUEIOS[x.bloqueio]}>{BLOQUEIOS[x.bloqueio]}</span> : x.regra ? <span className="note">{REGRAS[x.regra]}</span> : '—'}</td>
                  <td className="note">{Object.entries(x.partes).map(([c, m]) => `${c} · ${nomeCtt(ctx, c).slice(0, 16)}: ${fmt(m, 2)}`).join(' | ') || '—'}</td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={6} className="empty">Nenhuma linha.</td></tr>}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  )
}
