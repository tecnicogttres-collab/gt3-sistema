'use client'

// Documentos exigidos por contratante no GT0010 (por contratante ou por contrato de servico).
// Visao por contratante (cartoes: arraste um documento para outro contratante para vincular la
// tambem) e visao por documento (tabela). Fonte inicial: relatorios "Relacao de Documentos".

import { useState } from 'react'
import { useCs } from '../cs-data'
import { nomeCtt, norm, type Ctx, type DocCtt } from '../cs-lib'
import { OrdemControle, ordenar, useOrdem, type Ordem } from '../cs-ui'

const PER: Record<string, string> = { U: 'único', A: 'anual', B: 'bienal', T: 'trimestral', S: 'semestral', M: 'mensal', I: 'informado', O: 'outro' }
const per = (p: string | null) => (p ? p.split('/').map(x => PER[x] ?? x).join('/') : '')

export default function DocsContratantes({ ctx }: { ctx: Ctx }) {
  const { d } = useCs()
  const [visao, setVisao] = useState<'ctt' | 'doc'>('ctt')
  const [q, setQ] = useState('')
  const [origem, setOrigem] = useState<'' | DocCtt['origem']>('')
  const [inativos, setInativos] = useState(false)
  const vis = d.exig.filter(x => (inativos || x.ativo) && (!origem || x.origem === origem))
  const docsComVinculo = new Set(vis.map(x => x.documento_id)).size
  const cttsComVinculo = new Set(vis.map(x => x.contratante_cod)).size

  if (!d.exig.length) {
    return (
      <div className="box">
        <h2>Documentos por contratante (GT0010)</h2>
        <p className="note">Ainda não há vínculos. Rode <b>sql/custo-servir-documentos-gt0010.sql</b> no Supabase (carrega os 6 relatórios &quot;Relação de Documentos&quot;) e recarregue a página.</p>
      </div>
    )
  }
  return (
    <div className="box">
      <div className="row between">
        <div>
          <h2>Documentos por contratante (GT0010)</h2>
          <p className="note">Quais documentos cada contratante exige pelo GT0010: <b>por contratante</b> (vale para todos os prestadores dele) ou <b>por contrato de serviço</b> (só para alguns prestadores; o número mostra quantos contratos). Na Contagem, linha com Cód. GT0010 sem esse vínculo aparece como aviso.</p>
        </div>
        <div className="cfgnav">
          <button type="button" className={visao === 'ctt' ? 'on' : ''} onClick={() => setVisao('ctt')}>Por contratante</button>
          <button type="button" className={visao === 'doc' ? 'on' : ''} onClick={() => setVisao('doc')}>Por documento</button>
        </div>
      </div>
      <div className="tiles">
        <div className="tile"><b>{docsComVinculo}</b><span>documentos exigidos</span></div>
        <div className="tile"><b>{vis.length}</b><span>vínculos documento × contratante</span></div>
        <div className="tile"><b>{cttsComVinculo}</b><span>contratantes com exigência no GT0010</span></div>
        <div className="tile"><b>{vis.filter(x => x.bloqueia_acesso).length}</b><span>vínculos que bloqueiam o acesso</span></div>
      </div>
      <div className="row">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar documento, código ou contratante" style={{ width: 'min(340px,100%)' }} />
        <select value={origem} onChange={e => setOrigem(e.target.value as typeof origem)} aria-label="Origem">
          <option value="">Por contratante e por contrato</option>
          <option value="contratante">Só por contratante</option>
          <option value="contrato_servico">Só por contrato de serviço</option>
        </select>
        <label className="row note" style={{ gap: 6 }}><input type="checkbox" checked={inativos} onChange={e => setInativos(e.target.checked)} /> mostrar encerrados</label>
      </div>
      {visao === 'ctt' ? <PorContratante ctx={ctx} vis={vis} q={q} /> : <PorDocumento ctx={ctx} vis={vis} q={q} />}
    </div>
  )
}

function PorContratante({ ctx, vis, q }: { ctx: Ctx; vis: DocCtt[]; q: string }) {
  const { d, vincularDoc, desvincularDoc, ativarVinculo, tentar, toast } = useCs()
  // Vincular ja coloca o documento no grupo de criterio do contratante (e cria o grupo se precisar)
  const vincular = async (doc: string, c: string) => { const g = await vincularDoc(doc, c); if (g) setTimeout(() => toast(`Grupo de critério criado: ${g}`), 2700) }
  const [ord, setOrd] = useState<Ordem>({ col: 'cod', dir: 'asc' })
  const [drag, setDrag] = useState<{ doc: string; from: string } | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [todos, setTodos] = useState(false)
  const [novo, setNovo] = useState<Record<string, string>>({})
  const qn = norm(q)
  const porCtt = new Map<string, DocCtt[]>()
  for (const v of vis) { const a = porCtt.get(v.contratante_cod); if (a) a.push(v); else porCtt.set(v.contratante_cod, [v]) }
  const docNome = (id: string) => ctx.docs.get(id)?.nome ?? '—'
  const docCod = (id: string) => ctx.docs.get(id)?.codigo ?? ''
  const casaDoc = (v: DocCtt) => !qn || norm(docCod(v.documento_id) + ' ' + docNome(v.documento_id)).includes(qn)
  let cods = d.ctts.map(c => c.contratante_cod).filter(c => drag || todos || porCtt.has(c))
  if (qn && !drag) cods = cods.filter(c => norm(c + ' ' + nomeCtt(ctx, c)).includes(qn) || (porCtt.get(c) ?? []).some(casaDoc))
  cods = ordenar(cods, { cod: c => +c || c, nome: c => nomeCtt(ctx, c), n: c => porCtt.get(c)?.length ?? 0 }, ord)
  const docsOrdenados = [...d.docs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const rotuloDoc = (id: string) => { const x = ctx.docs.get(id); return x ? (x.codigo ? x.codigo + ' · ' : '') + x.nome : '' }

  async function incluir(c: string) {
    const txt = (novo[c] ?? '').trim()
    const doc = d.docs.find(x => rotuloDoc(x.id) === txt || x.codigo === txt || norm(x.nome) === norm(txt))
    if (!doc) return
    if (await tentar(() => vincular(doc.id, c), `Vinculado a ${c} · ${nomeCtt(ctx, c)}`)) setNovo(p => ({ ...p, [c]: '' }))
  }

  return <>
    <div className="row between">
      <label className="row note" style={{ gap: 6 }}><input type="checkbox" checked={todos} onChange={e => setTodos(e.target.checked)} /> mostrar contratantes sem exigência</label>
      <OrdemControle ord={ord} setOrd={setOrd} opcoes={[{ col: 'cod', label: 'Código' }, { col: 'nome', label: 'Nome' }, { col: 'n', label: 'Nº de documentos' }]} />
    </div>
    <p className="note">Arraste um documento para outro contratante para vincular lá também (por contratante). Todo vínculo já coloca o documento no grupo de critério do contratante; se ele ainda não tiver grupo, o grupo é criado. ✕ remove o vínculo; o selo &quot;encerrado&quot; liga/desliga.</p>
    <datalist id="cs-docs-gt0010">{docsOrdenados.map(x => <option key={x.id} value={rotuloDoc(x.id)} />)}</datalist>
    <div className="board">
      {cods.map(c => {
        const lista = (porCtt.get(c) ?? []).filter(v => !qn || casaDoc(v) || norm(c + ' ' + nomeCtt(ctx, c)).includes(qn))
          .sort((a, b) => docNome(a.documento_id).localeCompare(docNome(b.documento_id), 'pt-BR'))
        const alvo = !!drag && drag.from !== c
        return (
          <div key={c} className={'gcol' + (drag?.from === c ? ' origem' : '')}
            style={alvo && sobre === c ? { borderStyle: 'dashed', background: 'var(--cs-tint)' } : undefined}
            onDragOver={e => { if (!alvo) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (sobre !== c) setSobre(c) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(s => (s === c ? null : s)) }}
            onDrop={e => { e.preventDefault(); const x = drag; setDrag(null); setSobre(null); if (x && alvo) void tentar(() => vincular(x.doc, c), `${docNome(x.doc)} → ${c} · ${nomeCtt(ctx, c)}`) }}>
            <header>
              <div className="t">
                <span className="mono" style={{ fontWeight: 800, color: 'var(--cs-edge)' }}>{c}</span>
                <b title={nomeCtt(ctx, c)}>{nomeCtt(ctx, c)}</b>
                <span className="pill p-blue">{porCtt.get(c)?.length ?? 0}</span>
              </div>
            </header>
            <div className="body">
              {lista.length ? lista.map(v => (
                <div key={v.documento_id + v.origem} className={'dchip' + (drag?.doc === v.documento_id && drag.from === c ? ' arrastando' : '')}
                  style={!v.ativo ? { opacity: 0.5 } : undefined} draggable
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', v.documento_id); setDrag({ doc: v.documento_id, from: c }) }}
                  onDragEnd={() => { setDrag(null); setSobre(null) }}
                  title={`${docNome(v.documento_id)}\n${v.origem === 'contratante' ? 'Por contratante' : `Por contrato de serviço (${v.qtd_contratos} contrato(s))`}${v.periodicidade ? ' · ' + per(v.periodicidade) : ''}${v.bloqueia_acesso ? ' · bloqueia acesso' : ''}`}>
                  <span className="h">⠿</span>
                  {docCod(v.documento_id) && <b className="mono" style={{ fontSize: 11 }}>{docCod(v.documento_id)}</b>}
                  <span className="n" style={{ fontWeight: 500 }}>{docNome(v.documento_id)}</span>
                  {v.tipo_doc && <span className="badge" title={v.tipo_doc === 'C' ? 'Colaborador (pessoa)' : 'Empresa'}>{v.tipo_doc === 'C' ? 'P' : 'E'}</span>}
                  <span className="badge" title={v.origem === 'contratante' ? 'Por contratante' : 'Por contrato de serviço'}>{v.origem === 'contratante' ? 'ctt' : `contr ×${v.qtd_contratos}`}</span>
                  {!v.ativo && <button type="button" className="badge" style={{ cursor: 'pointer' }} title="Encerrado: clique para reativar" onClick={() => tentar(() => ativarVinculo(v, true), 'Vínculo reativado')}>encerrado</button>}
                  <button type="button" className="x" title="Remover vínculo" onClick={() => tentar(() => desvincularDoc(v.documento_id, c, v.origem), 'Vínculo removido')}>✕</button>
                </div>
              )) : <div className="vazio">Arraste documentos pra cá ou inclua abaixo</div>}
            </div>
            <div className="foot">
              <input list="cs-docs-gt0010" value={novo[c] ?? ''} placeholder="+ documento (nome ou código)" aria-label={'Incluir documento para ' + c}
                onChange={e => setNovo(p => ({ ...p, [c]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') void incluir(c) }} />
              <button type="button" className="btn sm" disabled={!(novo[c] ?? '').trim()} onClick={() => incluir(c)}>＋</button>
            </div>
          </div>
        )
      })}
      {!cods.length && <div className="empty">Nada encontrado.</div>}
    </div>
  </>
}

function PorDocumento({ ctx, vis, q }: { ctx: Ctx; vis: DocCtt[]; q: string }) {
  const porDoc = new Map<string, DocCtt[]>()
  for (const v of vis) { const a = porDoc.get(v.documento_id); if (a) a.push(v); else porDoc.set(v.documento_id, [v]) }
  const linhas = [...porDoc.entries()].map(([id, vs]) => ({ id, vs, doc: ctx.docs.get(id) }))
    .filter(x => !q || norm((x.doc?.codigo ?? '') + ' ' + (x.doc?.nome ?? '') + ' ' + x.vs.map(v => v.contratante_cod + ' ' + nomeCtt(ctx, v.contratante_cod)).join(' ')).includes(norm(q)))
  const { sorted, th } = useOrdem(linhas, {
    cod: x => +(x.doc?.codigo ?? '') || x.doc?.codigo, nome: x => x.doc?.nome, tipo: x => x.doc?.tipo, n: x => x.vs.length,
    vol: x => x.doc?.volume_ref ?? 0,
  }, { col: 'nome', dir: 'asc' })
  return (
    <div className="tbl scroll" style={{ maxHeight: 600 }}>
      <table>
        <thead><tr>{th('cod', 'Cód.')}{th('nome', 'Documento')}{th('tipo', 'Tipo')}{th('vol', 'Volume ref.', 'r')}{th('n', 'Contratantes', 'r')}<th>Quem exige</th></tr></thead>
        <tbody>
          {sorted.map(x => (
            <tr key={x.id}>
              <td className="mono">{x.doc?.codigo ?? '—'}</td>
              <td style={{ maxWidth: 340 }}>{x.doc?.nome}</td>
              <td className="note">{x.doc?.tipo === 'pessoa' ? 'Pessoa' : x.doc?.tipo === 'empresa' ? 'Empresa' : '—'}</td>
              <td className="r mono">{x.doc?.volume_ref || '—'}</td>
              <td className="r mono">{new Set(x.vs.map(v => v.contratante_cod)).size}</td>
              <td className="note">{x.vs.sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0)).map(v => `${v.contratante_cod}${v.origem === 'contrato_servico' ? ` (contr ×${v.qtd_contratos})` : ''}${v.ativo ? '' : ' [encerrado]'}`).join(', ')}</td>
            </tr>
          ))}
          {!sorted.length && <tr><td colSpan={6} className="empty">Nada encontrado.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
