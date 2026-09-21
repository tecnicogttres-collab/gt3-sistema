'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useUser } from '../components/UserContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Setor = { id: string; nome: string; ativo: boolean; created_at: string }
type Documento = { id: string; setor_id: string; nome: string; ativo: boolean; created_at: string }
type Situacao = { id: string; nome: string; cor: string; ativo: boolean; created_at: string }
type Empresa = { id: string; nome: string; contratante: string; email: string; created_at: string }
type Pertinencia = { setor_id: string; usuario_id: string }
type UsuarioRow = { id: string; nome: string | null; papel: string | null }
type EmailConfig = {
  id: string; assunto_template: string; saudacao_template: string; fechamento_template: string
  historico_dias: number
}

type Tratativa = 'aguardando' | 'ciente' | 'andamento' | 'resolvido'

type Designacao = {
  id: string
  empresa: string
  contratante: string
  setores: string[]
  documentos: string[]
  situacao_id: string | null
  responsaveis: string[]
  motivo: string
  data_verificacao: string
  tratativa: Tratativa
  ciencia_por: string[]
  retorno_recebido: boolean
  retorno_em: string | null
  criado_por: string
  created_at: string
  updated_at: string
}

// ─── Design tokens (mesma paleta de Legislações/Prioridades) ─────────────────

const PRIMARY      = '#2A4F96'
const PRIMARY_SOFT = '#E8EEF9'
const ACCENT       = '#D1AE6E'
const BG           = '#F4F6FA'
const SURF         = '#FFFFFF'
const BORDER       = '#E2E8F0'
const TEXT         = '#1F2937'
const MUTED        = '#6B7280'
const RADIUS       = 12
const SHADOW       = '0 1px 3px rgba(20,30,60,.06),0 1px 2px rgba(20,30,60,.04)'

const TRAT_COLORS: Record<Tratativa, string> = {
  aguardando: '#C53030',
  ciente:     '#2D8FD5',
  andamento:  '#B45309',
  resolvido:  '#16A34A',
}
const TRAT_LABEL: Record<Tratativa, string> = {
  aguardando: 'Aguardando ciência',
  ciente:     'Ciente',
  andamento:  'Em andamento',
  resolvido:  'Resolvido',
}
const TRAT_OPTIONS: { id: Tratativa; label: string }[] = [
  { id: 'aguardando', label: 'Aguardando ciência' },
  { id: 'ciente',     label: 'Ciente' },
  { id: 'andamento',  label: 'Em andamento' },
  { id: 'resolvido',  label: 'Resolvido' },
]

const CORES_SITUACAO = ['#DC2626', '#D97706', '#0284C7', '#059669', '#6B21A8', '#64748B']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hoje() { return new Date().toISOString().slice(0, 10) }

function fmtData(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtHora(iso: string) {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function iniciais(nome: string) {
  return nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?'
}

/** Escapa um valor antes de injetá-lo em corpo HTML — evita que &/</> num nome de
 *  empresa, setor ou documento corrompa a marcação ao montar o e-mail. */
function escapeHtml(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Converte o corpo HTML do e-mail para texto puro — fallback ao copiar (text/plain)
 *  para clientes que não aceitam o text/html do clipboard. */
function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '')
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.innerText ?? div.textContent ?? '').trim()
}

/** "A", "A e B", "A, B e C" — usado na saudação do e-mail para listar os setores marcados. */
function joinComE(itens: string[]): string {
  const a = itens.filter(Boolean)
  if (a.length === 0) return ''
  if (a.length === 1) return a[0]
  return a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]
}

/** Substitui {{variavel}} por valor num texto puro — usado no assunto (sem HTML). */
function aplicaVars(txt: string, vars: Record<string, string>): string {
  return (txt || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

/** Escapa o template (texto livre digitado pelo gestor) e injeta {{var}} em negrito —
 *  deixa o texto adaptável a 1 ou mais setores sem o gestor precisar digitar HTML. */
function montaComVariavelDestacada(template: string, varName: string, valorTexto: string): string {
  const marcador = `{{${varName}}}`
  return template.split(marcador).map(escapeHtml).join(`<b>${escapeHtml(valorTexto)}</b>`).replace(/\n/g, '<br>')
}

/** "E-mail" da empresa aceita vários endereços separados por ";" — mailto: e o cabeçalho
 *  To: do .eml exigem vírgula, então convertemos aqui na hora de enviar. */
function emailsParaEnvio(destino: string): string {
  return destino.split(';').map(e => e.trim()).filter(Boolean).join(', ')
}

const CONFIG_PADRAO: EmailConfig = {
  id: 'default',
  assunto_template: 'Portal GT3 - Acompanhamento de documentação - {{empresa}}',
  saudacao_template: 'Olá! Identificamos que você possui documentos de {{setores}} reprovados no Portal GT3.',
  fechamento_template: 'Você precisa de alguma ajuda com este(s) documento(s)?',
  historico_dias: 15,
}

/** Dias corridos entre a data de verificação (YYYY-MM-DD) e hoje. */
function diasDesde(dataIso: string): number {
  const [y, m, d] = dataIso.split('-').map(Number)
  const dia = new Date(y, (m || 1) - 1, d || 1)
  const hj = new Date(); hj.setHours(0, 0, 0, 0)
  return Math.round((hj.getTime() - dia.getTime()) / 86400000)
}

type GrupoDiaEmpresa = { key: string; data: string; empresa: string; itens: Designacao[] }

/** Agrupa uma lista de designações por dia + empresa, mais recente primeiro — dá o
 *  "workflow" visual (Minha Caixa / Visão geral): fica claro que dia e que empresa é
 *  cada bloco, em vez de uma lista solta de documentos. */
function agruparPorDiaEmpresa(lista: Designacao[]): GrupoDiaEmpresa[] {
  const ordenados = [...lista].sort((a, b) =>
    b.data_verificacao.localeCompare(a.data_verificacao) || a.empresa.localeCompare(b.empresa, 'pt-BR'))
  const grupos: GrupoDiaEmpresa[] = []
  const map = new Map<string, GrupoDiaEmpresa>()
  for (const d of ordenados) {
    const key = d.data_verificacao + '|' + d.empresa.trim().toLowerCase()
    let g = map.get(key)
    if (!g) { g = { key, data: d.data_verificacao, empresa: d.empresa, itens: [] }; map.set(key, g); grupos.push(g) }
    g.itens.push(d)
  }
  return grupos
}

/** Monta o e-mail de designação (assunto + corpo HTML) a partir dos setores/documentos
 *  marcados e da estrutura configurável (saudação/fechamento/assunto) — usado tanto na
 *  pré-visualização ao vivo do formulário "+ Novo" quanto no card de cada item na Minha
 *  Caixa. Um bloco em negrito+sublinhado por setor, com os documentos dele listados em
 *  tópicos — texto se adapta sozinho a 1 ou mais setores/documentos. */
function buildDesignacaoEmail(
  empresaNome: string, setorIds: string[], docIds: string[], motivo: string,
  setores: Setor[], documentos: Documento[], cfg: EmailConfig,
): { assunto: string; corpo: string } {
  const setoresSel = setorIds.map(id => setores.find(s => s.id === id)).filter((s): s is Setor => !!s)
  const assunto = aplicaVars(cfg.assunto_template, { empresa: empresaNome })
  if (setoresSel.length === 0 || docIds.length === 0) return { assunto, corpo: '' }

  const setoresTxt = joinComE(setoresSel.map(s => s.nome))
  const saudacao = `<div>${montaComVariavelDestacada(cfg.saudacao_template, 'setores', setoresTxt)}</div>`

  const blocosSetor = setoresSel.map(s => {
    const docs = documentos.filter(d => d.setor_id === s.id && docIds.includes(d.id))
    if (!docs.length) return ''
    const itens = docs.map(d => `<li>${escapeHtml(d.nome)}</li>`).join('')
    return `<div style="font-weight:700;text-decoration:underline;margin-top:12px">${escapeHtml(s.nome)}</div><ul style="margin:6px 0 0 18px;padding:0">${itens}</ul>`
  }).join('')

  const motivoBloco = motivo.trim() ? `<div style="margin-top:12px">${escapeHtml(motivo.trim()).replace(/\n/g, '<br>')}</div>` : ''

  const fechamento = `<div style="margin-top:12px">${escapeHtml(cfg.fechamento_template).replace(/\n/g, '<br>')}</div>`

  return { assunto, corpo: saudacao + blocosSetor + motivoBloco + fechamento }
}

// ─── Estilos reutilizáveis ─────────────────────────────────────────────────────

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8,
    fontSize: 13.5, fontFamily: 'inherit', background: BG, color: TEXT,
    outline: 'none', boxSizing: 'border-box', ...extra,
  }
}

const btnGhost: React.CSSProperties = {
  background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8,
  padding: '9px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const btnPrimary: React.CSSProperties = { ...btnGhost, background: PRIMARY, color: '#fff', border: 'none' }
const btnAccent: React.CSSProperties = { ...btnGhost, background: ACCENT, color: '#3D2F14', border: 'none' }
const btnDangerIcon: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#C53030', cursor: 'pointer', fontSize: 14, padding: '4px 6px',
}
function sm(extra: React.CSSProperties): React.CSSProperties {
  return { padding: '6px 12px', fontSize: 12, borderRadius: 7, ...extra }
}

const tagSetorStyle: React.CSSProperties = {
  display: 'inline-block', background: PRIMARY_SOFT, color: PRIMARY, borderRadius: 999,
  padding: '3px 10px', fontSize: 11, fontWeight: 600, margin: '1.5px 3px 1.5px 0', whiteSpace: 'nowrap',
}
const tagDocStyle: React.CSSProperties = {
  display: 'inline-block', background: BG, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 7,
  padding: '3px 9px', fontSize: 11, margin: '1.5px 3px 1.5px 0', whiteSpace: 'nowrap',
}
const respChipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: BG, border: `1px solid ${BORDER}`,
  borderRadius: 999, padding: '3px 10px 3px 3px', fontSize: 12, margin: '2px 4px 2px 0',
}
const avatarStyle: React.CSSProperties = {
  width: 20, height: 20, borderRadius: '50%', background: PRIMARY, color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0,
}

// ─── Sub-componentes de UI ─────────────────────────────────────────────────────

function Flag({ label, on, onClick, small, colorOn, sub }: {
  label: React.ReactNode; on: boolean; onClick: () => void; small?: boolean; colorOn?: string; sub?: React.ReactNode
}) {
  const color = on ? (colorOn ?? PRIMARY) : TEXT
  const border = on ? (colorOn ?? PRIMARY) : BORDER
  const bg = on ? (colorOn ? `${colorOn}14` : PRIMARY_SOFT) : SURF
  return (
    <div onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: small ? 6 : 9,
      border: `1.5px solid ${border}`, borderRadius: small ? 8 : 10, cursor: 'pointer', userSelect: 'none',
      padding: small ? '6px 11px 6px 9px' : '9px 14px 9px 11px', background: bg, color,
      fontSize: small ? 12 : 13, fontWeight: 600, lineHeight: 1.15,
    }}>
      <span style={{
        width: small ? 14 : 17, height: small ? 14 : 17, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${on ? color : '#B8C6D8'}`, background: on ? color : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 900,
      }}>{on ? '✓' : ''}</span>
      <span>{label}{sub && <small style={{ fontWeight: 400, opacity: .65, marginLeft: 5 }}>{sub}</small>}</span>
    </div>
  )
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      position: 'relative', width: 36, height: 20, background: on ? PRIMARY : BORDER,
      borderRadius: 999, cursor: 'pointer', transition: 'background .15s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .15s',
      }} />
    </div>
  )
}

function SubBlock({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflow: 'hidden', marginBottom: 10, background: '#FCFDFF' }}>
      <div style={{
        padding: '8px 14px', background: '#F6F9FC', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.5px', color: PRIMARY, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <span>{title}</span>
        {hint && <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: MUTED, fontSize: 11 }}>{hint}</span>}
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  )
}

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12.5, color: '#8A5A12', background: '#FEFAF0', border: '1.5px dashed #EFD08F',
      borderRadius: RADIUS, padding: '12px 15px', lineHeight: 1.5,
    }}>{children}</div>
  )
}

function ConfigPanel({ title, subtitle, wide, children }: {
  title: string; subtitle?: string; wide?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{
      background: SURF, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW,
      overflow: 'hidden', gridColumn: wide ? '1 / -1' : undefined,
    }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.4 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

function TratativaBadge({ t }: { t: Tratativa }) {
  const color = TRAT_COLORS[t]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {TRAT_LABEL[t]}
    </span>
  )
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: SURF, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${color}`, borderRadius: RADIUS,
      padding: '14px 16px', boxShadow: SHADOW, minWidth: 140, flex: '1 1 140px',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: TEXT, marginTop: 6 }}>{value}</div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DesignacaoReprovadosClient() {
  const { profile } = useUser()
  const userId = profile?.id ?? ''

  const [designacoes, setDesignacoes] = useState<Designacao[]>([])
  const [setores, setSetores]         = useState<Setor[]>([])
  const [documentos, setDocumentos]   = useState<Documento[]>([])
  const [situacoes, setSituacoes]     = useState<Situacao[]>([])
  const [empresas, setEmpresas]       = useState<Empresa[]>([])
  const [pertinencia, setPertinencia] = useState<Pertinencia[]>([])
  const [usuarios, setUsuarios]       = useState<UsuarioRow[]>([])
  const [loading, setLoading]         = useState(true)

  // Deep-link do widget do dashboard (/designacao-reprovados?caixa=1) — cai direto na Minha
  // Caixa. Lido no estado inicial (não em efeito) porque só importa no primeiro carregamento.
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'designacoes' | 'caixa' | 'geral' | 'config'>(
    () => (searchParams.get('caixa') === '1' ? 'caixa' : 'designacoes')
  )

  // ── Minha Caixa / Visão geral: sub-view e acordeão (nunca abre sozinho, só no clique) ──
  const [caixaSub, setCaixaSub]   = useState<'ativas' | 'historico'>('ativas')
  const [geralSub, setGeralSub]   = useState<'ativas' | 'historico'>('ativas')
  const [caixaAberto, setCaixaAberto] = useState<string | null>(null)
  const [geralAberto, setGeralAberto] = useState<string | null>(null)
  const [geralColaborador, setGeralColaborador] = useState<string | null>(null)

  // ── Formulário inline ──
  const [formOpen, setFormOpen]           = useState(false)
  const [fEmpresa, setFEmpresa]           = useState('')
  const [fData, setFData]                 = useState('')
  const [fSetores, setFSetores]           = useState<string[]>([])
  const [fDocumentos, setFDocumentos]     = useState<string[]>([])
  const [fSituacao, setFSituacao]         = useState('')
  const [fResponsaveis, setFResponsaveis] = useState<string[]>([])
  const [saving, setSaving]               = useState(false)
  const [qtdSessao, setQtdSessao]         = useState(0)
  const empresaInputRef = useRef<HTMLInputElement>(null)

  // ── Filtros ──
  const [busca, setBusca]                         = useState('')
  const [filtroSetores, setFiltroSetores]         = useState<string[]>([])
  const [filtroSituacoes, setFiltroSituacoes]     = useState<string[]>([])
  const [filtroTratativas, setFiltroTratativas]   = useState<Tratativa[]>([])
  const [filtroResponsaveis, setFiltroResponsaveis] = useState<string[]>([])

  // ── Config ──
  const [novoSetorNome, setNovoSetorNome]     = useState('')
  const [novaSitNome, setNovaSitNome]         = useState('')
  const [corSelecionada, setCorSelecionada]   = useState(CORES_SITUACAO[0])
  const [cfgSetorAtual, setCfgSetorAtual]     = useState('')
  const [novoDocNome, setNovoDocNome]         = useState('')
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('')
  const [novaEmpresaContratante, setNovaEmpresaContratante] = useState('')
  const [novaEmpresaEmail, setNovaEmpresaEmail] = useState('')
  const [empresaBusca, setEmpresaBusca]       = useState('')
  const [editEmpresaId, setEditEmpresaId]     = useState('')
  const [editNome, setEditNome]               = useState('')
  const [editContratante, setEditContratante] = useState('')
  const [editEmail, setEditEmail]             = useState('')

  // ── Estrutura do e-mail ──
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(CONFIG_PADRAO)
  const [cfgAssunto, setCfgAssunto]       = useState('')
  const [cfgSaudacao, setCfgSaudacao]     = useState('')
  const [cfgFechamento, setCfgFechamento] = useState('')
  const [cfgHistoricoDias, setCfgHistoricoDias] = useState(15)
  const [savingConfig, setSavingConfig]   = useState(false)

  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, show: true })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2800)
  }

  /** Copia com formatação (text/html) e fallback em texto puro (text/plain) — preserva
   *  negrito/sublinhado ao colar no cliente de e-mail. */
  async function copiarEmailHtml(html: string) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([htmlToPlainText(html)], { type: 'text/plain' }),
        }),
      ])
    } catch {
      await navigator.clipboard.writeText(htmlToPlainText(html))
    }
    showToast('E-mail copiado.')
  }

  // ── Load ──
  useEffect(() => {
    Promise.all([
      fetch('/api/designacao-reprovados').then(r => r.ok ? r.json() : []),
      fetch('/api/designacao-reprovados/setores').then(r => r.ok ? r.json() : []),
      fetch('/api/designacao-reprovados/documentos').then(r => r.ok ? r.json() : []),
      fetch('/api/designacao-reprovados/situacoes').then(r => r.ok ? r.json() : []),
      fetch('/api/designacao-reprovados/empresas').then(r => r.ok ? r.json() : []),
      fetch('/api/designacao-reprovados/pertinencia').then(r => r.ok ? r.json() : []),
      fetch('/api/designacao-reprovados/usuarios').then(r => r.ok ? r.json() : []),
      fetch('/api/designacao-reprovados/config').then(r => r.ok ? r.json() : CONFIG_PADRAO),
    ]).then(([des, set, doc, sit, emp, pert, usr, cfg]) => {
      setDesignacoes(des); setSetores(set); setDocumentos(doc); setSituacoes(sit)
      setEmpresas(emp); setPertinencia(pert); setUsuarios(usr)
      setEmailConfig(cfg); setCfgAssunto(cfg.assunto_template); setCfgSaudacao(cfg.saudacao_template); setCfgFechamento(cfg.fechamento_template)
      setCfgHistoricoDias(cfg.historico_dias ?? 15)
    }).finally(() => setLoading(false))
  }, [])

  // Setor selecionado no painel "Documentos por setor": cai no primeiro setor
  // cadastrado quando nada (ou um setor já removido) está selecionado ainda.
  const cfgSetorEfetivo = (cfgSetorAtual && setores.some(s => s.id === cfgSetorAtual))
    ? cfgSetorAtual
    : (setores[0]?.id ?? '')

  // ── Lookups ──
  const getSetorNome  = (id: string) => setores.find(s => s.id === id)?.nome ?? '—'
  const getDocNome    = (id: string) => documentos.find(d => d.id === id)?.nome ?? '—'
  const getSituacao   = (id: string | null) => situacoes.find(s => s.id === id) ?? { id: '', nome: '—', cor: '#64748B', ativo: true, created_at: '' }
  const getUsuarioNome = (id: string) => usuarios.find(u => u.id === id)?.nome?.trim() || 'Usuário'

  /** E-mail cadastrado da empresa — comparação tolerante a espaço/maiúscula, igual ao
   *  match usado no hint do formulário. Editável a qualquer momento em Configurações → Empresas. */
  function getEmpresaEmail(nomeEmpresa: string): string {
    const alvo = nomeEmpresa.trim().toLowerCase()
    return empresas.find(e => e.nome.trim().toLowerCase() === alvo)?.email ?? ''
  }

  /** Baixa um .eml já endereçado (To:) e com o assunto padrão configurado — abre pronto
   *  para envio em qualquer cliente de e-mail (Outlook, etc.), sem precisar copiar/colar. */
  function baixarEml(assunto: string, corpoHtml: string, destinoEmail: string, empresaNome: string) {
    const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
    const html = `<html><head><meta charset="utf-8"></head><body>${corpoHtml}</body></html>`
    const linhas = ['Subject: =?UTF-8?B?' + b64(assunto) + '?=']
    if (destinoEmail) linhas.unshift('To: ' + emailsParaEnvio(destinoEmail))
    linhas.push('X-Unsent: 1', 'MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', html)
    const eml = linhas.join('\r\n')
    const url = URL.createObjectURL(new Blob([eml], { type: 'message/rfc822' }))
    const el = document.createElement('a')
    el.href = url
    el.download = ('GT3 - ' + (empresaNome || 'empresa')).replace(/[\\/:*?"<>|]/g, '') + '.eml'
    el.click(); URL.revokeObjectURL(url)
    showToast(destinoEmail ? 'Arquivo .eml gerado, já endereçado.' : 'Arquivo .eml gerado — e-mail da empresa não cadastrado, To: em branco.')
  }

  function sitTag(id: string | null) {
    const s = getSituacao(id)
    return <span style={{ display: 'inline-block', background: `${s.cor}1A`, color: s.cor, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{s.nome}</span>
  }

  // ── KPIs ──
  const kpis = useMemo(() => ({
    aguardando: designacoes.filter(d => d.tratativa === 'aguardando').length,
    ciente:     designacoes.filter(d => d.tratativa === 'ciente').length,
    andamento:  designacoes.filter(d => d.tratativa === 'andamento').length,
    resolvido:  designacoes.filter(d => d.tratativa === 'resolvido').length,
    total: designacoes.length,
  }), [designacoes])

  // ── Lista filtrada (Designações) ──
  const listaFiltrada = useMemo(() => {
    const b = busca.trim().toLowerCase()
    return designacoes.filter(d => {
      if (filtroSetores.length && !d.setores.some(s => filtroSetores.includes(s))) return false
      if (filtroSituacoes.length && !(d.situacao_id && filtroSituacoes.includes(d.situacao_id))) return false
      if (filtroTratativas.length && !filtroTratativas.includes(d.tratativa)) return false
      if (filtroResponsaveis.length && !d.responsaveis.some(u => filtroResponsaveis.includes(u))) return false
      if (b) {
        const alvo = (
          d.empresa + ' ' + d.motivo + ' ' +
          d.documentos.map(getDocNome).join(' ') + ' ' +
          d.responsaveis.map(getUsuarioNome).join(' ')
        ).toLowerCase()
        if (!alvo.includes(b)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designacoes, busca, filtroSetores, filtroSituacoes, filtroTratativas, filtroResponsaveis, documentos, usuarios])

  // ── Minha caixa ──
  const minhaCaixa = useMemo(() => designacoes.filter(d => d.responsaveis.includes(userId)), [designacoes, userId])
  const minhaCaixaPendentes = minhaCaixa.filter(d => d.tratativa === 'aguardando').length

  // Recorte por prazo (padrão 15 dias, configurável) ANTES de agrupar — reaproveitado
  // também nas estatísticas por colaborador da Visão geral.
  const designacoesAtivas    = useMemo(() => designacoes.filter(d => diasDesde(d.data_verificacao) <= emailConfig.historico_dias), [designacoes, emailConfig.historico_dias])
  const designacoesHistorico = useMemo(() => designacoes.filter(d => diasDesde(d.data_verificacao) > emailConfig.historico_dias), [designacoes, emailConfig.historico_dias])

  const minhaAtivas    = useMemo(() => agruparPorDiaEmpresa(designacoesAtivas.filter(d => d.responsaveis.includes(userId))), [designacoesAtivas, userId])
  const minhaHistorico = useMemo(() => agruparPorDiaEmpresa(designacoesHistorico.filter(d => d.responsaveis.includes(userId))), [designacoesHistorico, userId])
  const minhaAtual = caixaSub === 'ativas' ? minhaAtivas : minhaHistorico

  const todasAtivas    = useMemo(() => agruparPorDiaEmpresa(designacoesAtivas), [designacoesAtivas])
  const todasHistorico = useMemo(() => agruparPorDiaEmpresa(designacoesHistorico), [designacoesHistorico])
  const geralAtual = geralSub === 'ativas' ? todasAtivas : todasHistorico
  const itensGeralAtual = geralSub === 'ativas' ? designacoesAtivas : designacoesHistorico

  // Acordeão: nunca abre sozinho (só no clique) — e se o grupo que estava aberto sumir da
  // lista atual (ex.: mudou de sub-view, ou foi resolvido/saiu do prazo), o valor "efetivo"
  // cai pra null sozinho em vez de deixar um painel vazio pendurado (calculado no render,
  // não via efeito corretivo, pra não disparar um re-render extra a cada troca de lista).
  const caixaAbertoEfetivo = (caixaAberto && minhaAtual.some(g => g.key === caixaAberto)) ? caixaAberto : null

  /** Contagem por tratativa + retorno dentro de um grupo — resumo no cabeçalho do
   *  acordeão pra bater o olho e saber o que está pendente sem abrir. */
  function resumoGrupo(itens: Designacao[]) {
    return {
      aguardando: itens.filter(d => d.tratativa === 'aguardando').length,
      andamento: itens.filter(d => d.tratativa === 'andamento').length,
      resolvido: itens.filter(d => d.tratativa === 'resolvido').length,
      retornou: itens.filter(d => d.retorno_recebido).length,
    }
  }

  // ── Visão geral: BI por colaborador (grade de cards; clicar no nome abre o detalhe) ──
  const statsColaboradores = useMemo(() => {
    const map = new Map<string, { userId: string; total: number; aguardando: number; ciente: number; andamento: number; resolvido: number; retornou: number }>()
    for (const d of itensGeralAtual) {
      for (const uid of d.responsaveis) {
        let s = map.get(uid)
        if (!s) { s = { userId: uid, total: 0, aguardando: 0, ciente: 0, andamento: 0, resolvido: 0, retornou: 0 }; map.set(uid, s) }
        s.total++
        s[d.tratativa]++
        if (d.retorno_recebido) s.retornou++
      }
    }
    return [...map.values()].sort((a, b) => getUsuarioNome(a.userId).localeCompare(getUsuarioNome(b.userId), 'pt-BR'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensGeralAtual, usuarios])

  const geralGruposColaborador = useMemo(
    () => geralColaborador ? agruparPorDiaEmpresa(itensGeralAtual.filter(d => d.responsaveis.includes(geralColaborador))) : [],
    [itensGeralAtual, geralColaborador],
  )
  // Mesma lógica do caixaAbertoEfetivo, mas considerando qual das duas listas da Visão
  // geral está visível no momento (grade por colaborador ou o drill-down de um só).
  const geralListaVisivel = geralColaborador ? geralGruposColaborador : geralAtual
  const geralAbertoEfetivo = (geralAberto && geralListaVisivel.some(g => g.key === geralAberto)) ? geralAberto : null

  // ── Duplicidade (form) ──
  const duplicidade = useMemo(() => {
    const nome = fEmpresa.trim().toLowerCase()
    const dia = fData || hoje()
    if (nome.length < 2) return null
    const jaHoje = designacoes.filter(d => d.empresa.trim().toLowerCase() === nome && d.data_verificacao === dia)
    if (!jaHoje.length) return null
    const mesmoDoc   = jaHoje.filter(d => fDocumentos.some(x => d.documentos.includes(x)))
    const mesmoSetor = jaHoje.filter(d => fSetores.some(s => d.setores.includes(s)))
    let texto = `${fEmpresa.trim()} já tem ${jaHoje.length} designação(ões) em ${fmtData(dia)}`
    if (!fSetores.length) texto += ' — confira abaixo antes de lançar'
    else if (mesmoDoc.length) texto += ' — atenção: documento repetido'
    else if (mesmoSetor.length) texto += ' — mesmo setor, documento diferente'
    else texto += ' — setores diferentes, sem conflito'
    return { texto, itens: jaHoje }
  }, [fEmpresa, fData, fSetores, fDocumentos, designacoes])

  // ── Form: helpers ──
  function limparCamposItem() {
    setFSetores([]); setFDocumentos([])
    setFSituacao(situacoes.find(s => s.ativo)?.id ?? '')
    setFResponsaveis([])
  }

  function abrirForm() {
    setQtdSessao(0)
    setFEmpresa(''); setFData(hoje())
    limparCamposItem()
    setFormOpen(true)
    setTimeout(() => empresaInputRef.current?.focus(), 120)
  }
  function fecharForm() { setFormOpen(false) }

  function toggleFormSetor(id: string) {
    const on = fSetores.includes(id)
    const next = on ? fSetores.filter(x => x !== id) : [...fSetores, id]
    setFSetores(next)
    if (on) {
      setFDocumentos(prev => prev.filter(docId => next.includes(documentos.find(x => x.id === docId)?.setor_id ?? '')))
      setFResponsaveis(prev => prev.filter(uId => next.some(sId => pertinencia.some(p => p.setor_id === sId && p.usuario_id === uId))))
    }
  }
  function toggleFormDocumento(id: string) {
    setFDocumentos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleFormResponsavel(id: string) {
    setFResponsaveis(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const empresaMatch = empresas.find(e => e.nome.trim().toLowerCase() === fEmpresa.trim().toLowerCase())
  const hintEmpresa = empresaMatch
    ? `✓ Contratante: ${empresaMatch.contratante || '—'} · E-mail: ${empresaMatch.email || '— não cadastrado'}`
    : (fEmpresa.trim() ? '⚠ Não cadastrada — será salva como texto livre, sem e-mail para o .eml.' : '')

  const formValido = fEmpresa.trim().length > 1 && fSetores.length > 0 && fDocumentos.length > 0 && fResponsaveis.length > 0 && !!fSituacao

  async function salvarDesignacao(continuar: boolean) {
    if (!formValido) { showToast('Complete os campos obrigatórios.'); return }
    setSaving(true)
    const res = await fetch('/api/designacao-reprovados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa: fEmpresa.trim(),
        data_verificacao: fData || hoje(),
        setores: fSetores,
        documentos: fDocumentos,
        situacao_id: fSituacao,
        responsaveis: fResponsaveis,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const created: Designacao = await res.json()
      setDesignacoes(prev => [created, ...prev])
      if (continuar) {
        setQtdSessao(n => n + 1)
        limparCamposItem()
        showToast(`Salvo. ${created.responsaveis.length} notificado(s) — pode incluir o próximo.`)
        setTimeout(() => { empresaInputRef.current?.focus(); empresaInputRef.current?.select() }, 60)
      } else {
        fecharForm()
        showToast(`Designação criada e ${created.responsaveis.length} usuário(s) notificado(s).`)
      }
    } else {
      const e = await res.json().catch(() => ({}))
      showToast((e as { error?: string }).error ?? 'Erro ao salvar designação.')
    }
  }

  async function excluirDesignacao(id: string) {
    if (!confirm('Excluir esta designação?')) return
    const res = await fetch(`/api/designacao-reprovados/${id}`, { method: 'DELETE' })
    if (res.ok) { setDesignacoes(prev => prev.filter(d => d.id !== id)); showToast('Designação excluída.') }
    else showToast('Erro ao excluir.')
  }

  function limparFiltros() {
    setBusca(''); setFiltroSetores([]); setFiltroSituacoes([]); setFiltroTratativas([]); setFiltroResponsaveis([])
  }

  // ── Minha caixa: ações ──
  async function darCiencia(id: string) {
    const res = await fetch(`/api/designacao-reprovados/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ciencia' }),
    })
    if (res.ok) {
      const updated: Designacao = await res.json()
      setDesignacoes(prev => prev.map(d => d.id === id ? updated : d))
      showToast('Ciência registrada — o aviso sai do dashboard.')
    } else {
      const e = await res.json().catch(() => ({}))
      showToast((e as { error?: string }).error ?? 'Erro ao registrar ciência.')
    }
  }
  async function mudarTratativa(id: string, novo: 'andamento' | 'resolvido') {
    const res = await fetch(`/api/designacao-reprovados/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tratativa', tratativa: novo }),
    })
    if (res.ok) {
      const updated: Designacao = await res.json()
      setDesignacoes(prev => prev.map(d => d.id === id ? updated : d))
      showToast('Atualizado para ' + TRAT_LABEL[novo] + '.')
    } else {
      const e = await res.json().catch(() => ({}))
      showToast((e as { error?: string }).error ?? 'Erro ao atualizar.')
    }
  }
  /** Marcador independente da tratativa — a empresa respondeu ao e-mail. Alterna. */
  async function marcarRetorno(id: string, ligar: boolean) {
    const res = await fetch(`/api/designacao-reprovados/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'retorno', retorno: ligar }),
    })
    if (res.ok) {
      const updated: Designacao = await res.json()
      setDesignacoes(prev => prev.map(d => d.id === id ? updated : d))
      showToast(ligar ? 'Marcado: empresa retornou.' : 'Retorno desmarcado.')
    } else {
      const e = await res.json().catch(() => ({}))
      showToast((e as { error?: string }).error ?? 'Erro ao atualizar.')
    }
  }

  // ── Config: setores ──
  async function addSetor() {
    if (!novoSetorNome.trim()) { showToast('Informe o nome do setor.'); return }
    const res = await fetch('/api/designacao-reprovados/setores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novoSetorNome }),
    })
    if (res.ok) { const created = await res.json(); setSetores(prev => [...prev, created]); setNovoSetorNome(''); showToast('Setor adicionado.') }
    else { const e = await res.json().catch(() => ({})); showToast((e as { error?: string }).error ?? 'Erro ao adicionar setor.') }
  }
  async function toggleSetorAtivo(s: Setor) {
    const res = await fetch(`/api/designacao-reprovados/setores/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !s.ativo }),
    })
    if (res.ok) { const updated = await res.json(); setSetores(prev => prev.map(x => x.id === s.id ? updated : x)) }
    else showToast('Erro ao atualizar setor.')
  }
  async function removerSetor(id: string) {
    if (!confirm('Remover o setor? Os documentos e a matriz de pertinência dele também serão removidos.')) return
    const res = await fetch(`/api/designacao-reprovados/setores/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSetores(prev => prev.filter(s => s.id !== id))
      setDocumentos(prev => prev.filter(d => d.setor_id !== id))
      setPertinencia(prev => prev.filter(p => p.setor_id !== id))
      showToast('Setor removido.')
    } else showToast('Erro ao remover setor.')
  }

  // ── Config: situações ──
  async function addSituacao() {
    if (!novaSitNome.trim()) { showToast('Informe o status.'); return }
    const res = await fetch('/api/designacao-reprovados/situacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novaSitNome, cor: corSelecionada }),
    })
    if (res.ok) { const created = await res.json(); setSituacoes(prev => [...prev, created]); setNovaSitNome(''); showToast('Status adicionado — já disponível na designação.') }
    else { const e = await res.json().catch(() => ({})); showToast((e as { error?: string }).error ?? 'Erro ao adicionar status.') }
  }
  async function toggleSitAtiva(s: Situacao) {
    const res = await fetch(`/api/designacao-reprovados/situacoes/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !s.ativo }),
    })
    if (res.ok) { const updated = await res.json(); setSituacoes(prev => prev.map(x => x.id === s.id ? updated : x)) }
    else showToast('Erro ao atualizar status.')
  }
  async function removerSituacao(id: string) {
    if (!confirm('Excluir este status?')) return
    const res = await fetch(`/api/designacao-reprovados/situacoes/${id}`, { method: 'DELETE' })
    if (res.ok) { setSituacoes(prev => prev.filter(s => s.id !== id)); showToast('Status excluído.') }
    else { const e = await res.json().catch(() => ({})); showToast((e as { error?: string }).error ?? 'Status em uso — desative em vez de excluir.') }
  }

  // ── Config: documentos por setor ──
  async function addDocumento() {
    if (!novoDocNome.trim()) { showToast('Informe o documento.'); return }
    if (!cfgSetorEfetivo) { showToast('Selecione um setor.'); return }
    const res = await fetch('/api/designacao-reprovados/documentos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setor_id: cfgSetorEfetivo, nome: novoDocNome }),
    })
    if (res.ok) { const created = await res.json(); setDocumentos(prev => [...prev, created]); setNovoDocNome(''); showToast('Documento adicionado a ' + getSetorNome(cfgSetorEfetivo) + '.') }
    else { const e = await res.json().catch(() => ({})); showToast((e as { error?: string }).error ?? 'Erro ao adicionar documento.') }
  }
  async function toggleDocAtivo(d: Documento) {
    const res = await fetch(`/api/designacao-reprovados/documentos/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !d.ativo }),
    })
    if (res.ok) { const updated = await res.json(); setDocumentos(prev => prev.map(x => x.id === d.id ? updated : x)) }
    else showToast('Erro ao atualizar documento.')
  }
  async function removerDocumento(id: string) {
    if (!confirm('Remover este documento?')) return
    const res = await fetch(`/api/designacao-reprovados/documentos/${id}`, { method: 'DELETE' })
    if (res.ok) { setDocumentos(prev => prev.filter(d => d.id !== id)); showToast('Documento removido.') }
    else showToast('Erro ao remover documento.')
  }

  // ── Config: matriz de pertinência ──
  async function togglePertinencia(setorId: string, usuarioId: string) {
    const res = await fetch('/api/designacao-reprovados/pertinencia', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setor_id: setorId, usuario_id: usuarioId }),
    })
    if (res.ok) {
      const { on } = await res.json()
      setPertinencia(prev => on
        ? [...prev, { setor_id: setorId, usuario_id: usuarioId }]
        : prev.filter(p => !(p.setor_id === setorId && p.usuario_id === usuarioId)))
    } else showToast('Erro ao atualizar pertinência.')
  }

  // ── Config: empresas ──
  async function addEmpresa() {
    if (!novaEmpresaNome.trim()) { showToast('Informe a empresa.'); return }
    const res = await fetch('/api/designacao-reprovados/empresas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novaEmpresaNome, contratante: novaEmpresaContratante, email: novaEmpresaEmail }),
    })
    if (res.ok) {
      const created = await res.json()
      setEmpresas(prev => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setNovaEmpresaNome(''); setNovaEmpresaContratante(''); setNovaEmpresaEmail('')
      showToast('Empresa adicionada.')
    } else { const e = await res.json().catch(() => ({})); showToast((e as { error?: string }).error ?? 'Erro ao adicionar empresa.') }
  }
  async function removerEmpresa(id: string) {
    if (!confirm('Remover esta empresa?')) return
    const res = await fetch(`/api/designacao-reprovados/empresas/${id}`, { method: 'DELETE' })
    if (res.ok) { setEmpresas(prev => prev.filter(e => e.id !== id)); showToast('Empresa removida.') }
    else showToast('Erro ao remover empresa.')
  }
  function iniciarEdicaoEmpresa(e: Empresa) {
    setEditEmpresaId(e.id); setEditNome(e.nome); setEditContratante(e.contratante); setEditEmail(e.email)
  }
  function cancelarEdicaoEmpresa() { setEditEmpresaId('') }
  async function salvarEdicaoEmpresa() {
    if (!editNome.trim()) { showToast('Informe a empresa.'); return }
    const res = await fetch(`/api/designacao-reprovados/empresas/${editEmpresaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: editNome, contratante: editContratante, email: editEmail }),
    })
    if (res.ok) {
      const updated = await res.json()
      setEmpresas(prev => prev.map(e => e.id === updated.id ? updated : e).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setEditEmpresaId('')
      showToast('Empresa atualizada.')
    } else { const e = await res.json().catch(() => ({})); showToast((e as { error?: string }).error ?? 'Erro ao salvar empresa.') }
  }

  // ── Config: estrutura do e-mail ──
  async function salvarEmailConfig() {
    setSavingConfig(true)
    const res = await fetch('/api/designacao-reprovados/config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assunto_template: cfgAssunto, saudacao_template: cfgSaudacao, fechamento_template: cfgFechamento,
        historico_dias: cfgHistoricoDias,
      }),
    })
    setSavingConfig(false)
    if (res.ok) { const updated = await res.json(); setEmailConfig(updated); showToast('Estrutura do e-mail salva.') }
    else showToast('Erro ao salvar estrutura do e-mail.')
  }

  const empresasFiltradas = useMemo(() => {
    const b = empresaBusca.trim().toLowerCase()
    if (!b) return empresas
    return empresas.filter(e => (e.nome + ' ' + e.contratante + ' ' + e.email).toLowerCase().includes(b))
  }, [empresas, empresaBusca])

  const setoresAtivos = setores.filter(s => s.ativo)
  const situacoesAtivas = situacoes.filter(s => s.ativo)

  // ── Minha Caixa / Visão geral: card de item + bloco de grupo (acordeão) ──
  function renderCardDesignacao(d: Designacao, opts: { mostrarResponsaveis: boolean }) {
    const souResponsavel = d.responsaveis.includes(userId)
    const jaCiente = d.ciencia_por.includes(userId)
    const email = buildDesignacaoEmail(d.empresa, d.setores, d.documentos, d.motivo, setores, documentos, emailConfig)
    const destinoEmail = getEmpresaEmail(d.empresa)
    return (
      <div key={d.id} style={{
        background: SURF, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${TRAT_COLORS[d.tratativa]}`,
        borderRadius: RADIUS, padding: '16px 18px', marginBottom: 12, boxShadow: SHADOW,
        opacity: d.tratativa === 'resolvido' ? .78 : 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: MUTED, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {d.setores.map(s => <span key={s} style={tagSetorStyle}>{getSetorNome(s)}</span>)}
            {sitTag(d.situacao_id)}
            <span>· por {getUsuarioNome(d.criado_por)}</span>
            {opts.mostrarResponsaveis && (
              <>
                <span>· para</span>
                {d.responsaveis.map(u => (
                  <span key={u} style={respChipStyle}><span style={avatarStyle}>{iniciais(getUsuarioNome(u))}</span>{getUsuarioNome(u)}</span>
                ))}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {d.retorno_recebido && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0A7A5E', background: '#EDFBF6', border: '1px solid #A9E6D2', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                🔁 Empresa retornou
              </span>
            )}
            <TratativaBadge t={d.tratativa} />
          </div>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
          <b>{d.documentos.map(getDocNome).join(' · ')}</b>
          {d.motivo && <div style={{ marginTop: 6 }}>{d.motivo}</div>}
        </div>

        {/* E-mail pronto para encaminhar à empresa — só quem recebe a designação vê isso montado.
            Clique no assunto ou no corpo copia — não tem botão "Copiar" separado. */}
        {email.corpo && (
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '7px 14px', background: '#F6F9FC', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: PRIMARY, borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>✉️ E-mail pronto</span>
              <span style={{ marginLeft: 'auto', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: destinoEmail ? '#16A34A' : '#B45309' }}>
                Para: {destinoEmail || 'não cadastrado'}
              </span>
            </div>
            <div
              onClick={() => { navigator.clipboard.writeText(email.assunto); showToast('Assunto copiado.') }}
              title="Clique para copiar o assunto"
              style={{ padding: '8px 16px', fontSize: 12.5, color: TEXT, background: '#FCFDFF', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F0F4FA' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FCFDFF' }}
            >
              <b>Assunto:</b> {email.assunto}
            </div>
            <div
              onClick={() => copiarEmailHtml(email.corpo)}
              title="Clique para copiar o e-mail"
              style={{ padding: '13px 16px', fontSize: 13, lineHeight: 1.6, color: TEXT, background: '#FCFDFF', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F0F4FA' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FCFDFF' }}
              dangerouslySetInnerHTML={{ __html: email.corpo }} />
            <div style={{ padding: '8px 16px', borderTop: `1px solid ${BORDER}`, background: '#F6F9FC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: MUTED }}>🖱 clique no assunto ou no e-mail para copiar</span>
              <button onClick={() => baixarEml(email.assunto, email.corpo, destinoEmail, d.empresa)} style={sm(btnGhost)}>⬇ Baixar .eml</button>
            </div>
          </div>
        )}

        {souResponsavel && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {!jaCiente ? (
              <button onClick={() => darCiencia(d.id)} style={sm(btnPrimary)}>✓ Dar ciência</button>
            ) : (
              <span style={{ fontSize: 12, color: TRAT_COLORS.resolvido, fontWeight: 600 }}>✓ Ciência registrada</span>
            )}
            {jaCiente && d.tratativa !== 'resolvido' && (
              <>
                <button onClick={() => mudarTratativa(d.id, 'andamento')} style={sm(btnGhost)}>▶ Em andamento</button>
                <button onClick={() => mudarTratativa(d.id, 'resolvido')} style={sm(btnAccent)}>✔ Resolvido</button>
              </>
            )}
            <button onClick={() => marcarRetorno(d.id, !d.retorno_recebido)} style={sm(btnGhost)}>
              {d.retorno_recebido ? '↺ Desmarcar retorno' : '🔁 Marcar retorno da empresa'}
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderGrupoAcordeao(grupo: GrupoDiaEmpresa, opts: { aberto: string | null; setAberto: (k: string | null) => void; mostrarResponsaveis: boolean }) {
    const isOpen = opts.aberto === grupo.key
    const r = resumoGrupo(grupo.itens)
    return (
      <div key={grupo.key} style={{ marginBottom: 14, border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflow: 'hidden', background: SURF, boxShadow: SHADOW }}>
        <div onClick={() => opts.setAberto(isOpen ? null : grupo.key)} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer',
          background: isOpen ? PRIMARY_SOFT : '#FAFCFE', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, transition: 'transform .15s', transform: isOpen ? 'rotate(90deg)' : 'none', color: MUTED }}>▶</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: PRIMARY, color: '#fff', borderRadius: 999, padding: '5px 13px 5px 11px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
            📅 {fmtData(grupo.data)}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>🏢 {grupo.empresa}</span>
          <span style={{ fontSize: 11, color: MUTED }}>{grupo.itens.length} item(ns)</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, fontWeight: 700 }}>
            {r.aguardando > 0 && <span style={{ color: TRAT_COLORS.aguardando }}>⏳ {r.aguardando} aguardando</span>}
            {r.andamento > 0 && <span style={{ color: TRAT_COLORS.andamento }}>▶ {r.andamento} em andamento</span>}
            {r.retornou > 0 && <span style={{ color: '#0A7A5E' }}>🔁 {r.retornou} retornou</span>}
            {r.resolvido > 0 && <span style={{ color: TRAT_COLORS.resolvido }}>✔ {r.resolvido} resolvido</span>}
          </div>
        </div>
        {isOpen && (
          <div style={{ padding: '14px 16px', borderTop: `1px solid ${BORDER}` }}>
            {grupo.itens.map(d => renderCardDesignacao(d, { mostrarResponsaveis: opts.mostrarResponsaveis }))}
          </div>
        )}
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Inter',system-ui,sans-serif", color: TEXT }}>

      {/* Header */}
      <div style={{ background: SURF, borderBottom: `1px solid ${BORDER}`, padding: '18px 28px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>Designação de Reprovados / Pendências</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Verificação diária do Portal GT3 · encaminhamento ao responsável</div>
      </div>

      {/* Tabs */}
      <div style={{ background: SURF, borderBottom: `1px solid ${BORDER}`, padding: '0 28px', display: 'flex', gap: 4 }}>
        {[
          { id: 'designacoes' as const, label: '📋 Designações' },
          { id: 'caixa' as const, label: `📥 Minha Caixa${minhaCaixaPendentes ? ` (${minhaCaixaPendentes})` : ''}` },
          { id: 'geral' as const, label: '🌐 Visão geral' },
          { id: 'config' as const, label: '⚙️ Configurações' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`gt3-tab${tab === t.id ? ' gt3-tab-active' : ''}`}
            style={{
              background: 'none', border: 'none', borderBottom: '2.5px solid transparent',
              padding: '14px 16px', fontSize: 13.5, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? PRIMARY : MUTED, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 24px 60px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED }}>Carregando...</div>
        ) : tab === 'designacoes' ? (
          <>
            {/* KPIs */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <Kpi label="Aguardando" value={kpis.aguardando} color={TRAT_COLORS.aguardando} />
              <Kpi label="Ciente" value={kpis.ciente} color={TRAT_COLORS.ciente} />
              <Kpi label="Em andamento" value={kpis.andamento} color={TRAT_COLORS.andamento} />
              <Kpi label="Resolvidos" value={kpis.resolvido} color={TRAT_COLORS.resolvido} />
              <Kpi label="Total de itens" value={kpis.total} color={PRIMARY} />
            </div>

            {/* Form inline */}
            {formOpen && (
              <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: '0 8px 24px rgba(20,30,60,.12)', marginBottom: 18, overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: PRIMARY }}>＋ Nova designação</h3>
                  <button onClick={fecharForm} style={{ border: 'none', background: BG, width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 15, color: MUTED }}>✕</button>
                </div>
                <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {duplicidade && (
                    <div style={{
                      background: '#FFFBF2', border: '1px solid #F0DDB4', borderLeft: `4px solid ${ACCENT}`,
                      borderRadius: RADIUS, padding: '13px 16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, color: '#7A5814' }}>
                        <span style={{ width: 24, height: 24, borderRadius: 7, background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>↺</span>
                        {duplicidade.texto}
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {duplicidade.itens.map(d => {
                          const repete = fDocumentos.some(x => d.documentos.includes(x))
                          return (
                            <div key={d.id} style={{
                              background: repete ? '#FEF6F5' : 'rgba(255,255,255,.75)', border: `1px solid ${repete ? '#E8A9A4' : '#F0E4C8'}`,
                              borderRadius: 9, padding: '9px 12px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
                            }}>
                              {repete ? <b style={{ color: '#B93A33' }}>⚠</b> : <span style={{ color: '#16A34A' }}>✓</span>}
                              {sitTag(d.situacao_id)}
                              <span>{d.setores.map(getSetorNome).join(', ')}</span>
                              <b>{d.documentos.map(getDocNome).join(' · ')}</b>
                              <span>→ {d.responsaveis.map(getUsuarioNome).join(', ')}</span>
                              <span style={{ color: MUTED, fontSize: 11, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{fmtHora(d.created_at)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Empresa + data */}
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Empresa</div>
                      <input ref={empresaInputRef} type="text" list="dlEmpresasDesig" autoComplete="off" placeholder="Digite para buscar..."
                        value={fEmpresa} onChange={e => setFEmpresa(e.target.value)} style={inputStyle({ width: '100%' })} />
                      <datalist id="dlEmpresasDesig">
                        {empresas.map(e => <option key={e.id} value={e.nome}>{e.contratante}</option>)}
                      </datalist>
                      {hintEmpresa && <div style={{ fontSize: 11.5, color: empresaMatch ? '#16A34A' : '#B45309', marginTop: 6 }}>{hintEmpresa}</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Data verificação</div>
                      <input type="date" value={fData} onChange={e => setFData(e.target.value)} style={inputStyle({ width: '100%' })} />
                    </div>
                  </div>

                  {/* Setor */}
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      Tipo de setor
                      <span style={{ background: PRIMARY, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 10 }}>{fSetores.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                      {setoresAtivos.map(s => (
                        <Flag key={s.id} label={s.nome} on={fSetores.includes(s.id)} onClick={() => toggleFormSetor(s.id)} />
                      ))}
                      {setoresAtivos.length === 0 && <Alerta>Nenhum setor ativo cadastrado. Configure em ⚙️ Configurações → Tipos de setor.</Alerta>}
                    </div>
                  </div>

                  {/* Documentos */}
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      Tipo de documento
                      <span style={{ background: PRIMARY, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 10 }}>{fDocumentos.length}</span>
                    </div>
                    {fSetores.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: MUTED, background: '#FAFBFD', border: '1.5px dashed #DFE7F1', borderRadius: RADIUS, padding: 17, textAlign: 'center' }}>
                        Flegue um tipo de setor acima para liberar os documentos.
                      </div>
                    ) : fSetores.map(sId => {
                      const docs = documentos.filter(d => d.setor_id === sId && d.ativo)
                      return (
                        <SubBlock key={sId} title={getSetorNome(sId)} hint={`${docs.length} documento(s)`}>
                          {docs.length === 0
                            ? <Alerta>Nenhum documento cadastrado para &quot;{getSetorNome(sId)}&quot;. Cadastre em ⚙️ Configurações → Documentos por setor.</Alerta>
                            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {docs.map(d => <Flag key={d.id} small label={d.nome} on={fDocumentos.includes(d.id)} onClick={() => toggleFormDocumento(d.id)} />)}
                              </div>}
                        </SubBlock>
                      )
                    })}
                  </div>

                  {/* Situação */}
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Status do documento</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                      {situacoesAtivas.map(s => (
                        <Flag key={s.id} label={s.nome} colorOn={s.cor} on={fSituacao === s.id} onClick={() => setFSituacao(s.id)} />
                      ))}
                      {situacoesAtivas.length === 0 && <Alerta>Nenhum status ativo cadastrado. Configure em ⚙️ Configurações → Status do documento.</Alerta>}
                    </div>
                  </div>

                  {/* Responsáveis */}
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      Responsáveis pertinentes
                      <span style={{ background: PRIMARY, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 10 }}>{fResponsaveis.length}</span>
                    </div>
                    {fSetores.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: MUTED, background: '#FAFBFD', border: '1.5px dashed #DFE7F1', borderRadius: RADIUS, padding: 17, textAlign: 'center' }}>
                        Os usuários pertinentes aparecem assim que você flegar o setor.
                      </div>
                    ) : fSetores.map(sId => {
                      const ids = pertinencia.filter(p => p.setor_id === sId).map(p => p.usuario_id)
                      return (
                        <SubBlock key={sId} title={getSetorNome(sId)} hint={`${ids.length} pertinente(s)`}>
                          {ids.length === 0
                            ? <Alerta>Nenhum usuário pertinente a &quot;{getSetorNome(sId)}&quot;. Ajuste em ⚙️ Configurações → Matriz de pertinência.</Alerta>
                            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {ids.map(uId => (
                                  <Flag key={uId} label={getUsuarioNome(uId)} on={fResponsaveis.includes(uId)} onClick={() => toggleFormResponsavel(uId)} />
                                ))}
                              </div>}
                        </SubBlock>
                      )
                    })}
                  </div>

                </div>

                <div style={{ padding: '16px 22px', background: '#FBFCFE', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {qtdSessao > 0 && (
                    <span style={{ background: '#EDFBF6', border: '1px solid #A9E6D2', color: '#0A7A5E', borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 600 }}>
                      ✓ <b>{qtdSessao}</b> incluída(s) nesta sessão
                    </span>
                  )}
                  <span style={{ marginRight: 'auto', fontSize: 12, color: MUTED }}>
                    {formValido
                      ? `${fDocumentos.length} documento(s) · ${fResponsaveis.length} responsável(is) · ${getSituacao(fSituacao).nome}`
                      : 'Falta: ' + [
                          fEmpresa.trim().length < 2 && 'empresa',
                          !fSetores.length && 'setor',
                          !fDocumentos.length && 'documento',
                          !fResponsaveis.length && 'responsável',
                        ].filter(Boolean).join(', ')}
                  </span>
                  <button onClick={fecharForm} style={btnGhost}>Cancelar</button>
                  <button onClick={() => salvarDesignacao(false)} disabled={!formValido || saving} style={{ ...btnGhost, opacity: (!formValido || saving) ? .5 : 1, cursor: (!formValido || saving) ? 'not-allowed' : 'pointer' }}>Salvar e fechar</button>
                  <button onClick={() => salvarDesignacao(true)} disabled={!formValido || saving} style={{ ...btnAccent, opacity: (!formValido || saving) ? .5 : 1, cursor: (!formValido || saving) ? 'not-allowed' : 'pointer' }}>
                    💾 {saving ? 'Salvando...' : 'Salvar e incluir ＋'}
                  </button>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 14, marginBottom: 16, boxShadow: SHADOW }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <input type="text" placeholder="🔍 Buscar por empresa, documento ou responsável..." value={busca} onChange={e => setBusca(e.target.value)}
                  style={inputStyle({ flex: 1, minWidth: 240 })} />
                <button onClick={limparFiltros} style={sm(btnGhost)}>Limpar filtros</button>
                {!formOpen && <button onClick={abrirForm} style={{ ...btnPrimary, marginLeft: 'auto' }}>＋ Novo</button>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: MUTED, minWidth: 90 }}>Setor</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {setoresAtivos.map(s => (
                      <Flag key={s.id} small label={s.nome} on={filtroSetores.includes(s.id)}
                        onClick={() => setFiltroSetores(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: MUTED, minWidth: 90 }}>Status doc.</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {situacoesAtivas.map(s => (
                      <Flag key={s.id} small label={s.nome} colorOn={s.cor} on={filtroSituacoes.includes(s.id)}
                        onClick={() => setFiltroSituacoes(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: MUTED, minWidth: 90 }}>Tratativa</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {TRAT_OPTIONS.map(t => (
                      <Flag key={t.id} small label={t.label} colorOn={TRAT_COLORS[t.id]} on={filtroTratativas.includes(t.id)}
                        onClick={() => setFiltroTratativas(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: MUTED, minWidth: 90 }}>Responsável</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {usuarios.map(u => (
                      <Flag key={u.id} small label={u.nome?.trim() || 'Usuário'} on={filtroResponsaveis.includes(u.id)}
                        onClick={() => setFiltroResponsaveis(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id])} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflow: 'hidden', boxShadow: SHADOW }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#FAFCFE' }}>
                      {['Empresa', 'Setor', 'Documentos', 'Status doc.', 'Responsáveis', 'Tratativa', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '50px 20px', textAlign: 'center', color: MUTED }}>
                        Nenhuma designação encontrada.<br />
                        <small>Use &quot;＋ Novo&quot; após a verificação diária no Portal GT3.</small>
                      </td></tr>
                    ) : listaFiltrada.map(d => (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 650 }}>{d.empresa}</div>
                          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{d.contratante ? d.contratante + ' · ' : ''}verif. {fmtData(d.data_verificacao)}</div>
                        </td>
                        <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>{d.setores.map(s => <span key={s} style={tagSetorStyle}>{getSetorNome(s)}</span>)}</td>
                        <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
                          {d.documentos.map(x => <span key={x} style={tagDocStyle}>{getDocNome(x)}</span>)}
                          {d.motivo && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>{d.motivo.slice(0, 70)}{d.motivo.length > 70 ? '…' : ''}</div>}
                        </td>
                        <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>{sitTag(d.situacao_id)}</td>
                        <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
                          {d.responsaveis.map(u => (
                            <span key={u} style={respChipStyle}><span style={avatarStyle}>{iniciais(getUsuarioNome(u))}</span>{getUsuarioNome(u)}</span>
                          ))}
                        </td>
                        <td style={{ padding: '13px 14px', verticalAlign: 'top' }}><TratativaBadge t={d.tratativa} /></td>
                        <td style={{ padding: '13px 14px', verticalAlign: 'top', textAlign: 'right' }}>
                          <button onClick={() => excluirDesignacao(d.id)} title="Excluir" style={btnDangerIcon}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : tab === 'caixa' ? (
          <div style={{ maxWidth: 900 }}>
            {minhaCaixaPendentes > 0 && (
              <div style={{
                background: 'linear-gradient(135deg,#FEF4F3,#FDEDEC)', border: '1px solid #F7CDCA', borderLeft: '4px solid #C53030',
                color: '#8E2C27', borderRadius: RADIUS, padding: '12px 16px', fontSize: 12.5, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                ⚠️ <span><b>{minhaCaixaPendentes}</b> item(ns) aguardando sua ciência. O aviso permanece no dashboard até você dar ciência aqui dentro.</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setCaixaSub('ativas')} style={caixaSub === 'ativas' ? btnPrimary : btnGhost}>
                Ativas {minhaAtivas.length ? `(${minhaAtivas.length})` : ''}
              </button>
              <button onClick={() => setCaixaSub('historico')} style={caixaSub === 'historico' ? btnPrimary : btnGhost}>
                🕘 Histórico {minhaHistorico.length ? `(${minhaHistorico.length})` : ''}
              </button>
            </div>
            {minhaAtual.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED, background: SURF, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
                <p style={{ fontWeight: 600, margin: 0 }}>
                  {caixaSub === 'ativas' ? 'Nenhum item ativo designado para você.' : `Nada no histórico (mais de ${emailConfig.historico_dias} dias).`}
                </p>
              </div>
            ) : minhaAtual.map(grupo => renderGrupoAcordeao(grupo, { aberto: caixaAbertoEfetivo, setAberto: setCaixaAberto, mostrarResponsaveis: false }))}
          </div>
        ) : tab === 'geral' ? (
          <div style={{ maxWidth: 1100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {geralColaborador ? (
                <button onClick={() => setGeralColaborador(null)} style={sm(btnGhost)}>← Voltar para todos</button>
              ) : (
                <div style={{ fontSize: 12.5, color: MUTED }}>Por colaborador — clique no nome para ver as designações dele(a).</div>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => setGeralSub('ativas')} style={geralSub === 'ativas' ? btnPrimary : btnGhost}>
                  Ativas {todasAtivas.length ? `(${todasAtivas.length})` : ''}
                </button>
                <button onClick={() => setGeralSub('historico')} style={geralSub === 'historico' ? btnPrimary : btnGhost}>
                  🕘 Histórico {todasHistorico.length ? `(${todasHistorico.length})` : ''}
                </button>
              </div>
            </div>

            {!geralColaborador ? (
              statsColaboradores.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED, background: SURF, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
                  <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
                  <p style={{ fontWeight: 600, margin: 0 }}>
                    {geralSub === 'ativas' ? 'Nenhuma designação ativa.' : `Nada no histórico (mais de ${emailConfig.historico_dias} dias).`}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                  {statsColaboradores.map(s => {
                    const pct = s.total ? Math.round((s.resolvido / s.total) * 100) : 0
                    return (
                      <div key={s.userId} onClick={() => setGeralColaborador(s.userId)}
                        style={{ cursor: 'pointer', background: SURF, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '14px 16px', boxShadow: SHADOW }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                          <span style={avatarStyle}>{iniciais(getUsuarioNome(s.userId))}</span>
                          <b style={{ fontSize: 13.5, color: PRIMARY, textDecoration: 'underline', textUnderlineOffset: 3 }}>{getUsuarioNome(s.userId)}</b>
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', fontSize: 11, fontWeight: 700, marginBottom: 12, minHeight: 16 }}>
                          {s.aguardando > 0 && <span style={{ color: TRAT_COLORS.aguardando }}>⏳ {s.aguardando}</span>}
                          {s.andamento > 0 && <span style={{ color: TRAT_COLORS.andamento }}>▶ {s.andamento}</span>}
                          {s.retornou > 0 && <span style={{ color: '#0A7A5E' }}>🔁 {s.retornou}</span>}
                          {s.resolvido > 0 && <span style={{ color: TRAT_COLORS.resolvido }}>✔ {s.resolvido}</span>}
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: BG, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: TRAT_COLORS.resolvido, borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: MUTED, marginTop: 5 }}>{pct}% resolvido · {s.total} no total</div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : geralGruposColaborador.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED, background: SURF, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
                <p style={{ fontWeight: 600, margin: 0 }}>Nenhuma designação de {getUsuarioNome(geralColaborador)} nesta visão.</p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={avatarStyle}>{iniciais(getUsuarioNome(geralColaborador))}</span>
                  {getUsuarioNome(geralColaborador)}
                </div>
                {geralGruposColaborador.map(grupo => renderGrupoAcordeao(grupo, { aberto: geralAbertoEfetivo, setAberto: setGeralAberto, mostrarResponsaveis: false }))}
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

            {/* Painel 1: Tipos de setor */}
            <ConfigPanel title="Tipos de setor" subtitle="As flags do primeiro nível da designação">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {setores.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, opacity: s.ativo ? 1 : .5 }}>{s.nome}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{documentos.filter(d => d.setor_id === s.id && d.ativo).length} doc(s)</span>
                    <Switch on={s.ativo} onClick={() => toggleSetorAtivo(s)} />
                    <button onClick={() => removerSetor(s.id)} style={btnDangerIcon} title="Excluir">🗑</button>
                  </div>
                ))}
                {setores.length === 0 && <div style={{ fontSize: 12.5, color: MUTED, padding: '8px 0' }}>Nenhum setor cadastrado.</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <input value={novoSetorNome} onChange={e => setNovoSetorNome(e.target.value)} placeholder="Nome do setor (ex.: Ambiental)" style={inputStyle({ flex: 1 })} />
                <button onClick={addSetor} style={sm(btnAccent)}>＋ Add</button>
              </div>
            </ConfigPanel>

            {/* Painel 2: Status do documento */}
            <ConfigPanel title="Status do documento" subtitle="Conectado direto ao campo da designação">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {situacoes.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.cor, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, opacity: s.ativo ? 1 : .5 }}>{s.nome}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{designacoes.filter(d => d.situacao_id === s.id).length} uso(s)</span>
                    <Switch on={s.ativo} onClick={() => toggleSitAtiva(s)} />
                    <button onClick={() => removerSituacao(s.id)} style={btnDangerIcon} title="Excluir">🗑</button>
                  </div>
                ))}
                {situacoes.length === 0 && <div style={{ fontSize: 12.5, color: MUTED, padding: '8px 0' }}>Nenhum status cadastrado.</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <input value={novaSitNome} onChange={e => setNovaSitNome(e.target.value)} placeholder="Ex.: Vencido, Aguardando envio..." style={inputStyle({ flex: 1 })} />
                <button onClick={addSituacao} style={sm(btnAccent)}>＋ Add</button>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Cor</div>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  {CORES_SITUACAO.map(c => (
                    <div key={c} onClick={() => setCorSelecionada(c)} style={{
                      width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: c,
                      border: corSelecionada === c ? '2.5px solid #fff' : '2.5px solid transparent',
                      boxShadow: corSelecionada === c ? `0 0 0 2.5px ${c}` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 900,
                    }}>{corSelecionada === c ? '✓' : ''}</div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>Tudo que for cadastrado aqui já aparece como flag na tela de designação, sem mexer no código.</div>
            </ConfigPanel>

            {/* Painel 3: Documentos por setor */}
            <ConfigPanel title="Documentos por setor" subtitle="O que é solicitado dentro de cada tipo de setor" wide>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Setor</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {setores.map(s => (
                    <Flag key={s.id} small label={s.nome} on={cfgSetorEfetivo === s.id} onClick={() => setCfgSetorAtual(s.id)} />
                  ))}
                  {setores.length === 0 && <span style={{ fontSize: 12.5, color: MUTED }}>Cadastre um setor primeiro.</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input value={novoDocNome} onChange={e => setNovoDocNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addDocumento() }}
                  placeholder="Nome do documento (ex.: ASO, CRLV, LTCAT...)" style={inputStyle({ flex: 1 })} />
                <button onClick={addDocumento} style={sm(btnAccent)}>＋ Add documento</button>
              </div>
              <div>
                {documentos.filter(d => d.setor_id === cfgSetorEfetivo).length === 0 ? (
                  <div style={{ fontSize: 12.5, color: MUTED, background: '#FAFBFD', border: '1.5px dashed #DFE7F1', borderRadius: RADIUS, padding: 17, textAlign: 'center' }}>
                    Nenhum documento cadastrado neste setor ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {documentos.filter(d => d.setor_id === cfgSetorEfetivo).map(d => (
                      <div key={d.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, border: `1.5px solid ${BORDER}`, borderRadius: 10,
                        padding: '7px 10px 7px 12px', fontSize: 12.5, fontWeight: 600, color: TEXT, opacity: d.ativo ? 1 : .45,
                      }}>
                        {d.nome}
                        <Switch on={d.ativo} onClick={() => toggleDocAtivo(d)} />
                        <span onClick={() => removerDocumento(d.id)} style={{ cursor: 'pointer', color: '#C53030', fontWeight: 700 }}>✕</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>Ao flegar o setor na designação, só os documentos ativos deste setor aparecem como flag.</div>
            </ConfigPanel>

            {/* Painel 4: Matriz de pertinência */}
            <ConfigPanel title="Matriz de pertinência · usuário × setor" subtitle="Define quem é liberado como responsável ao flegar cada setor" wide>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '9px 8px 9px 0', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: MUTED, borderBottom: `1px solid ${BORDER}` }}>Usuário</th>
                      {setoresAtivos.map(s => (
                        <th key={s.id} style={{ padding: '9px 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: MUTED, borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>{s.nome}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id}>
                        <td style={{ padding: '10px 8px 10px 0', fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>
                          {u.nome?.trim() || 'Usuário'}
                          <small style={{ display: 'block', fontWeight: 400, color: MUTED, fontSize: 11 }}>{u.papel || ''}</small>
                        </td>
                        {setoresAtivos.map(s => {
                          const on = pertinencia.some(p => p.setor_id === s.id && p.usuario_id === u.id)
                          return (
                            <td key={s.id} style={{ padding: '10px 8px', textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>
                              <div style={{ display: 'inline-block' }}><Switch on={on} onClick={() => togglePertinencia(s.id, u.id)} /></div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {usuarios.length === 0 && (
                      <tr><td colSpan={setoresAtivos.length + 1} style={{ padding: '16px 0', color: MUTED, fontSize: 12.5 }}>Nenhum usuário encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ConfigPanel>

            {/* Painel 5: Empresas */}
            <ConfigPanel title="Empresas / Prestadoras" subtitle={`Lista própria deste módulo (${empresas.length}) — e-mail usado no .eml e no "Copiar e-mail"`} wide>
              <input value={empresaBusca} onChange={e => setEmpresaBusca(e.target.value)} placeholder="🔍 Buscar por empresa, contratante ou e-mail..."
                style={inputStyle({ width: '100%', marginBottom: 10 })} />
              <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 14, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                {empresasFiltradas.map(e => editEmpresaId === e.id ? (
                  <div key={e.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, background: '#FCFDFF', flexWrap: 'wrap' }}>
                    <input value={editNome} onChange={ev => setEditNome(ev.target.value)} placeholder="Razão social / fantasia" style={inputStyle({ flex: 2, minWidth: 160 })} />
                    <input value={editContratante} onChange={ev => setEditContratante(ev.target.value)} placeholder="Contratante" style={inputStyle({ flex: 1, minWidth: 110 })} />
                    <input value={editEmail} onChange={ev => setEditEmail(ev.target.value)} placeholder="e-mail1@x.com;e-mail2@x.com" style={inputStyle({ flex: 2, minWidth: 160 })} />
                    <button onClick={salvarEdicaoEmpresa} style={sm(btnAccent)}>✓ Salvar</button>
                    <button onClick={cancelarEdicaoEmpresa} style={sm(btnGhost)}>Cancelar</button>
                  </div>
                ) : (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 13.5 }}>{e.nome}</b>
                      <div style={{ fontSize: 11.5, color: MUTED, overflowWrap: 'break-word' }}>
                        {e.contratante || '—'} {e.email ? <>· {e.email}</> : <span style={{ color: '#B45309' }}>· e-mail não cadastrado</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => iniciarEdicaoEmpresa(e)} title="Editar" style={{ ...btnDangerIcon, color: PRIMARY }}>✏️</button>
                      <button onClick={() => removerEmpresa(e.id)} style={btnDangerIcon} title="Excluir">🗑</button>
                    </div>
                  </div>
                ))}
                {empresasFiltradas.length === 0 && <div style={{ fontSize: 12.5, color: MUTED, padding: '10px' }}>Nenhuma empresa encontrada.</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={novaEmpresaNome} onChange={e => setNovaEmpresaNome(e.target.value)} placeholder="Razão social / fantasia" style={inputStyle({ flex: 2, minWidth: 180 })} />
                <input value={novaEmpresaContratante} onChange={e => setNovaEmpresaContratante(e.target.value)} placeholder="Contratante" style={inputStyle({ flex: 1, minWidth: 130 })} />
                <input value={novaEmpresaEmail} onChange={e => setNovaEmpresaEmail(e.target.value)} placeholder="e-mail1@x.com;e-mail2@x.com" style={inputStyle({ flex: 2, minWidth: 180 })} />
                <button onClick={addEmpresa} style={sm(btnAccent)}>＋ Add</button>
              </div>
            </ConfigPanel>

            {/* Painel 6: Estrutura do e-mail */}
            <ConfigPanel title="Estrutura do e-mail" subtitle="Assunto, saudação e fechamento — editáveis a qualquer momento, valem para todo e-mail montado pelo módulo" wide>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>
                    Assunto <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>— variável: <code>{'{{empresa}}'}</code></span>
                  </div>
                  <input value={cfgAssunto} onChange={e => setCfgAssunto(e.target.value)} style={inputStyle({ width: '100%' })} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>
                    Saudação (abertura) <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>— variável: <code>{'{{setores}}'}</code> (fica em negrito, se adapta a 1 ou mais)</span>
                  </div>
                  <textarea value={cfgSaudacao} onChange={e => setCfgSaudacao(e.target.value)} rows={2} style={inputStyle({ width: '100%', resize: 'vertical' })} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Fechamento</div>
                  <textarea value={cfgFechamento} onChange={e => setCfgFechamento(e.target.value)} rows={2} style={inputStyle({ width: '100%', resize: 'vertical' })} />
                </div>
                <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
                  O bloco de setor/documentos (título em negrito+sublinhado com os tópicos) é montado automaticamente a partir do que foi marcado e não é editável aqui.
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>
                    Prazo do histórico (Minha Caixa / Visão geral)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" min={1} value={cfgHistoricoDias}
                      onChange={e => setCfgHistoricoDias(Math.max(1, Number(e.target.value) || 1))}
                      style={inputStyle({ width: 90 })} />
                    <span style={{ fontSize: 12.5, color: MUTED }}>dias — passado isso, o item sai da lista principal e vai para o Histórico (continua acionável lá)</span>
                  </div>
                </div>
                <div>
                  <button onClick={salvarEmailConfig} disabled={savingConfig} style={{ ...btnAccent, opacity: savingConfig ? .6 : 1 }}>
                    {savingConfig ? 'Salvando...' : '💾 Salvar estrutura'}
                  </button>
                </div>
              </div>
            </ConfigPanel>

          </div>
        )}
      </div>

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) translateY(${toast.show ? 0 : 20}px)`,
        background: TEXT, color: '#fff', padding: '11px 20px', borderRadius: 999, fontSize: 13, fontWeight: 500,
        boxShadow: '0 8px 24px rgba(20,30,60,.12)', opacity: toast.show ? 1 : 0, transition: 'all .25s', zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', flexShrink: 0 }} />
        {toast.msg}
      </div>
    </div>
  )
}
