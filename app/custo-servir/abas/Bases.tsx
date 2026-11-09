'use client'

// Bases prontas: conjuntos de documentos reutilizaveis ("starter pack") com a calculadora de quanto tempo
// eles demandam, e o editor dos documentos de cada contratante (importar de outro contratante ou de um
// conjunto, salvar como conjunto e aplicar a outros contratantes).

import { useId, useMemo, useState } from 'react'
import { useCs } from '../cs-data'
import {
  brl, financeiro, fmt, grupoDe, grupoPadrao, nomeCtt, norm, porMes, rotuloValidade, tempoCtt, tempoNoGrupo, VALIDADES,
  type Ctx,
} from '../cs-lib'
import { BotaoConfirmar } from '../cs-ui'

const rotuloDoc = (ctx: Ctx, id: string) => { const x = ctx.docs.get(id); return x ? (x.codigo ? x.codigo + ' · ' : '') + x.nome : '' }
const tipoCurto = (t: string | null | undefined) => (t === 'pessoa' ? 'Pessoa' : t === 'empresa' ? 'Empresa' : '—')

/** Campo com lista de documentos do catalogo (nome ou codigo). */
function EscolherDoc({ ctx, excluir, onEscolher, placeholder = '+ documento do catálogo (nome ou código)' }: {
  ctx: Ctx; excluir: Set<string>; onEscolher: (id: string) => void; placeholder?: string
}) {
  const id = useId()
  const [txt, setTxt] = useState('')
  const docs = useMemo(() => [...ctx.docs.values()].filter(x => !excluir.has(x.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [ctx.docs, excluir])
  const achar = () => docs.find(x => rotuloDoc(ctx, x.id) === txt.trim() || x.codigo === txt.trim() || norm(x.nome) === norm(txt))
  const ok = () => { const d = achar(); if (d) { onEscolher(d.id); setTxt('') } }
  return (
    <div className="row" style={{ flex: 1, minWidth: 260 }}>
      <input list={id} value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ok() }} placeholder={placeholder} style={{ flex: 1, minWidth: 220 }} aria-label="Documento" />
      <datalist id={id}>{docs.map(x => <option key={x.id} value={rotuloDoc(ctx, x.id)} />)}</datalist>
      <button type="button" className="btn sm solid" disabled={!achar()} onClick={ok}>Incluir</button>
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
        <span className="note">{sel.size} marcado(s)</span>
        <button type="button" className="btn sm" onClick={() => setSel(new Set())}>Limpar</button>
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

// ═════════════════════════════════════════════════════════════════════════════
// Calculadora: quanto tempo um conjunto de documentos demanda
// ═════════════════════════════════════════════════════════════════════════════
export function Calculadora({ ctx, docs, grupoInicial }: { ctx: Ctx; docs: string[]; grupoInicial?: string }) {
  const { atualizarDoc, tentar } = useCs()
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
  })
  const ok = linhas.filter(l => l.ciclo != null && l.doc?.tipo)
  const semTempo = linhas.filter(l => l.ciclo == null), semTipo = linhas.filter(l => l.ciclo != null && !l.doc?.tipo)
  const semValidade = ok.filter(l => l.doc?.validade_dias == null)
  const hImpl = ok.reduce((a, l) => a + (l.implant ?? 0), 0) / 60
  const hMes = ok.reduce((a, l) => a + (l.mensal ?? 0), 0) / 60
  const grupos = [...ctx.grupos].sort((a, b) => (a.padrao === b.padrao ? a.nome.localeCompare(b.nome, 'pt-BR') : a.padrao ? -1 : 1))
  return (
    <div className="tp-bloco padrao">
      <b>Calculadora: quanto esse conjunto demanda</b>
      <div className="kv">
        <label>Critério (grupo)
          <select value={g} onChange={e => setG(e.target.value)}>{grupos.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
        </label>
        <label>Empresas<input type="number" min={0} value={empresas} onChange={e => setEmpresas(Math.max(0, +e.target.value || 0))} /></label>
        <label>Pessoas<input type="number" min={0} value={pessoas} onChange={e => setPessoas(Math.max(0, +e.target.value || 0))} /></label>
        <label>Pessoas novas por mês<input type="number" min={0} value={admissoes} onChange={e => setAdmissoes(Math.max(0, +e.target.value || 0))} /></label>
        <label>Reprovação (%)<input type="number" min={0} max={90} value={pRep} onChange={e => setPRep(Math.max(0, Math.min(90, +e.target.value || 0)))} /></label>
      </div>
      <div className="tiles">
        <div className="tile"><b>{fmt(hImpl, 1)} h</b><span>implantação (avaliar tudo uma vez)</span></div>
        <div className="tile"><b>{fmt(hMes, 1)} h</b><span>por mês (vencimentos + pessoas novas)</span></div>
        <div className="tile"><b>{fin.ok ? brl(hMes * fin.ch) : '—'}</b><span>custo por mês{fin.ok ? '' : ' (preencha a aba Resultado)'}</span></div>
        <div className="tile"><b>{fin.ok ? brl(hMes * fin.hmin) : '—'}</b><span>preço mínimo por mês (margem {fmt(ctx.cfg.margem_desejada)}%)</span></div>
        <div className="tile"><b>{fin.ok ? brl(hImpl * fin.hmin) : '—'}</b><span>preço mínimo da implantação</span></div>
      </div>
      {(semTempo.length > 0 || semTipo.length > 0 || semValidade.length > 0) && (
        <div className="warnbox">
          {semTempo.length > 0 && <div>{semTempo.length} documento(s) sem tempo cronometrado ficaram fora da conta.</div>}
          {semTipo.length > 0 && <div>{semTipo.length} documento(s) sem tipo (empresa/pessoa) ficaram fora; classifique no Catálogo.</div>}
          {semValidade.length > 0 && <div>{semValidade.length} documento(s) sem validade: só entram na implantação e nas pessoas novas. Defina a validade abaixo.</div>}
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
                <td>
                  <select value={l.doc?.validade_dias ?? ''} aria-label="Validade" onChange={e => tentar(() => atualizarDoc(l.id, { validade_dias: e.target.value === '' ? null : +e.target.value }))}
                    style={l.doc?.validade_dias == null ? { borderColor: 'var(--cs-warn)', background: 'var(--cs-warn-bg)' } : undefined}>
                    <option value="">—</option>
                    {VALIDADES.map(v => <option key={v.dias} value={v.dias}>{v.label}</option>)}
                    {l.doc?.validade_dias != null && !VALIDADES.some(v => v.dias === l.doc?.validade_dias) && <option value={l.doc.validade_dias}>{rotuloValidade(l.doc.validade_dias)}</option>}
                  </select>
                </td>
                <td className="r mono" title={l.foraDoGrupo ? 'Sem tempo neste grupo: usou o do grupo padrão' : undefined}>
                  {l.tA.val != null ? fmt(l.tA.val, 1) + (l.foraDoGrupo ? '*' : '') : <span className="pill p-warn">sem tempo</span>}
                </td>
                <td className="r mono">{l.doc?.tipo ? l.qtd : '—'}</td>
                <td className="r mono">{l.implant != null && l.doc?.tipo ? fmt(l.implant / 60, 2) : '—'}</td>
                <td className="r mono">{l.mensal != null && l.doc?.tipo ? fmt(l.mensal / 60, 2) : '—'}</td>
              </tr>
            ))}
            {!linhas.length && <tr><td colSpan={7} className="empty">Inclua documentos para calcular.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="note">Tempo = tempo-padrão de aprovado no grupo escolhido (* = sem tempo no grupo, usou o padrão). Cada reprovação gera um reenvio. Por mês = quantidade × tempo × vencimentos no mês (anual = 1/12) + as pessoas novas avaliando todos os documentos de pessoa. Documento de empresa usa a quantidade de empresas; de pessoa, a de pessoas.</p>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Documentos de um contratante
// ═════════════════════════════════════════════════════════════════════════════
export function EditorDocsContratante({ ctx, cod }: { ctx: Ctx; cod: string }) {
  const { d, vincularDocs, desvincularDoc, criarConjunto, docsConjunto, tentar, toast } = useCs()
  const vinc = d.exig.filter(x => x.contratante_cod === cod && x.ativo)
  const ids = [...new Set(vinc.map(x => x.documento_id))].sort((a, b) => (ctx.docs.get(a)?.nome ?? '').localeCompare(ctx.docs.get(b)?.nome ?? '', 'pt-BR'))
  const idsSet = new Set(ids)
  const [fonte, setFonte] = useState('')
  const [selImp, setSelImp] = useState<Set<string>>(new Set())
  const [modo, setModo] = useState<'' | 'importar' | 'aplicar' | 'salvar'>('')
  const [alvos, setAlvos] = useState<Set<string>>(new Set())
  const [nomeCj, setNomeCj] = useState('')
  const [cjAtualizar, setCjAtualizar] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const grupo = grupoDe(ctx, cod)

  const docsFonte = (f: string) => f.startsWith('c:')
    ? [...new Set(d.exig.filter(x => x.contratante_cod === f.slice(2) && x.ativo).map(x => x.documento_id))]
    : f.startsWith('j:') ? d.conjuntos.find(c => c.id === f.slice(2))?.docs ?? [] : []
  const candidatos = docsFonte(fonte).filter(id => !idsSet.has(id))
  const avisarGrupo = (g: string | null) => { if (g) setTimeout(() => toast(`Grupo de critério criado: ${g}`), 2700) }

  async function rodar(fn: () => Promise<void>) { setOcupado(true); try { await fn() } finally { setOcupado(false) } }

  return (
    <div className="box">
      <div className="row between">
        <div>
          <span className="eyebrow">Documentos do contratante · {grupo?.nome ?? 'grupo padrão'}</span>
          <h2>{cod} · {nomeCtt(ctx, cod)}</h2>
        </div>
        <div className="row">
          <button type="button" className={'btn sm' + (modo === 'importar' ? ' solid' : '')} onClick={() => setModo(modo === 'importar' ? '' : 'importar')}>Importar de…</button>
          <button type="button" className={'btn sm' + (modo === 'salvar' ? ' solid' : '')} disabled={!ids.length} onClick={() => setModo(modo === 'salvar' ? '' : 'salvar')}>Salvar como base pronta</button>
          <button type="button" className={'btn sm' + (modo === 'aplicar' ? ' solid' : '')} disabled={!ids.length} onClick={() => setModo(modo === 'aplicar' ? '' : 'aplicar')}>Aplicar a outros contratantes</button>
        </div>
      </div>

      {modo === 'importar' && (
        <div className="tp-bloco">
          <div className="row">
            <b>Importar documentos de</b>
            <select value={fonte} onChange={e => { const f = e.target.value; setFonte(f); setSelImp(new Set(docsFonte(f).filter(id => !idsSet.has(id)))) }} aria-label="Importar de">
              <option value="">escolha…</option>
              {d.conjuntos.length > 0 && <optgroup label="Bases prontas">{d.conjuntos.map(c => <option key={c.id} value={'j:' + c.id}>{c.nome} ({c.docs.length})</option>)}</optgroup>}
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
                if (await tentar(async () => { const r = await vincularDocs(sel, cod); avisarGrupo(r.grupo) }, `${sel.length} documento(s) importado(s)`)) { setFonte(''); setModo('') }
              })}>Importar {candidatos.filter(id => selImp.has(id)).length} documento(s)</button>
            </div>
          </>}
        </div>
      )}

      {modo === 'salvar' && (
        <div className="tp-bloco">
          <div className="row">
            <b>Nova base pronta</b>
            <input type="text" value={nomeCj} onChange={e => setNomeCj(e.target.value)} placeholder={`ex.: Pacote ${nomeCtt(ctx, cod).split(' ')[0]}`} style={{ width: 260 }} />
            <button type="button" className="btn sm solid" disabled={ocupado || !nomeCj.trim()} onClick={() => rodar(async () => {
              if (await tentar(() => criarConjunto(nomeCj.trim(), ids, `Criado a partir de ${cod} · ${nomeCtt(ctx, cod)}`), `Base pronta "${nomeCj.trim()}" criada com ${ids.length} documento(s)`)) { setNomeCj(''); setModo('') }
            })}>Criar com {ids.length} documento(s)</button>
          </div>
          {d.conjuntos.length > 0 && (
            <div className="row">
              <b>ou atualizar uma existente</b>
              <select value={cjAtualizar} onChange={e => setCjAtualizar(e.target.value)} aria-label="Base pronta">
                <option value="">escolha…</option>
                {d.conjuntos.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.docs.length})</option>)}
              </select>
              <button type="button" className="btn sm" disabled={ocupado || !cjAtualizar} onClick={() => rodar(async () => {
                const cj = d.conjuntos.find(c => c.id === cjAtualizar)!
                if (await tentar(() => docsConjunto(cj.id, ids, cj.docs.filter(x => !idsSet.has(x))), `"${cj.nome}" agora tem os ${ids.length} documento(s) deste contratante`)) { setCjAtualizar(''); setModo('') }
              })}>Substituir pelos documentos deste contratante</button>
            </div>
          )}
        </div>
      )}

      {modo === 'aplicar' && <>
        <p className="note">Os {ids.length} documentos deste contratante serão incluídos nos marcados (o que já existe lá fica). Cada um recebe os documentos no grupo de critério dele; quem não tem grupo próprio ganha um.</p>
        <EscolherContratantes ctx={ctx} sel={alvos} setSel={setAlvos} sem={cod} />
        <div className="row">
          <button type="button" className="btn solid" disabled={ocupado || !alvos.size} onClick={() => rodar(async () => {
            let total = 0
            const okk = await tentar(async () => { for (const c of alvos) { const r = await vincularDocs(ids, c); total += r.novos; avisarGrupo(r.grupo) } })
            if (okk) { toast(`${total} vínculo(s) novo(s) em ${alvos.size} contratante(s)`); setAlvos(new Set()); setModo('') }
          })}>Aplicar a {alvos.size} contratante(s)</button>
        </div>
      </>}

      <div className="row">
        <EscolherDoc ctx={ctx} excluir={idsSet} onEscolher={id => void tentar(async () => { const r = await vincularDocs([id], cod); avisarGrupo(r.grupo) }, 'Documento incluído')} />
      </div>
      <div className="tbl scroll" style={{ maxHeight: 380 }}>
        <table>
          <thead><tr><th>Documento</th><th>Tipo</th><th>Validade</th><th className="r">Tempo aprov. (min)</th><th>Origem</th><th /></tr></thead>
          <tbody>
            {ids.map(id => {
              const doc = ctx.docs.get(id), vs = vinc.filter(v => v.documento_id === id)
              const t = tempoCtt(ctx, cod, id, 'aprovado')
              return (
                <tr key={id}>
                  <td style={{ maxWidth: 360 }}>{doc?.nome ?? '—'}</td>
                  <td className="note">{tipoCurto(doc?.tipo)}</td>
                  <td className="note">{rotuloValidade(doc?.validade_dias)}</td>
                  <td className="r mono">{t.val != null ? fmt(t.val, 1) : <span className="pill p-warn">sem tempo</span>}</td>
                  <td className="note">{vs.map(v => (v.origem === 'contratante' ? 'contratante' : `contrato ×${v.qtd_contratos}`)).join(', ')}</td>
                  <td><BotaoConfirmar onConfirm={() => void tentar(async () => { for (const v of vs) await desvincularDoc(id, cod, v.origem) }, 'Documento retirado')}>Retirar</BotaoConfirmar></td>
                </tr>
              )
            })}
            {!ids.length && <tr><td colSpan={6} className="empty">Nenhum documento ainda. Inclua acima ou importe de outro contratante ou de uma base pronta.</td></tr>}
          </tbody>
        </table>
      </div>
      {ids.length > 0 && <Calculadora key={cod} ctx={ctx} docs={ids} grupoInicial={grupo?.id} />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Aba Bases prontas
// ═════════════════════════════════════════════════════════════════════════════
export default function Bases() {
  const { ctx, d, criarConjunto, salvarConjunto, excluirConjunto, docsConjunto, vincularDocs, tentar, toast } = useCs()
  const [selId, setSelId] = useState<string | null>(null)
  const [novo, setNovo] = useState('')
  const [fonte, setFonte] = useState('')
  const [aplicar, setAplicar] = useState(false)
  const [alvos, setAlvos] = useState<Set<string>>(new Set())
  const [ctt, setCtt] = useState('')
  const [ocupado, setOcupado] = useState(false)
  if (!ctx) return null
  const sel = d.conjuntos.find(c => c.id === selId) ?? d.conjuntos[0] ?? null
  const docsSet = new Set(sel?.docs ?? [])
  const ordenados = sel ? [...sel.docs].sort((a, b) => (ctx.docs.get(a)?.nome ?? '').localeCompare(ctx.docs.get(b)?.nome ?? '', 'pt-BR')) : []
  const docsDoCtt = (c: string) => [...new Set(d.exig.filter(x => x.contratante_cod === c && x.ativo).map(x => x.documento_id))]
  const ctts = [...ctx.ctts.values()].sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0))

  return (
    <>
      <div className="box">
        <h2>Bases prontas</h2>
        <p className="note">Conjuntos de documentos para reutilizar, como um &quot;starter pack&quot;. Monte o conjunto, veja quanto tempo ele demanda pela calculadora e aplique a contratantes. Cada contratante continua editável depois: dá para incluir ou retirar documentos dele sem mexer na base.</p>
        <div className="bases">
          <div className="cj-lista">
            {d.conjuntos.map(c => (
              <button key={c.id} type="button" className={sel?.id === c.id ? 'on' : ''} onClick={() => { setSelId(c.id); setAplicar(false) }}>
                <b>{c.nome}</b><span className="note">{c.docs.length} documento(s)</span>
              </button>
            ))}
            {!d.conjuntos.length && <p className="note">Nenhuma base pronta ainda.</p>}
            <div className="tp-bloco">
              <input type="text" value={novo} onChange={e => setNovo(e.target.value)} placeholder="Nome (ex.: Starter pack indústria)" aria-label="Nome da nova base" />
              <button type="button" className="btn sm solid" disabled={!novo.trim()} onClick={async () => {
                const nome = novo.trim()
                await tentar(async () => { const id = await criarConjunto(nome); setSelId(id); setNovo('') }, `Base "${nome}" criada`)
              }}>+ Nova base pronta</button>
            </div>
          </div>

          {sel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              <div className="row between">
                <input key={sel.id + sel.nome} type="text" defaultValue={sel.nome} aria-label="Nome da base" style={{ fontSize: 17, fontWeight: 800, flex: 1, minWidth: 220 }}
                  onBlur={e => { const v = e.target.value.trim(); if (v && v !== sel.nome) void tentar(() => salvarConjunto(sel.id, { nome: v }), 'Nome salvo') }} />
                <div className="row">
                  <button type="button" className="btn sm" onClick={() => tentar(async () => { const id = await criarConjunto(sel.nome + ' (cópia)', sel.docs, sel.descricao); setSelId(id) }, 'Base duplicada')}>Duplicar</button>
                  <button type="button" className={'btn sm' + (aplicar ? ' solid' : '')} disabled={!sel.docs.length} onClick={() => setAplicar(!aplicar)}>Aplicar a contratantes</button>
                  <BotaoConfirmar onConfirm={() => void tentar(async () => { await excluirConjunto(sel.id); setSelId(null) }, 'Base excluída')}>Excluir</BotaoConfirmar>
                </div>
              </div>
              <input key={sel.id + 'd' + (sel.descricao ?? '')} type="text" defaultValue={sel.descricao ?? ''} placeholder="Descrição (opcional): para quem serve esta base" aria-label="Descrição"
                onBlur={e => { const v = e.target.value.trim() || null; if (v !== sel.descricao) void tentar(() => salvarConjunto(sel.id, { descricao: v })) }} />

              {aplicar && <>
                <p className="note">Os {sel.docs.length} documentos serão incluídos nos contratantes marcados (o que eles já têm fica).</p>
                <EscolherContratantes ctx={ctx} sel={alvos} setSel={setAlvos} />
                <div className="row">
                  <button type="button" className="btn solid" disabled={ocupado || !alvos.size} onClick={async () => {
                    setOcupado(true)
                    let total = 0
                    const okk = await tentar(async () => { for (const c of alvos) total += (await vincularDocs(sel.docs, c)).novos })
                    setOcupado(false)
                    if (okk) { toast(`${total} vínculo(s) novo(s) em ${alvos.size} contratante(s)`); setAlvos(new Set()); setAplicar(false) }
                  }}>Aplicar a {alvos.size} contratante(s)</button>
                </div>
              </>}

              <div className="row">
                <EscolherDoc ctx={ctx} excluir={docsSet} onEscolher={id => void tentar(() => docsConjunto(sel.id, [id]), 'Documento incluído')} />
                <select value={fonte} aria-label="Trazer documentos de um contratante" onChange={async e => {
                  const c = e.target.value; setFonte(''); if (!c) return
                  const ds = docsDoCtt(c)
                  await tentar(async () => { const n = await docsConjunto(sel.id, ds); toast(`${n} documento(s) de ${c} incluído(s)`) })
                }}>
                  <option value="">+ trazer todos de um contratante…</option>
                  {ctts.filter(c => d.exig.some(x => x.contratante_cod === c.contratante_cod && x.ativo)).map(c => <option key={c.contratante_cod} value={c.contratante_cod}>{c.contratante_cod} · {c.nome}</option>)}
                </select>
              </div>
              <div className="tbl scroll" style={{ maxHeight: 320 }}>
                <table>
                  <thead><tr><th>Documento</th><th>Tipo</th><th>Validade</th><th /></tr></thead>
                  <tbody>
                    {ordenados.map(id => (
                      <tr key={id}>
                        <td>{ctx.docs.get(id)?.nome ?? '—'}</td>
                        <td className="note">{tipoCurto(ctx.docs.get(id)?.tipo)}</td>
                        <td className="note">{rotuloValidade(ctx.docs.get(id)?.validade_dias)}</td>
                        <td><button type="button" className="btn sm bad" onClick={() => tentar(() => docsConjunto(sel.id, [], [id]), 'Documento retirado da base')}>Retirar</button></td>
                      </tr>
                    ))}
                    {!ordenados.length && <tr><td colSpan={4} className="empty">Base vazia. Inclua documentos acima ou traga os de um contratante.</td></tr>}
                  </tbody>
                </table>
              </div>
              {sel.docs.length > 0 && <Calculadora key={sel.id} ctx={ctx} docs={sel.docs} />}
            </div>
          ) : <div className="empty">Crie a primeira base pronta ao lado.</div>}
        </div>
      </div>

      <div className="box">
        <div className="row between">
          <h2>Documentos por contratante</h2>
          <select value={ctt} onChange={e => setCtt(e.target.value)} aria-label="Contratante" style={{ minWidth: 280 }}>
            <option value="">Escolha o contratante…</option>
            {ctts.map(c => <option key={c.contratante_cod} value={c.contratante_cod}>{c.contratante_cod} · {c.nome}</option>)}
          </select>
        </div>
        <p className="note">Indique quais documentos da base são pertinentes ao contratante. Importe de outro contratante ou de uma base pronta, salve o resultado como base pronta e aplique a outros. Também abre pela tela de cada grupo (Cronometrar › grupo › contratante).</p>
      </div>
      {ctt && <EditorDocsContratante key={ctt} ctx={ctx} cod={ctt} />}
    </>
  )
}
