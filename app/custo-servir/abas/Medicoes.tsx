'use client'

import { useMemo, useState } from 'react'
import { useCs } from '../cs-data'
import { baixar, csvCell, nomeUsuario, norm } from '../cs-lib'
import { TabelaMedicoes } from '../cs-ui'

export default function Medicoes() {
  const { d } = useCs()
  const [g, setG] = useState('')
  const [u, setU] = useState('')
  const [sit, setSit] = useState('')
  const [res, setRes] = useState('')
  const [q, setQ] = useState('')

  const nomeDoc = useMemo(() => new Map(d.docs.map(x => [x.id, x.nome])), [d.docs])
  const nomeGrupo = useMemo(() => new Map(d.grupos.map(x => [x.id, x.nome])), [d.grupos])
  const nomeUsr = (id: string) => nomeUsuario(d.usuarios.find(x => x.id === id))

  let L = d.meds
  if (g === '__sem') L = L.filter(m => !m.grupo_id); else if (g) L = L.filter(m => m.grupo_id === g)
  if (u) L = L.filter(m => m.avaliador_id === u)
  if (sit) L = L.filter(m => m.situacao === sit)
  if (res) L = L.filter(m => m.resultado === res)
  if (q) L = L.filter(m => norm(nomeDoc.get(m.documento_id)).includes(norm(q)))

  const porAvaliador = new Map<string, number>()
  for (const m of d.meds) porAvaliador.set(m.avaliador_id, (porAvaliador.get(m.avaliador_id) ?? 0) + 1)
  const avaliadoresComMedicao = [...porAvaliador.keys()]

  function exportar() {
    const linhas = [['data_hora', 'grupo', 'documento', 'avaliador', 'resultado', 'duracao_seg', 'situacao', 'motivo']]
      .concat(L.map(m => [
        new Date(m.created_at).toLocaleString('pt-BR'),
        m.grupo_id ? nomeGrupo.get(m.grupo_id) ?? '' : '(grupo excluído)',
        nomeDoc.get(m.documento_id) ?? '',
        nomeUsr(m.avaliador_id),
        m.resultado,
        (m.duracao_ms / 1000).toFixed(1).replace('.', ','),
        m.situacao,
        m.motivo ?? '',
      ]))
    baixar('medicoes-custo-de-servir.csv', '﻿' + linhas.map(r => r.map(csvCell).join(';')).join('\n'))
  }

  return (
    <>
      <div className="tiles">
        <div className="tile"><b>{d.meds.length}</b><span>medições registradas</span></div>
        <div className="tile"><b>{d.meds.filter(m => m.situacao === 'validada').length}</b><span>validadas</span></div>
        <div className="tile"><b>{d.meds.filter(m => m.situacao === 'descartada').length}</b><span>descartadas</span></div>
        <div className="tile"><b>{porAvaliador.size}</b><span>avaliadores</span></div>
        <div className="tile"><b>{new Set(d.meds.map(m => m.grupo_id + '|' + m.documento_id)).size}</b><span>documentos medidos (por grupo)</span></div>
      </div>
      <div className="box">
        <div className="row between">
          <h2>Todas as medições</h2>
          <button type="button" className="btn" onClick={exportar} disabled={!L.length}>Exportar CSV</button>
        </div>
        <div className="row">
          <select aria-label="Grupo" value={g} onChange={e => setG(e.target.value)}>
            <option value="">Todos os grupos</option>
            {d.grupos.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
            {d.meds.some(m => !m.grupo_id) && <option value="__sem">(grupo excluído)</option>}
          </select>
          <select aria-label="Avaliador" value={u} onChange={e => setU(e.target.value)}>
            <option value="">Todos os avaliadores</option>
            {d.usuarios.filter(x => !x.desativado || avaliadoresComMedicao.includes(x.id)).map(x => (
              <option key={x.id} value={x.id}>{nomeUsuario(x)}</option>
            ))}
          </select>
          <select aria-label="Situação" value={sit} onChange={e => setSit(e.target.value)}>
            <option value="">Qualquer situação</option>
            <option value="validada">Validadas</option>
            <option value="descartada">Descartadas</option>
          </select>
          <select aria-label="Resultado" value={res} onChange={e => setRes(e.target.value)}>
            <option value="">Aprovado e reprovado</option>
            <option value="aprovado">Aprovado</option>
            <option value="reprovado">Reprovado</option>
          </select>
          <input type="search" placeholder="Buscar documento" value={q} onChange={e => setQ(e.target.value)} />
          <span className="note">{L.length} de {d.meds.length}</span>
        </div>
        <TabelaMedicoes lista={L} />
        <div className="row">
          <span className="eyebrow">Medições por avaliador</span>
          {porAvaliador.size
            ? [...porAvaliador.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
              <span key={id} className="pill p-blue">{nomeUsr(id)} · {n}</span>
            ))
            : <span className="note">—</span>}
        </div>
      </div>
    </>
  )
}
