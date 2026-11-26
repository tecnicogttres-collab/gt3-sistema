'use client'

// Linha do tempo: uma visão única, por data, de tudo o que aconteceu no PDI —
// anotações do Diário, ações criadas/concluídas, etapas feitas, pesquisas
// enviadas/respondidas, ciclos e conversas. Filtra por origem e por competência.

import { useMemo, useState } from 'react'
import type { PdiColaborador } from '../../../../data/pdis/types'
import type { Acompanhamento } from './useAcompanhamento'
import { C, Pill, Vazio, Alerta, Carregando, TIPOS, cx, fmtData, respostaCurta } from './pdi-ui'
import { MESES } from './DiarioTab'
import { textoPlano } from './RichText'
import { resumoResposta } from '../../popup-ui'
import { SITUACOES } from '../../../lib/pdi-checkin'

type Origem = 'diario' | 'acoes' | 'registros' | 'pesquisas' | 'ciclos' | 'detalhes'

type Evento = {
  id: string
  quando: string          // ISO (data ou data-hora)
  origem: Origem
  icon: string
  cor: string
  bg: string
  titulo: string
  texto?: string
  competencias: string[]
  extra?: React.ReactNode
}

const ORIGENS: { id: Origem; label: string; icon: string; soGestao?: boolean }[] = [
  { id: 'diario', label: 'Diário', icon: '📓' },
  { id: 'acoes', label: 'Ações e etapas', icon: '🎯' },
  { id: 'registros', label: 'Pop-ups', icon: '⚡' },
  { id: 'pesquisas', label: 'Pesquisas', icon: '📝' },
  { id: 'ciclos', label: 'Ciclos e conversas', icon: '🔄' },
  { id: 'detalhes', label: 'Movimentações', icon: '⚙️', soGestao: true },
]

// Eventos do histórico que já aparecem por outra origem (evita duplicar)
const HIST_COBERTO = new Set(['Ação criada', 'Ação concluída', 'Pesquisa ligada', 'Registro rápido respondido', 'Pop-up respondido'])

export default function LinhaDoTempoTab({ pdi, canEdit, dados, competenciaInicial }: {
  pdi: PdiColaborador; canEdit: boolean; dados: Acompanhamento; competenciaInicial?: string
}) {
  const [origens, setOrigens] = useState<Set<Origem>>(new Set(['diario', 'acoes', 'registros', 'pesquisas', 'ciclos']))
  const [comp, setComp] = useState(competenciaInicial ?? '')

  const eventos = useMemo(() => {
    const ev: Evento[] = []
    const compDaAcao = (id: string | null) => dados.acoes.find(a => a.id === id)?.competencia

    for (const n of dados.anotacoes) {
      const m = TIPOS[n.tipo] ?? TIPOS.observacao
      ev.push({
        id: `n-${n.id}`, quando: n.data, origem: 'diario', icon: m.icon, cor: m.color, bg: m.bg,
        titulo: m.label + (n.tipo === 'investigar' ? (n.resolvido ? ' · respondido' : ' · em aberto') : ''),
        texto: textoPlano(n.texto) + (n.resposta ? `\n↳ ${n.resposta}` : ''),
        competencias: [n.competencia, compDaAcao(n.acao_id)].filter(Boolean) as string[],
        extra: canEdit && !n.visivel ? <Pill bg="#EEF2F7" color="#475569">🔒 Só gestão</Pill> : undefined,
      })
    }

    for (const a of dados.acoes) {
      ev.push({ id: `a-${a.id}`, quando: a.created_at, origem: 'acoes', icon: '🎯', cor: '#3730A3', bg: '#EEF2FF', titulo: `Ação criada: ${a.competencia}`, texto: a.desenvolver, competencias: [a.competencia] })
      if (a.concluido_em) ev.push({ id: `ac-${a.id}`, quando: a.concluido_em, origem: 'acoes', icon: '🏁', cor: '#166534', bg: '#E8F7F0', titulo: `Ação concluída: ${a.competencia}`, texto: [a.resultado_alcancado, a.evidencia && `Evidência: ${a.evidencia}`].filter(Boolean).join('\n'), competencias: [a.competencia] })
    }
    for (const e of dados.etapas) {
      if (!e.concluido_em) continue
      const c = compDaAcao(e.acao_id)
      ev.push({ id: `e-${e.id}`, quando: e.concluido_em, origem: 'acoes', icon: '✓', cor: '#1E9E6A', bg: '#E8F7F0', titulo: `Etapa feita: ${e.titulo}`, texto: c ? `Ação: ${c}` : undefined, competencias: c ? [c] : [] })
    }

    for (const k of dados.checkins) {
      const m = SITUACOES[k.situacao]
      const c = compDaAcao(k.acao_id)
      ev.push({ id: `k-${k.id}`, quando: k.created_at, origem: 'registros', icon: m.icon, cor: m.cor, bg: m.bg, titulo: `Status da ação: ${m.label}${c ? ` em ${c}` : ''}`, texto: k.nota || undefined, competencias: c ? [c] : [] })
    }

    for (const r of dados.popupRespostas) {
      const outras = r.perguntas.filter(q => q.tipo !== 'acoes' && r.respostas[q.id] !== undefined)
      if (!outras.length) continue
      ev.push({ id: `pp-${r.id}`, quando: r.created_at, origem: 'registros', icon: r.icone, cor: r.cor, bg: r.cor + '18', titulo: r.titulo,
        texto: outras.map(q => `${q.texto} → ${resumoResposta(q, r.respostas[q.id])}`).join('\n'), competencias: [] })
    }

    for (const p of dados.pesquisas) {
      const lig = dados.vinculos.filter(v => v.convite_id === p.id)
      const comps = [...new Set(lig.map(v => v.competencia))]
      if (p.enviado_em) ev.push({ id: `pe-${p.id}`, quando: p.enviado_em, origem: 'pesquisas', icon: '📨', cor: '#475569', bg: '#EEF2F7', titulo: `Pesquisa enviada: ${p.titulo}`, competencias: comps })
      if (p.status === 'respondido' && p.respondido_em) {
        const destaques = lig.filter(v => v.pergunta_id).map(v => {
          const q = p.perguntas.find(x => x.id === v.pergunta_id)
          return q ? { comp: v.competencia, q: q.label, r: respostaCurta(p.respostas[q.id]) } : null
        }).filter(Boolean) as { comp: string; q: string; r: string }[]
        ev.push({
          id: `pr-${p.id}`, quando: p.respondido_em, origem: 'pesquisas', icon: '📝', cor: '#5B21B6', bg: '#F5F3FF',
          titulo: `Pesquisa respondida: ${p.titulo}`, competencias: comps,
          extra: destaques.length ? (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {destaques.map((d, i) => (
                <div key={i} style={{ fontSize: 12.5, background: 'var(--p2-sunken)', borderRadius: 8, padding: '6px 10px' }}>
                  <span style={{ color: C.MU }}>{d.q}</span> → <b>{d.r}</b> <span style={{ color: '#5B21B6', fontSize: 11.5 }}>· {d.comp}</span>
                </div>
              ))}
            </div>
          ) : undefined,
        })
      }
    }

    for (const c of dados.ciclos) {
      if (c.data_inicio) ev.push({ id: `ci-${c.id}`, quando: c.data_inicio, origem: 'ciclos', icon: '🔄', cor: '#1E40AF', bg: '#EBF4FF', titulo: `Ciclo ${c.numero_ciclo} iniciado`, competencias: [] })
      if (c.data_conversa) {
        const passou = c.data_conversa < new Date().toISOString()
        ev.push({ id: `cc-${c.id}`, quando: c.data_conversa, origem: 'ciclos', icon: '🗓️', cor: '#9C6B0B', bg: '#FBF6EC', titulo: passou ? `Conversa do ciclo ${c.numero_ciclo}` : `Conversa agendada (ciclo ${c.numero_ciclo})`, texto: c.conversa_confirmada_em ? 'Confirmada pelo colaborador' : undefined, competencias: [] })
      }
      if (c.arquivado_em) ev.push({ id: `ca-${c.id}`, quando: c.arquivado_em, origem: 'ciclos', icon: '📦', cor: '#475569', bg: '#EEF2F7', titulo: `Ciclo ${c.numero_ciclo} encerrado`, competencias: [] })
    }

    if (canEdit) {
      for (const h of dados.historico) {
        if (HIST_COBERTO.has(h.evento) || (h.evento === 'Etapa marcada' && h.detalhe.endsWith(': feita'))) continue
        const c = compDaAcao(h.acao_id)
        ev.push({ id: `h-${h.id}`, quando: h.created_at, origem: 'detalhes', icon: '·', cor: '#64748B', bg: '#F1F5F9', titulo: h.evento, texto: `${h.detalhe}${h.usuario_nome ? ` — ${h.usuario_nome}` : ''}`, competencias: c ? [c] : [] })
      }
    }

    return ev.sort((a, b) => b.quando.localeCompare(a.quando))
  }, [dados, canEdit])

  if (dados.carregando) return <Carregando txt="Montando a linha do tempo…" />

  const todasComps = [...new Set([...pdi.matrizAvaliacao.competencias, ...eventos.flatMap(e => e.competencias)])].sort()
  const visiveis = eventos.filter(e => origens.has(e.origem) && (!comp || e.competencias.includes(comp)))
  const grupos: { chave: string; label: string; itens: Evento[] }[] = []
  for (const e of visiveis) {
    const chave = e.quando.slice(0, 7)
    let g = grupos.find(x => x.chave === chave)
    if (!g) { g = { chave, label: `${MESES[Number(chave.slice(5, 7)) - 1]} de ${chave.slice(0, 4)}`, itens: [] }; grupos.push(g) }
    g.itens.push(e)
  }

  function toggle(o: Origem) {
    setOrigens(s => { const n = new Set(s); if (n.has(o)) n.delete(o); else n.add(o); return n })
  }

  return (
    <div>
      {dados.erro && <div style={{ marginBottom: 12 }}><Alerta>{dados.erro}</Alerta></div>}

      <div className="p2-card" style={{ marginBottom: 16 }}>
        <div className="p2-card-b" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px' }}>
          {ORIGENS.filter(o => !o.soGestao || canEdit).map(o => {
            const on = origens.has(o.id)
            const n = eventos.filter(e => e.origem === o.id).length
            return (
              <button key={o.id} type="button" onClick={() => toggle(o.id)} className="p2-chip"
                style={on ? { borderColor: C.P, background: 'var(--p2-blue-bg)', color: C.P } : { opacity: .75 }}>
                {o.icon} {o.label} · {n}
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          <select value={comp} onChange={e => setComp(e.target.value)} className="p2-input" style={{ padding: '6px 9px', maxWidth: 240 }}>
            <option value="">Todas as competências</option>
            {todasComps.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {comp && (
        <div style={{ fontSize: 13, color: C.MU, marginBottom: 6 }}>
          Mostrando só o que se liga a <b style={{ color: C.TX }}>{comp}</b>. <button type="button" className="p2-link" onClick={() => setComp('')}>Ver tudo</button>
        </div>
      )}

      {visiveis.length === 0 ? (
        <Vazio>Nada para mostrar com estes filtros.</Vazio>
      ) : (
        <div className="p2-tl" key={[...origens].join() + comp}>
          {grupos.map(g => (
            <div key={g.chave} className="p2-stagger">
              <div className="p2-tl-month">{g.label}</div>
              {g.itens.map(e => (
                <div key={e.id} className="p2-tl-item">
                  <div className="p2-tl-node" style={{ background: e.bg, color: e.cor, fontWeight: 800 }}>{e.icon}</div>
                  <div className={cx('p2-card', 'is-hover')} style={e.origem === 'detalhes' ? { background: '#FBFCFE', boxShadow: 'none' } : undefined}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <b style={{ fontSize: e.origem === 'detalhes' ? 12.5 : 13.5, color: e.origem === 'detalhes' ? C.MU : C.TX }}>{e.titulo}</b>
                      <span style={{ fontSize: 12, color: C.MU }}>{fmtData(e.quando)}</span>
                      {e.competencias.filter(c => c !== comp).map(c => (
                        <button key={c} type="button" onClick={() => setComp(c)} className="p2-pill" style={{ background: '#EEF2F7', color: '#334155', border: 'none', cursor: 'pointer' }} title="Filtrar por esta competência">{c}</button>
                      ))}                    </div>
                    {e.texto && <div style={{ fontSize: 13, color: '#374151', marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{e.texto}</div>}
                    {e.extra}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
