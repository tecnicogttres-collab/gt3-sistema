'use client'

import { useState } from 'react'
import { useCs } from '../cs-data'
import { useModules } from '../../components/ModulesContext'
import { ABAS, docsComTurno, fmt, grupoDe, nomeCtt, nomeUsuario, norm, PERFIS, rotuloValidade, temCatraca, unidadesDe, validadePeloNome, VALIDADES, type Ctx } from '../cs-lib'
import { BotaoConfirmar, IconeCatraca, SeloCatraca, useOrdem } from '../cs-ui'
import { NumCampo } from './Resultado'
import QuadroDocumentos from './QuadroDocumentos'
import QuadroTurnos from './QuadroTurnos'
import DocsContratantes from './DocsContratantes'

/** Campo de texto que grava ao sair (blur/Enter). */
function TxtCampo({ valor, onSalvar, obrigatorio = true, style, placeholder, ariaLabel }: {
  valor: string; onSalvar: (v: string) => Promise<boolean> | void; obrigatorio?: boolean
  style?: React.CSSProperties; placeholder?: string; ariaLabel?: string
}) {
  const [txt, setTxt] = useState(valor)
  const [anterior, setAnterior] = useState(valor)
  if (valor !== anterior) { setAnterior(valor); setTxt(valor) }
  const commit = async () => {
    const t = txt.trim()
    if (t === valor) return
    if (!t && obrigatorio) { setTxt(valor); return }
    const r = await onSalvar(t)
    if (r === false) setTxt(valor)
  }
  return (
    <input type="text" value={txt} style={style} placeholder={placeholder} aria-label={ariaLabel}
      onChange={e => setTxt(e.target.value)} onBlur={() => void commit()}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

const SUB = [
  ['grupos', 'Grupos'], ['docs', 'Documentos por grupo'], ['catalogo', 'Catálogo de documentos'], ['exigidos', 'Documentos por contratante'], ['ctt', 'Contratantes'],
  ['turnos', 'Turnos'], ['param', 'Parâmetros'], ['users', 'Avaliadores'],
] as const
type Sub = typeof SUB[number][0]

export default function Configuracoes() {
  const { ctx, cfgSub, setCfgSub } = useCs()
  const sub = (SUB.some(([k]) => k === cfgSub) ? cfgSub : 'grupos') as Sub
  const setSub = (s: Sub) => setCfgSub(s)
  if (!ctx) return null
  return (
    <>
      <div className="cfgnav">
        {SUB.map(([k, l]) => <button key={k} type="button" className={k === sub ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}
      </div>
      {sub === 'grupos' && <Grupos ctx={ctx} />}
      {sub === 'docs' && <QuadroDocumentos ctx={ctx} />}
      {sub === 'catalogo' && <Catalogo ctx={ctx} />}
      {sub === 'exigidos' && <DocsContratantes ctx={ctx} />}
      {sub === 'ctt' && <Contratantes ctx={ctx} />}
      {sub === 'turnos' && <QuadroTurnos ctx={ctx} />}
      {sub === 'param' && <Parametros ctx={ctx} />}
      {sub === 'users' && <Avaliadores />}
    </>
  )
}


function Grupos({ ctx }: { ctx: Ctx }) {
  const { d, criarGrupo, renomearGrupo, excluirGrupo, tentar } = useCs()
  const [novo, setNovo] = useState('')
  const { sorted: grupos, th } = useOrdem(ctx.grupos, {
    nome: g => g.nome, ctt: g => (g.padrao ? null : g.contratantes.join(', ')), docs: g => ctx.gd.get(g.id)?.size ?? 0,
    meds: g => d.meds.filter(m => m.grupo_id === g.id).length,
  }, { col: 'ordem', dir: 'asc' })
  return (
    <>
    <div className="box">
      <h2>Grupos de critério</h2>
      <p className="note">Contratantes que avaliam um documento com o mesmo critério ficam no mesmo grupo. Quem não estiver em nenhum grupo específico usa o grupo padrão. Um contratante só pode estar em um grupo.</p>
      <div className="tbl">
        <table>
          <thead><tr>{th('nome', 'Grupo')}{th('ctt', 'Contratantes')}{th('docs', 'Documentos', 'r')}{th('meds', 'Medições', 'r')}<th /></tr></thead>
          <tbody>
            {grupos.map(g => (
              <tr key={g.id}>
                <td><TxtCampo valor={g.nome} ariaLabel="Nome do grupo" onSalvar={v => tentar(() => renomearGrupo(g.id, v), 'Grupo renomeado')} /></td>
                <td>
                  {g.padrao
                    ? <span className="note">todos os demais</span>
                    : g.contratantes.length ? <span className="note">{g.contratantes.join(', ')}</span> : <span className="note">nenhum (arraste abaixo)</span>}
                </td>
                <td className="r mono">{ctx.gd.get(g.id)?.size ?? 0}</td>
                <td className="r mono">{d.meds.filter(m => m.grupo_id === g.id).length}</td>
                <td>{!g.padrao && <BotaoConfirmar onConfirm={() => tentar(() => excluirGrupo(g.id), 'Grupo excluído. As medições continuam no histórico.')}>Excluir</BotaoConfirmar>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <input type="text" value={novo} onChange={e => setNovo(e.target.value)} placeholder="Nome do novo grupo, ex.: Grupo Volare" style={{ minWidth: 260 }} />
        <button type="button" className="btn solid" disabled={!novo.trim()}
          onClick={async () => { if (await tentar(() => criarGrupo(novo.trim()), 'Grupo criado')) setNovo('') }}>Criar grupo</button>
      </div>
    </div>
    <QuadroContratantes ctx={ctx} />
    </>
  )
}

/** Contratantes por grupo: arraste o contratante para o grupo dele; quem fica em
 *  "Sem grupo específico" usa o grupo padrão. Um contratante fica em um grupo só. */
function QuadroContratantes({ ctx }: { ctx: Ctx }) {
  const { d, setContratantesGrupo, tentar } = useCs()
  const [drag, setDrag] = useState<{ cod: string; from: string | null } | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [novo, setNovo] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const especificos = ctx.grupos.filter(g => !g.padrao)
  const comGrupo = new Set(especificos.flatMap(g => g.contratantes))
  const semGrupo = d.ctts.map(c => c.contratante_cod).filter(c => !comGrupo.has(c))

  async function mover(cod: string, from: string | null, to: string | null) {
    if (from === to || ocupado) return
    setOcupado(true)
    const destinoNome = to ? ctx.grupos.find(g => g.id === to)?.nome : 'grupo padrão'
    await tentar(async () => {
      // Tira do grupo de origem antes (um contratante so pode estar em um grupo)
      if (from) { const g = ctx.grupos.find(x => x.id === from)!; await setContratantesGrupo(from, g.contratantes.filter(c => c !== cod)) }
      if (to) { const g = ctx.grupos.find(x => x.id === to)!; await setContratantesGrupo(to, [...g.contratantes.filter(c => c !== cod), cod]) }
    }, `${cod} · ${nomeCtt(ctx, cod)} → ${destinoNome}`)
    setOcupado(false)
  }

  const chip = (cod: string, from: string | null) => (
    <div key={cod} className={'dchip cchip' + (drag?.cod === cod ? ' arrastando' : '')} draggable={!ocupado} title={nomeCtt(ctx, cod)}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', cod); setDrag({ cod, from }) }}
      onDragEnd={() => { setDrag(null); setSobre(null) }}>
      <span className="h">⠿</span>
      <span className="n"><b className="mono">{cod}</b> · {nomeCtt(ctx, cod).slice(0, 28)}</span>
      {from && <button type="button" className="x" title="Voltar para o grupo padrão" onClick={() => mover(cod, from, null)}>✕</button>}
    </div>
  )

  const cartao = (key: string, id: string | null, titulo: string, sub: string, cods: string[]) => {
    const alvo = !!drag && drag.from !== id
    return (
      <div key={key} className="gcol"
        style={alvo && sobre === key ? { borderStyle: 'dashed', background: 'var(--cs-tint)' } : undefined}
        onDragOver={e => { if (!alvo) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (sobre !== key) setSobre(key) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(s => (s === key ? null : s)) }}
        onDrop={e => { e.preventDefault(); if (drag && alvo) void mover(drag.cod, drag.from, id); setDrag(null); setSobre(null) }}>
        <header>
          <div className="t"><b>{titulo}</b><span className="pill p-blue">{cods.length}</span></div>
          <span className="note">{sub}</span>
        </header>
        <div className="body wrap">
          {cods.length ? cods.map(c => chip(c, id)) : <div className="vazio">Arraste contratantes pra cá</div>}
        </div>
        {id && (
          <div className="foot">
            <input value={novo[key] ?? ''} placeholder="+ código do contratante" aria-label={'Incluir contratante em ' + titulo}
              onChange={e => setNovo(p => ({ ...p, [key]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget.nextSibling as HTMLButtonElement | null)?.click() }} />
            <button type="button" className="btn sm" disabled={!(novo[key] ?? '').trim()} onClick={async () => {
              const cod = (novo[key] ?? '').trim()
              const atual = especificos.find(g => g.contratantes.includes(cod))?.id ?? null
              await mover(cod, atual, id)
              setNovo(p => ({ ...p, [key]: '' }))
            }}>＋</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="box">
      <h2>Contratantes por grupo</h2>
      <p className="note">Arraste cada contratante para o grupo de critério dele. Quem fica em &quot;Sem grupo específico&quot; usa o grupo padrão. Um contratante fica em um grupo só.</p>
      <div className="board">
        {cartao('__padrao', null, 'Sem grupo específico', 'usam o grupo padrão', semGrupo)}
        {especificos.map(g => cartao(g.id, g.id, g.nome, 'grupo específico', g.contratantes))}
      </div>
    </div>
  )
}

export function Catalogo({ ctx }: { ctx: Ctx }) {
  const { d, atualizarDoc, atualizarDocs, adicionarDoc, tentar, linhas, relSel } = useCs()
  const [novo, setNovo] = useState('')
  const [q, setQ] = useState('')
  const [fTipo, setFTipo] = useState<'' | 'empresa' | 'pessoa' | 'sem'>('')
  const [semVal, setSemVal] = useState(false)
  const filtrados = d.docs
    .filter(x => !q || norm(x.nome).includes(norm(q)) || (x.codigo ?? '').includes(q.trim()))
    .filter(x => !fTipo || (fTipo === 'sem' ? !x.tipo : x.tipo === fTipo))
    .filter(x => !semVal || x.validade_dias == null)
  const semTipo = d.docs.filter(x => !x.tipo && !x.nao_conta).length
  // Documento que aparece com turno no relatorio e de pessoa (turno so existe em documento de pessoa)
  const sugeridosPessoa = [...docsComTurno(ctx, linhas)].filter(id => !d.docs.find(x => x.id === id)?.tipo)
  const perGt = (id: string) => d.exig.find(v => v.documento_id === id && v.periodicidade)?.periodicidade ?? null
  const sugestoes = d.docs.filter(x => x.validade_dias == null).map(x => ({ id: x.id, v: validadePeloNome(x.nome, perGt(x.id)) })).filter((x): x is { id: string; v: number } => x.v != null)
  const nSemValidade = d.docs.filter(x => x.validade_dias == null && !x.nao_conta).length
  async function preencherValidades() {
    const porValor = new Map<number, string[]>()
    for (const x of sugestoes) porValor.set(x.v, [...(porValor.get(x.v) ?? []), x.id])
    for (const [v, ids] of porValor) await atualizarDocs(ids, { validade_dias: v })
  }
  const gruposDe = (id: string) => ctx.grupos.filter(g => ctx.gd.get(g.id)?.has(id)).map(g => g.nome).join(', ')
  const { sorted: docs, th } = useOrdem(filtrados, {
    nome: x => x.nome, cod: x => x.codigo, vol: x => x.volume_ref, rep: x => x.reprovados_ref,
    nc: x => (x.nao_conta ? 0 : 1), val: x => x.validade_dias ?? -1, grupos: x => gruposDe(x.id), tipo: x => x.tipo, exig: x => ctx.exige.get(x.id)?.size ?? 0,
  }, { col: 'nome', dir: 'asc' })
  return (
    <div className="box">
      <h2>Catálogo de documentos</h2>
      <p className="note">{d.docs.length} documentos. O volume de referência veio do relatório EFIDOCEMP-201 de 19 a 27/10/2026. O código é opcional e ajuda a casar com o relatório. Marque &quot;Não conta&quot; para itens de presença. Documentos novos entram no grupo padrão.</p>
      <p className="note"><b>Tipo</b> define a regra do requisito comum: <b>Empresa</b> conta para a vinculação ativa (GT0120); <b>Pessoa</b> só conta para os contratantes dos turnos ativos (GT0130), e sem turno não conta. Requisito do GT0010 vale 100% para o contratante dele nos dois casos.</p>
      {(semTipo > 0 || sugeridosPessoa.length > 0) && (
        <div className="selbar">
          <b>{semTipo} documento(s) sem tipo.</b>
          {sugeridosPessoa.length > 0
            ? <>
              <span className="note">O relatório {relSel?.nome ? `“${relSel.nome}” ` : ''}mostra {sugeridosPessoa.length} deles com turno, ou seja, são de pessoa.</span>
              <button type="button" className="btn sm solid" onClick={() => tentar(() => atualizarDocs(sugeridosPessoa, { tipo: 'pessoa' }), `${sugeridosPessoa.length} documento(s) marcados como Pessoa`)}>Classificar pelo relatório</button>
            </>
            : <span className="note">Quando houver relatório com a coluna de turnos, o botão &quot;Classificar pelo relatório&quot; marca como Pessoa os que aparecem com turno.</span>}
          <button type="button" className="link" onClick={() => setFTipo('sem')}>ver os sem tipo</button>
        </div>
      )}
      {nSemValidade > 0 && (
        <div className="selbar">
          <b>{nSemValidade} documento(s) sem validade.</b>
          {sugestoes.length > 0
            ? <>
              <span className="note">Pelo nome (ex.: &quot;ASO - ANUAL&quot;, &quot;EPI - 60 DIAS&quot;, &quot;ÚNICO&quot;) ou pela periodicidade do GT0010, dá para preencher {sugestoes.length} deles.</span>
              <button type="button" className="btn sm solid" onClick={() => tentar(preencherValidades, `Validade preenchida em ${sugestoes.length} documento(s)`)}>Preencher pelo nome</button>
            </>
            : <span className="note">Os que faltam não têm pista no nome (ex.: &quot;INFORMADA&quot; vale a data do próprio documento): escolha na coluna Validade.</span>}
          <label className="row note" style={{ gap: 6 }}><input type="checkbox" checked={semVal} onChange={e => setSemVal(e.target.checked)} /> ver só os sem validade</label>
        </div>
      )}
      <div className="row">
        <input type="text" value={novo} onChange={e => setNovo(e.target.value)} placeholder="Nome de um documento novo" style={{ flex: 1, minWidth: 220 }} />
        <button type="button" className="btn solid" disabled={!novo.trim()}
          onClick={async () => { if (await tentar(() => adicionarDoc(novo.trim()), 'Documento adicionado ao catálogo')) setNovo('') }}>Adicionar ao catálogo</button>
        <select value={fTipo} onChange={e => setFTipo(e.target.value as typeof fTipo)} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          <option value="empresa">Empresa</option>
          <option value="pessoa">Pessoa</option>
          <option value="sem">Sem tipo</option>
        </select>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar" style={{ width: 200 }} />
      </div>
      <div className="tbl scroll">
        <table>
          <thead><tr>{th('nome', 'Documento')}{th('cod', 'Código')}{th('tipo', 'Tipo')}{th('val', 'Validade', '', 'Validade do documento: base da frequência nas Bases prontas')}{th('vol', 'Volume', 'r')}{th('rep', 'Reprov.', 'r')}{th('nc', 'Não conta', 'c')}{th('exig', 'Exigido por (GT0010)', 'r', 'Contratantes com vínculo ativo no GT0010')}{th('grupos', 'Grupos')}</tr></thead>
          <tbody>
            {docs.map(x => (
              <tr key={x.id}>
                <td style={{ minWidth: 300 }}><TxtCampo valor={x.nome} ariaLabel="Nome do documento" onSalvar={v => tentar(() => atualizarDoc(x.id, { nome: v }))} /></td>
                <td><TxtCampo valor={x.codigo ?? ''} obrigatorio={false} ariaLabel="Código" style={{ width: 90 }}
                  onSalvar={v => tentar(() => atualizarDoc(x.id, { codigo: v || null }))} /></td>
                <td>
                  <select value={x.tipo ?? ''} aria-label="Tipo do documento" onChange={e => tentar(() => atualizarDoc(x.id, { tipo: (e.target.value || null) as typeof x.tipo }))}
                    style={!x.tipo && !x.nao_conta ? { borderColor: 'var(--cs-warn)', background: 'var(--cs-warn-bg)' } : undefined}>
                    <option value="">—</option>
                    <option value="empresa">Empresa</option>
                    <option value="pessoa">Pessoa</option>
                  </select>
                </td>
                <td>
                  <select value={x.validade_dias ?? ''} aria-label="Validade" onChange={e => tentar(() => atualizarDoc(x.id, { validade_dias: e.target.value === '' ? null : +e.target.value }))}
                    title={x.validade_dias == null ? (validadePeloNome(x.nome, perGt(x.id)) != null ? 'Sugestão pelo nome: ' + rotuloValidade(validadePeloNome(x.nome, perGt(x.id))) : 'Sem pista no nome') : undefined}>
                    <option value="">—</option>
                    {VALIDADES.map(v => <option key={v.dias} value={v.dias}>{v.label}</option>)}
                    {x.validade_dias != null && !VALIDADES.some(v => v.dias === x.validade_dias) && <option value={x.validade_dias}>{rotuloValidade(x.validade_dias)}</option>}
                  </select>
                </td>
                <td className="r mono">{fmt(x.volume_ref)}</td>
                <td className="r mono">{fmt(x.reprovados_ref)}</td>
                <td className="c"><input type="checkbox" aria-label="Não conta" checked={x.nao_conta}
                  onChange={e => tentar(() => atualizarDoc(x.id, { nao_conta: e.target.checked }))} /></td>
                <td className="r mono" title={[...(ctx.exige.get(x.id) ?? [])].map(c => c + ' · ' + nomeCtt(ctx, c)).join('\n')}>{ctx.exige.get(x.id)?.size || '—'}</td>
                <td className="note">{ctx.grupos.filter(g => ctx.gd.get(g.id)?.has(x.id)).map(g => g.nome).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Contratantes({ ctx }: { ctx: Ctx }) {
  const { d, salvarCtt, adicionarCtt, excluirCtt, tentar } = useCs()
  const [cod, setCod] = useState('')
  const [nome, setNome] = useState('')
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState<'' | 'com' | 'sem'>('')
  const nTurnos = (c: string) => d.turnos.filter(t => t.contratante_cod === c).length
  const filtrados = d.ctts
    .filter(c => !q || norm(c.contratante_cod + ' ' + c.nome).includes(norm(q)))
    .filter(c => !fCat || (fCat === 'com' ? temCatraca(ctx, c.contratante_cod) : !temCatraca(ctx, c.contratante_cod)))
  const { sorted: ctts, th } = useOrdem(filtrados, {
    cod: c => +c.contratante_cod || c.contratante_cod, nome: c => c.nome, fat: c => c.faturamento_mensal,
    pai: c => (c.contratante_pai ? nomeCtt(ctx, c.contratante_pai) : null), turnos: c => nTurnos(c.contratante_cod),
    cat: c => ctx.catraca.get(c.contratante_cod) ?? 0,
    grupo: c => grupoDe(ctx, c.contratante_cod)?.nome,
  }, { col: 'cod', dir: 'asc' })
  // Pode ser principal quem nao e unidade de ninguem
  const candidatos = [...d.ctts].filter(c => !c.contratante_pai).sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0))
  return (
    <>
    <div className="box">
      <div className="row between">
        <div>
          <h2>Contratantes</h2>
          <p className="note">Código igual ao do sistema. O faturamento mensal é usado na aba Resultado. &quot;Contratante principal&quot; agrupa unidades (ex.: GUTEN, GLOW e ALIMENTAR na SEDE / MATRIZ): a contagem continua separada e também aparece somada.</p>
        </div>
        <div className="row">
          <select value={fCat} onChange={e => setFCat(e.target.value as typeof fCat)} aria-label="Catraca">
            <option value="">Com e sem catraca</option>
            <option value="com">Só com catraca ({ctx.catraca.size})</option>
            <option value="sem">Só sem catraca ({d.ctts.length - ctx.catraca.size})</option>
          </select>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar código ou nome" style={{ width: 'min(260px,100%)' }} />
        </div>
      </div>
      <div className="tbl scroll">
        <table>
          <thead><tr>{th('cod', 'Código')}{th('nome', 'Nome')}{th('pai', 'Contratante principal')}{th('turnos', 'Turnos', 'r')}{th('cat', <><IconeCatraca title="Catraca de acesso" /> Catraca</>, 'c', 'Turnos com código de integração')}{th('fat', 'Faturamento/mês (R$)', 'r')}{th('grupo', 'Grupo de critério')}<th /></tr></thead>
          <tbody>
            {ctts.length ? ctts.map(c => {
              const unidades = unidadesDe(ctx, c.contratante_cod)
              return (
                <tr key={c.contratante_cod}>
                  <td><TxtCampo valor={c.contratante_cod} ariaLabel="Código" style={{ width: 80 }}
                    onSalvar={v => tentar(() => salvarCtt(c.contratante_cod, { contratante_cod: v }))} /></td>
                  <td style={{ minWidth: 220 }}><TxtCampo valor={c.nome} ariaLabel="Nome" onSalvar={v => tentar(() => salvarCtt(c.contratante_cod, { nome: v }))} /></td>
                  <td>
                    {unidades.length
                      ? <span className="pill p-blue" title={unidades.map(u => u + ' · ' + nomeCtt(ctx, u)).join('\n')}>principal de {unidades.length} unidade{unidades.length > 1 ? 's' : ''}</span>
                      : (
                        <select value={c.contratante_pai ?? ''} aria-label="Contratante principal" style={{ maxWidth: 230 }}
                          onChange={e => tentar(() => salvarCtt(c.contratante_cod, { contratante_pai: e.target.value || null }), 'Contratante principal atualizado')}>
                          <option value="">— independente —</option>
                          {candidatos.filter(x => x.contratante_cod !== c.contratante_cod).map(x => (
                            <option key={x.contratante_cod} value={x.contratante_cod}>{x.contratante_cod} · {x.nome}</option>
                          ))}
                        </select>
                      )}
                  </td>
                  <td className="r mono">{nTurnos(c.contratante_cod) || '—'}</td>
                  <td className="c">{temCatraca(ctx, c.contratante_cod) ? <SeloCatraca n={ctx.catraca.get(c.contratante_cod)} /> : <span className="note">—</span>}</td>
                  <td className="r"><NumCampo valor={c.faturamento_mensal} permiteVazio={false} ariaLabel="Faturamento" style={{ width: 130, textAlign: 'right' }}
                    onSalvar={v => tentar(() => salvarCtt(c.contratante_cod, { faturamento_mensal: v ?? 0 }))} /></td>
                  <td className="note">{grupoDe(ctx, c.contratante_cod)?.nome}</td>
                  <td><BotaoConfirmar onConfirm={() => tentar(() => excluirCtt(c.contratante_cod), 'Contratante excluído')}>Excluir</BotaoConfirmar></td>
                </tr>
              )
            }) : <tr><td colSpan={8} className="empty">Nenhum contratante.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="row">
        <input type="text" value={cod} onChange={e => setCod(e.target.value)} placeholder="Código" style={{ width: 100 }} />
        <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do contratante" style={{ flex: 1, minWidth: 200 }} />
        <button type="button" className="btn solid" disabled={!cod.trim() || !nome.trim()} onClick={async () => {
          if (await tentar(() => adicionarCtt({ contratante_cod: cod.trim(), nome: nome.trim(), faturamento_mensal: 0, contratante_pai: null }), 'Contratante adicionado')) { setCod(''); setNome('') }
        }}>Adicionar</button>
      </div>
    </div>
    <QuadroUnidades ctx={ctx} />
    </>
  )
}

/** Contratante principal e unidades: arraste unidades para o cartao do principal. */
function QuadroUnidades({ ctx }: { ctx: Ctx }) {
  const { d, salvarCtt, tentar } = useCs()
  const [drag, setDrag] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [novos, setNovos] = useState<string[]>([])     // principais criados aqui, ainda sem unidades
  const [escolha, setEscolha] = useState('')
  const [q, setQ] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const comUnidades = [...new Set(d.ctts.map(c => c.contratante_pai).filter((x): x is string => !!x))]
  const principais = [...new Set([...comUnidades, ...novos.filter(n => d.ctts.some(c => c.contratante_cod === n && !c.contratante_pai))])]
    .sort((a, b) => (+a || 0) - (+b || 0))
  const livres = d.ctts.filter(c => !c.contratante_pai && !principais.includes(c.contratante_cod))
    .sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0))
  const independentes = q ? livres.filter(c => norm(c.contratante_cod + ' ' + c.nome).includes(norm(q))) : livres

  async function definir(cod: string, pai: string | null) {
    if (ocupado || cod === pai) return
    if (pai && unidadesDe(ctx, cod).length) { await tentar(async () => { throw new Error('Esse contratante já é principal de outras unidades.') }); return }
    setOcupado(true)
    await tentar(() => salvarCtt(cod, { contratante_pai: pai }), pai ? `${cod} agora é unidade de ${pai} · ${nomeCtt(ctx, pai)}` : `${cod} voltou a ser independente`)
    setOcupado(false)
  }

  const chip = (cod: string, pai: string | null) => (
    <div key={cod} className={'dchip cchip' + (drag === cod ? ' arrastando' : '')} draggable={!ocupado} title={nomeCtt(ctx, cod)}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', cod); setDrag(cod) }}
      onDragEnd={() => { setDrag(null); setSobre(null) }}>
      <span className="h">⠿</span>
      <span className="n"><b className="mono">{cod}</b> · {nomeCtt(ctx, cod).slice(0, 30)}</span>
      {temCatraca(ctx, cod) && <IconeCatraca size={12} />}
      {pai && <button type="button" className="x" title="Tirar do agrupamento" onClick={() => definir(cod, null)}>✕</button>}
    </div>
  )

  const zona = (key: string, pai: string | null) => ({
    style: drag && sobre === key ? { borderStyle: 'dashed', background: 'var(--cs-tint)' } as React.CSSProperties : undefined,
    onDragOver: (e: React.DragEvent) => { if (!drag || drag === pai) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (sobre !== key) setSobre(key) },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(s => (s === key ? null : s)) },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const c = drag; setDrag(null); setSobre(null); if (c) void definir(c, pai) },
  })

  return (
    <div className="box">
      <div className="row between">
        <div>
          <h2>Contratante principal e unidades</h2>
          <p className="note">Arraste um contratante para o cartão do principal para torná-lo unidade dele. Na Contagem e no Resultado cada unidade continua com a sua conta, e o principal mostra a soma de todas (incluindo a conta dele mesmo).</p>
        </div>
        <div className="row">
          <select value={escolha} onChange={e => setEscolha(e.target.value)} aria-label="Novo contratante principal" style={{ maxWidth: 280 }}>
            <option value="">Novo agrupamento: escolha o principal…</option>
            {livres.map(c => <option key={c.contratante_cod} value={c.contratante_cod}>{c.contratante_cod} · {c.nome}</option>)}
          </select>
          <button type="button" className="btn sm solid" disabled={!escolha} onClick={() => { setNovos(n => [...n, escolha]); setEscolha('') }}>Criar cartão</button>
        </div>
      </div>
      <div className="board">
        {principais.map(p => {
          const unidades = unidadesDe(ctx, p).sort((a, b) => (+a || 0) - (+b || 0))
          return (
            <div key={p} className="gcol" {...zona(p, p)}>
              <header>
                <div className="t">
                  <span className="mono" style={{ fontWeight: 800, color: 'var(--cs-edge)' }}>{p}</span>
                  <b title={nomeCtt(ctx, p)}>{nomeCtt(ctx, p)}</b>
                  <span className="pill p-blue">{unidades.length}</span>
                </div>
                <span className="note">contratante principal</span>
              </header>
              <div className="body wrap">
                {unidades.length ? unidades.map(u => chip(u, p)) : <div className="vazio">Arraste as unidades pra cá</div>}
              </div>
              {unidades.length === 0 && (
                <div className="foot"><button type="button" className="link" onClick={() => setNovos(n => n.filter(x => x !== p))}>remover cartão</button></div>
              )}
            </div>
          )
        })}
        <div className="gcol" {...zona('__ind', null)}>
          <header>
            <div className="t"><b>Independentes</b><span className="pill p-blue">{livres.length}</span></div>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar" style={{ padding: '4px 8px', fontSize: 12.5 }} />
          </header>
          <div className="body wrap">
            {independentes.length ? independentes.map(c => chip(c.contratante_cod, null)) : <div className="vazio">Nenhum.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}


function Parametros({ ctx }: { ctx: Ctx }) {
  const { salvarConfig, tentar, papel } = useCs()
  const { overrides, saveOverride } = useModules()
  const c = ctx.cfg
  const [nome, setNome] = useState(c.nome_modulo)
  const [nomeAnterior, setNomeAnterior] = useState(c.nome_modulo)
  if (c.nome_modulo !== nomeAnterior) { setNomeAnterior(c.nome_modulo); setNome(c.nome_modulo) }
  const gerencia = papel === 'admin' || papel === 'gestor'

  async function salvarNome() {
    const n = nome.trim()
    if (!n) return
    const ok = await tentar(() => salvarConfig({ nome_modulo: n }), 'Nome salvo')
    // Sidebar: o nome exibido vem de modulos_config (so gestor/admin gravam la)
    if (ok && gerencia) {
      try { await saveOverride('custo-servir', n, overrides['custo-servir']?.color ?? '') } catch { /* sem permissao */ }
    }
  }

  function toggleAba(aba: string, perfil: string, on: boolean) {
    const atual = c.abas_perfis[aba] ?? []
    const prox = on ? [...new Set([...atual, perfil])] : atual.filter(p => p !== perfil)
    void tentar(() => salvarConfig({ abas_perfis: { ...c.abas_perfis, [aba]: prox } }))
  }

  return (
    <>
      <div className="box">
        <h2>Parâmetros da medição</h2>
        <div className="kv">
          <label>Tempo-padrão calculado pela
            <select value={c.base} onChange={e => tentar(() => salvarConfig({ base: e.target.value as 'mediana' | 'media' }))}>
              <option value="mediana">Mediana (recomendado)</option>
              <option value="media">Média</option>
            </select>
          </label>
          <label>Medições mínimas para &quot;pronto&quot;
            <NumCampo valor={c.minimo} min={1} permiteVazio={false} onSalvar={v => tentar(() => salvarConfig({ minimo: Math.round(v ?? 1) }))} />
          </label>
        </div>
        <p className="note">A mediana não é puxada por uma medição atípica. A média aparece ao lado em todas as telas, para comparação.</p>
      </div>
      <div className="box">
        <h2>Nome do módulo</h2>
        <div className="row">
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} style={{ width: 'min(360px,100%)' }} />
          <button type="button" className="btn solid" disabled={!nome.trim() || nome.trim() === c.nome_modulo} onClick={salvarNome}>Salvar nome</button>
        </div>
        {!gerencia && <p className="note">O nome na barra lateral só é atualizado quando um gestor ou admin salva.</p>}
      </div>
      <div className="box">
        <h2>Acesso por perfil</h2>
        <p className="note">Quais perfis veem cada aba. Hoje todos veem todas. O admin sempre vê todas as abas.{!gerencia && ' Só gestor ou admin altera.'}</p>
        <div className="tbl">
          <table>
            <thead><tr><th>Aba</th>{PERFIS.map(p => <th key={p} className="c">{p}</th>)}</tr></thead>
            <tbody>
              {ABAS.map(a => (
                <tr key={a.id}>
                  <td>{a.label}</td>
                  {PERFIS.map(p => (
                    <td key={p} className="c">
                      <input type="checkbox" aria-label={`${a.label} para ${p}`}
                        checked={p === 'admin' || (c.abas_perfis[a.id] ?? []).includes(p)}
                        disabled={!gerencia || p === 'admin'}
                        onChange={e => toggleAba(a.id, p, e.target.checked)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function Avaliadores() {
  const { d } = useCs()
  const n = new Map<string, number>()
  for (const m of d.meds) if (!m.origem_id) n.set(m.avaliador_id, (n.get(m.avaliador_id) ?? 0) + 1)
  const { sorted: lista, th } = useOrdem(d.usuarios.filter(u => !u.desativado || n.has(u.id)), {
    nome: u => nomeUsuario(u), papel: u => u.papel, n: u => n.get(u.id) ?? 0,
  }, { col: 'nome', dir: 'asc' })
  return (
    <div className="box">
      <h2>Avaliadores</h2>
      <p className="note">Os avaliadores são os usuários do sistema. Cada medição é gravada em nome de quem está logado. Para incluir alguém, crie o login em Usuários.</p>
      <div className="tbl scroll">
        <table>
          <thead><tr>{th('nome', 'Usuário')}{th('papel', 'Perfil')}{th('n', 'Medições', 'r')}</tr></thead>
          <tbody>
            {lista.map(u => (
              <tr key={u.id}>
                <td>{nomeUsuario(u)}{u.desativado && <span className="pill p-gray" style={{ marginLeft: 6 }}>desativado</span>}</td>
                <td className="note">{u.papel ?? '—'}</td>
                <td className="r mono">{n.get(u.id) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
