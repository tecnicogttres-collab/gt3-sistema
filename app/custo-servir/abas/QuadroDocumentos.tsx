'use client'

// Quadro de grupos: cada grupo e um cartao com os documentos dele. Arraste um documento (ou
// varios selecionados) para outro cartao e solte em "Copiar" ou "Mover". Tambem da para
// adicionar pelo campo "+ documento" do cartao, remover (✕) e usar os botoes da selecao.

import { useState } from 'react'
import { useCs } from '../cs-data'
import { nomeCtt, norm, stat, type Ctx, type Grupo } from '../cs-lib'
import { OrdemControle, ordenar, type Ordem } from '../cs-ui'

type Drag = { from: string; ids: string[] }
type Sel = { g: string; ids: Set<string> }

export default function QuadroDocumentos({ ctx }: { ctx: Ctx }) {
  const { d, copiarDocs, moverDocs, removerDoGrupo, tentar } = useCs()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Sel | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [sobre, setSobre] = useState<{ g: string; modo: 'copiar' | 'mover' } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [destino, setDestino] = useState('')
  const [ord, setOrd] = useState<Ordem>({ col: 'nome', dir: 'asc' })

  const nomeG = (id: string) => ctx.grupos.find(g => g.id === id)?.nome ?? ''
  const nMed = (g: string, doc: string) => d.meds.filter(m => m.grupo_id === g && m.documento_id === doc).length
  const docsDe = (g: string) => ordenar([...(ctx.gd.get(g) ?? [])].map(id => ctx.docs.get(id)!).filter(Boolean), {
    nome: x => x.nome, vol: x => x.volume_ref, med: x => nMed(g, x.id),
  }, ord)

  async function executar(modo: 'copiar' | 'mover', from: string, to: string, ids: string[]) {
    if (from === to || !ids.length || ocupado) return
    const levaMedicoes = modo === 'mover' && ids.some(id => nMed(from, id) > 0)
    setOcupado(true)
    const ok = await tentar(
      () => (modo === 'copiar' ? copiarDocs(to, ids) : moverDocs(from, to, ids)),
      `${ids.length} documento(s) ${modo === 'copiar' ? 'copiado(s)' : 'movido(s)'} para ${nomeG(to)}${levaMedicoes ? ' (com as medições)' : ''}`,
    )
    if (ok) setSel(null)
    setOcupado(false)
  }

  function iniciarDrag(e: React.DragEvent, g: string, doc: string) {
    const ids = sel?.g === g && sel.ids.has(doc) ? [...sel.ids] : [doc]
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('text/plain', ids.join(','))   // Firefox exige dados no drag
    setDrag({ from: g, ids })
  }
  const fimDrag = () => { setDrag(null); setSobre(null) }

  function alternarSel(g: string, doc: string) {
    setSel(prev => {
      if (!prev || prev.g !== g) return { g, ids: new Set([doc]) }
      const ids = new Set(prev.ids)
      if (ids.has(doc)) ids.delete(doc); else ids.add(doc)
      return ids.size ? { g, ids } : null
    })
  }

  const selIds = sel ? [...sel.ids].filter(id => ctx.gd.get(sel.g)?.has(id)) : []
  const outros = sel ? ctx.grupos.filter(g => g.id !== sel.g) : []
  const destinoSel = outros.find(g => g.id === destino)?.id ?? outros[0]?.id ?? ''

  return (
    <div className="box">
      <div className="row between">
        <div>
          <h2>Documentos por grupo</h2>
          <p className="note">Arraste um documento de um grupo para outro e solte em <b>Copiar</b> ou <b>Mover</b>. Clique nos documentos para marcar vários e arrastar juntos.</p>
        </div>
        <div className="row">
          <OrdemControle ord={ord} setOrd={setOrd} opcoes={[{ col: 'nome', label: 'Nome' }, { col: 'vol', label: 'Volume de referência' }, { col: 'med', label: 'Medições no grupo' }]} />
          <input type="search" placeholder="Buscar documento em todos os grupos" value={q} onChange={e => setQ(e.target.value)} style={{ width: 'min(320px,100%)' }} />
        </div>
      </div>
      <p className="note"><b>Copiar</b>: o documento fica nos dois grupos e o destino começa sem medições (critério diferente, tempo diferente). <b>Mover</b>: sai da origem e leva as medições junto. Remover (✕) de um grupo específico faz os contratantes dele voltarem a usar o tempo do grupo padrão; as medições ficam no histórico.</p>

      {sel && selIds.length > 0 && (
        <div className="selbar">
          <b>{selIds.length} marcado(s) em {nomeG(sel.g)}</b>
          {outros.length > 0 && <>
            <span className="note">para</span>
            <select value={destinoSel} onChange={e => setDestino(e.target.value)} aria-label="Grupo de destino">
              {outros.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
            <button type="button" className="btn sm solid" disabled={ocupado || !destinoSel} onClick={() => executar('copiar', sel.g, destinoSel, selIds)}>Copiar</button>
            <button type="button" className="btn sm" disabled={ocupado || !destinoSel} onClick={() => executar('mover', sel.g, destinoSel, selIds)}>Mover</button>
          </>}
          {!ctx.grupos.find(g => g.id === sel.g)?.padrao && (
            <button type="button" className="btn sm bad" disabled={ocupado} onClick={async () => {
              setOcupado(true)
              const ok = await tentar(async () => { for (const id of selIds) await removerDoGrupo(sel.g, id) }, `${selIds.length} removido(s) de ${nomeG(sel.g)}`)
              if (ok) setSel(null)
              setOcupado(false)
            }}>Remover do grupo</button>
          )}
          <button type="button" className="link" onClick={() => setSel(null)}>desmarcar</button>
        </div>
      )}

      <div className="board">
        {ctx.grupos.map(g => (
          <Cartao key={g.id} ctx={ctx} g={g} docs={docsDe(g.id)} q={q} sel={sel} drag={drag} sobre={sobre} ocupado={ocupado}
            nMed={nMed} onSel={alternarSel} onDragStart={iniciarDrag} onDragEnd={fimDrag} setSobre={setSobre}
            onSoltar={(modo) => { if (drag) void executar(modo, drag.from, g.id, drag.ids); fimDrag() }}
            onRemover={doc => tentar(() => removerDoGrupo(g.id, doc), 'Removido do grupo')}
            onAdicionar={doc => tentar(() => copiarDocs(g.id, [doc]), 'Documento incluído no grupo')}
            onMarcarVisiveis={ids => setSel(ids.length ? { g: g.id, ids: new Set(ids) } : null)}
          />
        ))}
      </div>
    </div>
  )
}

function Cartao({ ctx, g, docs, q, sel, drag, sobre, ocupado, nMed, onSel, onDragStart, onDragEnd, setSobre, onSoltar, onRemover, onAdicionar, onMarcarVisiveis }: {
  ctx: Ctx; g: Grupo; docs: { id: string; nome: string; volume_ref: number }[]; q: string
  sel: Sel | null; drag: Drag | null; sobre: { g: string; modo: 'copiar' | 'mover' } | null; ocupado: boolean
  nMed: (g: string, d: string) => number
  onSel: (g: string, d: string) => void
  onDragStart: (e: React.DragEvent, g: string, d: string) => void
  onDragEnd: () => void
  setSobre: (s: { g: string; modo: 'copiar' | 'mover' } | null) => void
  onSoltar: (modo: 'copiar' | 'mover') => void
  onRemover: (d: string) => void
  onAdicionar: (d: string) => void
  onMarcarVisiveis: (ids: string[]) => void
}) {
  const [novo, setNovo] = useState('')
  const visiveis = q ? docs.filter(x => norm(x.nome).includes(norm(q))) : docs
  const alvo = !!drag && drag.from !== g.id
  const naoEstao = [...ctx.docs.values()].filter(x => !ctx.gd.get(g.id)?.has(x.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const listId = 'cs-add-' + g.id

  function adicionar() {
    const doc = naoEstao.find(x => norm(x.nome) === norm(novo))
    if (!doc) return
    onAdicionar(doc.id)
    setNovo('')
  }

  const zona = (modo: 'copiar' | 'mover') => (
    <div
      className={'drop ' + modo + (sobre?.g === g.id && sobre.modo === modo ? ' on' : '')}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = modo === 'copiar' ? 'copy' : 'move'; if (sobre?.g !== g.id || sobre.modo !== modo) setSobre({ g: g.id, modo }) }}
      onDragLeave={() => { if (sobre?.g === g.id && sobre.modo === modo) setSobre(null) }}
      onDrop={e => { e.preventDefault(); onSoltar(modo) }}
    >
      <span>
        {modo === 'copiar' ? '⧉ Copiar para cá' : '➜ Mover para cá'}
        <small>{modo === 'copiar' ? 'fica nos dois · destino sem medições' : 'sai da origem · leva as medições'}</small>
      </span>
    </div>
  )

  return (
    <div className={'gcol' + (drag?.from === g.id ? ' origem' : '')}>
      {alvo && <div className="drops">{zona('copiar')}{zona('mover')}</div>}
      <header>
        <div className="t">
          <b title={g.nome}>{g.nome}</b>
          <span className="pill p-blue">{docs.length}</span>
        </div>
        <div className="chips">
          {g.padrao
            ? <span className="chip">todos os demais contratantes</span>
            : g.contratantes.length
              ? g.contratantes.map(c => <span key={c} className="chip" title={nomeCtt(ctx, c)}>{c} · {nomeCtt(ctx, c).slice(0, 18)}</span>)
              : <span className="note">nenhum contratante (defina em Grupos)</span>}
        </div>
        {visiveis.length > 0 && (
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="link" style={{ fontSize: 12 }} onClick={() => onMarcarVisiveis(visiveis.map(x => x.id))}>marcar {q ? 'encontrados' : 'todos'}</button>
          </div>
        )}
      </header>
      <div className="body">
        {visiveis.length ? visiveis.map(x => {
          const marcado = sel?.g === g.id && sel.ids.has(x.id)
          const arrastando = drag?.from === g.id && drag.ids.includes(x.id)
          const n = nMed(g.id, x.id)
          const pronto = stat(ctx, g.id, x.id, 'aprovado').n >= ctx.cfg.minimo
          return (
            <div
              key={x.id}
              className={'dchip' + (marcado ? ' sel' : '') + (arrastando ? ' arrastando' : '')}
              draggable={!ocupado}
              onDragStart={e => onDragStart(e, g.id, x.id)}
              onDragEnd={onDragEnd}
              onClick={() => onSel(g.id, x.id)}
              title={x.nome}
            >
              <span className="h">⠿</span>
              <span className="n">{x.nome}</span>
              {n > 0 && <span className={'badge' + (pronto ? ' ok' : '')} title={`${n} medição(ões) neste grupo`}>{n}</span>}
              {!g.padrao && (
                <button type="button" className="x" title="Remover deste grupo" onClick={e => { e.stopPropagation(); onRemover(x.id) }}>✕</button>
              )}
            </div>
          )
        }) : <div className="vazio">{q ? 'Nenhum documento encontrado.' : 'Arraste documentos pra cá'}</div>}
      </div>
      <div className="foot">
        <input list={listId} value={novo} placeholder="+ documento do catálogo…" aria-label={'Incluir documento em ' + g.nome}
          onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') adicionar() }} />
        <datalist id={listId}>{naoEstao.map(x => <option key={x.id} value={x.nome} />)}</datalist>
        <button type="button" className="btn sm" disabled={!naoEstao.some(x => norm(x.nome) === norm(novo))} onClick={adicionar}>＋</button>
      </div>
    </div>
  )
}
