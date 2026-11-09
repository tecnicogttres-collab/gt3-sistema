'use client'

// "Tempo padrao": usar medicoes de um grupo em outros grupos para o mesmo documento.
// Enviar: deste grupo para um ou varios grupos. Trazer: de outro grupo para este (o padrao vem primeiro).

import { useMemo, useState } from 'react'
import { useCs } from '../cs-data'
import { dt, mmss, nomeCtt, nomeUsuario, type Ctx, type Grupo, type Medicao } from '../cs-lib'
import { PillResultado } from '../cs-ui'

export type ModoTransporte = 'enviar' | 'trazer'

export default function TransportarTempo({ ctx, g, docId, docNome, modo, fechar }: {
  ctx: Ctx; g: Grupo; docId: string; docNome: string; modo: ModoTransporte; fechar: () => void
}) {
  return (
    <div className="cs-modal" onClick={e => { if (e.target === e.currentTarget) fechar() }}>
      <div className="cs" style={{ maxWidth: 900 }}>
        <div className="row between">
          <div>
            <div className="eyebrow">{g.nome} · {docNome}</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--cs-edge-2)' }}>
              {modo === 'enviar' ? 'Usar estas medições como tempo padrão em outros grupos' : 'Trazer medições de outro grupo como tempo padrão'}
            </h2>
          </div>
          <button type="button" className="btn" onClick={fechar}>Fechar</button>
        </div>
        <p className="note">
          As medições transportadas entram no cálculo do grupo de destino com a etiqueta <span className="pill p-tp">Tempo padrão</span>.
          Medições feitas direto no grupo continuam contando como medição própria. Excluir a medição original exclui também as cópias.
        </p>
        {modo === 'enviar'
          ? <Enviar ctx={ctx} g={g} docId={docId} fechar={fechar} />
          : <Trazer ctx={ctx} g={g} docId={docId} fechar={fechar} />}
      </div>
    </div>
  )
}

const raizDe = (m: Medicao) => m.origem_id ?? m.id

function LinhaMed({ m, marcado, desativado, aviso, onChange }: {
  m: Medicao; marcado: boolean; desativado?: boolean; aviso?: string; onChange: (v: boolean) => void
}) {
  const { d } = useCs()
  return (
    <label className={desativado ? 'off' : ''} title={aviso}>
      <input type="checkbox" checked={marcado} disabled={desativado} onChange={e => onChange(e.target.checked)} />
      <b className="mono">{mmss(m.duracao_ms)}</b>
      <PillResultado r={m.resultado} />
      {m.origem_id && <span className="pill p-tp">Tempo padrão</span>}
      <span className="note">{nomeUsuario(d.usuarios.find(u => u.id === m.avaliador_id))} · {dt(m.created_at)}</span>
      {aviso && <span className="note">· {aviso}</span>}
    </label>
  )
}

function Enviar({ ctx, g, docId, fechar }: { ctx: Ctx; g: Grupo; docId: string; fechar: () => void }) {
  const { d, transportarMedicoes, tentar, toast } = useCs()
  const aqui = useMemo(() => d.meds.filter(m => m.grupo_id === g.id && m.documento_id === docId && m.situacao === 'validada'), [d.meds, g.id, docId])
  const [selMeds, setSelMeds] = useState<Set<string>>(() => new Set(aqui.map(m => m.id)))
  const [destinos, setDestinos] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)

  const temDoc = (gid: string) => !!ctx.gd.get(gid)?.has(docId)
  const grupos = ctx.grupos.filter(x => x.id !== g.id).sort((a, b) =>
    (+b.padrao - +a.padrao) || (+temDoc(b.id) - +temDoc(a.id)) || a.nome.localeCompare(b.nome, 'pt-BR'))
  const escolhidas = aqui.filter(m => selMeds.has(m.id))
  const jaRecebeu = (gid: string) => escolhidas.filter(m => d.meds.some(x => x.grupo_id === gid && (x.id === raizDe(m) || x.origem_id === raizDe(m)))).length
  const toggle = (set: Set<string>, id: string, v: boolean) => { const n = new Set(set); if (v) n.add(id); else n.delete(id); return n }

  async function confirmar() {
    setSalvando(true)
    const okk = await tentar(async () => {
      const n = await transportarMedicoes(escolhidas, [...destinos])
      toast(n ? `${n} medição(ões) transportada(s) como tempo padrão para ${destinos.size} grupo(s)` : 'Esses grupos já tinham essas medições.')
    })
    setSalvando(false)
    if (okk) fechar()
  }

  if (!aqui.length) return <div className="empty">Nenhuma medição validada neste grupo para este documento.</div>
  return (
    <>
      <div className="tp-bloco">
        <div className="row between">
          <b>1. Medições validadas deste grupo ({escolhidas.length} de {aqui.length})</b>
          <div className="row">
            <button type="button" className="btn sm" onClick={() => setSelMeds(new Set(aqui.map(m => m.id)))}>Todas</button>
            <button type="button" className="btn sm" onClick={() => setSelMeds(new Set())}>Nenhuma</button>
          </div>
        </div>
        <div className="tp-lista">
          {aqui.map(m => <LinhaMed key={m.id} m={m} marcado={selMeds.has(m.id)} onChange={v => setSelMeds(s => toggle(s, m.id, v))} />)}
        </div>
      </div>
      <div className="tp-bloco">
        <div className="row between">
          <b>2. Grupos de destino ({destinos.size})</b>
          <div className="row">
            <button type="button" className="btn sm" onClick={() => setDestinos(new Set(grupos.filter(x => temDoc(x.id)).map(x => x.id)))}>Grupos com este documento</button>
            <button type="button" className="btn sm" onClick={() => setDestinos(new Set(grupos.map(x => x.id)))}>Todos</button>
            <button type="button" className="btn sm" onClick={() => setDestinos(new Set())}>Limpar</button>
          </div>
        </div>
        <div className="tp-lista tp-grid">
          {grupos.map(x => {
            const ja = jaRecebeu(x.id)
            const info = [
              x.padrao ? 'grupo padrão' : x.contratantes.slice(0, 2).map(c => nomeCtt(ctx, c).slice(0, 18)).join(', ') + (x.contratantes.length > 2 ? '…' : ''),
              temDoc(x.id) ? '' : 'documento será incluído',
              ja ? `já tem ${ja}` : '',
            ].filter(Boolean).join(' · ')
            return (
              <label key={x.id}>
                <input type="checkbox" checked={destinos.has(x.id)} onChange={e => setDestinos(s => toggle(s, x.id, e.target.checked))} />
                <span><b style={{ fontWeight: 700 }}>{x.nome}</b>{info && <><br /><span className="note">{info}</span></>}</span>
              </label>
            )
          })}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={fechar}>Cancelar</button>
        <button type="button" className="btn solid" disabled={salvando || !escolhidas.length || !destinos.size} onClick={() => void confirmar()}>
          Usar como tempo padrão em {destinos.size} grupo{destinos.size === 1 ? '' : 's'}
        </button>
      </div>
    </>
  )
}

function Trazer({ ctx, g, docId, fechar }: { ctx: Ctx; g: Grupo; docId: string; fechar: () => void }) {
  const { d, transportarMedicoes, tentar, toast } = useCs()
  const jaAqui = (m: Medicao) => d.meds.some(x => x.grupo_id === g.id && (x.id === raizDe(m) || x.origem_id === raizDe(m)))
  // So medicoes originais (cada uma aparece uma vez, no grupo onde foi feita); o padrao vem primeiro
  const blocos = useMemo(() => {
    const origem = d.meds.filter(m => !m.origem_id && m.documento_id === docId && m.situacao === 'validada' && m.grupo_id && m.grupo_id !== g.id)
    return ctx.grupos.filter(x => x.id !== g.id)
      .map(x => ({ g: x, meds: origem.filter(m => m.grupo_id === x.id) }))
      .filter(b => b.meds.length)
      .sort((a, b) => (+b.g.padrao - +a.g.padrao) || a.g.nome.localeCompare(b.g.nome, 'pt-BR'))
  }, [d.meds, ctx.grupos, g.id, docId])
  const [sel, setSel] = useState<Set<string>>(() => new Set(blocos.filter(b => b.g.padrao).flatMap(b => b.meds).filter(m => !jaAqui(m)).map(m => m.id)))
  const [verOutros, setVerOutros] = useState(() => !blocos.some(b => b.g.padrao))
  const [salvando, setSalvando] = useState(false)
  const escolhidas = blocos.flatMap(b => b.meds).filter(m => sel.has(m.id))
  const toggle = (id: string, v: boolean) => setSel(s => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n })

  async function confirmar() {
    setSalvando(true)
    const okk = await tentar(async () => {
      const n = await transportarMedicoes(escolhidas, [g.id])
      toast(n ? `${n} medição(ões) trazida(s) como tempo padrão` : 'Essas medições já estavam neste grupo.')
    })
    setSalvando(false)
    if (okk) fechar()
  }

  if (!blocos.length) return <div className="empty">Nenhum outro grupo tem medição validada deste documento.</div>
  const padrao = blocos.filter(b => b.g.padrao), outros = blocos.filter(b => !b.g.padrao)
  const bloco = (b: typeof blocos[number]) => {
    const livres = b.meds.filter(m => !jaAqui(m))
    return (
      <div key={b.g.id} className={'tp-bloco' + (b.g.padrao ? ' padrao' : '')}>
        <div className="row between">
          <div>
            <span className="eyebrow">{b.g.padrao ? 'Grupo padrão · recomendado' : 'Grupo específico'}</span>
            <div><b>{b.g.nome}</b> <span className="note">· {b.meds.length} medição(ões) validada(s)</span></div>
          </div>
          {livres.length > 0 && (
            <button type="button" className="btn sm" onClick={() => setSel(s => { const n = new Set(s); const todas = livres.every(m => n.has(m.id)); livres.forEach(m => (todas ? n.delete(m.id) : n.add(m.id))); return n })}>
              {livres.every(m => sel.has(m.id)) ? 'Desmarcar' : 'Marcar'} todas
            </button>
          )}
        </div>
        <div className="tp-lista">
          {b.meds.map(m => {
            const ja = jaAqui(m)
            return <LinhaMed key={m.id} m={m} marcado={ja || sel.has(m.id)} desativado={ja} aviso={ja ? 'já está neste grupo' : undefined} onChange={v => toggle(m.id, v)} />
          })}
        </div>
      </div>
    )
  }
  return (
    <>
      {padrao.map(bloco)}
      {outros.length > 0 && (padrao.length && !verOutros
        ? <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setVerOutros(true)}>Ver medições de outros grupos ({outros.length})</button>
        : outros.map(bloco))}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={fechar}>Cancelar</button>
        <button type="button" className="btn solid" disabled={salvando || !escolhidas.length} onClick={() => void confirmar()}>
          Trazer {escolhidas.length} medição{escolhidas.length === 1 ? '' : 'ões'} como tempo padrão
        </button>
      </div>
    </>
  )
}
