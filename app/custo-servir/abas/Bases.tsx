'use client'

// Documentos e bases, organizado em torno dos MODELOS DE VENDA:
//   Modelos de venda   : o modelo padrao (a "Base" principal) e as variacoes (padrao + documentos a mais/a menos),
//                        com tempo e preco que atualizam sozinhos conforme o cronometro valida medicoes.
//                        (tabela cs_conjuntos com perk = true; o padrao e o de menor ordem)
//   Contratantes       : o que cada contratante exige (modelo padrao + extras) e o cadastro (incluir, inativar, excluir).
//   Pacotes de extras  : so o que difere do padrao, para aplicar a varios contratantes (cs_conjuntos com perk = false).
//   Catalogo           : de onde todos os documentos vem.
// Os documentos vem SEMPRE do catalogo (cs_documentos); do Cronometrar vem so o tempo-padrao.

import { useMemo, useState } from 'react'
import { useCs } from '../cs-data'
import {
  brl, cttsAtivos, financeiro, fmt, grupoDe, grupoPadrao, nomeCtt, norm, porMes, rotuloValidade, situacaoDoc, stat, tempoCtt, tempoNoGrupo, VALIDADES,
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
  ['base', '📦 Modelos de venda'], ['ctt', '🏢 Contratantes'], ['grupos', '🧩 Pacotes de extras'], ['docs', '🗂 Catálogo de documentos'],
] as const
type Passo = typeof PASSOS[number][0]
const LS_PASSO = 'cs_bases_passo'

// ═════════════════════════════════════════════════════════════════════════════
// Seletor de documentos em lote: busca, filtro por tipo, marcar varios e colar lista
// ═════════════════════════════════════════════════════════════════════════════
export function SeletorDocs({ ctx, jaTem, onIncluir, rotulo = '+ Incluir documentos', marcarBase, impacto }: {
  ctx: Ctx; jaTem: Set<string>; onIncluir: (ids: string[]) => Promise<boolean>; rotulo?: string
  /** Documentos da Base: aparecem com selo e da para marcar todos de uma vez. */
  marcarBase?: Set<string>
  /** Previa do efeito dos marcados (ex.: quanto tempo a mais a Base passa a demandar). */
  impacto?: (ids: string[]) => React.ReactNode
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
      {impacto && sel.size > 0 && impacto([...sel])}
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
  const lista = cttsAtivos(ctx).filter(c => c.contratante_cod !== sem && (!q || norm(c.contratante_cod + ' ' + c.nome).includes(norm(q))))
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
          {semTipo.length > 0 && <div>{semTipo.length} documento(s) sem tipo (empresa/funcionário) ficaram fora; classifique no Catálogo de documentos.</div>}
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
          <button type="button" className={'btn sm' + (modo === 'salvar' ? ' solid' : '')} disabled={!extras.length} onClick={() => setModo(modo === 'salvar' ? '' : 'salvar')} title="Cria um pacote só com os extras (o que não está no modelo padrão)">Salvar extras como pacote</button>
          <button type="button" className={'btn sm' + (modo === 'aplicar' ? ' solid' : '')} disabled={!ids.length} onClick={() => setModo(modo === 'aplicar' ? '' : 'aplicar')}>Aplicar a outros contratantes</button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><b>{ids.length}</b><span>documentos exigidos</span></div>
        <div className="tile"><b>{base ? `${daBase.length}/${base.docs.length}` : '—'}</b><span>{base ? `da ${base.nome}` : 'sem modelo padrão (aba Modelos de venda)'}</span></div>
        <div className="tile"><b>{extras.length}</b><span>extras (fora do modelo padrão)</span></div>
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
              {d.conjuntos.length > 0 && <optgroup label="Modelos de venda e pacotes de extras">{d.conjuntos.map(c => <option key={c.id} value={'j:' + c.id}>{c.perk ? '★ ' : ''}{c.nome} ({c.docs.length})</option>)}</optgroup>}
              <optgroup label="Outro contratante">
                {cttsAtivos(ctx).filter(c => c.contratante_cod !== cod)
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
          <p className="note">Cria um pacote de extras com os {extras.length} extra(s) deste contratante (o que já está no modelo padrão fica de fora).</p>
          <div className="row">
            <input type="text" value={nomeCj} onChange={e => setNomeCj(e.target.value)} placeholder={`ex.: Extras ${nomeCtt(ctx, cod).split(' ')[0]}`} style={{ width: 260 }} />
            <button type="button" className="btn sm solid" disabled={ocupado || !nomeCj.trim()} onClick={() => rodar(async () => {
              if (await tentar(() => criarConjunto(nomeCj.trim(), extras, `Extras de ${cod} · ${nomeCtt(ctx, cod)}`), `Pacote "${nomeCj.trim()}" criado com ${extras.length} documento(s)`)) { setNomeCj(''); setModo('') }
            })}>Criar pacote com {extras.length} extra(s)</button>
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
        {variacoes.length > 0 && <span className="note">ou importe um pacote de extras em &quot;Importar de…&quot;</span>}
        <button type="button" className="link" onClick={() => irConfig('ctt')}>editar cadastro do contratante</button>
      </div>

      <TabelaPorTipo ctx={ctx} ids={ids} vazio="Nenhum documento ainda. Inclua o modelo padrão ou escolha documentos acima."
        tempoDe={id => tempoCtt(ctx, cod, id, 'aprovado')}
        extra={{
          titulo: 'Padrão ou extra',
          cel: id => (
            <span className="pills">
              {baseSet.has(id) ? <span className="pill p-blue">Padrão</span> : <span className="pill p-warn" title="Fora do modelo padrão">Extra</span>}
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
  const { d, adicionarCtt, tentar } = useCs()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'' | 'extras' | 'falta' | 'vazio'>('')
  const [verInativos, setVerInativos] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [novo, setNovo] = useState<{ cod: string; nome: string } | null>(null)
  const base = baseDe(d.conjuntos)
  const baseSet = new Set(base?.docs ?? [])
  const nInativos = [...ctx.ctts.values()].filter(c => c.ativo === false).length
  const linhas = [...ctx.ctts.values()].filter(c => (verInativos ? c.ativo === false : c.ativo !== false)).map(c => {
    const ids = docsAtivosDoCtt(d.exig, c.contratante_cod)
    const naBase = ids.filter(id => baseSet.has(id)).length
    return { c, n: ids.length, extras: ids.length - naBase, faltam: baseSet.size - naBase }
  }).filter(x => (!q || norm(x.c.contratante_cod + ' ' + x.c.nome).includes(norm(q)))
    && (!filtro || (filtro === 'extras' ? x.extras > 0 : filtro === 'falta' ? x.n > 0 && x.faltam > 0 : x.n === 0)))
    .sort((a, b) => (+a.c.contratante_cod || 0) - (+b.c.contratante_cod || 0))
  const atual = sel && ctx.ctts.has(sel) ? sel : null

  async function criar() {
    if (!novo) return
    const cod = novo.cod.trim(), nome = novo.nome.trim()
    if (await tentar(() => adicionarCtt({ contratante_cod: cod, nome, faturamento_mensal: 0, contratante_pai: null }), `Contratante ${cod} incluído`)) {
      setNovo(null); setVerInativos(false); setSel(cod)
    }
  }

  return (
    <div className="box">
      <div className="row between">
        <div>
          <h2>Contratantes</h2>
          <p className="note">Escolha um contratante para ver o que ele exige: o que está no modelo padrão aparece como <span className="pill p-blue">Padrão</span>; o que é diferente, como <span className="pill p-warn">Extra</span>. Quem não atende mais pode ser <b>inativado</b>: sai das listas, mas o histórico (relatórios, medições, turnos) continua valendo.</p>
        </div>
        <button type="button" className={'btn sm' + (novo ? '' : ' solid')} onClick={() => setNovo(novo ? null : { cod: '', nome: '' })}>{novo ? 'Cancelar' : '+ Incluir contratante'}</button>
      </div>
      {novo && (
        <div className="selbar">
          <b>Novo contratante</b>
          <input type="text" autoFocus value={novo.cod} onChange={e => setNovo({ ...novo, cod: e.target.value })} placeholder="Código (igual ao do sistema)" style={{ width: 200 }} aria-label="Código" />
          <input type="text" value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome" style={{ flex: '1 1 220px' }} aria-label="Nome"
            onKeyDown={e => { if (e.key === 'Enter' && novo.cod.trim() && novo.nome.trim()) void criar() }} />
          <button type="button" className="btn sm solid" disabled={!novo.cod.trim() || !novo.nome.trim() || ctx.ctts.has(novo.cod.trim())} onClick={() => void criar()}>Incluir</button>
          {ctx.ctts.has(novo.cod.trim()) && <span className="note">Já existe um contratante com esse código{ctx.ctts.get(novo.cod.trim())?.ativo === false ? ' (inativo: reative-o na lista de inativos)' : ''}.</span>}
        </div>
      )}
      <div className="bases">
        <div className="cj-lista">
          <div className="cfgnav" style={{ margin: 0 }}>
            <button type="button" className={!verInativos ? 'on' : ''} onClick={() => setVerInativos(false)}>Ativos ({ctx.ctts.size - nInativos})</button>
            <button type="button" className={verInativos ? 'on' : ''} onClick={() => setVerInativos(true)}>Inativos ({nInativos})</button>
          </div>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar código ou nome" aria-label="Buscar contratante" />
          <select value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)} aria-label="Filtro">
            <option value="">Todos</option>
            <option value="extras">Com extras (fora do padrão)</option>
            <option value="falta">Faltando algo do padrão</option>
            <option value="vazio">Sem documentos</option>
          </select>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 640, overflow: 'auto' }}>
            {linhas.map(x => (
              <button key={x.c.contratante_cod} type="button" className={atual === x.c.contratante_cod ? 'on' : ''} onClick={() => setSel(x.c.contratante_cod)}
                style={x.c.ativo === false ? { opacity: 0.7 } : undefined}>
                <b><span className="mono">{x.c.contratante_cod}</span> · {x.c.nome}</b>
                <span className="note">{x.n ? `${x.n} doc(s)${base ? ` · ${x.extras} extra(s)${x.faltam > 0 ? ` · faltam ${x.faltam} do padrão` : ' · padrão completo'}` : ''}` : 'sem documentos'}</span>
              </button>
            ))}
            {!linhas.length && <p className="note">{verInativos ? 'Nenhum contratante inativo.' : 'Nenhum contratante encontrado.'}</p>}
          </div>
        </div>
        {atual
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              <CadastroCtt ctx={ctx} cod={atual} aoExcluir={() => setSel(null)} />
              <EditorDocsContratante key={atual} ctx={ctx} cod={atual} />
            </div>
          : <div className="empty">Escolha um contratante ao lado (ou inclua um novo).</div>}
      </div>
    </div>
  )
}

/** Faixa de cadastro do contratante escolhido: situacao, inativar/reativar e excluir. */
function CadastroCtt({ ctx, cod, aoExcluir }: { ctx: Ctx; cod: string; aoExcluir: () => void }) {
  const { d, salvarCtt, excluirCtt, tentar, irConfig } = useCs()
  const c = ctx.ctts.get(cod)
  if (!c) return null
  const ativo = c.ativo !== false
  const nTurnos = d.turnos.filter(t => t.contratante_cod === cod).length
  const nDocs = docsAtivosDoCtt(d.exig, cod).length
  return (
    <div className="selbar" style={ativo ? undefined : { background: 'var(--cs-tint2)', borderStyle: 'dashed' }}>
      {ativo ? <span className="pill p-good">✓ Ativo</span> : <span className="pill p-gray">Inativo</span>}
      <span className="note">{nTurnos} turno(s) · {nDocs} documento(s) exigido(s)</span>
      <span style={{ marginLeft: 'auto' }} className="row">
        <button type="button" className="btn sm" onClick={() => tentar(() => salvarCtt(cod, { ativo: !ativo }), ativo ? `${c.nome} inativado` : `${c.nome} reativado`)}
          title={ativo ? 'Sai das listas de escolha; relatórios, medições e turnos continuam valendo' : 'Volta para as listas'}>
          {ativo ? 'Inativar' : 'Reativar'}
        </button>
        <span title={nTurnos ? 'Tem turnos cadastrados: exclua ou mova os turnos antes (ou só inative)' : 'Apaga o cadastro do contratante'}>
          <BotaoConfirmar disabled={nTurnos > 0} onConfirm={() => void tentar(async () => { await excluirCtt(cod); aoExcluir() }, 'Contratante excluído')}>Excluir</BotaoConfirmar>
        </span>
        <button type="button" className="link" onClick={() => irConfig('ctt')}>faturamento e unidades</button>
      </span>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Pacotes de extras: so o que difere do modelo padrao
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
  const ctts = cttsAtivos(ctx)
  const paraAplicar = sel ? [...new Set([...(comBase ? base?.docs ?? [] : []), ...sel.docs])] : []

  return (
    <div className="box">
      <h2>Pacotes de extras</h2>
      <p className="note">Só o que é <b>diferente do modelo padrão</b>: documentos extras que vários contratantes exigem (ex.: &quot;Extras indústria alimentícia&quot;). Monte o pacote e aplique aos contratantes; quem recebe fica com o modelo padrão + esses extras.</p>
      <div className="bases">
        <div className="cj-lista">
          {grupos.map(c => (
            <button key={c.id} type="button" className={sel?.id === c.id ? 'on' : ''} onClick={() => { setSelId(c.id); setAplicar(false) }}>
              <b>{c.nome}</b><span className="note">{c.docs.filter(id => !baseSet.has(id)).length} extra(s){c.docs.some(id => baseSet.has(id)) ? ` · ${c.docs.filter(id => baseSet.has(id)).length} já no padrão` : ''}</span>
            </button>
          ))}
          {!grupos.length && <p className="note">Nenhum pacote ainda.</p>}
          <div className="tp-bloco">
            <input type="text" value={novo} onChange={e => setNovo(e.target.value)} placeholder="Nome (ex.: Extras indústria)" aria-label="Nome do novo pacote" />
            <button type="button" className="btn sm solid" disabled={!novo.trim()} onClick={async () => {
              const nome = novo.trim()
              await tentar(async () => { const id = await criarConjunto(nome); setSelId(id); setNovo('') }, `Pacote "${nome}" criado`)
            }}>+ Novo pacote</button>
          </div>
        </div>

        {sel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div className="row between">
              <input key={sel.id + sel.nome} type="text" defaultValue={sel.nome} aria-label="Nome do pacote" style={{ fontSize: 17, fontWeight: 800, flex: 1, minWidth: 220 }}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== sel.nome) void tentar(() => salvarConjunto(sel.id, { nome: v }), 'Nome salvo') }} />
              <div className="row">
                <button type="button" className="btn sm" onClick={() => tentar(async () => { const id = await criarConjunto(sel.nome + ' (cópia)', sel.docs, sel.descricao); setSelId(id) }, 'Pacote duplicado')}>Duplicar</button>
                <button type="button" className={'btn sm' + (aplicar ? ' solid' : '')} disabled={!sel.docs.length} onClick={() => setAplicar(!aplicar)}>Aplicar a contratantes</button>
                <BotaoConfirmar onConfirm={() => void tentar(async () => { await excluirConjunto(sel.id); setSelId(null) }, 'Pacote excluído')}>Excluir</BotaoConfirmar>
              </div>
            </div>
            <input key={sel.id + 'd' + (sel.descricao ?? '')} type="text" defaultValue={sel.descricao ?? ''} placeholder="Descrição (opcional): para quem serve este pacote" aria-label="Descrição"
              onBlur={e => { const v = e.target.value.trim() || null; if (v !== sel.descricao) void tentar(() => salvarConjunto(sel.id, { descricao: v })) }} />

            {jaNaBase.length > 0 && (
              <div className="selbar">
                <span>{jaNaBase.length} documento(s) deste pacote já estão no modelo padrão e não precisam ficar aqui.</span>
                <button type="button" className="btn sm solid" onClick={() => tentar(() => docsConjunto(sel.id, [], jaNaBase), `${jaNaBase.length} documento(s) do padrão retirado(s) do pacote`)}>Deixar só os extras</button>
              </div>
            )}

            {aplicar && <>
              <label className="row note" style={{ gap: 6 }}>
                <input type="checkbox" checked={comBase} disabled={!base} onChange={e => setComBase(e.target.checked)} />
                Incluir também o modelo padrão ({base?.docs.length ?? 0} documentos) · total: {paraAplicar.length} documento(s)
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
            <TabelaPorTipo ctx={ctx} ids={sel.docs} vazio="Pacote vazio. Inclua os documentos extras acima ou traga os de um contratante."
              tempoDe={id => tempoNoGrupo(ctx, grupoPadrao(ctx)?.id ?? '', id, 'aprovado')}
              extra={{ titulo: '', cel: id => (baseSet.has(id) ? <span className="pill p-gray" title="Já está no modelo padrão">já no padrão</span> : null) }}
              acao={id => <button type="button" className="btn sm bad" onClick={() => tentar(() => docsConjunto(sel.id, [], [id]), 'Documento retirado do pacote')}>Retirar</button>}
            />
            {sel.docs.length > 0 && <Calculadora key={sel.id} ctx={ctx} docs={[...new Set([...(base?.docs ?? []), ...sel.docs])]} titulo={`Calculadora: modelo padrão + ${sel.nome}`} />}
          </div>
        ) : <div className="empty">Crie o primeiro pacote ao lado.</div>}
      </div>
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════════════════
// Base: nivel de venda (perk). Abre com os cards das bases; cada base abre um card
// "Documentos base" onde se inclui/retira documento vendo quanto tempo isso muda.
// ═════════════════════════════════════════════════════════════════════════════
type Resumo = { impl: number; mes: number; n: number; semTempo: number }
/** Soma por tipo: implantacao (avaliar tudo uma vez) e recorrencia mensal (vencimentos), em minutos por unidade. */
function resumoTempos(ctx: Ctx, gId: string, ids: string[]): Record<'empresa' | 'pessoa', Resumo> {
  const r = { empresa: { impl: 0, mes: 0, n: 0, semTempo: 0 }, pessoa: { impl: 0, mes: 0, n: 0, semTempo: 0 } }
  for (const id of new Set(ids)) {
    const doc = ctx.docs.get(id)
    if (doc?.tipo !== 'empresa' && doc?.tipo !== 'pessoa') continue
    const t = tempoNoGrupo(ctx, gId, id, 'aprovado').val
    const s = r[doc.tipo]
    s.n++
    if (t == null) { s.semTempo++; continue }
    s.impl += t
    s.mes += t * porMes(doc.validade_dias)
  }
  return r
}

/** Previa: como a base fica com os documentos incluidos (ou retirados). */
function ImpactoBase({ ctx, gId, atuais, mudanca, retirar }: { ctx: Ctx; gId: string; atuais: string[]; mudanca: string[]; retirar?: boolean }) {
  const tm = useTempo()
  const antes = resumoTempos(ctx, gId, atuais)
  const depois = resumoTempos(ctx, gId, retirar ? atuais.filter(id => !mudanca.includes(id)) : [...atuais, ...mudanca])
  const linha = (tipo: 'empresa' | 'pessoa', k: 'impl' | 'mes', rot: string) => {
    const a = antes[tipo][k], b = depois[tipo][k], dlt = b - a
    if (Math.abs(dlt) < 0.05) return null
    const pct = a > 0 ? ` (${dlt > 0 ? '+' : ''}${fmt((dlt / a) * 100, 0)}%)` : ''
    return (
      <div key={tipo + k}>
        {rot}: {tm.mu(a, 1)} → <b>{tm.mu(b, 1)}</b>{' '}
        <span className={dlt > 0 ? 'mais' : 'menos'}>{dlt > 0 ? '+' : '−'}{tm.mu(Math.abs(dlt), 1)}{pct}</span>
      </div>
    )
  }
  const linhas = [
    linha('empresa', 'impl', 'Implantação por empresa'),
    linha('pessoa', 'impl', 'Implantação por funcionário'),
    linha('empresa', 'mes', 'Por mês, por empresa'),
    linha('pessoa', 'mes', 'Por mês, por funcionário'),
  ].filter(Boolean)
  const semTempo = mudanca.filter(id => ctx.docs.get(id)?.tipo && tempoNoGrupo(ctx, gId, id, 'aprovado').val == null).length
  const semTipo = mudanca.filter(id => !ctx.docs.get(id)?.tipo).length
  return (
    <div className="impacto">
      <b>{retirar ? 'Retirando' : 'Incluindo'} {mudanca.length} documento(s), a base passa a demandar:</b>
      {linhas.length ? linhas : <div className="note">Sem mudança de tempo calculável.</div>}
      {semTempo > 0 && <div className="note">{semTempo} documento(s) ainda sem tempo cronometrado: entram na conta quando o Cronometrar validar.</div>}
      {semTipo > 0 && <div className="note">{semTipo} documento(s) sem tipo (empresa/funcionário) ficam fora da conta.</div>}
    </div>
  )
}

/** Diferenca de um modelo para o padrao: o que tem a mais e o que tirou. */
function diferenca(p: Conjunto, padrao: Conjunto | null) {
  if (!padrao || padrao.id === p.id) return { mais: [] as string[], menos: [] as string[], iguais: p.docs }
  const ps = new Set(padrao.docs), ms = new Set(p.docs)
  return { mais: p.docs.filter(id => !ps.has(id)), menos: padrao.docs.filter(id => !ms.has(id)), iguais: p.docs.filter(id => ps.has(id)) }
}

/** Compara o tempo (implantacao e mes, por empresa e por funcionario) de um conjunto de documentos com o padrao. */
function ComparaPadrao({ ctx, gId, padrao, ids }: { ctx: Ctx; gId: string; padrao: Conjunto; ids: string[] }) {
  const tm = useTempo()
  const fin = financeiro(ctx.cfg)
  const a = resumoTempos(ctx, gId, padrao.docs), b = resumoTempos(ctx, gId, ids)
  const linha = (tipo: 'empresa' | 'pessoa', k: 'impl' | 'mes', rot: string) => {
    const va = a[tipo][k], vb = b[tipo][k], dlt = vb - va
    return (
      <tr key={tipo + k}>
        <td>{rot}</td>
        <td className="r mono">{tm.mu(va, 1)}</td>
        <td className="r mono"><b>{tm.mu(vb, 1)}</b></td>
        <td className="r mono">{Math.abs(dlt) < 0.05 ? <span className="note">igual</span>
          : <span style={{ color: dlt > 0 ? 'var(--cs-bad)' : 'var(--cs-good)', fontWeight: 800 }}>{dlt > 0 ? '+' : '−'}{tm.mu(Math.abs(dlt), 1)}{va > 0 ? ` (${dlt > 0 ? '+' : ''}${fmt((dlt / va) * 100, 0)}%)` : ''}</span>}</td>
        {fin.ok && <td className="r mono">{brl((vb / 60) * fin.hmin)}</td>}
      </tr>
    )
  }
  return (
    <div className="tbl">
      <table>
        <thead><tr><th>Tempo por unidade</th><th className="r">{padrao.nome} (padrão)</th><th className="r">Este modelo</th><th className="r">Diferença</th>{fin.ok && <th className="r" title="Preço mínimo (hora mínima com a margem desejada)">Preço mínimo</th>}</tr></thead>
        <tbody>
          {linha('empresa', 'impl', 'Implantação, por empresa')}
          {linha('pessoa', 'impl', 'Implantação, por funcionário')}
          {linha('empresa', 'mes', 'Por mês, por empresa (vencimentos)')}
          {linha('pessoa', 'mes', 'Por mês, por funcionário (vencimentos)')}
        </tbody>
      </table>
    </div>
  )
}

function BaseVenda({ ctx }: { ctx: Ctx }) {
  const { d } = useCs()
  const [aberta, setAberta] = useState<string | null>(null)
  const perks = d.conjuntos.filter(c => c.perk).sort((a, b) => a.ordem - b.ordem)
  const padrao = perks[0] ?? null
  const g = grupoPadrao(ctx)
  const tm = useTempo()
  const fin = financeiro(ctx.cfg)
  const atual = aberta && aberta !== 'nova' ? perks.find(p => p.id === aberta) ?? null : null

  if (aberta === 'nova') return <NovaBase ctx={ctx} perks={perks} voltar={id => setAberta(id)} />
  if (atual) return <DetalheBase ctx={ctx} p={atual} padrao={padrao} voltar={() => setAberta(null)} />

  return (
    <div className="box">
      <div className="row between">
        <div>
          <h2>Modelos de venda</h2>
          <p className="note">Um modelo é o pacote de documentos que você vende. O <b>padrão</b> é a referência; para criar outro modelo, parta do padrão e acrescente (ou tire) documentos. Tempo e preço atualizam sozinhos conforme o Cronometrar valida medições.</p>
        </div>
        <button type="button" className="btn solid" onClick={() => setAberta('nova')}>+ Novo modelo</button>
      </div>
      {!perks.length && (
        <div className="warnbox">Nenhum modelo ainda. Crie o primeiro em &quot;+ Novo modelo&quot;: ele vira o padrão (ou rode <b>sql/custo-servir-base-perks.sql</b> para criar a Base com 13 documentos de empresa e 3 de funcionário).</div>
      )}
      <div className="base-grid">
        {perks.map((p, i) => {
          const r = g ? resumoTempos(ctx, g.id, p.docs) : null
          const prontos = g ? p.docs.filter(id => situacaoDoc(ctx, g.id, id) === 'pronto').length : 0
          const dif = diferenca(p, padrao)
          return (
            <button key={p.id} type="button" className="base-card" onClick={() => setAberta(p.id)}
              style={i === 0 ? { borderColor: 'var(--cs-gold)', background: '#FFFCF6' } : undefined}>
              <div>
                <span className="eyebrow">{i === 0 ? '★ Modelo padrão' : 'Variação do padrão'}</span>
                <h3>📦 {p.nome}</h3>
                {p.descricao && <span className="note">{p.descricao}</span>}
              </div>
              {i > 0 && (
                <span className="pills">
                  <span className="pill p-gray">{padrao?.nome ?? 'padrão'}</span>
                  {dif.mais.length > 0 && <span className="pill p-warn">+ {dif.mais.length} doc(s)</span>}
                  {dif.menos.length > 0 && <span className="pill p-blue">− {dif.menos.length} doc(s)</span>}
                  {!dif.mais.length && !dif.menos.length && <span className="note">igual ao padrão</span>}
                </span>
              )}
              <div className="mini">
                <div><b>{r?.empresa.n ?? 0}</b><span>docs da empresa{r ? ` · ${tm.mu(r.empresa.impl, 0)}` : ''}{fin.ok && r ? ` · ${brl((r.empresa.impl / 60) * fin.hmin)}` : ''}</span></div>
                <div><b>{r?.pessoa.n ?? 0}</b><span>docs por funcionário{r ? ` · ${tm.mu(r.pessoa.impl, 0)}` : ''}{fin.ok && r ? ` · ${brl((r.pessoa.impl / 60) * fin.hmin)}` : ''}</span></div>
              </div>
              <div className="prog" title="Documentos com tempo pronto"><i style={{ width: (p.docs.length ? (prontos / p.docs.length) * 100 : 0) + '%' }} /></div>
              <span className="note">{prontos}/{p.docs.length} com tempo pronto · <b style={{ color: 'var(--cs-edge)' }}>Abrir →</b></span>
            </button>
          )
        })}
        <button type="button" className="base-card nova" onClick={() => setAberta('nova')}>
          <span style={{ fontSize: 26 }}>＋</span>
          Novo modelo
          <span className="note" style={{ fontWeight: 400 }}>{padrao ? `parte do ${padrao.nome} e você acrescenta o que muda` : 'o primeiro vira o padrão'}</span>
        </button>
      </div>
      {fin.ok && <p className="note">Valores em R$ = preço mínimo da implantação por unidade (hora mínima com margem de {fmt(ctx.cfg.margem_desejada)}%). Para simular quantidades, abra o modelo.</p>}
    </div>
  )
}

/** Fontes para copiar documentos: outros modelos de venda e pacotes de extras. */
function SelFonte({ d, valor, setValor, sem }: { d: ReturnType<typeof useCs>['d']; valor: string; setValor: (v: string) => void; sem?: string }) {
  const perks = d.conjuntos.filter(c => c.perk && c.id !== sem).sort((a, b) => a.ordem - b.ordem)
  const grupos = d.conjuntos.filter(c => !c.perk && c.id !== sem)
  return (
    <select value={valor} onChange={e => setValor(e.target.value)} aria-label="Copiar documentos de">
      <option value="">escolha…</option>
      {perks.length > 0 && <optgroup label="Modelos de venda">{perks.map(c => <option key={c.id} value={c.id}>★ {c.nome} ({c.docs.length})</option>)}</optgroup>}
      {grupos.length > 0 && <optgroup label="Pacotes de extras">{grupos.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.docs.length})</option>)}</optgroup>}
    </select>
  )
}

/** Lista de documentos para marcar (importacao). */
function MarcarDocs({ ctx, ids, sel, setSel }: { ctx: Ctx; ids: string[]; sel: Set<string>; setSel: (s: Set<string>) => void }) {
  return <>
    <div className="row">
      <button type="button" className="btn sm" onClick={() => setSel(new Set(ids))}>Todos</button>
      <button type="button" className="btn sm" onClick={() => setSel(new Set())}>Nenhum</button>
      <span className="note">{sel.size} de {ids.length} marcado(s)</span>
    </div>
    <div className="tp-lista tp-grid" style={{ maxHeight: 280 }}>
      {[...ids].sort(porNome(ctx)).map(id => (
        <label key={id}>
          <input type="checkbox" checked={sel.has(id)} onChange={e => { const n = new Set(sel); if (e.target.checked) n.add(id); else n.delete(id); setSel(n) }} />
          <span>{ctx.docs.get(id)?.nome ?? '—'} <span className="note">· {tipoCurto(ctx.docs.get(id)?.tipo)}</span></span>
        </label>
      ))}
    </div>
  </>
}

function NovaBase({ ctx, perks, voltar }: { ctx: Ctx; perks: Conjunto[]; voltar: (id: string | null) => void }) {
  const { criarConjunto, tentar } = useCs()
  const padrao = perks[0] ?? null
  const [nome, setNome] = useState('')
  const [desc, setDesc] = useState('')
  // Ponto de partida: id de um modelo existente ('' = vazio). Comeca no padrao.
  const [fonte, setFonte] = useState(padrao?.id ?? '')
  const docsFonte = perks.find(c => c.id === fonte)?.docs ?? []
  const [tirar, setTirar] = useState<Set<string>>(new Set())
  const [extras, setExtras] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const g = grupoPadrao(ctx)
  const herdados = docsFonte.filter(id => !tirar.has(id))
  const finais = [...new Set([...herdados, ...extras])]

  return (
    <div className="box">
      <div className="row between">
        <h2>Novo modelo de venda</h2>
        <button type="button" className="btn sm" onClick={() => voltar(null)}>← Todos os modelos</button>
      </div>

      <div className="ep-passo">
        <span className="ep-num">1</span>
        <div>
          <b>Nome do modelo</b>
          <div className="kv">
            <label>Nome<input type="text" autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="ex.: Completo, Indústria" /></label>
            <label style={{ flex: '1 1 320px' }}>Descrição (opcional)<input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="o que este modelo cobre, para quem vende" /></label>
          </div>
        </div>
      </div>

      <div className="ep-passo">
        <span className="ep-num">2</span>
        <div>
          <b>Partir de</b>
          <div className="row">
            {perks.map((p, i) => (
              <label key={p.id} className="row note" style={{ gap: 6 }}>
                <input type="radio" name="fonte" checked={fonte === p.id} onChange={() => { setFonte(p.id); setTirar(new Set()) }} />
                {p.nome}{i === 0 ? ' (padrão, recomendado)' : ''} · {p.docs.length} doc(s)
              </label>
            ))}
            <label className="row note" style={{ gap: 6 }}>
              <input type="radio" name="fonte" checked={fonte === ''} onChange={() => { setFonte(''); setTirar(new Set()) }} />
              Começar vazio
            </label>
          </div>
          {docsFonte.length > 0 && (
            <details>
              <summary className="note" style={{ cursor: 'pointer' }}>Vêm {herdados.length} de {docsFonte.length} documento(s). Quer tirar algum? (opcional)</summary>
              <MarcarDocs ctx={ctx} ids={docsFonte} sel={new Set(herdados)} setSel={s => setTirar(new Set(docsFonte.filter(id => !s.has(id))))} />
            </details>
          )}
        </div>
      </div>

      <div className="ep-passo">
        <span className="ep-num">3</span>
        <div>
          <b>Acrescentar documentos (o que este modelo tem a mais)</b>
          {extras.length > 0 && (
            <div className="row">
              {extras.map(id => (
                <span key={id} className="selbar" style={{ padding: '2px 8px' }}>
                  {ctx.docs.get(id)?.nome ?? id}
                  <button type="button" className="link" aria-label="Tirar" onClick={() => setExtras(extras.filter(x => x !== id))}>×</button>
                </span>
              ))}
            </div>
          )}
          <SeletorDocs ctx={ctx} jaTem={new Set(finais)} rotulo={extras.length ? '+ Acrescentar mais' : '+ Acrescentar documentos'}
            onIncluir={async ids => { setExtras(prev => [...new Set([...prev, ...ids])]); return true }} />
        </div>
      </div>

      {padrao && g && finais.length > 0 && <>
        <b>Como fica comparado ao padrão</b>
        <ComparaPadrao ctx={ctx} gId={g.id} padrao={padrao} ids={finais} />
      </>}

      <div className="row">
        <button type="button" className="btn solid" disabled={ocupado || !nome.trim()} onClick={async () => {
          setOcupado(true)
          let id = ''
          const okk = await tentar(async () => {
            id = await criarConjunto(nome.trim(), finais, desc.trim() || null, { ordem: Math.max(0, ...perks.map(p => p.ordem)) + 1 })
          }, `Modelo "${nome.trim()}" criado com ${finais.length} documento(s)`)
          setOcupado(false)
          if (okk) voltar(id)
        }}>Criar modelo com {finais.length} documento(s)</button>
        <button type="button" className="btn" onClick={() => voltar(null)}>Cancelar</button>
      </div>
    </div>
  )
}

function DetalheBase({ ctx, p, padrao, voltar }: { ctx: Ctx; p: Conjunto; padrao: Conjunto | null; voltar: () => void }) {
  const { d, docsConjunto, salvarConjunto, excluirConjunto, tentar } = useCs()
  const tm = useTempo()
  const principal = padrao?.id === p.id
  const g = grupoPadrao(ctx)
  const docsSet = new Set(p.docs)
  const prontos = p.docs.filter(id => g && situacaoDoc(ctx, g.id, id) === 'pronto').length
  const pct = p.docs.length ? (prontos / p.docs.length) * 100 : 0
  const r = g ? resumoTempos(ctx, g.id, p.docs) : null
  const dif = diferenca(p, padrao)
  const padraoSet = new Set(padrao?.docs ?? [])
  const [importar, setImportar] = useState(false)
  const [fonte, setFonte] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [verCusto, setVerCusto] = useState(false)
  const candidatos = (d.conjuntos.find(c => c.id === fonte)?.docs ?? []).filter(id => !docsSet.has(id))
  const tempoDoc = (id: string) => (g ? tempoNoGrupo(ctx, g.id, id, 'aprovado').val : null)
  const nomeDoc = (id: string) => ctx.docs.get(id)?.nome ?? '—'
  const perks = d.conjuntos.filter(c => c.perk)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <button type="button" className="btn sm" onClick={voltar}>← Todos os modelos</button>
        <div className="row">
          {!principal && (
            <BotaoConfirmar className="btn sm" onConfirm={() => void tentar(() => salvarConjunto(p.id, { ordem: Math.min(...perks.map(c => c.ordem)) - 1 }), `"${p.nome}" agora é o modelo padrão`)}>
              ★ Tornar padrão
            </BotaoConfirmar>
          )}
          <BotaoConfirmar disabled={principal} onConfirm={() => void tentar(async () => { await excluirConjunto(p.id); voltar() }, `Modelo "${p.nome}" excluído`)}>
            {principal ? 'Padrão (não exclui)' : 'Excluir modelo'}
          </BotaoConfirmar>
        </div>
      </div>

      <div className="box" style={principal ? { borderColor: 'var(--cs-gold)' } : undefined}>
        <div>
          <span className="eyebrow">{principal ? '★ Modelo padrão (referência dos outros modelos e dos contratantes)' : `Variação do padrão (${padrao?.nome ?? '—'})`}</span>
          <input key={p.id + p.nome} type="text" defaultValue={p.nome} aria-label="Nome do modelo" style={{ fontSize: 20, fontWeight: 900, minWidth: 220, width: '100%' }}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.nome) void tentar(() => salvarConjunto(p.id, { nome: v }), 'Nome salvo') }} />
        </div>
        <input key={p.id + 'd' + (p.descricao ?? '')} type="text" defaultValue={p.descricao ?? ''} placeholder="Descrição para a venda (ex.: o essencial para entrar no portal)" aria-label="Descrição"
          onBlur={e => { const v = e.target.value.trim() || null; if (v !== p.descricao) void tentar(() => salvarConjunto(p.id, { descricao: v })) }} />
        <div className="tiles">
          <div className="tile"><b>{r?.empresa.n ?? 0}</b><span>docs da empresa · {r ? tm.mu(r.empresa.impl, 1) : '—'} por empresa</span></div>
          <div className="tile"><b>{r?.pessoa.n ?? 0}</b><span>docs por funcionário · {r ? tm.mu(r.pessoa.impl, 1) : '—'} por funcionário</span></div>
          <div className="tile"><b>{prontos}/{p.docs.length}</b><span>com tempo pronto (≥ {ctx.cfg.minimo} medições no grupo padrão)</span></div>
        </div>
        <div className="prog" title="Documentos do modelo com tempo pronto"><i style={{ width: pct + '%' }} /></div>
      </div>

      {!principal && padrao && (
        <div className="box">
          <h2>O que muda em relação ao {padrao.nome}</h2>
          <p className="note">Este modelo = {padrao.nome} ({dif.iguais.length} documento(s) iguais) {dif.mais.length ? `+ ${dif.mais.length} a mais` : ''}{dif.mais.length && dif.menos.length ? ' ' : ''}{dif.menos.length ? `− ${dif.menos.length} tirado(s)` : ''}{!dif.mais.length && !dif.menos.length ? '. Ainda está igual ao padrão: acrescente documentos abaixo.' : '.'}</p>
          <div className="grid2">
            <div className="tp-bloco">
              <b>+ A mais que o padrão ({dif.mais.length})</b>
              {dif.mais.length ? [...dif.mais].sort(porNome(ctx)).map(id => (
                <div key={id} className="row between">
                  <span>{nomeDoc(id)} <span className="note">· {tipoCurto(ctx.docs.get(id)?.tipo)}</span></span>
                  <button type="button" className="btn sm bad" onClick={() => tentar(() => docsConjunto(p.id, [], [id]), 'Documento retirado')}>Retirar</button>
                </div>
              )) : <span className="note">Nada a mais.</span>}
            </div>
            <div className="tp-bloco">
              <div className="row between">
                <b>− Tirados do padrão ({dif.menos.length})</b>
                {dif.menos.length > 1 && <button type="button" className="btn sm" onClick={() => tentar(() => docsConjunto(p.id, dif.menos), `${dif.menos.length} documento(s) recolocado(s)`)}>Recolocar todos</button>}
              </div>
              {dif.menos.length ? [...dif.menos].sort(porNome(ctx)).map(id => (
                <div key={id} className="row between">
                  <span>{nomeDoc(id)} <span className="note">· {tipoCurto(ctx.docs.get(id)?.tipo)}</span></span>
                  <button type="button" className="btn sm" onClick={() => tentar(() => docsConjunto(p.id, [id]), 'Documento recolocado')}>Recolocar</button>
                </div>
              )) : <span className="note">Tem tudo o que o padrão tem.</span>}
            </div>
          </div>
          {g && <ComparaPadrao ctx={ctx} gId={g.id} padrao={padrao} ids={p.docs} />}
        </div>
      )}

      <div className="box">
        <div className="row between">
          <div>
            <h2>📄 Documentos do modelo ({p.docs.length})</h2>
            <p className="note">Ao escolher documentos, você vê antes de confirmar quanto tempo a mais o modelo passa a demandar.</p>
          </div>
          <div className="row">
            <SeletorDocs ctx={ctx} jaTem={docsSet} rotulo="+ Acrescentar documento"
              impacto={g ? ids => <ImpactoBase ctx={ctx} gId={g.id} atuais={p.docs} mudanca={ids} /> : undefined}
              onIncluir={ids => tentar(() => docsConjunto(p.id, ids), `${ids.length} documento(s) incluído(s) em ${p.nome}`)} />
            <button type="button" className={'btn sm' + (importar ? ' solid' : '')} onClick={() => { setImportar(!importar); setFonte(''); setSel(new Set()) }}>Copiar de outro modelo ou pacote</button>
          </div>
        </div>

        {importar && (
          <div className="tp-bloco">
            <div className="row">
              <b>Copiar de</b>
              <SelFonte d={d} valor={fonte} sem={p.id} setValor={f => { setFonte(f); setSel(new Set((d.conjuntos.find(c => c.id === f)?.docs ?? []).filter(id => !docsSet.has(id)))) }} />
              {fonte && <span className="note">{candidatos.length} documento(s) que este modelo ainda não tem</span>}
            </div>
            {fonte && candidatos.length > 0 && <>
              <MarcarDocs ctx={ctx} ids={candidatos} sel={sel} setSel={setSel} />
              {g && sel.size > 0 && <ImpactoBase ctx={ctx} gId={g.id} atuais={p.docs} mudanca={[...sel]} />}
              <div className="row">
                <button type="button" className="btn solid" disabled={!sel.size} onClick={async () => {
                  if (await tentar(() => docsConjunto(p.id, [...sel]), `${sel.size} documento(s) copiado(s)`)) { setImportar(false); setFonte(''); setSel(new Set()) }
                }}>Copiar {sel.size} documento(s)</button>
              </div>
            </>}
          </div>
        )}

        <TabelaPorTipo ctx={ctx} ids={p.docs} vazio="Nenhum documento neste modelo. Use “+ Acrescentar documento” ou copie de outro modelo."
          tempoDe={id => (g ? { val: tempoDoc(id), n: stat(ctx, g.id, id, 'aprovado').n } : { val: null })}
          extra={{
            titulo: principal ? 'Situação' : 'Origem · situação',
            cel: id => (
              <span className="pills">
                {!principal && (padraoSet.has(id) ? <span className="pill p-gray">do padrão</span> : <span className="pill p-warn">a mais</span>)}
                {g && <><PillSituacao s={situacaoDoc(ctx, g.id, id)} /><span className="note mono">{stat(ctx, g.id, id, 'aprovado').n}/{ctx.cfg.minimo}</span></>}
              </span>
            ),
          }}
          acao={id => {
            const t = tempoDoc(id)
            return (
              <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                {t != null && <span className="note mono" title="Quanto o modelo deixa de demandar (por unidade)">−{tm.mu(t, 1)}</span>}
                <BotaoConfirmar onConfirm={() => void tentar(() => docsConjunto(p.id, [], [id]), `Documento retirado de ${p.nome}`)}>Retirar</BotaoConfirmar>
              </span>
            )
          }}
        />
      </div>

      {p.docs.length > 0 && (
        <div className="box">
          <div className="row between">
            <h2>💰 Quanto custa o {p.nome}</h2>
            <button type="button" className="btn sm" onClick={() => setVerCusto(!verCusto)}>{verCusto ? 'Esconder calculadora' : 'Simular por quantidade'}</button>
          </div>
          {verCusto && <Calculadora key={p.id} ctx={ctx} docs={p.docs} titulo="Simule por quantidade de empresas e funcionários" />}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Aba Documentos e bases: abas no topo (abre em Modelos de venda) + guia rapido
// ═════════════════════════════════════════════════════════════════════════════
const PASSO_DESC: Record<Passo, string> = {
  base: 'O modelo padrão e as variações que você vende, com tempo e preço.',
  ctt: 'O que cada contratante exige (padrão + extras) e o cadastro: incluir, inativar, excluir.',
  grupos: 'Extras que vários contratantes pedem além do padrão.',
  docs: 'O catálogo: de onde todos os documentos vêm (tipo, validade).',
}

export default function Bases() {
  const { ctx, d } = useCs()
  const [passo, setPassoSt] = useState<Passo>(() => {
    try { const v = typeof window !== 'undefined' ? localStorage.getItem(LS_PASSO) : null; return PASSOS.some(([k]) => k === v) ? v as Passo : 'base' } catch { return 'base' }
  })
  if (!ctx) return null
  const ir = (p: Passo) => { setPassoSt(p); try { localStorage.setItem(LS_PASSO, p) } catch { /* ignore */ } }
  const perks = d.conjuntos.filter(c => c.perk)
  const nAtivos = [...ctx.ctts.values()].filter(c => c.ativo !== false).length
  const contagem: Record<Passo, string> = {
    base: `${perks.length}`,
    ctt: `${nAtivos}`,
    grupos: `${d.conjuntos.length - perks.length}`,
    docs: `${ctx.docs.size}`,
  }

  return (
    <>
      <details className="tp-bloco">
        <summary style={{ cursor: 'pointer' }}><b>Como esta tela funciona</b> <span className="note">(para quem está chegando)</span></summary>
        <ol className="note" style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li><b>Catálogo de documentos</b>: a lista de todos os documentos (com tipo empresa/funcionário e validade). Tudo puxa daqui.</li>
          <li><b>Modelos de venda</b>: o <b>modelo padrão</b> é o pacote básico. Para vender algo diferente, crie outro modelo partindo do padrão e acrescente (ou tire) documentos. A tela mostra a diferença e quanto tempo/preço muda.</li>
          <li><b>Pacotes de extras</b>: documentos além do padrão que vários contratantes pedem; aplique de uma vez em vários.</li>
          <li><b>Contratantes</b>: o que cada um exige = padrão + extras. Aqui também se inclui, inativa (não atende mais) ou exclui contratante.</li>
        </ol>
        <p className="note" style={{ marginTop: 6 }}>Os tempos vêm do Cronometrar e atualizam sozinhos.</p>
      </details>
      <div className="cfgnav">
        {PASSOS.map(([k, l]) => (
          <button key={k} type="button" className={k === passo ? 'on' : ''} onClick={() => ir(k)} title={PASSO_DESC[k]}>{l} <span className="mono">({contagem[k]})</span></button>
        ))}
      </div>
      {passo === 'docs' && <Catalogo ctx={ctx} />}
      {passo === 'ctt' && <HubContratantes ctx={ctx} />}
      {passo === 'grupos' && <GruposContratantes ctx={ctx} />}
      {passo === 'base' && <BaseVenda ctx={ctx} />}
    </>
  )
}
