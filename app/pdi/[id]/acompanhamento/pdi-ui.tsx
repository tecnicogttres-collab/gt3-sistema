'use client'

// Peças compartilhadas do PDI de acompanhamento (Painel, Plano de Ações, Diário).
// Paleta e mecânica de status vêm do Workflow de Programas; o histórico "ver",
// da Custo de Operação.

import { useState } from 'react'
import type { Pergunta, ValorResposta } from '../../../questionarios/types'

export const C = {
  P: '#2A4F96', AC: '#D1AE6E', OK: '#1E9E6A', NO: '#D64545', WARN: '#D9730D', NA: '#94A3B8',
  LINE: '#E2E8F0', MU: '#6B7A99', TX: '#1E293B', BG: '#F8FAFC',
}

// ── Tipos ────────────────────────────────────────────────────────────

export type Acao = {
  id: string
  pdi_id: string
  competencia: string
  desenvolver: string
  acoes: string
  resultados_esperados: string
  inicio: string
  termino: string
  status: string
  concluido_em: string | null
  resultado_alcancado: string
  evidencia: string
  created_at: string
  updated_at: string
}

export type EtapaStatus = '' | 'ok' | 'parcial' | 'travada' | 'na'

export type Etapa = {
  id: string
  acao_id: string
  titulo: string
  status: EtapaStatus
  responsavel: string
  prazo: string | null
  obs: string
  ordem: number
  concluido_em: string | null
  updated_at: string
}

export type TipoAnotacao = 'pauta' | 'conversa' | 'feedback' | 'conquista' | 'atencao' | 'observacao' | 'investigar'

export type Anotacao = {
  id: string
  tipo: TipoAnotacao
  data: string
  texto: string
  visivel: boolean
  acao_id: string | null
  competencia: string
  resolvido: boolean
  resposta: string
  resolvido_em: string | null
  autor_nome: string
  autor_id?: string | null
  ciclo_id?: string | null
  created_at: string
  updated_at?: string
}

export type EventoHist = { id: string; acao_id: string | null; evento: string; detalhe: string; usuario_nome: string; created_at: string }

export type Pesquisa = {
  id: string            // id do convite (questionario_convites)
  titulo: string
  situacaoQuestionario: string
  status: 'respondido' | 'enviado' | 'nao_enviado'
  respondido_em: string | null
  enviado_em: string | null
  perguntas: Pergunta[]
  respostas: Record<string, ValorResposta>
}

export type Vinculo = { id: string; convite_id: string; pergunta_id: string; competencia: string; leitura: string; autor_nome: string; created_at: string }

export type CicloResumo = { id: string; numero_ciclo: number; status: string; data_conversa: string | null; conversa_confirmada_em: string | null; data_inicio: string | null; data_fim: string | null; arquivado_em: string | null; criado_em: string
  avaliacao_diretiva: number[]; autoavaliacao: number[]; ambicao: number[] }

/** Resposta de uma pergunta como texto curto (para chips e resumos). */
export function respostaCurta(v: ValorResposta | undefined): string {
  if (v === undefined || v === null || v === '') return '—'
  if (Array.isArray(v)) return v.join(', ')
  return String(v) === '__prefiro_nao_responder__' ? 'Prefiro não responder' : String(v)
}

// ── Metadados ────────────────────────────────────────────────────────

export const TIPOS: Record<TipoAnotacao, { label: string; icon: string; bg: string; color: string }> = {
  pauta:      { label: 'Pauta da conversa', icon: '🗒️', bg: '#FBF6EC', color: '#92400E' },
  conversa:   { label: 'Conversa 1:1',      icon: '💬', bg: '#EBF4FF', color: '#1E40AF' },
  feedback:   { label: 'Feedback',          icon: '🗣️', bg: '#F5F3FF', color: '#5B21B6' },
  conquista:  { label: 'Conquista',         icon: '🏆', bg: '#F0FFF4', color: '#166534' },
  atencao:    { label: 'Ponto de atenção',  icon: '⚠️', bg: '#FFF7ED', color: '#9A3412' },
  observacao: { label: 'Observação',        icon: '👁️', bg: '#F8FAFC', color: '#475569' },
  investigar: { label: 'Investigar',        icon: '❓', bg: '#FEF9C3', color: '#854D0E' },
}

export const ETAPA_DOTS: { v: Exclude<EtapaStatus, ''>; sym: string; color: string; title: string }[] = [
  { v: 'ok',      sym: '✓', color: C.OK,   title: 'Feita' },
  { v: 'parcial', sym: '◐', color: C.WARN, title: 'Em andamento' },
  { v: 'travada', sym: '✕', color: C.NO,   title: 'Travada' },
  { v: 'na',      sym: '–', color: C.NA,   title: 'Não se aplica' },
]

export const STATUS_ACAO: Record<string, { bg: string; color: string }> = {
  'Concluído':    { bg: '#F0FFF4', color: '#166534' },
  'Em evolução':  { bg: '#FFFBEB', color: '#92400E' },
  'Em andamento': { bg: '#EBF4FF', color: '#1E40AF' },
  'Não iniciado': { bg: '#F8FAFC', color: '#64748B' },
}
export const STATUS_OPCOES = ['Não iniciado', 'Em andamento', 'Em evolução', 'Concluído']

// ── Helpers ──────────────────────────────────────────────────────────

export const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const fmtData = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR')
export const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
export const diasDesde = (iso: string) =>
  Math.floor((Date.now() - new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).getTime()) / 86400000)

/** Etapas que contam para o progresso (as "não se aplica" saem da conta). */
export function progresso(etapas: Etapa[]) {
  const validas = etapas.filter(e => e.status !== 'na')
  const feitas = validas.filter(e => e.status === 'ok').length
  return { feitas, total: validas.length, pct: validas.length ? Math.round((feitas / validas.length) * 100) : 0 }
}

export const prazoVencido = (e: Etapa) => !!e.prazo && e.status !== 'ok' && e.status !== 'na' && e.prazo < hojeISO()

// ── Componentes (classes em pdi.css) ─────────────────────────────────

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) {
    const b = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(b.error ?? 'Erro ao salvar')
  }
  return r.status === 204 ? (undefined as T) : r.json()
}

export function Btn({ v = 'pri', sm, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { v?: 'pri' | 'gho' | 'danger' | 'ok'; sm?: boolean }) {
  return <button type="button" {...p} className={cx('p2-btn', v, sm && 'sm', className)} />
}

export function Pill({ bg, color, children, title }: { bg: string; color: string; children: React.ReactNode; title?: string }) {
  return <span className="p2-pill" title={title} style={{ background: bg, color }}>{children}</span>
}

export function Barra({ pct, cor = C.OK }: { pct: number; cor?: string }) {
  return <div className="p2-bar"><i style={{ width: `${pct}%`, background: cor }} /></div>
}

export function Card({ titulo, extra, children, rodape, hover, onClick, className, style, bodyStyle }: {
  titulo?: React.ReactNode; extra?: React.ReactNode; children?: React.ReactNode; rodape?: React.ReactNode
  hover?: boolean; onClick?: () => void; className?: string; style?: React.CSSProperties; bodyStyle?: React.CSSProperties
}) {
  return (
    <div className={cx('p2-card', hover && 'is-hover', onClick && 'is-click', className)} style={style} onClick={onClick}>
      {(titulo || extra) && <div className="p2-card-h"><h3>{titulo}</h3>{extra}</div>}
      {children !== undefined && <div className="p2-card-b" style={bodyStyle}>{children}</div>}
      {rodape && <div className="p2-card-f">{rodape}</div>}
    </div>
  )
}

/** Recolher/expandir com altura animada (grid 0fr → 1fr). */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return <div className={cx('p2-collapse', open && 'is-open')}><div>{children}</div></div>
}

export function Chev({ open }: { open: boolean }) {
  return <span className={cx('p2-chev', open && 'is-open')}>▶</span>
}

export function Alerta({ tipo = 'err', children }: { tipo?: 'err' | 'warn'; children: React.ReactNode }) {
  return <div className={cx('p2-alert', tipo)}>{children}</div>
}

/** Bolinhas de status da etapa. Clicar na bolinha ativa de novo limpa (como no Workflow). */
export function Dots({ value, onChange, disabled }: { value: EtapaStatus; onChange: (v: EtapaStatus) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {ETAPA_DOTS.map(d => {
        const on = value === d.v
        return (
          <button key={d.v} type="button" title={d.title} disabled={disabled} onClick={() => onChange(on ? '' : d.v)}
            className={cx('p2-dot', on && 'is-on')}
            style={on ? { background: d.color, borderColor: d.color, color: '#fff' } : disabled ? { opacity: .4 } : undefined}>
            {d.sym}
          </button>
        )
      })}
    </div>
  )
}

/** Link "Histórico" que carrega o log sob demanda. */
export function Historico({ pdiId, acaoId, label = 'Histórico' }: { pdiId: string; acaoId?: string; label?: string }) {
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState<EventoHist[] | null>(null)
  async function abrir() {
    setAberto(a => !a)
    if (itens) return
    const r = await fetch(`/api/pdi/${pdiId}/historico${acaoId ? `?acao=${acaoId}` : ''}`)
    setItens(r.ok ? await r.json() : [])
  }
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <button type="button" onClick={abrir} className="p2-link"><Chev open={aberto} /> {label}</button>
      <Collapse open={aberto}>
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--p2-sunken)', borderRadius: 10, border: '1px solid var(--p2-line)', maxHeight: 220, overflowY: 'auto' }}>
          {itens === null ? <div style={{ fontSize: 12, color: C.MU }}>Carregando…</div>
            : itens.length === 0 ? <div style={{ fontSize: 12, color: C.MU }}>Nada registrado ainda.</div>
            : itens.map(h => (
              <div key={h.id} style={{ fontSize: 12, color: '#475569', padding: '4px 0', borderBottom: '1px dashed var(--p2-line-soft)' }}>
                <span style={{ color: C.MU }}>{fmtDataHora(h.created_at)} · {h.usuario_nome || '—'}</span>
                {' · '}<b style={{ color: C.TX }}>{h.evento}</b>{h.detalhe ? `: ${h.detalhe}` : ''}
              </div>
            ))}
        </div>
      </Collapse>
    </div>
  )
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="p2-empty">{children}</div>
}

export function Modal({ titulo, onClose, children, largura = 560 }: { titulo: string; onClose: () => void; children: React.ReactNode; largura?: number }) {
  return (
    <div className="p2-modal-bg" onClick={onClose}>
      <div className="p2-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: largura }}>
        <div className="p2-card-h" style={{ padding: '18px 24px' }}>
          <h3 style={{ fontSize: 16 }}>{titulo}</h3>
          <button type="button" className="p2-icon-btn" onClick={onClose} style={{ fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: '18px 24px 22px' }}>{children}</div>
      </div>
    </div>
  )
}

export function Carregando({ txt }: { txt: string }) {
  return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>{txt}</div>
}

// ── Registro rápido (Fase 3) ─────────────────────────────────────────

export type Checkin = { id: string; acao_id: string; periodo_ref: string; situacao: 'avancei' | 'travei' | 'nao_mexi'; nota: string; usuario_nome: string; created_at: string }
export type PopupGestao = import('../../../lib/pdi-popup').Popup & {
  atual: { abre: string; fecha: string; respondida: boolean } | null
  proximas: string[]
  total_respostas: number
}
export type PopupResposta = {
  id: string; popup_id: string; ocorrencia: string; respostas: Record<string, unknown>; usuario_nome: string; created_at: string
  titulo: string; icone: string; cor: string; perguntas: import('../../../lib/pdi-popup').Pergunta[]
}

// ── Autoria (Diário e pauta) ─────────────────────────────────────────

const CORES_AUTOR = ['#2A4F96', '#0F9F8F', '#D9730D', '#9B5DE5', '#B5458F', '#1E9E6A', '#64748B']
export function corAutor(nome: string) {
  let h = 0
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CORES_AUTOR[h % CORES_AUTOR.length]
}
const iniciais = (n: string) => { const p = n.replace(/\s+Admin$/i, '').trim().split(/\s+/); return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase() }
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')

/** Quem anotou, quando registrou (dia e hora) e se foi editado depois. */
export function Autor({ nome, criado, editado, referente }: { nome: string; criado: string; editado?: string; referente?: string }) {
  const cor = corAutor(nome || '—')
  const foiEditado = editado && new Date(editado).getTime() - new Date(criado).getTime() > 60_000
  const diaCriado = new Date(criado).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: cor, color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{iniciais(nome || '—')}</span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
        <b style={{ fontSize: 12.5, color: cor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome || '—'}</b>
        <span style={{ fontSize: 11, color: C.MU, whiteSpace: 'nowrap' }}>
          {dataHora(criado)}
          {foiEditado && <span title={`Editado em ${dataHora(editado!)}`}> · editado</span>}
          {referente && referente !== diaCriado && <> · ref. {fmtData(referente)}</>}
        </span>
      </span>
    </span>
  )
}
