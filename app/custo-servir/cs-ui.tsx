'use client'

import { useState } from 'react'
import { ACOES, useCs, type Hist } from './cs-data'
import { dt, mmss, nomeUsuario, type Medicao, type SituacaoDoc } from './cs-lib'

// ── Ordenacao com setas crescente/decrescente ────────────────────────────────
export type Dir = 'asc' | 'desc'
export type Ordem = { col: string; dir: Dir }
type Valor = string | number | null | undefined
type Getters<T> = Record<string, (r: T) => Valor>

const comparar = (a: Valor, b: Valor) => {
  const va = a === '' ? null : a, vb = b === '' ? null : b
  if (va == null && vb == null) return 0
  if (va == null) return 1             // vazios sempre no fim
  if (vb == null) return -1
  if (typeof va === 'number' && typeof vb === 'number') return va - vb
  return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' })
}

export function ordenar<T>(rows: T[], getters: Getters<T>, o: Ordem): T[] {
  const g = getters[o.col]
  if (!g) return rows
  const vazio = (v: Valor) => v == null || v === ''
  return [...rows].sort((x, y) => {
    const a = g(x), b = g(y)
    if (vazio(a) || vazio(b)) return comparar(a, b)  // vazios no fim nas duas direcoes
    const c = comparar(a, b)
    return o.dir === 'asc' ? c : -c
  })
}

function Setas({ ativo, dir, onDir }: { ativo: boolean; dir: Dir; onDir: (d: Dir) => void }) {
  return (
    <span className="setas">
      <button type="button" className={ativo && dir === 'asc' ? 'on' : ''} title="Crescente (A→Z, 0→9)" aria-label="Ordenar crescente"
        onClick={e => { e.stopPropagation(); onDir('asc') }}>▲</button>
      <button type="button" className={ativo && dir === 'desc' ? 'on' : ''} title="Decrescente (Z→A, 9→0)" aria-label="Ordenar decrescente"
        onClick={e => { e.stopPropagation(); onDir('desc') }}>▼</button>
    </span>
  )
}

/** Tabela ordenavel: devolve as linhas ordenadas e um gerador de <th> com setas. */
export function useOrdem<T>(rows: T[], getters: Getters<T>, inicial: Ordem) {
  const [ord, setOrd] = useState<Ordem>(inicial)
  return { sorted: ordenar(rows, getters, ord), th: thOrdem(ord, setOrd), ord, setOrd }
}

/** Gerador de <th> com setas a partir de um estado de ordenacao ja existente. */
export function thOrdem(ord: Ordem, setOrd: (o: Ordem) => void) {
  function cabecalho(col: string, label: React.ReactNode, className = '', title?: string) {
    const ativo = ord.col === col
    return (
      <th key={col} className={('sortable ' + className).trim()} title={title}
        aria-sort={ativo ? (ord.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        onClick={() => setOrd(ativo ? { col, dir: ord.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })}>
        <span className="thc">{label}<Setas ativo={ativo} dir={ord.dir} onDir={dir => setOrd({ col, dir })} /></span>
      </th>
    )
  }
  return cabecalho
}

/** Seletor de ordenacao para listas em cartoes (campo + setas). */
export function OrdemControle({ ord, setOrd, opcoes }: {
  ord: Ordem; setOrd: (o: Ordem) => void; opcoes: { col: string; label: string }[]
}) {
  return (
    <span className="ordctl">
      <span className="note">Ordenar por</span>
      <select value={ord.col} onChange={e => setOrd({ ...ord, col: e.target.value })} aria-label="Ordenar por">
        {opcoes.map(o => <option key={o.col} value={o.col}>{o.label}</option>)}
      </select>
      <Setas ativo dir={ord.dir} onDir={dir => setOrd({ ...ord, dir })} />
    </span>
  )
}

/** Icone de catraca de acesso (torniquete). */
export function IconeCatraca({ size = 14, title = 'Tem catraca de acesso' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} style={{ verticalAlign: '-2px', flex: 'none' }}>
      <title>{title}</title>
      <rect x="3" y="3" width="4" height="18" rx="1.2" fill="#2A4F96" />
      <circle cx="5" cy="9" r="1.6" fill="#D1AE6E" />
      <path d="M7 9h13M7 9l9.5-5.5M7 9l9.5 5.5" stroke="#2A4F96" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** Selo "catraca" para usar ao lado do nome do contratante. */
export function SeloCatraca({ n, compacto }: { n?: number; compacto?: boolean }) {
  const t = n ? `Catraca de acesso · ${n} turno${n > 1 ? 's' : ''} com código de integração` : 'Catraca de acesso'
  return (
    <span className="selo-cat" title={t}>
      <IconeCatraca size={13} title={t} />{!compacto && <span>catraca</span>}
    </span>
  )
}

export function PillSituacao({ s }: { s: SituacaoDoc }) {
  if (s === 'pronto') return <span className="pill p-good">Pronto</span>
  if (s === 'andamento') return <span className="pill p-warn">Em andamento</span>
  return <span className="pill p-gray">Sem medição</span>
}

export const PillResultado = ({ r }: { r: Medicao['resultado'] }) =>
  r === 'aprovado' ? <span className="pill p-good">Aprov.</span> : <span className="pill p-bad">Reprov.</span>

export const PillMedicao = ({ m }: { m: Medicao }) =>
  m.situacao === 'validada'
    ? <span className="pill p-blue">Na média</span>
    : <span className="pill p-gray" title={m.motivo ?? ''}>Descartada</span>

/** Etiqueta das medicoes transportadas de outro grupo ("tempo padrao"). */
export function PillOrigem({ m }: { m: Medicao }) {
  const { d } = useCs()
  if (!m.origem_id) return null
  const raiz = d.meds.find(x => x.id === m.origem_id)
  const g = d.grupos.find(x => x.id === raiz?.grupo_id)
  return <span className="pill p-tp" title={'Medição transportada de ' + (g?.nome ?? 'outro grupo')}>Tempo padrão</span>
}

/** Excluir medicao (duas etapas). Avisa quando ha copias de tempo padrao que saem junto. */
export function BotaoExcluirMedicao({ m }: { m: Medicao }) {
  const { d, excluirMedicao, tentar } = useCs()
  const copias = d.meds.filter(x => x.origem_id === m.id).length
  return (
    <span title={copias ? `Exclui também ${copias} cópia${copias > 1 ? 's' : ''} de tempo padrão em outros grupos` : 'Excluir medição'}>
      <BotaoConfirmar onConfirm={() => void tentar(() => excluirMedicao(m), copias ? `Medição e ${copias} cópia(s) excluídas` : 'Medição excluída')}>
        Excluir{copias ? ` (+${copias})` : ''}
      </BotaoConfirmar>
    </span>
  )
}

/** Botao de duas etapas (clica, vira "Confirmar" por 3 s). */
export function BotaoConfirmar({ children, onConfirm, className = 'btn sm bad', disabled }: {
  children: React.ReactNode; onConfirm: () => void; className?: string; disabled?: boolean
}) {
  const [armado, setArmado] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      className={className + (armado ? ' solid' : '')}
      onClick={() => {
        if (!armado) { setArmado(true); setTimeout(() => setArmado(false), 3000); return }
        setArmado(false); onConfirm()
      }}
    >{armado ? 'Confirmar' : children}</button>
  )
}

function Historico({ medicaoId }: { medicaoId: string }) {
  const { historico, d } = useCs()
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState<Hist[] | null>(null)
  if (!aberto) {
    return <button type="button" className="link" onClick={() => {
      setAberto(true)
      historico(medicaoId).then(setItens).catch(() => setItens([]))
    }}>ver</button>
  }
  return (
    <div>
      <div className="hist">
        {itens === null ? <span>Carregando…</span> : itens.length === 0 ? <span>Sem registros.</span> : itens.map(h => (
          <span key={h.id}>
            <b className="mono">{dt(h.created_at)}</b> · {nomeUsuario(d.usuarios.find(u => u.id === h.usuario_id))} · {ACOES[h.acao] ?? h.acao}
            {h.detalhe ? `: ${h.detalhe}` : ''}
          </span>
        ))}
      </div>
      <button type="button" className="link" onClick={() => { setAberto(false); setItens(null) }}>fechar</button>
    </div>
  )
}

export function TabelaMedicoes({ lista, compacta, maxH }: { lista: Medicao[]; compacta?: boolean; maxH?: number }) {
  const { d, alternarMedicao, tentar } = useCs()
  const nomeGrupo = (id: string | null) => (id ? d.grupos.find(g => g.id === id)?.nome ?? '—' : '(grupo excluído)')
  const nomeDoc = (id: string) => d.docs.find(x => x.id === id)?.nome ?? '—'
  const nomeAv = (id: string) => nomeUsuario(d.usuarios.find(u => u.id === id))
  const { sorted: ordenada, th } = useOrdem(lista, {
    data: m => m.created_at, grupo: m => nomeGrupo(m.grupo_id), doc: m => nomeDoc(m.documento_id),
    avaliador: m => nomeAv(m.avaliador_id), resultado: m => m.resultado, tempo: m => m.duracao_ms,
    situacao: m => m.situacao, motivo: m => m.motivo,
  }, { col: 'data', dir: 'desc' })
  return (
    <div className="tbl scroll" style={maxH ? { maxHeight: maxH } : undefined}>
      <table>
        <thead>
          <tr>
            {th('data', 'Data e hora')}
            {!compacta && <>{th('grupo', 'Grupo')}{th('doc', 'Documento')}</>}
            {th('avaliador', 'Avaliador')}{th('resultado', 'Resultado')}{th('tempo', 'Tempo', 'r')}{th('situacao', 'Situação')}{th('motivo', 'Motivo')}
            <th>Histórico</th><th />
          </tr>
        </thead>
        <tbody>
          {ordenada.length ? ordenada.map(m => (
            <tr key={m.id}>
              <td className="mono">{dt(m.created_at)}</td>
              {!compacta && <><td>{nomeGrupo(m.grupo_id)}</td><td style={{ maxWidth: 280 }}>{nomeDoc(m.documento_id)}</td></>}
              <td>{nomeUsuario(d.usuarios.find(u => u.id === m.avaliador_id))}</td>
              <td><PillResultado r={m.resultado} /></td>
              <td className="r mono">{mmss(m.duracao_ms)}</td>
              <td><span className="pills"><PillMedicao m={m} /><PillOrigem m={m} /></span></td>
              <td className="note">{m.motivo ?? ''}</td>
              <td><Historico key={m.id + m.situacao + (m.grupo_id ?? '')} medicaoId={m.id} /></td>
              <td>
                <span className="pills">
                  <button
                    type="button"
                    className={'btn sm' + (m.situacao === 'validada' ? ' bad' : '')}
                    onClick={() => tentar(() => alternarMedicao(m), m.situacao === 'validada' ? 'Medição descartada' : 'Medição restaurada')}
                  >{m.situacao === 'validada' ? 'Descartar' : 'Restaurar'}</button>
                  <BotaoExcluirMedicao m={m} />
                </span>
              </td>
            </tr>
          )) : (
            <tr><td colSpan={compacta ? 8 : 10} className="empty">Nenhuma medição.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
