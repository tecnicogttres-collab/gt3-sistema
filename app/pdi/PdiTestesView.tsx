'use client'

// Visão unificada dos testes de perfil (Eneagrama, quatro animais e MBTI) de todos os PDIs.
// Só gestão (gestor/admin). Os dados vêm da própria lista de PDIs (estáticos + banco):
// nada novo é buscado. Clicar numa barra de distribuição filtra a tabela.

import { useMemo, useState } from 'react'
import Link from 'next/link'

export type TesteLinha = {
  id: string
  nome: string
  funcao: string
  arquivado: boolean
  eneagrama: { tipo: string; pontuacao: string }[]
  animais: { animal: string; emoji: string; percentual?: number }[]
  mbti: string | null
}

const COR_ANIMAL: Record<string, string> = { Lobo: '#2A4F96', Tubarão: '#D9730D', Gato: '#0F9F8F', Águia: '#9B5DE5' }
const EMOJI_ANIMAL: Record<string, string> = { Lobo: '🐺', Tubarão: '🦈', Gato: '🐱', Águia: '🦅' }
const ANIMAIS = ['Lobo', 'Tubarão', 'Gato', 'Águia']
const ENEA_NOMES: Record<number, string> = {
  1: 'Reformador', 2: 'Ajudante', 3: 'Realizador', 4: 'Individualista', 5: 'Observador',
  6: 'Lealista', 7: 'Entusiasta', 8: 'Confrontador', 9: 'Pacifista',
}
const MBTI_EIXOS: [string, string, string, string][] = [
  ['E', 'Extroversão', 'I', 'Introversão'],
  ['S', 'Sensação', 'N', 'Intuição'],
  ['T', 'Pensamento', 'F', 'Sentimento'],
  ['J', 'Julgamento', 'P', 'Percepção'],
]

const TX = '#1E293B', MU = '#6B7A99', LINE = '#E2E8F0', NAVY = '#1E3A6E', BLUE = '#2A4F96', GOLD = '#D1AE6E'

function numTipo(tipo: string): number | null {
  const m = tipo.match(/(\d)/)
  return m ? Number(m[1]) : null
}
function pts(p: string): number | null {
  const n = parseInt(p, 10)
  return Number.isFinite(n) ? n : null
}
function animaisOrdenados(l: TesteLinha) {
  return [...l.animais].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0))
}
function dominante(l: TesteLinha): string | null {
  return animaisOrdenados(l)[0]?.animal ?? null
}

type Ordem = 'nome' | 'eneagrama' | 'animal' | 'mbti'
type Filtros = {
  busca: string
  enea: number | null
  animal: string | null
  mbti: string | null
  letras: Record<number, string | null>
  arquivados: boolean
  soCompletos: boolean
}
const FILTROS_INIT: Filtros = { busca: '', enea: null, animal: null, mbti: null, letras: { 0: null, 1: null, 2: null, 3: null }, arquivados: false, soCompletos: false }

function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: string | number; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '.06em' }}>{rotulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: TX, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Painel({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TX }}>{titulo}</div>
        {acao}
      </div>
      {children}
    </div>
  )
}

/** Barra horizontal clicável (ativa = filtro aplicado). */
function BarraDist({ rotulo, sub, n, max, cor, ativo, apagado, onClick }: {
  rotulo: React.ReactNode; sub?: string; n: number; max: number; cor: string; ativo: boolean; apagado: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} title={ativo ? 'Remover filtro' : 'Filtrar'}
      style={{
        display: 'grid', gridTemplateColumns: 'minmax(110px, 1.1fr) 2fr 28px', gap: 8, alignItems: 'center', width: '100%',
        padding: '4px 6px', margin: '0 -6px', border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
        background: ativo ? '#EEF3FC' : 'transparent', opacity: apagado ? 0.45 : 1, fontFamily: 'inherit',
      }}>
      <span style={{ fontSize: 12.5, color: TX, fontWeight: ativo ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {rotulo}{sub && <span style={{ color: MU, fontWeight: 400 }}> {sub}</span>}
      </span>
      <span style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: max ? `${(n / max) * 100}%` : 0, background: cor, borderRadius: 4, transition: 'width .3s' }} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: n ? TX : '#CBD5E1', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
    </button>
  )
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${ativo ? BLUE : LINE}`, background: ativo ? BLUE : '#fff', color: ativo ? '#fff' : '#475569', fontWeight: ativo ? 600 : 500,
      }}>
      {children}
    </button>
  )
}

function exportarCsv(linhas: TesteLinha[]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const cab = ['Nome', 'Função', 'Status', 'Eneagrama 1º', 'Pontos 1º', 'Eneagrama 2º', 'Pontos 2º', 'Eneagrama 3º', 'Pontos 3º',
    ...ANIMAIS.map(a => `${a} %`), 'Animal dominante', 'MBTI']
  const corpo = linhas.map(l => {
    const e = [0, 1, 2].flatMap(i => [l.eneagrama[i]?.tipo ?? '', l.eneagrama[i]?.pontuacao ?? ''])
    const an = ANIMAIS.map(a => { const x = l.animais.find(y => y.animal === a); return x?.percentual != null ? String(x.percentual) : '' })
    return [l.nome, l.funcao, l.arquivado ? 'Arquivado' : 'Ativo', ...e, ...an, dominante(l) ?? '', l.mbti ?? ''].map(esc).join(';')
  })
  const blob = new Blob(['﻿' + [cab.map(esc).join(';'), ...corpo].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pdi-testes-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function PdiTestesView({ linhas }: { linhas: TesteLinha[] }) {
  const [f, setF] = useState<Filtros>(FILTROS_INIT)
  const [eneaModo, setEneaModo] = useState<'dominante' | 'top3'>('dominante')
  const [ordem, setOrdem] = useState<Ordem>('nome')

  // Base = respeita só "arquivados" e "só completos"; os demais filtros são aplicados por cima.
  const base = useMemo(() => linhas.filter(l =>
    (f.arquivados || !l.arquivado) &&
    (!f.soCompletos || (l.eneagrama.length > 0 && l.animais.length > 0 && !!l.mbti))
  ), [linhas, f.arquivados, f.soCompletos])

  const eneaTipos = (l: TesteLinha) =>
    (eneaModo === 'dominante' ? l.eneagrama.slice(0, 1) : l.eneagrama.slice(0, 3)).map(e => numTipo(e.tipo)).filter((n): n is number => n !== null)

  const filtradas = useMemo(() => {
    const q = f.busca.trim().toLowerCase()
    const r = base.filter(l => {
      if (q && !`${l.nome} ${l.funcao}`.toLowerCase().includes(q)) return false
      if (f.enea !== null && !eneaTipos(l).includes(f.enea)) return false
      if (f.animal && dominante(l) !== f.animal) return false
      if (f.mbti && l.mbti !== f.mbti) return false
      for (let i = 0; i < 4; i++) {
        const letra = f.letras[i]
        if (letra && l.mbti?.[i] !== letra) return false
      }
      return true
    })
    const cmpNome = (a: TesteLinha, b: TesteLinha) => a.nome.localeCompare(b.nome, 'pt-BR')
    const semFim = (v: string | number | null) => v === null ? '￿' : String(v)
    return r.sort((a, b) => {
      if (ordem === 'eneagrama') return semFim(numTipo(a.eneagrama[0]?.tipo ?? '')).localeCompare(semFim(numTipo(b.eneagrama[0]?.tipo ?? ''))) || cmpNome(a, b)
      if (ordem === 'animal') {
        const idx = (l: TesteLinha) => { const i = ANIMAIS.indexOf(dominante(l) ?? ''); return i < 0 ? 99 : i }
        return idx(a) - idx(b) || cmpNome(a, b)
      }
      if (ordem === 'mbti') return semFim(a.mbti).localeCompare(semFim(b.mbti)) || cmpNome(a, b)
      return cmpNome(a, b)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, f, ordem, eneaModo])

  // Estatísticas sobre o recorte filtrado
  const st = useMemo(() => {
    const comEnea = filtradas.filter(l => l.eneagrama.length)
    const comAnimais = filtradas.filter(l => l.animais.length)
    const comMbti = filtradas.filter(l => l.mbti)
    const enea: Record<number, number> = {}
    for (let t = 1; t <= 9; t++) enea[t] = 0
    for (const l of comEnea) for (const t of eneaTipos(l)) enea[t] = (enea[t] ?? 0) + 1
    const animalDom: Record<string, number> = Object.fromEntries(ANIMAIS.map(a => [a, 0]))
    const animalMedia: Record<string, number> = {}
    for (const a of ANIMAIS) {
      const vals = comAnimais.map(l => l.animais.find(x => x.animal === a)?.percentual).filter((v): v is number => v != null)
      animalMedia[a] = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0
    }
    for (const l of comAnimais) { const d = dominante(l); if (d) animalDom[d] = (animalDom[d] ?? 0) + 1 }
    const mbtiTipos: Record<string, number> = {}
    for (const l of comMbti) mbtiTipos[l.mbti!] = (mbtiTipos[l.mbti!] ?? 0) + 1
    const eixos = MBTI_EIXOS.map((_, i) => {
      const a = comMbti.filter(l => l.mbti![i] === MBTI_EIXOS[i][0]).length
      return { a, b: comMbti.length - a }
    })
    const completos = filtradas.filter(l => l.eneagrama.length && l.animais.length && l.mbti).length
    const eneaTop = Object.entries(enea).sort((a, b) => b[1] - a[1])[0]
    const animalTop = Object.entries(animalDom).sort((a, b) => b[1] - a[1])[0]
    const mbtiTop = Object.entries(mbtiTipos).sort((a, b) => b[1] - a[1])[0]
    return { comEnea: comEnea.length, comAnimais: comAnimais.length, comMbti: comMbti.length, enea, animalDom, animalMedia, mbtiTipos, eixos, completos, eneaTop, animalTop, mbtiTop }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, eneaModo])

  const temFiltro = !!(f.busca || f.enea !== null || f.animal || f.mbti || Object.values(f.letras).some(Boolean))
  const maxEnea = Math.max(1, ...Object.values(st.enea))
  const maxAnimal = Math.max(1, ...Object.values(st.animalDom))
  const mbtiOrd = Object.entries(st.mbtiTipos).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const maxMbti = Math.max(1, ...Object.values(st.mbtiTipos))
  const total = filtradas.length

  const thStyle: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', color: MU, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap', borderBottom: `2px solid ${LINE}`, background: '#F8FAFC' }
  const thOrd = (o: Ordem, rotulo: string) => (
    <th style={{ ...thStyle, cursor: 'pointer', color: ordem === o ? BLUE : MU }} onClick={() => setOrdem(o)} title="Ordenar">
      {rotulo}{ordem === o ? ' ▾' : ''}
    </th>
  )

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Filtros */}
      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input value={f.busca} onChange={e => setF({ ...f, busca: e.target.value })} placeholder="Buscar nome ou função…"
          style={{ padding: '7px 11px', border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, minWidth: 200, fontFamily: 'inherit', outline: 'none' }} />
        <select value={f.enea ?? ''} onChange={e => setF({ ...f, enea: e.target.value ? Number(e.target.value) : null })}
          style={{ padding: '7px 10px', border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">Eneagrama: todos</option>
          {Object.entries(ENEA_NOMES).map(([n, nome]) => <option key={n} value={n}>Tipo {n} · {nome}</option>)}
        </select>
        <select value={f.animal ?? ''} onChange={e => setF({ ...f, animal: e.target.value || null })}
          style={{ padding: '7px 10px', border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">Animal dominante: todos</option>
          {ANIMAIS.map(a => <option key={a} value={a}>{EMOJI_ANIMAL[a]} {a}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: MU, marginRight: 2 }}>MBTI</span>
          {MBTI_EIXOS.map(([a, la, b, lb], i) => (
            <span key={i} style={{ display: 'inline-flex', border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden' }}>
              {[[a, la], [b, lb]].map(([letra, nome]) => {
                const on = f.letras[i] === letra
                return (
                  <button key={letra} type="button" title={nome}
                    onClick={() => setF({ ...f, letras: { ...f.letras, [i]: on ? null : letra } })}
                    style={{ width: 26, padding: '5px 0', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: on ? NAVY : '#fff', color: on ? GOLD : '#475569' }}>
                    {letra}
                  </button>
                )
              })}
            </span>
          ))}
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
          <input type="checkbox" checked={f.soCompletos} onChange={e => setF({ ...f, soCompletos: e.target.checked })} /> Só com os 3 testes
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
          <input type="checkbox" checked={f.arquivados} onChange={e => setF({ ...f, arquivados: e.target.checked })} /> Incluir arquivados
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {temFiltro && <button type="button" onClick={() => setF({ ...FILTROS_INIT, arquivados: f.arquivados, soCompletos: f.soCompletos })}
            style={{ fontSize: 12.5, padding: '6px 12px', border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: '#475569', cursor: 'pointer' }}>✕ Limpar filtros</button>}
          <button type="button" onClick={() => exportarCsv(filtradas)} disabled={!total}
            style={{ fontSize: 12.5, padding: '6px 12px', border: `1px solid ${BLUE}`, borderRadius: 8, background: '#fff', color: BLUE, fontWeight: 600, cursor: total ? 'pointer' : 'not-allowed', opacity: total ? 1 : 0.5 }}>⬇ CSV</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 14 }}>
        <Kpi rotulo="Colaboradores" valor={total} sub={`${st.completos} com os 3 testes`} />
        <Kpi rotulo="Eneagrama" valor={`${st.comEnea}/${total}`}
          sub={st.eneaTop && st.eneaTop[1] ? `Mais comum: Tipo ${st.eneaTop[0]} · ${ENEA_NOMES[Number(st.eneaTop[0])]}` : 'Sem dados'} />
        <Kpi rotulo="Quatro animais" valor={`${st.comAnimais}/${total}`}
          sub={st.animalTop && st.animalTop[1] ? `Mais comum: ${EMOJI_ANIMAL[st.animalTop[0]] ?? ''} ${st.animalTop[0]}` : 'Sem dados'} />
        <Kpi rotulo="MBTI" valor={`${st.comMbti}/${total}`}
          sub={st.mbtiTop ? `Mais comum: ${st.mbtiTop[0]} (${st.mbtiTop[1]})` : 'Sem dados'} />
      </div>

      {/* Distribuições */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 14 }}>
        <Painel titulo="🔢 Eneagrama" acao={
          <div style={{ display: 'flex', gap: 4 }}>
            <Chip ativo={eneaModo === 'dominante'} onClick={() => setEneaModo('dominante')}>Dominante</Chip>
            <Chip ativo={eneaModo === 'top3'} onClick={() => setEneaModo('top3')}>No top 3</Chip>
          </div>
        }>
          {Object.entries(ENEA_NOMES).map(([n, nome]) => {
            const t = Number(n)
            return <BarraDist key={n} rotulo={`Tipo ${n}`} sub={nome} n={st.enea[t]} max={maxEnea} cor={BLUE}
              ativo={f.enea === t} apagado={f.enea !== null && f.enea !== t}
              onClick={() => setF({ ...f, enea: f.enea === t ? null : t })} />
          })}
        </Painel>

        <Painel titulo="🐾 Quatro animais">
          <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Dominante</div>
          {ANIMAIS.map(a => (
            <BarraDist key={a} rotulo={`${EMOJI_ANIMAL[a]} ${a}`} n={st.animalDom[a]} max={maxAnimal} cor={COR_ANIMAL[a]}
              ativo={f.animal === a} apagado={!!f.animal && f.animal !== a}
              onClick={() => setF({ ...f, animal: f.animal === a ? null : a })} />
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '.05em', margin: '14px 0 6px' }}>Média do grupo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {ANIMAIS.map(a => (
              <div key={a} style={{ textAlign: 'center', borderTop: `3px solid ${COR_ANIMAL[a]}`, background: '#F8FAFC', borderRadius: 8, padding: '6px 4px' }}>
                <div style={{ fontSize: 16 }}>{EMOJI_ANIMAL[a]}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: COR_ANIMAL[a], fontVariantNumeric: 'tabular-nums' }}>{st.animalMedia[a]}%</div>
              </div>
            ))}
          </div>
        </Painel>

        <Painel titulo="🧠 MBTI">
          {!st.comMbti ? <div style={{ fontSize: 12.5, color: '#94A3B8', fontStyle: 'italic' }}>Nenhum MBTI no recorte.</div> : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {MBTI_EIXOS.map(([a, la, b, lb], i) => {
                  const { a: na, b: nb } = st.eixos[i]
                  const pa = Math.round((na / st.comMbti) * 100)
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MU, marginBottom: 3 }}>
                        <span><b style={{ color: TX }}>{a}</b> {la} · {na}</span>
                        <span>{nb} · {lb} <b style={{ color: TX }}>{b}</b></span>
                      </div>
                      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#F1F5F9' }}>
                        <span style={{ width: `${pa}%`, background: NAVY }} />
                        <span style={{ width: `${100 - pa}%`, background: GOLD }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Tipos</div>
              {mbtiOrd.map(([t, n]) => (
                <BarraDist key={t} rotulo={<b style={{ letterSpacing: '.08em' }}>{t}</b>} n={n} max={maxMbti} cor={NAVY}
                  ativo={f.mbti === t} apagado={!!f.mbti && f.mbti !== t}
                  onClick={() => setF({ ...f, mbti: f.mbti === t ? null : t })} />
              ))}
            </>
          )}
        </Painel>
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, fontSize: 12.5 }}>
            <thead>
              <tr>
                {thOrd('nome', 'Colaborador')}
                {thOrd('eneagrama', 'Eneagrama (top 3)')}
                {thOrd('animal', 'Quatro animais')}
                {thOrd('mbti', 'MBTI')}
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l, li) => {
                const an = animaisOrdenados(l)
                const somaAn = an.reduce((s, a) => s + (a.percentual ?? 0), 0) || 1
                return (
                  <tr key={l.id} style={{ borderBottom: li < filtradas.length - 1 ? `1px solid #F1F5F9` : 'none', opacity: l.arquivado ? 0.65 : 1 }}>
                    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: TX }}>{l.nome}{l.arquivado && <span style={{ fontSize: 10, fontWeight: 600, color: MU, marginLeft: 6 }}>arquivado</span>}</div>
                      <div style={{ fontSize: 11.5, color: MU }}>{l.funcao || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                      {!l.eneagrama.length ? <span style={{ color: '#CBD5E1' }}>—</span> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {l.eneagrama.slice(0, 3).map((e, i) => {
                            const t = numTipo(e.tipo), p = pts(e.pontuacao)
                            const destaque = f.enea !== null && t === f.enea
                            return (
                              <div key={i} style={{ display: 'grid', gridTemplateColumns: '18px 130px 60px 40px', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: MU }}>{i + 1}º</span>
                                <span style={{ fontWeight: i === 0 ? 700 : 500, color: destaque ? BLUE : TX, whiteSpace: 'nowrap' }}>T{t ?? '?'} {t ? ENEA_NOMES[t] : e.tipo}</span>
                                <span style={{ height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                                  <span style={{ display: 'block', height: '100%', width: p !== null ? `${(p / 25) * 100}%` : 0, background: i === 0 ? BLUE : '#9FB3D9' }} />
                                </span>
                                <span style={{ fontSize: 11, color: MU, fontVariantNumeric: 'tabular-nums' }}>{e.pontuacao || '—'}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'top', minWidth: 230 }}>
                      {!an.length ? <span style={{ color: '#CBD5E1' }}>—</span> : (
                        <>
                          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1, marginBottom: 5 }}>
                            {an.map(a => <span key={a.animal} title={`${a.animal} ${a.percentual ?? 0}%`} style={{ width: `${((a.percentual ?? 0) / somaAn) * 100}%`, background: COR_ANIMAL[a.animal] ?? '#94A3B8' }} />)}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {an.map((a, i) => (
                              <span key={a.animal} style={{ fontSize: 11.5, color: i === 0 ? TX : MU, fontWeight: i === 0 ? 700 : 500, whiteSpace: 'nowrap' }}>
                                {a.emoji || EMOJI_ANIMAL[a.animal]} {a.animal}{a.percentual != null ? ` ${a.percentual}%` : ''}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                      {l.mbti
                        ? <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: NAVY, color: GOLD, letterSpacing: '.08em' }}>{l.mbti}</span>
                        : <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'top', textAlign: 'right' }}>
                      <Link href={`/pdi/${l.id}`} style={{ fontSize: 12, color: BLUE, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Abrir PDI →</Link>
                    </td>
                  </tr>
                )
              })}
              {!filtradas.length && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>Ninguém corresponde aos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: '#94A3B8', textAlign: 'center', marginTop: 10 }}>
        Os testes são instrumentos de reflexão, não diagnóstico. Estatísticas calculadas sobre o recorte filtrado.
      </div>
    </div>
  )
}
