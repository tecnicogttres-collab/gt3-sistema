'use client'

// Documentos e bases. Estrutura em 4 passos:
//   1. Documentos              : o catalogo (de onde tudo puxa os documentos).
//   2. Contratantes            : hub de cada contratante (documentos que ele exige, o que e Base e o que e extra).
//   3. Grupos de contratantes  : so o que e DIFERENTE da Base (pacotes de extras aplicaveis a varios contratantes).
//   4. Base                    : nivel de venda (perk), dividido em Empresa e Funcionarios, com tempo e preco que
//                                atualizam sozinhos conforme o cronometro valida medicoes.
// Os documentos vem SEMPRE do catalogo (cs_documentos); do Cronometrar vem so o tempo-padrao.

import { useMemo, useState } from 'react'
import { useCs } from '../cs-data'
import {
  brl, financeiro, fmt, grupoDe, grupoPadrao, nomeCtt, norm, porMes, rotuloValidade, situacaoDoc, stat, tempoCtt, tempoNoGrupo, VALIDADES,
  type Conjunto, type Ctx, type Documento,
} from '../cs-lib'
import { BotaoConfirmar, PillSituacao } from '../cs-ui'
import { useTempo } from '../cs-tempo'
import { Catalogo } from './Configuracoes'

type TipoDoc = Documento['tipo']
const tipoCurto = (t: TipoDoc | undefined) => (t === 'pessoa' ? 'Funcionário' : t === 'empresa' ? 'Empresa' : '—')
const SECOES: { tipo: TipoDoc; titulo: string; sub: string }[] = [
  { tipo: 'empresa', titulo: 'Empresa', sub: 'uma avaliação por empresa' },
  { tipo: 'pessoa', titulo: 'Funcionários', sub: 'uma avaliação por funcionário' },
  { tipo: null, titulo: 'Sem tipo', sub: 'classifique no catálogo (Empresa ou Pessoa) para entrar na conta' },
]
const porNome = (ctx: Ctx) => (a: string, b: string) => (ctx.docs.get(a)?.nome ?? '').localeCompare(ctx.docs.get(b)?.nome ?? '', 'pt-BR')
const docsAtivosDoCtt = (exig: ReturnType<typeof useCs>['d']['exig'], cod: string) =>
  [...new Set(exig.filter(x => x.contratante_cod === cod && x.ativo).map(x => x.documento_id))]
/** Nivel de venda principal (a Base). */
const baseDe = (cjs: Conjunto[]) => cjs.filter(c => c.perk).sort((a, b) => a.ordem - b.ordem)[0] ?? null

const PASSOS = [
  ['docs', '1 · Documentos'], ['ctt', '2 · Contratantes'], ['grupos', '3 · Grupos de contratantes'], ['base', '4 · Base'],
] as const
type Passo = typeof PASSOS[number][0]

// ═════════════════════════════════════════════════════════════════════════════
// Seletor de documentos em lote: busca, filtro por tipo, marcar varios e colar lista
// ═════════════════════════════════════════════════════════════════════════════
export function SeletorDocs({ ctx, jaTem, onIncluir, rotulo = '+ Incluir documentos', marcarBase }: {
  ctx: Ctx; jaTem: Set<string>; onIncluir: (ids: string[]) => Promise<boolean>; rotulo?: string
  /** Documentos da Base: aparecem com selo e da para marcar todos de uma vez. */
  marcarBase?: Set<string>
}) {
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState<'' | 'empresa' | 'pessoa' | 'sem'>('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [colar, setColar] = useState('')
  const [naoAchados, setNaoAchados] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const candidatos = useMemo(() => [...ctx.docs.values()].filter(x => !jaTem.has(x.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [ctx.docs, jaTem])
  const vis = candidatos.filter(x => (!tipo || (tipo === 'sem' ? !x.tipo : x.tipo === tipo)) && (!q || norm(x.nome + ' ' + (x.codigo ?? '')).includes(norm(q))))
  const conta = (t: typeof tipo) => candidatos.filter(x => (!t || (t === 'sem' ? !x.tipo : x.tipo === t))).length
  const alternar = (id: string) => setSel(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const fechar = () => { setAberto(false); setSel(new Set()); setQ(''); setColar(''); setNaoAchados([]) }

  function lerLista() {
    const linhas = colar.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean)
    const n = new Set(sel), faltou: string[] = []
    for (const l of linhas) {
      const cod = l.match(/^\d+$/) ? l : null
      const exato = candidatos.find(x => (cod && x.codigo === cod) || norm(x.nome) === norm(l))
      const parecidos = exato ? [exato] : candidatos.filter(x => norm(x.nome).includes(norm(l)))
      if (parecidos.length === 1) n.add(parecidos[0].id); else faltou.push(l + (parecidos.length > 1 ? ` (${parecidos.length} parecidos)` : ''))
    }
    setSel(n); setNaoAchados(faltou); setColar('')
  }

  if (!aberto) return <button type="button" className="btn sm solid" onClick={() => setAberto(true)}>{rotulo}</button>
  return (
    <div className="tp-bloco padrao" style={{ width: '100%' }}>
      <div className="row between">
        <b>Escolha os documentos do catálogo</b>
        <button type="button" className="link" onClick={fechar}>fechar</button>
      </div>
      <div className="row">
        <input type="search" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome ou código" style={{ flex: '1 1 260px' }} />
        <span className="cfgnav" style={{ margin: 0 }}>
          {([['', 'Todos'], ['empresa', 'Empresa'], ['pessoa', 'Funcionário'], ['sem', 'Sem tipo']] as const).map(([k, l]) => (
            <button key={k} type="button" className={tipo === k ? 'on' : ''} onClick={() => setTipo(k)}>{l} ({conta(k)})</button>
          ))}
        </span>
      </div>
      <div className="row">
        <button type="button" className="btn sm" onClick={() => setSel(new Set([...sel, ...vis.map(x => x.id)]))}>Marcar os {vis.length} visíveis</button>
        {marcarBase && [...marcarBase].some(id => !jaTem.has(id)) && (
          <button type="button" className="btn sm" onClick={() => setSel(new Set([...sel, ...[...marcarBase].filter(id => !jaTem.has(id))]))}>Marcar os que faltam da Base</button>
        )}
        <button type="button" className="btn sm" disabled={!sel.size} onClick={() => setSel(new Set())}>Limpar</button>
        <span className="note">{sel.size} marcado(s)</span>
      </div>
      <div className="tp-lista tp-grid" style={{ maxHeight: 300 }}>
        {vis.map(x => (
          <label key={x.id} style={sel.has(x.id) ? { background: 'var(--cs-tint)' } : undefined}>
            <input type="checkbox" checked={sel.has(x.id)} onChange={() => alternar(x.id)} />
            <span>
              {x.codigo && <b className="mono">{x.codigo} </b>}{x.nome}
              <span className="note"> · {tipoCurto(x.tipo)}</span>
              {marcarBase?.has(x.id) && <> <span className="pill p-blue">Base</span></>}
            </span>
          </label>
        ))}
        {!vis.length && <span className="note">Nada encontrado (ou já incluído).</span>}
      </div>
      <details>
        <summary className="note" style={{ cursor: 'pointer' }}>Colar uma lista (um documento por linha, nome ou código)</summary>
        <textarea value={colar} onChange={e => setColar(e.target.value)} rows={5} style={{ width: '100%' }} placeholder={'ASO - ATESTADO DE SAÚDE OCUPACIONAL - ANUAL\nCARTÃO CNPJ\n139'} />
        <div className="row"><button type="button" className="btn sm" disabled={!colar.trim()} onClick={lerLista}>Marcar os da lista</button></div>
        {naoAchados.length > 0 && <div className="warnbox">Não encontrei (ou já estão incluídos): {naoAchados.join('; ')}</div>}
      </details>
      <div className="row">
        <button type="button" className="btn solid" disabled={ocupado || !sel.size} onClick={async () => {
          setOcupado(true)
          const ok = await onIncluir([...sel])
          setOcupado(false)
          if (ok) fechar()
        }}>Incluir {sel.size} documento(s)</button>
      </div>
    </div>
  )
}

/** Lista de contratantes para marcar (aplicar a varios). */
function EscolherContratantes({ ctx, sel, setSel, sem }: { ctx: Ctx; sel: Set<string>; setSel: (s: Set<string>) => void; sem?: string }) {
  const [q, setQ] = useState('')
  const lista = [...ctx.ctts.values()].filter(c => c.contratante_cod !== sem && (!q || norm(c.contratante_cod + ' ' + c.nome).includes(norm(q))))
    .sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0))
  return (
    <div className="tp-bloco">
      <div className="row">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar contratante" style={{ width: 220 }} />
        <button type="button" className="btn sm" onClick={() => setSel(new Set([...sel, ...lista.map(c => c.contratante_cod)]))}>Marcar os {lista.length} visíveis</button>
        <button type="button" className="btn sm" onClick={() => setSel(new Set())}>Limpar</button>
        <span className="note">{sel.size} marcado(s)</span>
      </div>
      <div className="tp-lista tp-grid">
        {lista.map(c => (
          <label key={c.contratante_cod}>
            <input type="checkbox" checked={sel.has(c.contratante_cod)} onChange={e => { const n = new Set(sel); if (e.target.checked) n.add(c.contratante_cod); else n.delete(c.contratante_cod); setSel(n) }} />
            <span><b className="mono">{c.contratante_cod}</b> {c.nome}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/** Seletor de validade (base da frequencia no mes). */
function SelValidade({ doc }: { doc: Documento | undefined }) {
  const { atualizarDoc, tentar } = useCs()
  if (!doc) return <span className="note">—</span>
  return (
    <select value={doc.validade_dias ?? ''} aria-label="Validade" onChange={e => tentar(() => atualizarDoc(doc.id, { validade_dias: e.target.value === '' ? null : +e.target.value }))}
      style={doc.validade_dias == null ? { borderColor: 'var(--cs-warn)', background: 'var(--cs-warn-bg)' } : undefined}>
      <option value="">—</option>
      {VALIDADES.map(v => <option key={v.dias} value={v.dias}>{v.label}</option>)}
      {doc.validade_dias != null && !VALIDADES.some(v => v.dias === doc.validade_dias) && <option value={doc.validade_dias}>{rotuloValidade(doc.validade_dias)}</option>}
    </select>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Calculadora: quanto um conjunto de documentos demanda
// ═════════════════════════════════════════════════════════════════════════════
export function Calculadora({ ctx, docs, grupoInicial, titulo = 'Calculadora: quanto esse conjunto demanda' }: { ctx: Ctx; docs: string[]; grupoInicial?: string; titulo?: string }) {
  const tm = useTempo()
  const [g, setG] = useState(grupoInicial ?? grupoPadrao(ctx)?.id ?? '')
  const [empresas, setEmpresas] = useState(1)
  const [pessoas, setPessoas] = useState(10)
  const [admissoes, setAdmissoes] = useState(1)
  const [pRep, setPRep] = useState(10)
  const fin = financeiro(ctx.cfg)
  const p = Math.min(0.9, Math.max(0, pRep / 100))
  const linhas = docs.map(id => {
    const doc = ctx.docs.get(id)
    const tA = tempoNoGrupo(ctx, g, id, 'aprovado'), tR = tempoNoGrupo(ctx, g, id, 'reprovado')
    const qtd = doc?.tipo === 'empresa' ? empresas : doc?.tipo === 'pessoa' ? pessoas : 0
    // Cada reprovacao gera um reenvio: em media p/(1-p) avaliacoes de reprovado antes da aprovada
    const ciclo = tA.val != null ? tA.val + (p / (1 - p)) * (tR.val ?? tA.val) : null
    const implant = ciclo != null ? qtd * ciclo : null
    const recorrente = ciclo != null ? qtd * ciclo * porMes(doc?.validade_dias) : null
    const entrada = ciclo != null && doc?.tipo === 'pessoa' ? admissoes * ciclo : 0
    const mensal = recorrente != null ? recorrente + entrada : null
    return { id, doc, tA, ciclo, qtd, implant, mensal, foraDoGrupo: tA.g && tA.g !== g }
  }).sort((a, b) => (a.doc?.tipo === b.doc?.tipo ? (a.doc?.nome ?? '').localeCompare(b.doc?.nome ?? '', 'pt-BR') : a.doc?.tipo === 'empresa' ? -1 : 1))
  const ok = linhas.filter(l => l.ciclo != null && l.doc?.tipo)
  const semTempo = linhas.filter(l => l.ciclo == null), semTipo = linhas.filter(l => l.ciclo != null && !l.doc?.tipo)
  const semValidade = ok.filter(l => l.doc?.validade_dias == null)
  const soma = (t: TipoDoc | 'todos', k: 'implant' | 'mensal') => ok.filter(l => t === 'todos' || l.doc?.tipo === t).reduce((a, l) => a + (l[k] ?? 0), 0) / 60
  const hImpl = soma('todos', 'implant'), hMes = soma('todos', 'mensal')
  const grupos = [...ctx.grupos].sort((a, b) => (a.padrao === b.padrao ? a.nome.localeCompare(b.nome, 'pt-BR') : a.padrao ? -1 : 1))
  return (
    <div className="tp-bloco padrao">
      <b>{titulo}</b>
      <div className="kv">
        <label>Critério (grupo)
          <select value={g} onChange={e => setG(e.target.value)}>{grupos.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
        </label>
        <label>Empresas<input type="number" min={0} value={empresas} onChange={e => setEmpresas(Math.max(0, +e.target.value || 0))} /></label>
        <label>Funcionários<input type="number" min={0} value={pessoas} onChange={e => setPessoas(Math.max(0, +e.target.value || 0))} /></label>
        <label>Funcionários novos por mês<input type="number" min={0} value={admissoes} onChange={e => setAdmissoes(Math.max(0, +e.target.value || 0))} /></label>
        <label>Reprovação (%)<input type="number" min={0} max={90} value={pRep} onChange={e => setPRep(Math.max(0, Math.min(90, +e.target.value || 0)))} /></label>
      </div>
      <div className="tiles">
        <div className="tile"><b>{tm.hu(hImpl, 1)}</b><span>implantação (avaliar tudo uma vez) · empresa {tm.hu(soma('empresa', 'implant'), 1)} · funcionários {tm.hu(soma('pessoa', 'implant'), 1)}</span></div>
        <div className="tile"><b>{tm.hu(hMes, 1)}</b><span>por mês (vencimentos + novos) · empresa {tm.hu(soma('empresa', 'mensal'), 1)} · funcionários {tm.hu(soma('pessoa', 'mensal'), 1)}</span></div>
        <div className="tile"><b>{fin.ok ? brl(hMes * fin.ch) : '—'}</b><span>custo por mês{fin.ok ? '' : ' (preencha a aba Resultado)'}</span></div>
        <div className="tile"><b>{fin.ok ? brl(hMes * fin.hmin) : '—'}</b><span>preço mínimo por mês (margem {fmt(ctx.cfg.margem_desejada)}%)</span></div>
        <div className="tile"><b>{fin.ok ? brl(hImpl * fin.hmin) : '—'}</b><span>preço mínimo da implantação</span></div>
      </div>
      {(semTempo.length > 0 || semTipo.length > 0 || semValidade.length > 0) && (
        <div className="warnbox">
          {semTempo.length > 0 && <div>{semTempo.length} documento(s) ainda sem tempo cronometrado ficaram fora da conta: o valor sobe conforme o cronômetro valida.</div>}
          {semTipo.length > 0 && <div>{semTipo.length} documento(s) sem tipo (empresa/funcionário) ficaram fora; classifique no passo 1 · Documentos.</div>}
          {semValidade.length > 0 && <div>{semValidade.length} documento(s) sem validade: só entram na implantação e nos funcionários novos. Defina a validade abaixo.</div>}
        </div>
      )}
      <div className="tbl scroll" style={{ maxHeight: 420 }}>
        <table>
          <thead><tr><th>Documento</th><th>Tipo</th><th>Validade</th><th className="r">Tempo (min)</th><th className="r">Qtd.</th><th className="r">Implantação (h)</th><th className="r">Por mês (h)</th></tr></thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.id}>
                <td style={{ maxWidth: 340 }}>{l.doc?.nome ?? '—'}</td>
                <td className="note">{tipoCurto(l.doc?.tipo)}</td>
                <td><SelValidade doc={l.doc} /></td>
                <td className="r mono" title={l.foraDoGrupo ? 'Sem tempo neste grupo: usou o do grupo padrão' : undefined}>
                  {l.tA.val != null ? tm.min(l.tA.val, 1) + (l.foraDoGrupo ? '*' : '') : <span className="pill p-warn">sem tempo</span>}
                </td>
                <td className="r mono">{l.doc?.tipo ? l.qtd : '—'}</td>
                <td className="r mono">{l.implant != null && l.doc?.tipo ? tm.h(l.implant / 60) : '—'}</td>
                <td className="r mono">{l.mensal != null && l.doc?.tipo ? tm.h(l.mensal / 60) : '—'}</td>
              </tr>
            ))}
            {!linhas.length && <tr><td colSpan={7} className="empty">Inclua documentos para calcular.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="note">Tempo = tempo-padrão de aprovado no grupo escolhido (* = sem tempo no grupo, usou o padrão); atualiza sozinho a cada medição validada no Cronometrar. Cada reprovação gera um reenvio. Por mês = quantidade × tempo × vencimentos no mês (anual = 1/12) + funcionários novos avaliando todos os documentos de funcionário.</p>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Tabela de documentos dividida em Empresa / Funcionarios
// ═════════════════════════════════════════════════════════════════════════════
function TabelaPorTipo({ ctx, ids, tempoDe, extra, acao, vazio }: {
  ctx: Ctx; ids: string[]
  tempoDe: (id: string) => { val: number | null; n?: number }
  extra?: { titulo: string; cel: (id: string) => React.ReactNode }
  acao?: (id: string) => React.ReactNode
  vazio: string
}) {
  const tm = useTempo()
  if (!ids.length) return <div className="empty">{vazio}</div>
  return <>
    {SECOES.map(s => {
      const lista = ids.filter(id => (ctx.docs.get(id)?.tipo ?? null) === s.tipo).sort(porNome(ctx))
      if (!lista.length) return null
      const tempos = lista.map(tempoDe)
      const comTempo = tempos.filter(t => t.val != null)
      const total = comTempo.reduce((a, t) => a + t.val!, 0)
      return (
        <div key={s.titulo} className="tp-bloco">
          <div className="row between">
            <b>{s.titulo} <span className="pill p-blue">{lista.length}</span></b>
            <span className="note">{s.tipo ? <>{s.sub}: <b>{tm.mu(total, 1)}</b> somando os {comTempo.length} com tempo{comTempo.length < lista.length ? ` (faltam ${lista.length - comTempo.length})` : ''}</> : s.sub}</span>
          </div>
          <div className="tbl">
            <table>
              <thead><tr><th>Documento</th><th>Validade</th><th className="r">Tempo aprov. (min)</th>{extra && <th>{extra.titulo}</th>}{acao && <th />}</tr></thead>
              <tbody>
                {lista.map((id, i) => (
                  <tr key={id}>
                    <td style={{ maxWidth: 380 }}>{ctx.docs.get(id)?.codigo && <span className="mono note">{ctx.docs.get(id)?.codigo} · </span>}{ctx.docs.get(id)?.nome ?? '—'}</td>
                    <td><SelValidade doc={ctx.docs.get(id)} /></td>
                    <td className="r mono">{tempos[i].val != null ? tm.min(tempos[i].val!, 1) : <span className="pill p-warn">sem tempo</span>}</td>
                    {extra && <td>{extra.cel(id)}</td>}
                    {acao && <td>{acao(id)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    })}
  </>
}

// ═════════════════════════════════════════════════════════════════════════════
// Documentos de um contratante (hub e modal do Cronometrar)
// ═════════════════════════════════════════════════════════════════════════════
export function EditorDocsContratante({ ctx, cod }: { ctx: Ctx; cod: string }) {
  const { d, vincularDocs, desvincularDoc, criarConjunto, tentar, toast, irConfig } = useCs()
  const vinc = d.exig.filter(x => x.contratante_cod === cod && x.ativo)
  const ids = docsAtivosDoCtt(d.exig, cod)
  const idsSet = new Set(ids)
  const base = baseDe(d.conjuntos)
  const baseSet = new Set(base?.docs ?? [])
  const daBase = ids.filter(id => baseSet.has(id)), extras = ids.filter(id => !baseSet.has(id))
  const faltamBase = (base?.docs ?? []).filter(id => !idsSet.has(id))
  const [fonte, setFonte] = useState('')
  const [selImp, setSelImp] = useState<Set<string>>(new Set())
  const [modo, setModo] = useState<'' | 'importar' | 'aplicar' | 'salvar'>('')
  const [alvos, setAlvos] = useState<Set<string>>(new Set())
  const [nomeCj, setNomeCj] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const grupo = grupoDe(ctx, cod)
  const variacoes = d.conjuntos.filter(c => !c.perk)

  const docsFonte = (f: string) => f.startsWith('c:') ? docsAtivosDoCtt(d.exig, f.slice(2)) : f.startsWith('j:') ? d.conjuntos.find(c => c.id === f.slice(2))?.docs ?? [] : []
  const candidatos = docsFonte(fonte).filter(id => !idsSet.has(id))
  async function rodar(fn: () => Promise<void>) { setOcupado(true); try { await fn() } finally { setOcupado(false) } }
  const incluir = (lista: string[], msg?: string) => tentar(async () => { await vincularDocs(lista, cod) }, msg ?? `${lista.length} documento(s) incluído(s)`)

  return (
    <div className="box">
      <div className="row between">
        <div>
          <span className="eyebrow">Contratante · critério: {grupo?.padrao ? 'grupo padrão' : grupo?.nome}</span>
          <h2>{cod} · {nomeCtt(ctx, cod)}</h2>
        </div>
        <div className="row">
          <button type="button" className={'btn sm' + (modo === 'importar' ? ' solid' : '')} onClick={() => setModo(modo === 'importar' ? '' : 'importar')}>Importar de…</button>
          <button type="button" className={'btn sm' + (modo === 'salvar' ? ' solid' : '')} disabled={!extras.length} onClick={() => setModo(modo === 'salvar' ? '' : 'salvar')} title="Cria um grupo de contratantes só com os extras (o que não está na Base)">Salvar extras como grupo</button>
          <button type="button" className={'btn sm' + (modo === 'aplicar' ? ' solid' : '')} disabled={!ids.length} onClick={() => setModo(modo === 'aplicar' ? '' : 'aplicar')}>Aplicar a outros contratantes</button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><b>{ids.length}</b><span>documentos exigidos</span></div>
        <div className="tile"><b>{base ? `${daBase.length}/${base.docs.length}` : '—'}</b><span>{base ? `da ${base.nome}` : 'sem Base definida (passo 4)'}</span></div>
        <div className="tile"><b>{extras.length}</b><span>extras (diferentes da Base)</span></div>
      </div>
      {base && faltamBase.length > 0 && (
        <div className="selbar">
          <span>Faltam <b>{faltamBase.length}</b> documento(s) da {base.nome} neste contratante.</span>
          <button type="button" className="btn sm solid" disabled={ocupado} onClick={() => rodar(async () => { await incluir(faltamBase, `${faltamBase.length} documento(s) da ${base.nome} incluído(s)`) })}>Incluir os que faltam da {base.nome}</button>
        </div>
      )}

      {modo === 'importar' && (
        <div className="tp-bloco">
          <div className="row">
            <b>Importar documentos de</b>
            <select value={fonte} onChange={e => { const f = e.target.value; setFonte(f); setSelImp(new Set(docsFonte(f).filter(id => !idsSet.has(id)))) }} aria-label="Importar de">
              <option value="">escolha…</option>
              {d.conjuntos.length > 0 && <optgroup label="Base e grupos de contratantes">{d.conjuntos.map(c => <option key={c.id} value={'j:' + c.id}>{c.perk ? '★ ' : ''}{c.nome} ({c.docs.length})</option>)}</optgroup>}
              <optgroup label="Outro contratante">
                {[...ctx.ctts.values()].filter(c => c.contratante_cod !== cod).sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0))
                  .map(c => <option key={c.contratante_cod} value={'c:' + c.contratante_cod}>{c.contratante_cod} · {c.nome}</option>)}
              </optgroup>
            </select>
            {fonte && <span className="note">{candidatos.length} documento(s) que este contratante ainda não tem</span>}
          </div>
          {fonte && candidatos.length > 0 && <>
            <div className="row">
              <button type="button" className="btn sm" onClick={() => setSelImp(new Set(candidatos))}>Todos</button>
              <button type="button" className="btn sm" onClick={() => setSelImp(new Set())}>Nenhum</button>
            </div>
            <div className="tp-lista tp-grid">
              {candidatos.map(id => (
                <label key={id}>
                  <input type="checkbox" checked={selImp.has(id)} onChange={e => { const n = new Set(selImp); if (e.target.checked) n.add(id); else n.delete(id); setSelImp(n) }} />
                  <span>{ctx.docs.get(id)?.nome} <span className="note">· {tipoCurto(ctx.docs.get(id)?.tipo)}</span></span>
                </label>
              ))}
            </div>
            <div className="row">
              <button type="button" className="btn solid" disabled={ocupado || !selImp.size} onClick={() => rodar(async () => {
                const sel = candidatos.filter(id => selImp.has(id))
                if (await incluir(sel, `${sel.length} documento(s) importado(s)`)) { setFonte(''); setModo('') }
              })}>Importar {candidatos.filter(id => selImp.has(id)).length} documento(s)</button>
            </div>
          </>}
        </div>
      )}

      {modo === 'salvar' && (
        <div className="tp-bloco">
          <p className="note">Cria um grupo de contratantes com os {extras.length} extra(s) deste contratante (o que já está na Base fica de fora).</p>
          <div className="row">
            <input type="text" value={nomeCj} onChange={e => setNomeCj(e.target.value)} placeholder={`ex.: Extras ${nomeCtt(ctx, cod).split(' ')[0]}`} style={{ width: 260 }} />
            <button type="button" className="btn sm solid" disabled={ocupado || !nomeCj.trim()} onClick={() => rodar(async () => {
              if (await tentar(() => criarConjunto(nomeCj.trim(), extras, `Extras de ${cod} · ${nomeCtt(ctx, cod)}`), `Grupo "${nomeCj.trim()}" criado com ${extras.length} documento(s)`)) { setNomeCj(''); setModo('') }
            })}>Criar grupo com {extras.length} extra(s)</button>
          </div>
        </div>
      )}

      {modo === 'aplicar' && <>
        <p className="note">Os {ids.length} documentos deste contratante serão incluídos nos marcados (o que já existe lá fica).</p>
        <EscolherContratantes ctx={ctx} sel={alvos} setSel={setAlvos} sem={cod} />
        <div className="row">
          <button type="button" className="btn solid" disabled={ocupado || !alvos.size} onClick={() => rodar(async () => {
            let total = 0
            const okk = await tentar(async () => { for (const c of alvos) total += (await vincularDocs(ids, c)).novos })
            if (okk) { toast(`${total} vínculo(s) novo(s) em ${alvos.size} contratante(s)`); setAlvos(new Set()); setModo('') }
          })}>Aplicar a {alvos.size} contratante(s)</button>
        </div>
      </>}

      <div className="row">
        <SeletorDocs ctx={ctx} jaTem={idsSet} marcarBase={baseSet} onIncluir={lista => incluir(lista)} />
        {variacoes.length > 0 && <span className="note">ou importe um grupo de contratantes em &quot;Importar de…&quot;</span>}
        <button type="button" className="link" onClick={() => irConfig('ctt')}>editar cadastro do contratante</button>
      </div>

      <TabelaPorTipo ctx={ctx} ids={ids} vazio="Nenhum documento ainda. Inclua a Base ou escolha documentos acima."
        tempoDe={id => tempoCtt(ctx, cod, id, 'aprovado')}
        extra={{
          titulo: 'Base ou extra',
          cel: id => (
            <span className="pills">
              {baseSet.has(id) ? <span className="pill p-blue">Base</span> : <span className="pill p-warn" title="Diferente da Base">Extra</span>}
              <span className="note">{vinc.filter(v => v.documento_id === id).map(v => (v.origem === 'contratante' ? 'GT0010' : `contrato ×${v.qtd_contratos}`)).join(', ')}</span>
            </span>
          ),
        }}
        acao={id => <BotaoConfirmar onConfirm={() => void tentar(async () => { for (const v of vinc.filter(x => x.documento_id === id)) await desvincularDoc(id, cod, v.origem) }, 'Documento retirado')}>Retirar</BotaoConfirmar>}
      />
      {ids.length > 0 && <Calculadora key={cod} ctx={ctx} docs={ids} grupoInicial={grupo?.id} titulo="Calculadora: quanto este contratante demanda" />}
    </div>
  )
}

function HubContratantes({ ctx }: { ctx: Ctx }) {
  const { d } = useCs()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'' | 'extras' | 'falta' | 'vazio'>('')
  const [sel, setSel] = useState<string | null>(null)
  const base = baseDe(d.conjuntos)
  const baseSet = new Set(base?.docs ?? [])
  const linhas = [...ctx.ctts.values()].map(c => {
    const ids = docsAtivosDoCtt(d.exig, c.contratante_cod)
    const naBase = ids.filter(id => baseSet.has(id)).length
    return { c, n: ids.length, extras: ids.length - naBase, faltam: baseSet.size - naBase }
  }).filter(x => (!q || norm(x.c.contratante_cod + ' ' + x.c.nome).includes(norm(q)))
    && (!filtro || (filtro === 'extras' ? x.extras > 0 : filtro === 'falta' ? x.n > 0 && x.faltam > 0 : x.n === 0)))
    .sort((a, b) => (+a.c.contratante_cod || 0) - (+b.c.contratante_cod || 0))
  const atual = sel && ctx.ctts.has(sel) ? sel : null
  return (
    <div className="box">
      <h2>Contratantes</h2>
      <p className="note">Escolha o contratante para ver e montar os documentos dele. Os que estão na Base aparecem como <span className="pill p-blue">Base</span>; o que é diferente aparece como <span className="pill p-warn">Extra</span>. Para incluir vários de uma vez, use &quot;+ Incluir documentos&quot;.</p>
      <div className="bases">
        <div className="cj-lista">
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Buscar (${ctx.ctts.size} contratantes)`} />
          <select value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)} aria-label="Filtro">
            <option value="">Todos</option>
            <option value="extras">Com extras (diferentes da Base)</option>
            <option value="falta">Faltando algo da Base</option>
            <option value="vazio">Sem documentos</option>
          </select>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 640, overflow: 'auto' }}>
            {linhas.map(x => (
              <button key={x.c.contratante_cod} type="button" className={atual === x.c.contratante_cod ? 'on' : ''} onClick={() => setSel(x.c.contratante_cod)}>
                <b><span className="mono">{x.c.contratante_cod}</span> · {x.c.nome}</b>
                <span className="note">{x.n ? `${x.n} doc(s)${base ? ` · ${x.extras} extra(s)${x.faltam > 0 ? ` · faltam ${x.faltam} da Base` : ' · Base completa'}` : ''}` : 'sem documentos'}</span>
              </button>
            ))}
            {!linhas.length && <p className="note">Nenhum contratante encontrado.</p>}
          </div>
        </div>
        {atual ? <EditorDocsContratante key={atual} ctx={ctx} cod={atual} /> : <div className="empty">Escolha um contratante ao lado.</div>}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Grupos de contratantes: so o que difere da Base
// ═════════════════════════════════════════════════════════════════════════════
function GruposContratantes({ ctx }: { ctx: Ctx }) {
  const { d, criarConjunto, salvarConjunto, excluirConjunto, docsConjunto, vincularDocs, tentar, toast } = useCs()
  const [selId, setSelId] = useState<string | null>(null)
  const [novo, setNovo] = useState('')
  const [aplicar, setAplicar] = useState(false)
  const [comBase, setComBase] = useState(true)
  const [alvos, setAlvos] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState(false)
  const base = baseDe(d.conjuntos)
  const baseSet = new Set(base?.docs ?? [])
  const grupos = d.conjuntos.filter(c => !c.perk)
  const sel = grupos.find(c => c.id === selId) ?? grupos[0] ?? null
  const docsSet = new Set(sel?.docs ?? [])
  const jaNaBase = (sel?.docs ?? []).filter(id => baseSet.has(id))
  const ctts = [...ctx.ctts.values()].sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0))
  const paraAplicar = sel ? [...new Set([...(comBase ? base?.docs ?? [] : []), ...sel.docs])] : []

  return (
    <div className="box">
      <h2>Grupos de contratantes</h2>
      <p className="note">Só o que é <b>diferente da Base</b>: pacotes de documentos extras que vários contratantes exigem (ex.: &quot;Extras indústria alimentícia&quot;). Monte o grupo e aplique aos contratantes; quem recebe fica com a Base + esses extras.</p>
      <div className="bases">
        <div className="cj-lista">
          {grupos.map(c => (
            <button key={c.id} type="button" className={sel?.id === c.id ? 'on' : ''} onClick={() => { setSelId(c.id); setAplicar(false) }}>
              <b>{c.nome}</b><span className="note">{c.docs.filter(id => !baseSet.has(id)).length} extra(s){c.docs.some(id => baseSet.has(id)) ? ` · ${c.docs.filter(id => baseSet.has(id)).length} já na Base` : ''}</span>
            </button>
          ))}
          {!grupos.length && <p className="note">Nenhum grupo ainda.</p>}
          <div className="tp-bloco">
            <input type="text" value={novo} onChange={e => setNovo(e.target.value)} placeholder="Nome (ex.: Extras indústria)" aria-label="Nome do novo grupo" />
            <button type="button" className="btn sm solid" disabled={!novo.trim()} onClick={async () => {
              const nome = novo.trim()
              await tentar(async () => { const id = await criarConjunto(nome); setSelId(id); setNovo('') }, `Grupo "${nome}" criado`)
            }}>+ Novo grupo</button>
          </div>
        </div>

        {sel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div className="row between">
              <input key={sel.id + sel.nome} type="text" defaultValue={sel.nome} aria-label="Nome do grupo" style={{ fontSize: 17, fontWeight: 800, flex: 1, minWidth: 220 }}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== sel.nome) void tentar(() => salvarConjunto(sel.id, { nome: v }), 'Nome salvo') }} />
              <div className="row">
                <button type="button" className="btn sm" onClick={() => tentar(async () => { const id = await criarConjunto(sel.nome + ' (cópia)', sel.docs, sel.descricao); setSelId(id) }, 'Grupo duplicado')}>Duplicar</button>
                <button type="button" className={'btn sm' + (aplicar ? ' solid' : '')} disabled={!sel.docs.length} onClick={() => setAplicar(!aplicar)}>Aplicar a contratantes</button>
                <BotaoConfirmar onConfirm={() => void tentar(async () => { await excluirConjunto(sel.id); setSelId(null) }, 'Grupo excluído')}>Excluir</BotaoConfirmar>
              </div>
            </div>
            <input key={sel.id + 'd' + (sel.descricao ?? '')} type="text" defaultValue={sel.descricao ?? ''} placeholder="Descrição (opcional): para quem serve este grupo" aria-label="Descrição"
              onBlur={e => { const v = e.target.value.trim() || null; if (v !== sel.descricao) void tentar(() => salvarConjunto(sel.id, { descricao: v })) }} />

            {jaNaBase.length > 0 && (
              <div className="selbar">
                <span>{jaNaBase.length} documento(s) deste grupo já estão na Base e não precisam ficar aqui.</span>
                <button type="button" className="btn sm solid" onClick={() => tentar(() => docsConjunto(sel.id, [], jaNaBase), `${jaNaBase.length} documento(s) da Base retirado(s) do grupo`)}>Deixar só os extras</button>
              </div>
            )}

            {aplicar && <>
              <label className="row note" style={{ gap: 6 }}>
                <input type="checkbox" checked={comBase} disabled={!base} onChange={e => setComBase(e.target.checked)} />
                Incluir também a Base ({base?.docs.length ?? 0} documentos) · total: {paraAplicar.length} documento(s)
              </label>
              <EscolherContratantes ctx={ctx} sel={alvos} setSel={setAlvos} />
              <div className="row">
                <button type="button" className="btn solid" disabled={ocupado || !alvos.size} onClick={async () => {
                  setOcupado(true)
                  let total = 0
                  const okk = await tentar(async () => { for (const c of alvos) total += (await vincularDocs(paraAplicar, c)).novos })
                  setOcupado(false)
                  if (okk) { toast(`${total} vínculo(s) novo(s) em ${alvos.size} contratante(s)`); setAlvos(new Set()); setAplicar(false) }
                }}>Aplicar a {alvos.size} contratante(s)</button>
              </div>
            </>}

            <div className="row">
              <SeletorDocs ctx={ctx} jaTem={new Set([...docsSet, ...baseSet])} rotulo="+ Incluir extras" onIncluir={ids => tentar(() => docsConjunto(sel.id, ids), `${ids.length} documento(s) incluído(s)`)} />
              <select value="" aria-label="Trazer os extras de um contratante" onChange={async e => {
                const c = e.target.value; if (!c) return
                const ds = docsAtivosDoCtt(d.exig, c).filter(id => !baseSet.has(id))
                await tentar(async () => { const n = await docsConjunto(sel.id, ds); toast(`${n} extra(s) de ${c} incluído(s)`) })
              }}>
                <option value="">+ trazer os extras de um contratante…</option>
                {ctts.filter(c => docsAtivosDoCtt(d.exig, c.contratante_cod).some(id => !baseSet.has(id))).map(c => <option key={c.contratante_cod} value={c.contratante_cod}>{c.contratante_cod} · {c.nome}</option>)}
              </select>
            </div>
            <TabelaPorTipo ctx={ctx} ids={sel.docs} vazio="Grupo vazio. Inclua os documentos extras acima ou traga os de um contratante."
              tempoDe={id => tempoNoGrupo(ctx, grupoPadrao(ctx)?.id ?? '', id, 'aprovado')}
              extra={{ titulo: '', cel: id => (baseSet.has(id) ? <span className="pill p-gray" title="Já está na Base">já na Base</span> : null) }}
              acao={id => <button type="button" className="btn sm bad" onClick={() => tentar(() => docsConjunto(sel.id, [], [id]), 'Documento retirado do grupo')}>Retirar</button>}
            />
            {sel.docs.length > 0 && <Calculadora key={sel.id} ctx={ctx} docs={[...new Set([...(base?.docs ?? []), ...sel.docs])]} titulo={`Calculadora: Base + ${sel.nome}`} />}
          </div>
        ) : <div className="empty">Crie o primeiro grupo ao lado.</div>}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Base: nivel de venda (perk), dividido em Empresa e Funcionarios
// ═════════════════════════════════════════════════════════════════════════════
function BaseVenda({ ctx }: { ctx: Ctx }) {
  const { d } = useCs()
  const perks = d.conjuntos.filter(c => c.perk).sort((a, b) => a.ordem - b.ordem)
  if (!perks.length) {
    return (
      <div className="box">
        <h2>Base</h2>
        <div className="warnbox">A Base ainda não está definida. Rode <b>sql/custo-servir-base-perks.sql</b> no SQL Editor do Supabase (cria a Base com os 13 documentos de empresa e os 3 de funcionário) e recarregue a página.</div>
      </div>
    )
  }
  return <>{perks.map(p => <CartaoPerk key={p.id} ctx={ctx} p={p} />)}</>
}

function CartaoPerk({ ctx, p }: { ctx: Ctx; p: Conjunto }) {
  const { docsConjunto, salvarConjunto, tentar } = useCs()
  const g = grupoPadrao(ctx)
  const docsSet = new Set(p.docs)
  const prontos = p.docs.filter(id => g && situacaoDoc(ctx, g.id, id) === 'pronto').length
  const pct = p.docs.length ? (prontos / p.docs.length) * 100 : 0
  return (
    <div className="box">
      <div className="row between">
        <div>
          <span className="eyebrow">Nível de venda</span>
          <input key={p.id + p.nome} type="text" defaultValue={p.nome} aria-label="Nome do nível" style={{ fontSize: 20, fontWeight: 900, minWidth: 220 }}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.nome) void tentar(() => salvarConjunto(p.id, { nome: v }), 'Nome salvo') }} />
        </div>
        <SeletorDocs ctx={ctx} jaTem={docsSet} rotulo="+ Incluir documentos na Base" onIncluir={ids => tentar(() => docsConjunto(p.id, ids), `${ids.length} documento(s) incluído(s) na ${p.nome}`)} />
      </div>
      <input key={p.id + 'd' + (p.descricao ?? '')} type="text" defaultValue={p.descricao ?? ''} placeholder="Descrição para a venda (ex.: o essencial para entrar no portal)" aria-label="Descrição"
        onBlur={e => { const v = e.target.value.trim() || null; if (v !== p.descricao) void tentar(() => salvarConjunto(p.id, { descricao: v })) }} />
      <div className="tiles">
        <div className="tile"><b>{p.docs.filter(id => ctx.docs.get(id)?.tipo === 'empresa').length}</b><span>documentos da empresa</span></div>
        <div className="tile"><b>{p.docs.filter(id => ctx.docs.get(id)?.tipo === 'pessoa').length}</b><span>documentos por funcionário</span></div>
        <div className="tile"><b>{prontos}/{p.docs.length}</b><span>com tempo pronto (≥ {ctx.cfg.minimo} medições no grupo padrão)</span></div>
      </div>
      <div className="prog" title="Documentos da Base com tempo pronto"><i style={{ width: pct + '%' }} /></div>
      <p className="note">O tempo e o preço abaixo atualizam sozinhos conforme o Cronometrar valida medições (grupo padrão). Documento sem tempo ainda fica fora da conta.</p>
      <TabelaPorTipo ctx={ctx} ids={p.docs} vazio="Nenhum documento na Base."
        tempoDe={id => (g ? { val: tempoNoGrupo(ctx, g.id, id, 'aprovado').val, n: stat(ctx, g.id, id, 'aprovado').n } : { val: null })}
        extra={{ titulo: 'Situação', cel: id => (g ? <span className="pills"><PillSituacao s={situacaoDoc(ctx, g.id, id)} /><span className="note mono">{stat(ctx, g.id, id, 'aprovado').n}/{ctx.cfg.minimo}</span></span> : null) }}
        acao={id => <button type="button" className="btn sm bad" onClick={() => tentar(() => docsConjunto(p.id, [], [id]), `Documento retirado da ${p.nome}`)}>Retirar</button>}
      />
      {p.docs.length > 0 && <Calculadora key={p.id} ctx={ctx} docs={p.docs} titulo={`Quanto custa a ${p.nome}`} />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Aba Documentos e bases
// ═════════════════════════════════════════════════════════════════════════════
export default function Bases() {
  const { ctx } = useCs()
  const [passo, setPasso] = useState<Passo>(() => {
    try { const v = localStorage.getItem('cs_bases_passo'); return (PASSOS.some(([k]) => k === v) ? v : 'base') as Passo } catch { return 'base' }
  })
  if (!ctx) return null
  const ir = (p: Passo) => { setPasso(p); try { localStorage.setItem('cs_bases_passo', p) } catch { /* ignore */ } }
  return (
    <>
      <div className="cfgnav">
        {PASSOS.map(([k, l]) => <button key={k} type="button" className={k === passo ? 'on' : ''} onClick={() => ir(k)}>{l}</button>)}
      </div>
      <p className="note">Documentos (catálogo) › Contratantes (o que cada um exige) › Grupos de contratantes (só o que difere da Base) › Base (nível de venda). Os documentos vêm sempre do catálogo; do Cronometrar vem só o tempo.</p>
      {passo === 'docs' && <Catalogo ctx={ctx} />}
      {passo === 'ctt' && <HubContratantes ctx={ctx} />}
      {passo === 'grupos' && <GruposContratantes ctx={ctx} />}
      {passo === 'base' && <BaseVenda ctx={ctx} />}
    </>
  )
}
