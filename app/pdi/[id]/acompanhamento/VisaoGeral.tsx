'use client'

// Visão geral do PDI — a primeira tela, completa num olhar.
// Gestão: atenção · ações · mapa de competências · perfil em resumo | conversas · Diário.
// Colaborador/trainee: próximos passos · mapa · perfil | conversas · recados · registros.

import type { PdiColaborador } from '../../../../data/pdis/types'
import type { Acompanhamento } from './useAcompanhamento'
import {
  C, Barra, Pill, Vazio, Card, Alerta, Carregando, STATUS_ACAO, TIPOS, progresso, prazoVencido, fmtData, diasDesde, hojeISO,
  type Acao, type Etapa,
} from './pdi-ui'
import { SITUACOES } from '../../../lib/pdi-checkin'
import { HUMOR, fmtQuando } from '../../../lib/pdi-popup'
import MapaCompetencias from './MapaCompetencias'
import DiarioPainel from './DiarioTab'
import { RichView } from './RichText'

export type IrPara = (tab: 'acoes' | 'avaliacoes' | 'perfil' | 'historico', competencia?: string) => void

const DIAS_PARADA = 30
const DIAS_SEM_CONVERSA = 45
// Paleta validada (dataviz/validate_palette.js): cor fixa por animal, nunca pela posição
const COR_ANIMAL: Record<string, string> = { Lobo: '#2A4F96', Tubarão: '#D9730D', Gato: '#0F9F8F', Águia: '#9B5DE5' }

const proximaEtapa = (etapas: Etapa[]) => [...etapas].sort((a, b) => a.ordem - b.ordem).find(e => e.status !== 'ok' && e.status !== 'na')

// ── Peças ────────────────────────────────────────────────────────────

function LinhaAcao({ a, dados, onClick, paraColaborador }: { a: Acao; dados: Acompanhamento; onClick: () => void; paraColaborador?: boolean }) {
  const ets = dados.etapas.filter(e => e.acao_id === a.id)
  const p = progresso(ets)
  const prox = proximaEtapa(ets)
  const st = STATUS_ACAO[a.status] ?? STATUS_ACAO['Não iniciado']
  const travadas = ets.filter(e => e.status === 'travada').length
  const vencidas = ets.filter(prazoVencido).length
  const reg = dados.checkins.filter(c => c.acao_id === a.id).sort((x, y) => y.periodo_ref.localeCompare(x.periodo_ref))[0]
  return (
    <div className="p2-row-link" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 160, fontSize: 13.5, fontWeight: 700 }}>{a.competencia}</span>
        {travadas > 0 && <Pill bg="var(--p2-no-bg)" color={C.NO}>✕ {travadas}</Pill>}
        {vencidas > 0 && <Pill bg="var(--p2-warn-bg)" color="#9A3412">⏰ {vencidas}</Pill>}
        {reg && <span title={`Registro rápido de ${fmtData(reg.periodo_ref)}: ${SITUACOES[reg.situacao].label}${reg.nota ? ` · ${reg.nota}` : ''}`} style={{ fontSize: 13 }}>{SITUACOES[reg.situacao].icon}</span>}
        <Pill bg={st.bg} color={st.color}>{a.status || 'Não iniciado'}</Pill>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
        <Barra pct={p.pct} />
        <span style={{ fontSize: 11.5, color: C.MU, minWidth: 70, textAlign: 'right' }}>{p.total ? `${p.feitas}/${p.total} etapas` : 'sem etapas'}</span>
      </div>
      {prox ? (
        <div style={{ fontSize: 12.5, color: C.MU, marginTop: 6 }}>
          {paraColaborador ? 'Próximo passo' : 'Próxima etapa'}: <span style={{ color: C.TX }}>{prox.titulo}</span>
          {prox.responsavel && <> · 👤 {prox.responsavel}</>}
          {prox.prazo && <span style={{ color: prazoVencido(prox) ? C.NO : C.MU }}> · 📅 {fmtData(prox.prazo)}</span>}
        </div>
      ) : a.desenvolver ? (
        <div style={{ fontSize: 12.5, color: C.MU, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.desenvolver}</div>
      ) : null}
    </div>
  )
}

function Bloco({ rot, val, sub, cor }: { rot: string; val: string; sub?: string; cor?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 120, background: 'var(--p2-sunken)', borderRadius: 12, padding: '10px 12px' }}>
      <span className="p2-label" style={{ marginBottom: 2 }}>{rot}</span>
      <div style={{ fontSize: 17, fontWeight: 800, color: cor ?? C.TX }}>{val}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.MU }}>{sub}</div>}
    </div>
  )
}

function Conversas({ dados, canEdit, nome, irPara }: { dados: Acompanhamento; canEdit: boolean; nome: string; irPara: IrPara }) {
  const ciclo = dados.ciclos.find(c => c.status === 'ativo') ?? null
  const proxima = ciclo?.data_conversa && ciclo.data_conversa.slice(0, 10) >= hojeISO() ? ciclo.data_conversa : null
  const ult = dados.anotacoes.filter(n => n.tipo === 'conversa').map(n => n.data).sort().pop()
  const dUlt = ult ? diasDesde(ult) : null
  const ligados = dados.popups.filter(p => p.ativo)
  const proxPopup = ligados.flatMap(p => p.proximas.map(d => ({ d, p }))).sort((a, b) => a.d.localeCompare(b.d))[0]
  const ultReg = [...dados.checkins].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  return (
    <Card titulo="💬 Conversas" extra={<button type="button" className="p2-link" onClick={() => irPara('avaliacoes')}>Avaliações →</button>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Bloco rot="Próxima" val={proxima ? fmtData(proxima) : '—'} sub={proxima ? `ciclo ${ciclo?.numero_ciclo}` : 'não agendada'} />
        {canEdit && <Bloco rot="Última registrada" val={dUlt === null ? '—' : dUlt === 0 ? 'hoje' : `há ${dUlt}d`} sub={ult ? fmtData(ult) : 'nenhuma no Diário'} cor={dUlt !== null && dUlt > DIAS_SEM_CONVERSA ? C.WARN : undefined} />}
      </div>
      {canEdit && (
        <div style={{ fontSize: 12, color: C.MU, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          ⚡ Pop-ups:{' '}
          {ligados.length ? <b style={{ color: '#166534' }}>{ligados.length} ligado{ligados.length > 1 ? 's' : ''}</b> : <span>nenhum ligado</span>}
          {proxPopup && <span>· próximo: {proxPopup.p.icone} {fmtQuando(proxPopup.d)}</span>}
          {ultReg && <span>· último status de {nome}: {SITUACOES[ultReg.situacao].icon} {fmtData(ultReg.periodo_ref)}</span>}
          <button type="button" className="p2-link" onClick={() => irPara('acoes')}>{ligados.length ? 'gerenciar' : 'configurar'}</button>
        </div>
      )}
    </Card>
  )
}

function PerfilResumo({ pdi, irPara }: { pdi: PdiColaborador; irPara: IrPara }) {
  const en = pdi.perfilComportamental.eneagrama.ranking
  const animais = [...pdi.perfilComportamental.animais].filter(a => a.percentual).sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0))
  const mbti = pdi.perfilComportamental.mbti
  const total = animais.reduce((s, a) => s + (a.percentual ?? 0), 0) || 100
  if (!en.length && !animais.length && !mbti?.tipo) return null
  const pts = (p: string) => { const n = parseInt(p, 10); return Number.isFinite(n) ? n : null }
  return (
    <Card titulo="🧩 Perfil em resumo" extra={<button type="button" className="p2-link" onClick={() => irPara('perfil')}>Perfil completo →</button>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        {en.length > 0 && (
          <div>
            <span className="p2-label">Eneagrama</span>
            {en.slice(0, 3).map((e, i) => {
              const n = pts(e.pontuacao)
              return (
                <div key={i} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', fontSize: 12.5, gap: 6 }}>
                    <span style={{ flex: 1, fontWeight: i === 0 ? 700 : 500 }}>{e.tipo.split(' (')[0]}</span>
                    {n !== null && <span style={{ color: C.MU }}>{n}/25</span>}
                  </div>
                  {n !== null && <div className="p2-bar" style={{ marginTop: 3, height: 5 }}><i style={{ width: `${(n / 25) * 100}%`, background: i === 0 ? '#2A4F96' : '#9FB3D9' }} /></div>}
                </div>
              )
            })}
          </div>
        )}
        {animais.length > 0 && (
          <div>
            <span className="p2-label">Quatro animais</span>
            <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, background: '#fff' }}>
              {animais.map(a => <span key={a.animal} title={`${a.animal} ${a.percentual}%`} style={{ width: `${((a.percentual ?? 0) / total) * 100}%`, background: COR_ANIMAL[a.animal] ?? '#94A3B8', transition: 'width .6s var(--p2-ease-out)' }} />)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
              {animais.map(a => (
                <span key={a.animal} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <i style={{ width: 8, height: 8, borderRadius: 2, background: COR_ANIMAL[a.animal] ?? '#94A3B8' }} />
                  {a.emoji} {a.animal} <b>{a.percentual}%</b>
                </span>
              ))}
            </div>
          </div>
        )}
        {mbti?.tipo && (
          <div>
            <span className="p2-label">MBTI</span>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#5B21B6', letterSpacing: '.04em' }}>{mbti.tipo}</div>
            {mbti.veredito && <div style={{ fontSize: 12, color: C.MU, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{mbti.veredito}</div>}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Visão geral ──────────────────────────────────────────────────────

export default function VisaoGeral({ pdi, canEdit, dados, irPara }: { pdi: PdiColaborador; canEdit: boolean; dados: Acompanhamento; irPara: IrPara }) {
  if (dados.carregando) return <Carregando txt="Montando a visão geral…" />
  const primeiro = pdi.nome.split(' ')[0]
  const ativas = dados.acoes.filter(a => a.status !== 'Concluído')
  const concluidas = dados.acoes.filter(a => a.status === 'Concluído')

  // ── Alertas (gestão) ──
  type Al = { nivel: 'alto' | 'medio'; txt: string }
  const alertas: Al[] = []
  if (canEdit) {
    const etapasAtivas = dados.etapas.filter(e => ativas.some(a => a.id === e.acao_id))
    const comp = (id: string) => ativas.find(x => x.id === id)?.competencia
    for (const e of etapasAtivas.filter(prazoVencido)) alertas.push({ nivel: 'alto', txt: `Prazo vencido (${fmtData(e.prazo)}): “${e.titulo}” · ${comp(e.acao_id)}` })
    for (const e of etapasAtivas.filter(x => x.status === 'travada')) alertas.push({ nivel: 'alto', txt: `Etapa travada: “${e.titulo}” · ${comp(e.acao_id)}` })
    for (const a of ativas) {
      const regs = dados.checkins.filter(c => c.acao_id === a.id).sort((x, y) => y.periodo_ref.localeCompare(x.periodo_ref))
      if (regs[0]?.situacao === 'travei') alertas.push({ nivel: 'alto', txt: `⚡ ${primeiro} marcou “travei” em ${a.competencia}${regs[0].nota ? `: ${regs[0].nota}` : ''}` })
      else if (regs.length >= 2 && regs[0].situacao === 'nao_mexi' && regs[1].situacao === 'nao_mexi') alertas.push({ nivel: 'medio', txt: `⚡ ${a.competencia}: dois registros seguidos de “não mexi”` })
      const ets = dados.etapas.filter(e => e.acao_id === a.id)
      if (ets.length === 0) { alertas.push({ nivel: 'medio', txt: `${a.competencia}: sem etapas. Quebre em passos para acompanhar.` }); continue }
      const ult = [a.updated_at, ...ets.map(e => e.updated_at)].filter(Boolean).sort().pop()
      if (ult && diasDesde(ult) > DIAS_PARADA) alertas.push({ nivel: 'medio', txt: `${a.competencia}: sem movimentação há ${diasDesde(ult)} dias` })
    }
    // Humor baixo (😞/🙁) na resposta mais recente de cada pop-up com pergunta de humor
    for (const p of dados.popups) {
      const q = p.perguntas.find(x => x.tipo === 'humor')
      const r = q && dados.popupRespostas.find(x => x.popup_id === p.id)
      const v = r ? (r.respostas[q!.id] as { valor?: number; nota?: string } | undefined) : undefined
      if (v?.valor && v.valor <= 2) alertas.push({ nivel: 'medio', txt: `${HUMOR.find(h => h.v === v.valor)?.e} ${primeiro} respondeu “${HUMOR.find(h => h.v === v.valor)?.l}” em ${p.titulo} (${fmtData(r!.created_at)})${v.nota ? `: ${v.nota}` : ''}` })
    }
    const ultConv = dados.anotacoes.filter(n => n.tipo === 'conversa').map(n => n.data).sort().pop()
    if (!ultConv) alertas.push({ nivel: 'medio', txt: 'Nenhuma conversa 1:1 registrada no Diário ainda' })
    else if (diasDesde(ultConv) > DIAS_SEM_CONVERSA) alertas.push({ nivel: 'medio', txt: `Última conversa registrada há ${diasDesde(ultConv)} dias` })
    alertas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'alto' ? -1 : 1))
  }

  const cardAcoes = (
    <Card titulo={<>{canEdit ? '🎯 Ações em andamento' : '🎯 Seus próximos passos'} <Pill bg="#EEF2FF" color="#3730A3">{ativas.length}</Pill></>}
      extra={<button type="button" className="p2-link" onClick={() => irPara('acoes')}>Plano de Ações →</button>}
      rodape={concluidas.length ? <span style={{ fontSize: 12, color: '#166534' }}>🏁 {concluidas.length} ação{concluidas.length > 1 ? 'ões' : ''} concluída{concluidas.length > 1 ? 's' : ''}</span> : undefined}>
      {ativas.length === 0
        ? <Vazio>{canEdit ? 'Nenhuma ação ativa. Crie a primeira no Plano de Ações.' : 'Nenhuma ação ativa no momento.'}</Vazio>
        : ativas.map(a => <LinhaAcao key={a.id} a={a} dados={dados} onClick={() => irPara('acoes')} paraColaborador={!canEdit} />)}
    </Card>
  )

  // ── Colaborador / trainee ──
  if (!canEdit) {
    const recados = dados.anotacoes.filter(n => n.tipo !== 'investigar') // a API já entrega só as compartilhadas
    const pesqPend = dados.pesquisas.filter(p => p.status === 'enviado').length
    const meusRegs = [...dados.checkins].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)
    return (
      <div className="p2-overview">
        <div className="p2-col p2-stagger">
          {cardAcoes}
          <MapaCompetencias pdi={pdi} dados={dados} onAbrir={c => irPara('historico', c)} />
          <PerfilResumo pdi={pdi} irPara={irPara} />
        </div>
        <div className="p2-col side p2-stagger">
          <Conversas dados={dados} canEdit={false} nome={primeiro} irPara={irPara} />
          <Card titulo="✉️ Recados da sua liderança">
            {recados.length === 0 ? <Vazio>Quando sua liderança compartilhar um feedback, conquista ou combinado, ele aparece aqui.</Vazio>
              : recados.slice(0, 6).map((n, i) => {
                const m = TIPOS[n.tipo] ?? TIPOS.observacao
                return (
                  <div key={n.id} style={{ padding: '9px 0', borderTop: i ? '1px solid var(--p2-line-soft)' : 'none' }}>
                    <div style={{ fontSize: 11.5, color: m.color, fontWeight: 700 }}>{m.icon} {m.label} <span style={{ color: C.MU, fontWeight: 400 }}>· {fmtData(n.data)}</span></div>
                    <div style={{ marginTop: 3 }}><RichView html={n.texto} style={{ fontSize: 13 }} /></div>
                  </div>
                )
              })}
          </Card>
          {(meusRegs.length > 0 || pesqPend > 0) && (
            <Card titulo="⚡ Seus registros">
              {pesqPend > 0 && <div style={{ marginBottom: 8 }}><Alerta tipo="warn">📝 {pesqPend} pesquisa{pesqPend > 1 ? 's' : ''} aguardando sua resposta.</Alerta></div>}
              {meusRegs.map(k => {
                const s = SITUACOES[k.situacao]
                return (
                  <div key={k.id} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '4px 0', alignItems: 'baseline' }}>
                    <span>{s.icon}</span>
                    <span style={{ flex: 1 }}>{dados.acoes.find(a => a.id === k.acao_id)?.competencia ?? 'Ação'}{k.nota && <span style={{ color: C.MU }}> · {k.nota}</span>}</span>
                    <span style={{ color: C.MU }}>{fmtData(k.periodo_ref)}</span>
                  </div>
                )
              })}
            </Card>
          )}
        </div>
      </div>
    )
  }

  // ── Gestão ──
  return (
    <div className="p2-overview">
      <div className="p2-col p2-stagger">
        {dados.erro && <Alerta>{dados.erro}</Alerta>}
        {alertas.length > 0 && (
          <Card titulo={<>⚠️ Pede atenção <Pill bg="var(--p2-warn-bg)" color="#9A3412">{alertas.length}</Pill></>}>
            {alertas.slice(0, 6).map((a, i) => (
              <div key={i} className="p2-row-link" onClick={() => irPara('acoes')} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 8px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: a.nivel === 'alto' ? C.NO : C.WARN, boxShadow: `0 0 0 3px ${a.nivel === 'alto' ? '#FDEEEE' : '#FFF4E8'}` }} />
                <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{a.txt}</span>
              </div>
            ))}
            {alertas.length > 6 && <div style={{ fontSize: 12, color: C.MU, marginTop: 4 }}>+ {alertas.length - 6} no Plano de Ações</div>}
          </Card>
        )}
        {cardAcoes}
        <MapaCompetencias pdi={pdi} dados={dados} onAbrir={c => irPara('historico', c)} />
        <PerfilResumo pdi={pdi} irPara={irPara} />
      </div>
      <div className="p2-col side p2-stagger">
        <Conversas dados={dados} canEdit nome={primeiro} irPara={irPara} />
        <DiarioPainel pdi={pdi} dados={dados} />
      </div>
    </div>
  )
}
