'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useUser, displayName } from '../components/UserContext'
import { createClient } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Item = { id: string; chave: string; texto: string }

type Treino = {
  id: string
  nome: string
  descricao: string
  ativo: boolean
  ordem: number
  itens: Item[]
}

type Combo = {
  id: string
  nome: string
  treinamento_ids: string[]
  ordem: number
}

type Config = {
  email: { tituloComuns: string; cabecalho: string; rodape: string }
  modelos: { contratante: string; empresa: string; atividade: string }
  acoes: { inclusao: string; remocao: string }
  rotulos: { inclusao: string; remocao: string }
  formas_contato: string[]
  atalhos: Atalho[]
}

/** Atalho pronto: define só os campos que quiser (os demais ficam para preencher na hora). */
type Atalho = {
  id: string
  nome: string
  acao: 'inclusao' | 'remocao' | null
  origem: 'contratante' | 'empresa' | 'atividade' | null
  contato: string | null
}

type Hist = {
  id: string
  data: string | null
  alvo: string
  acao: string
  origem: string
  contratante: string
  contato: string
  texto: string
  created_at: string
}

type Alvo = { tipo: 'nr' | 'combo'; id: string }

type Form = {
  acao: 'inclusao' | 'remocao' | null
  origem: 'contratante' | 'empresa' | 'atividade' | null
  contratante: string
  contato: string | null
  contatoOutro: string
  data: string
}

type Draft = { nome: string; descricao: string; itens: Item[] }

type View = 'home' | 'detalhe' | 'historico' | 'config'
type CfgTab = 'treinamentos' | 'combos' | 'modelos' | 'atalhos' | 'email' | 'geral'

// ─── Design tokens ────────────────────────────────────────────────────────────

const PRIMARY      = '#2A4F96'
const PRIMARY_DARK = '#1E3A70'
const PRIMARY_SOFT = '#E8EEF9'
const ACCENT       = '#D1AE6E'
const ACCENT_SOFT  = '#FBF4E6'
const ACCENT_DARK  = '#7A5C1E'
const BG           = '#F4F6FA'
const SURF         = '#FFFFFF'
const BORDER       = '#E2E8F0'
const TEXT         = '#1F2937'
const MUTED        = '#6B7280'
const OK           = '#15803D'
const OK_SOFT      = '#E7F6EC'
const DANGER       = '#B91C1C'
const RADIUS       = 12
const SHADOW       = '0 1px 3px rgba(30,58,112,.08),0 6px 18px rgba(30,58,112,.06)'

/** Todos os padrões possíveis de ação × origem × contato (sem "Outros", que exige texto livre). */
const ATALHOS_PADRAO: Atalho[] = [
  { id: 'inc-emp-whatsapp',   nome: 'Inclusão · Empresa · WhatsApp',      acao: 'inclusao', origem: 'empresa',     contato: 'WhatsApp' },
  { id: 'inc-emp-email',      nome: 'Inclusão · Empresa · E-mail',        acao: 'inclusao', origem: 'empresa',     contato: 'E-mail' },
  { id: 'inc-emp-portal',     nome: 'Inclusão · Empresa · Portal',        acao: 'inclusao', origem: 'empresa',     contato: 'Portal' },
  { id: 'rem-emp-whatsapp',   nome: 'Remoção · Empresa · WhatsApp',       acao: 'remocao',  origem: 'empresa',     contato: 'WhatsApp' },
  { id: 'rem-emp-email',      nome: 'Remoção · Empresa · E-mail',         acao: 'remocao',  origem: 'empresa',     contato: 'E-mail' },
  { id: 'rem-emp-portal',     nome: 'Remoção · Empresa · Portal',         acao: 'remocao',  origem: 'empresa',     contato: 'Portal' },
  { id: 'inc-ctt-whatsapp',   nome: 'Inclusão · Contratante · WhatsApp',  acao: 'inclusao', origem: 'contratante', contato: 'WhatsApp' },
  { id: 'inc-ctt-email',      nome: 'Inclusão · Contratante · E-mail',    acao: 'inclusao', origem: 'contratante', contato: 'E-mail' },
  { id: 'inc-ctt-portal',     nome: 'Inclusão · Contratante · Portal',    acao: 'inclusao', origem: 'contratante', contato: 'Portal' },
  { id: 'rem-ctt-whatsapp',   nome: 'Remoção · Contratante · WhatsApp',   acao: 'remocao',  origem: 'contratante', contato: 'WhatsApp' },
  { id: 'rem-ctt-email',      nome: 'Remoção · Contratante · E-mail',     acao: 'remocao',  origem: 'contratante', contato: 'E-mail' },
  { id: 'rem-ctt-portal',     nome: 'Remoção · Contratante · Portal',     acao: 'remocao',  origem: 'contratante', contato: 'Portal' },
  { id: 'inc-atividade',      nome: 'Inclusão · Atividade da empresa',    acao: 'inclusao', origem: 'atividade',   contato: null },
  { id: 'rem-atividade',      nome: 'Remoção · Atividade da empresa',     acao: 'remocao',  origem: 'atividade',   contato: null },
]

const CONFIG_PADRAO: Config = {
  email: {
    tituloComuns: 'Padrão a todos:',
    cabecalho: 'Olá!\n\nOK, inseridos o(s) treinamento(s) solicitado(s).\n\nConsiderações:',
    rodape: '',
  },
  modelos: {
    contratante: '{{data}}: {{acao}} {{treinamentos}}, conforme solicitação da {{contratante}} via {{contato}}. {{usuario}}',
    empresa: '{{data}}: {{acao}} {{treinamentos}}, conforme solicitação da própria empresa via {{contato}}. {{usuario}}',
    atividade: '{{data}}: {{acao}} {{treinamentos}}, conforme atividade da empresa. {{usuario}}',
  },
  acoes: { inclusao: 'inserido', remocao: 'removido' },
  rotulos: { inclusao: 'Aprovação (inclusão)', remocao: 'Remoção' },
  formas_contato: ['E-mail', 'Portal', 'WhatsApp', 'Outros'],
  atalhos: ATALHOS_PADRAO,
}

/** Textos que já nascem em todo treinamento novo, com a chave de item comum. */
const COMUNS = {
  envio: 'Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;',
  ead: 'Não é possível aceitar treinamentos 100% EAD.',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9)
const normaliza = (s: string) => String(s).toLowerCase().replace(/\s+/g, ' ').trim()
const hoje = () => new Date().toISOString().slice(0, 10)

function dataBR(iso: string | null) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function juntar(arr: string[]) {
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  return `${arr.slice(0, -1).join(', ')} e ${arr[arr.length - 1]}`
}

/**
 * Mescla as exigências de vários treinamentos.
 * - item com `chave` preenchida: deduplicado pela chave
 * - item sem chave: deduplicado pelo texto normalizado
 * - item presente em 2+ NRs vira "comum" e sai dos blocos individuais
 */
function mesclar(ids: string[], treinos: Treino[]) {
  const byId = new Map(treinos.map(t => [t.id, t]))
  const mapa = new Map<string, { texto: string; nrs: Set<string>; ordem: number }>()

  ids.forEach(id => {
    const t = byId.get(id)
    if (!t) return
    t.itens.forEach(it => {
      const sig = it.chave ? `k:${it.chave}` : `x:${normaliza(it.texto)}`
      if (!mapa.has(sig)) mapa.set(sig, { texto: it.texto, nrs: new Set(), ordem: mapa.size })
      mapa.get(sig)!.nrs.add(id)
    })
  })

  const comuns: string[] = []
  const porNr: Record<string, string[]> = {}
  ids.forEach(i => { porNr[i] = [] })

  const valores = [...mapa.values()].sort((a, b) => a.ordem - b.ordem)
  valores.forEach(v => {
    if (ids.length > 1 && v.nrs.size > 1) comuns.push(v.texto)
    else porNr[[...v.nrs][0]]?.push(v.texto)
  })

  const blocos = ids
    .map(id => ({ nome: byId.get(id)?.nome ?? '', itens: porNr[id] ?? [] }))
    .filter(b => b.itens.length)

  return { comuns, blocos }
}

function nomesTreinos(ids: string[], treinos: Treino[]) {
  return ids.map(i => treinos.find(t => t.id === i)?.nome ?? '').filter(Boolean)
}

const GRUPOS_ATALHO: [Atalho['origem'], string][] = [
  ['contratante', 'Contratante'],
  ['empresa', 'Empresa'],
  ['atividade', 'Atividade'],
  [null, 'Outros'],
]

function agruparAtalhos(atalhos: Atalho[]) {
  return GRUPOS_ATALHO
    .map(([origem, label]) => ({ origem, label, itens: atalhos.filter(a => a.origem === origem) }))
    .filter(g => g.itens.length > 0)
}

function textoOrientacao(ids: string[], treinos: Treino[], config: Config) {
  const { comuns, blocos } = mesclar(ids, treinos)
  const nomes = juntar(nomesTreinos(ids, treinos))

  let out = `${config.email.cabecalho.replace(/\{\{treinamentos\}\}/g, nomes)}\n\n`
  if (comuns.length) {
    out += `${config.email.tituloComuns || 'Padrão a todos:'}\n`
    comuns.forEach(x => { out += `- ${x}\n` })
    out += '\n'
  }
  blocos.forEach(b => {
    if (blocos.length > 1 || comuns.length) out += `${b.nome}:\n`
    b.itens.forEach(x => { out += `- ${x}\n` })
    out += '\n'
  })
  out += config.email.rodape.replace(/\{\{treinamentos\}\}/g, nomes)
  return out.trim()
}

function contatoTexto(form: Form) {
  if (form.contato === 'Outros') return form.contatoOutro.trim() || 'outros'
  return form.contato ?? ''
}

function textoRegistro(ids: string[], treinos: Treino[], config: Config, form: Form, usuario: string) {
  if (!form.acao || !form.origem) return ''
  const precisaContato = form.origem === 'contratante' || form.origem === 'empresa'
  if (precisaContato && !form.contato) return ''
  if (form.origem === 'contratante' && !form.contratante) return ''
  if (form.contato === 'Outros' && !form.contatoOutro.trim()) return ''

  const nomes = juntar(nomesTreinos(ids, treinos))
  return (config.modelos[form.origem] || '')
    .replace(/\{\{data\}\}/g, dataBR(form.data))
    .replace(/\{\{acao\}\}/g, config.acoes[form.acao] || '')
    .replace(/\{\{treinamentos\}\}/g, nomes)
    .replace(/\{\{contratante\}\}/g, form.contratante || '')
    .replace(/\{\{contato\}\}/g, contatoTexto(form))
    .replace(/\{\{usuario\}\}/g, usuario)
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function copiarTexto(txt: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(txt)
      return true
    }
  } catch { /* cai no fallback */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = txt
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}

function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Estilos reutilizados ────────────────────────────────────────────────────

const S = {
  panel: { background: SURF, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW } as React.CSSProperties,
  panelHead: { padding: '15px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 } as React.CSSProperties,
  panelTitle: { margin: 0, fontSize: 15, fontWeight: 600 } as React.CSSProperties,
  panelBody: { padding: 18 } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 } as React.CSSProperties,
  input: { width: '100%', padding: '9px 11px', border: `1px solid ${BORDER}`, borderRadius: 8, background: '#fff', color: TEXT, fontSize: 14, fontFamily: 'inherit' } as React.CSSProperties,
  textarea: { width: '100%', padding: '9px 11px', border: `1px solid ${BORDER}`, borderRadius: 8, background: '#fff', color: TEXT, fontSize: 14, fontFamily: 'inherit', minHeight: 80, lineHeight: 1.55, resize: 'vertical' } as React.CSSProperties,
  hint: { fontSize: 12.5, color: MUTED, marginTop: 5 } as React.CSSProperties,
  listItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', border: `1px solid ${BORDER}`, borderRadius: 9, background: '#fff', marginBottom: 8 } as React.CSSProperties,
  empty: { padding: 34, textAlign: 'center', color: MUTED, background: SURF, border: `1px dashed ${BORDER}`, borderRadius: RADIUS } as React.CSSProperties,
  callout: { background: ACCENT_SOFT, border: '1px solid #EBD8B2', borderRadius: 9, padding: '12px 14px', fontSize: 13.5, color: '#6B5320', marginBottom: 16 } as React.CSSProperties,
  divider: { height: 1, background: BORDER, margin: '20px 0' } as React.CSSProperties,
  mono: { fontFamily: 'Consolas,"Courier New",monospace', fontSize: 13, background: '#EEF1F7', padding: '1px 5px', borderRadius: 4 } as React.CSSProperties,
  cell: { padding: '9px 10px', borderBottom: '1px solid var(--border-soft)', verticalAlign: 'top' } as React.CSSProperties,
  secao: { fontSize: 13, fontWeight: 600, color: MUTED, margin: '26px 0 12px' } as React.CSSProperties,
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 15 } as React.CSSProperties,
}

type BtnKind = 'primary' | 'ghost' | 'gold' | 'danger'

function btnStyle(kind: BtnKind = 'primary', sm = false): React.CSSProperties {
  const base: React.CSSProperties = {
    border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
    padding: sm ? '6px 11px' : '9px 16px', fontSize: sm ? 13 : 14, whiteSpace: 'nowrap',
  }
  if (kind === 'ghost')  return { ...base, background: '#fff', color: PRIMARY, border: `1px solid ${BORDER}` }
  if (kind === 'gold')   return { ...base, background: ACCENT, color: '#3A2E14' }
  if (kind === 'danger') return { ...base, background: '#fff', color: DANGER, border: '1px solid #F0CFCF' }
  return { ...base, background: PRIMARY, color: '#fff' }
}

/** Botão de atalho: verde para inclusão, vermelho para remoção, dourado quando a ação não foi predefinida. */
function atalhoBtnStyle(a: Atalho): React.CSSProperties {
  const base = btnStyle('ghost', true)
  if (a.acao === 'inclusao') return { ...base, background: OK, color: '#fff', border: 'none' }
  if (a.acao === 'remocao')  return { ...base, background: DANGER, color: '#fff', border: 'none' }
  return { ...base, background: ACCENT, color: '#3A2E14', border: 'none' }
}

// ─── Componentes auxiliares (nível de módulo: não remontam a cada render) ─────

function CopyBox({ texto, copiado, onCopy }: { texto: string; copiado: boolean; onCopy: () => void }) {
  return (
    <button onClick={onCopy}
      style={{
        position: 'relative', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: copiado ? OK_SOFT : '#FBFCFE', border: `1px solid ${copiado ? OK : BORDER}`,
        borderRadius: 10, padding: '15px 34px 15px 16px', whiteSpace: 'pre-wrap', fontSize: 14,
        lineHeight: 1.62, fontFamily: 'inherit', color: TEXT,
      }}>
      <span style={{
        position: 'absolute', top: 9, right: 11, fontSize: 11.5, fontWeight: 700,
        color: copiado ? OK : MUTED, background: '#fff',
        border: `1px solid ${copiado ? '#B7E0C4' : BORDER}`, borderRadius: 6, padding: '2px 8px',
      }}>
        {copiado ? 'Copiado' : 'Clique para copiar'}
      </span>
      {texto}
    </button>
  )
}

function Opcao({ on, gold, onClick, children }: { on: boolean; gold?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        border: `1px solid ${on ? (gold ? ACCENT : PRIMARY) : BORDER}`,
        background: on ? (gold ? ACCENT : PRIMARY) : '#fff',
        color: on ? (gold ? '#3A2E14' : '#fff') : TEXT,
        borderRadius: 9, padding: '9px 15px', cursor: 'pointer', fontWeight: 500,
        fontFamily: 'inherit', fontSize: 14,
      }}>
      {children}
    </button>
  )
}

function Tab({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`gt3-tab${ativo ? ' gt3-tab-active' : ''}`}
      style={{
        background: 'none', border: 0, borderBottom: '2px solid transparent',
        padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, marginBottom: -1,
        color: ativo ? PRIMARY : MUTED, fontWeight: ativo ? 600 : 500,
      }}>
      {children}
    </button>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RetornoNRClient() {
  const { profile } = useUser()
  const usuario = profile ? displayName(profile, '') : ''

  const [treinos, setTreinos]           = useState<Treino[]>([])
  const [combos, setCombos]             = useState<Combo[]>([])
  const [config, setConfig]             = useState<Config>(CONFIG_PADRAO)
  const [contratantes, setContratantes] = useState<string[]>([])
  const [historico, setHistorico]       = useState<Hist[]>([])
  const [loading, setLoading]           = useState(true)

  const [view, setView]     = useState<View>('home')
  const [cfgTab, setCfgTab] = useState<CfgTab>('treinamentos')
  const [alvo, setAlvo]     = useState<Alvo | null>(null)
  const [livreSel, setLivreSel] = useState<string[]>([])
  const [busca, setBusca]   = useState('')
  const [form, setForm]     = useState<Form>({ acao: null, origem: null, contratante: '', contato: null, contatoOutro: '', data: hoje() })

  // Configurações — edição de treinamento e de combinação
  const [editando, setEditando]         = useState<string | null>(null)
  const [draft, setDraft]               = useState<Draft>({ nome: '', descricao: '', itens: [] })
  const [comboSel, setComboSel]         = useState<string[]>([])
  const [comboNome, setComboNome]       = useState('')
  const [comboNomeAuto, setComboNomeAuto] = useState(true)
  const [novaForma, setNovaForma]       = useState('')
  const [atalhoNome, setAtalhoNome]     = useState('')
  const [atalhoAcao, setAtalhoAcao]     = useState<Atalho['acao']>(null)
  const [atalhoOrigem, setAtalhoOrigem] = useState<Atalho['origem']>(null)
  const [atalhoContato, setAtalhoContato] = useState<string | null>(null)
  const [salvando, setSalvando]         = useState(false)

  const [copiado, setCopiado] = useState<string | null>(null)
  const [toast, setToast]     = useState<{ msg: string; show: boolean }>({ msg: '', show: false })
  const toastTimer            = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const copyTimer             = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, show: true })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2400)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (copyTimer.current) clearTimeout(copyTimer.current)
  }, [])

  // ── Load ────────────────────────────────────────────────────────────────────

  const carregarEstado = useCallback(async () => {
    const res = await fetch('/api/retorno-de-nr')
    if (!res.ok) return
    const data = await res.json() as { treinamentos: Treino[]; combos: Combo[]; config: Partial<Config> | null }
    setTreinos((data.treinamentos ?? []).map(t => ({ ...t, itens: Array.isArray(t.itens) ? t.itens : [] })))
    setCombos(data.combos ?? [])
    if (data.config) {
      setConfig({
        email:          { ...CONFIG_PADRAO.email,   ...(data.config.email   ?? {}) },
        modelos:        { ...CONFIG_PADRAO.modelos, ...(data.config.modelos ?? {}) },
        acoes:          { ...CONFIG_PADRAO.acoes,   ...(data.config.acoes   ?? {}) },
        rotulos:        { ...CONFIG_PADRAO.rotulos, ...(data.config.rotulos ?? {}) },
        formas_contato: data.config.formas_contato?.length ? data.config.formas_contato : CONFIG_PADRAO.formas_contato,
        atalhos:        Array.isArray(data.config.atalhos) ? data.config.atalhos : CONFIG_PADRAO.atalhos,
      })
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      // carregarEstado só faz setState depois do await do fetch — não é síncrono no efeito
      // eslint-disable-next-line react-hooks/set-state-in-effect
      carregarEstado(),
      fetch('/api/retorno-de-nr/historico').then(r => r.ok ? r.json() : []).then((h: Hist[]) => setHistorico(h)),
      supabase.from('contratantes').select('name').order('name').then(({ data }) => {
        const nomes = (data ?? []).map((c: { name: string | null }) => (c.name ?? '').trim()).filter(Boolean)
        setContratantes([...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR')))
      }),
    ]).finally(() => setLoading(false))
  }, [carregarEstado])

  // ── Realtime: textos e combinações são compartilhados pela equipe ────────────

  useEffect(() => {
    const supabase = createClient()
    const sufixo = Math.random().toString(36).slice(2)
    const ch = supabase
      .channel(`retorno-nr-${sufixo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rnr_treinamentos' }, () => { carregarEstado() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rnr_combos' },        () => { carregarEstado() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rnr_config' },        () => { carregarEstado() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [carregarEstado])

  // ── Derivados ───────────────────────────────────────────────────────────────

  const alvoAtual = useMemo(() => {
    if (!alvo) return null
    if (alvo.tipo === 'nr') {
      const t = treinos.find(x => x.id === alvo.id)
      return t ? { nome: t.nome, ids: [t.id] } : null
    }
    const c = combos.find(x => x.id === alvo.id)
    return c ? { nome: c.nome, ids: c.treinamento_ids.filter(i => treinos.some(t => t.id === i)) } : null
  }, [alvo, treinos, combos])

  // ── Ações ───────────────────────────────────────────────────────────────────

  const copiar = useCallback(async (txt: string, marca: string) => {
    const ok = await copiarTexto(txt)
    if (!ok) { showToast('Não foi possível copiar — use Ctrl+C.'); return }
    if (copyTimer.current) clearTimeout(copyTimer.current)
    setCopiado(marca)
    copyTimer.current = setTimeout(() => setCopiado(null), 1600)
    showToast('Texto copiado')
  }, [showToast])

  function abrirCard(tipo: 'nr' | 'combo', id: string) {
    setAlvo({ tipo, id })
    setForm({ acao: null, origem: null, contratante: '', contato: null, contatoOutro: '', data: hoje() })
    setView('detalhe')

    const ids = tipo === 'nr'
      ? (treinos.some(t => t.id === id) ? [id] : [])
      : (combos.find(c => c.id === id)?.treinamento_ids.filter(i => treinos.some(t => t.id === i)) ?? [])
    if (ids.length) void copiar(textoOrientacao(ids, treinos, config), 'orientacao')
  }

  /** Marca/desmarca um treinamento na seleção por flag da tela inicial e já copia a orientação atualizada. */
  function toggleLivre(id: string) {
    const next = livreSel.includes(id) ? livreSel.filter(i => i !== id) : [...livreSel, id]
    setLivreSel(next)
    if (next.length) void copiar(textoOrientacao(next, treinos, config), 'orientacao')
  }

  /** Limpa a seleção por flag e o formulário, pra começar do zero depois de finalizar um registro. */
  function resetarLivre() {
    setLivreSel([])
    setForm({ acao: null, origem: null, contratante: '', contato: null, contatoOutro: '', data: hoje() })
  }

  /**
   * Aplica só os campos definidos no atalho — o resto do formulário fica como está, para completar na mão.
   * Se os campos aplicados já forem suficientes para gerar o texto (ex.: Empresa + WhatsApp não precisam
   * de contratante), copia na hora. Senão, só preenche e avisa o que falta.
   */
  function aplicarAtalho(a: Atalho, ids: string[]) {
    const origemMudou = a.origem !== null && a.origem !== form.origem
    const novo: Form = {
      ...form,
      acao: a.acao ?? form.acao,
      origem: a.origem ?? form.origem,
      contratante: origemMudou ? '' : form.contratante,
      contato: a.contato ?? (origemMudou ? null : form.contato),
      contatoOutro: origemMudou || (a.contato && a.contato !== 'Outros') ? '' : form.contatoOutro,
    }
    setForm(novo)
    if (!ids.length) return
    const texto = textoRegistro(ids, treinos, config, novo, usuario)
    if (texto) void copiar(texto, 'registro')
    else showToast('Atalho aplicado — complete os campos restantes para copiar.')
  }

  function abrirEditor(t: Treino) {
    setDraft({ nome: t.nome, descricao: t.descricao, itens: t.itens.map(i => ({ ...i })) })
    setEditando(t.id)
  }

  async function salvarNoHistorico(nome: string, texto: string) {
    if (!texto) return
    const res = await fetch('/api/retorno-de-nr/historico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: form.data,
        alvo: nome,
        acao: form.acao ? config.acoes[form.acao] : '',
        origem: form.origem ?? '',
        contratante: form.contratante,
        contato: contatoTexto(form),
        texto,
      }),
    })
    if (!res.ok) { showToast('Erro ao salvar no histórico.'); return }
    const novo: Hist = await res.json()
    setHistorico(prev => [novo, ...prev])
    showToast('Registro salvo no histórico')
  }

  async function salvarConfig(patch: Partial<Config>, msg = 'Configuração salva') {
    setConfig(c => ({ ...c, ...patch }))
    setSalvando(true)
    const res = await fetch('/api/retorno-de-nr', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSalvando(false)
    showToast(res.ok ? msg : 'Erro ao salvar.')
  }

  // ── Views (funções chamadas direto: não criam novo tipo de componente) ───────

  function renderHome() {
    const q = normaliza(busca)
    const nrs = treinos.filter(t => t.ativo !== false && (!q || normaliza(`${t.nome} ${t.descricao}`).includes(q)))
    const cbs = combos.filter(c => !q || normaliza(c.nome).includes(q))

    const cardBase: React.CSSProperties = {
      background: SURF, border: `1px solid ${BORDER}`, borderLeft: `5px solid ${PRIMARY}`,
      borderRadius: RADIUS, padding: '16px 17px', cursor: 'pointer', textAlign: 'left',
      boxShadow: SHADOW, display: 'block', width: '100%', fontFamily: 'inherit', color: TEXT,
    }

    const nomeLivre = livreSel.length ? nomesTreinos(livreSel, treinos).join(' + ') : ''

    return (
      <>
        <div style={{ ...S.panel, marginBottom: 18 }}>
          <div style={S.panelHead}>
            <h3 style={S.panelTitle}>Treinamentos (marque quantos quiser)</h3>
            {livreSel.length > 0 && (
              <button style={{ ...btnStyle('danger', true), marginLeft: 'auto' }} onClick={resetarLivre}>Resetar seleção</button>
            )}
          </div>
          <div style={S.panelBody}>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {treinos.filter(t => t.ativo !== false).map(t => (
                // toggleLivre only runs on click, never during render — copyTimer.current is safe here.
                // eslint-disable-next-line react-hooks/refs
                <Opcao key={t.id} on={livreSel.includes(t.id)} onClick={() => toggleLivre(t.id)}>{t.nome}</Opcao>
              ))}
            </div>
            <div style={S.hint}>
              A cada treinamento marcado ou desmarcado, a orientação ao prestador já é copiada — sem precisar clicar em nada.
              Prefere ir por card? As combinações e treinamentos prontos continuam logo abaixo.
            </div>
          </div>
        </div>

        {livreSel.length > 0 && (
          <div style={{ marginBottom: 26 }}>
            {renderPainelRegistro(nomeLivre, livreSel)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar NR ou combinação..."
            style={{ ...S.input, maxWidth: 340 }} />
          <button style={btnStyle('ghost', true)} onClick={() => { setCfgTab('combos'); setView('config') }}>Nova combinação</button>
          <button style={btnStyle('ghost', true)} onClick={() => { setEditando(null); setCfgTab('treinamentos'); setView('config') }}>Novo treinamento</button>
        </div>

        {cbs.length > 0 && (
          <>
            <div style={{ ...S.secao, marginTop: 0 }}>Combinações prontas</div>
            <div style={S.cards}>
              {cbs.map(c => {
                const nomes = nomesTreinos(c.treinamento_ids, treinos)
                const m = mesclar(c.treinamento_ids, treinos)
                return (
                  // abrirCard only runs on click, never during render — copyTimer.current is safe here.
                  // eslint-disable-next-line react-hooks/refs
                  <button key={c.id} onClick={() => abrirCard('combo', c.id)} style={{ ...cardBase, borderLeftColor: ACCENT }}>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 5 }}>{c.nome}</div>
                    <div style={{ fontSize: 13, color: MUTED, minHeight: 34 }}>{nomes.join(' · ')}</div>
                    <div style={{ marginTop: 11, fontSize: 12, color: '#B45309', fontWeight: 600 }}>{m.comuns.length} itens em comum</div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div style={S.secao}>Treinamentos</div>
        {nrs.length > 0 ? (
          <div style={S.cards}>
            {nrs.map(t => (
              <button key={t.id} onClick={() => abrirCard('nr', t.id)} style={cardBase}>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 5 }}>{t.nome}</div>
                <div style={{ fontSize: 13, color: MUTED, minHeight: 34 }}>{t.descricao}</div>
                <div style={{ marginTop: 11, fontSize: 12, color: PRIMARY, fontWeight: 600 }}>{t.itens.length} exigências</div>
              </button>
            ))}
          </div>
        ) : (
          <div style={S.empty}>Nenhum treinamento encontrado para essa busca.</div>
        )}
      </>
    )
  }

  /** Botão de voltar ao início do módulo — usado na tela de card e na montagem livre. */
  function BotaoVoltar() {
    return (
      <button onClick={() => setView('home')} style={{ ...btnStyle('ghost', true), marginBottom: 16 }}>
        ← Voltar ao início
      </button>
    )
  }

  /**
   * Painéis "1. Orientação ao prestador" e "2. Registro no GT0100", montados a partir de uma
   * lista de ids de treinamento — usado tanto pelo card/combinação pronta quanto pela montagem
   * livre (seleção por flag), que recalcula tudo em tempo real a cada treinamento marcado.
   */
  function renderPainelRegistro(nome: string, ids: string[]) {
    const nomes = nomesTreinos(ids, treinos)
    const m = mesclar(ids, treinos)
    const orientacao = textoOrientacao(ids, treinos, config)
    const registro = textoRegistro(ids, treinos, config, form, usuario)

    /** Só falta escolher o contratante — os atalhos de Contratante não presetam esse campo (varia sempre). */
    function selecionarContratante(v: string) {
      const novo: Form = { ...form, contratante: v }
      setForm(novo)
      if (!v) return
      const texto = textoRegistro(ids, treinos, config, novo, usuario)
      if (texto) void copiar(texto, 'registro')
    }

    return (
      <>
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 23, fontWeight: 600 }}>{nome}</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            {nomes.map(n => (
              <span key={n} style={{ background: PRIMARY_SOFT, color: PRIMARY_DARK, borderRadius: 20, padding: '3px 11px', fontSize: 12.5, fontWeight: 600 }}>{n}</span>
            ))}
            {ids.length > 1 && (
              <span style={{ background: ACCENT_SOFT, color: ACCENT_DARK, borderRadius: 20, padding: '3px 11px', fontSize: 12.5, fontWeight: 600 }}>
                {m.comuns.length} itens mesclados
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 16, alignItems: 'start' }}>

          {/* 1. Orientação ao prestador */}
          <div style={S.panel}>
            <div style={S.panelHead}>
              <h3 style={S.panelTitle}>1. Orientação ao prestador</h3>
              <button style={{ ...btnStyle('ghost', true), marginLeft: 'auto' }}
                onClick={() => { setEditando(null); setCfgTab('treinamentos'); setView('config') }}>Editar textos</button>
            </div>
            <div style={S.panelBody}>
              <CopyBox texto={orientacao} copiado={copiado === 'orientacao'} onCopy={() => copiar(orientacao, 'orientacao')} />
            </div>
          </div>

          {/* 2. Registro no GT0100 */}
          <div style={S.panel}>
            <div style={S.panelHead}>
              <h3 style={S.panelTitle}>2. Registro no GT0100 (INSOFT)</h3>
              <button style={{ ...btnStyle('ghost', true), marginLeft: 'auto' }}
                onClick={() => { setCfgTab('modelos'); setView('config') }}>Editar modelo</button>
            </div>
            <div style={S.panelBody}>

              {config.atalhos.length > 0 ? (
                <div style={{ marginBottom: 18 }}>
                  <span style={S.label}>Clique na opção que corresponde ao pedido</span>
                  {agruparAtalhos(config.atalhos).map(g => (
                    <div key={g.label} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, margin: '2px 0 6px' }}>{g.label}</div>
                      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                        {g.itens.map(a => (
                          <button key={a.id} onClick={() => aplicarAtalho(a, ids)} style={atalhoBtnStyle(a)}>{a.nome}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={S.hint}>O texto abaixo já sai pronto e copiado — em Contratante, só falta escolher qual.</div>
                </div>
              ) : (
                <div style={{ ...S.callout, marginBottom: 18 }}>
                  Nenhum atalho configurado ainda. Cadastre em <b>Configurações → Atalhos prontos</b> pra gerar o registro com um clique.
                </div>
              )}

              {form.origem === 'contratante' && (
                <div style={{ marginBottom: 18 }}>
                  <span style={S.label}>Qual contratante</span>
                  {contratantes.length > 0 ? (
                    <>
                      <select value={form.contratante} onChange={e => selecionarContratante(e.target.value)} style={S.input}>
                        <option value="">Selecione...</option>
                        {contratantes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div style={S.hint}>Lista sincronizada do módulo Cadastro Contratantes.</div>
                    </>
                  ) : (
                    <div style={{ ...S.callout, margin: 0 }}>Nenhum contratante encontrado no módulo Cadastro Contratantes.</div>
                  )}
                </div>
              )}

              <div style={S.divider} />

              <span style={S.label}>Observação gerada</span>
              {registro ? (
                <>
                  <CopyBox texto={registro} copiado={copiado === 'registro'} onCopy={() => copiar(registro, 'registro')} />
                  <button style={{ ...btnStyle('gold', true), marginTop: 12 }} onClick={() => salvarNoHistorico(nome, registro)}>Salvar no histórico</button>
                </>
              ) : (
                <div style={{ ...S.empty, padding: 20 }}>
                  {form.origem === 'contratante' ? 'Selecione o contratante para gerar o texto.' : 'Clique em uma opção acima para gerar o texto.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  function renderDetalhe() {
    if (!alvoAtual) {
      return <><BotaoVoltar /><div style={S.empty}>Este card não existe mais.</div></>
    }
    return <><BotaoVoltar />{renderPainelRegistro(alvoAtual.nome, alvoAtual.ids)}</>
  }

  function renderHistorico() {
    async function limpar() {
      if (!confirm('Apagar todo o seu histórico?')) return
      const res = await fetch('/api/retorno-de-nr/historico', { method: 'DELETE' })
      if (!res.ok) { showToast('Erro ao limpar histórico.'); return }
      setHistorico([])
    }

    async function excluir(id: string) {
      const res = await fetch(`/api/retorno-de-nr/historico?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { showToast('Erro ao excluir.'); return }
      setHistorico(prev => prev.filter(h => h.id !== id))
    }

    function exportarCsv() {
      const linhas = [['Data', 'Treinamentos', 'Acao', 'Origem', 'Contratante', 'Contato', 'Texto']]
      historico.forEach(r => linhas.push([dataBR(r.data), r.alvo, r.acao, r.origem, r.contratante, r.contato, r.texto]))
      const csv = linhas.map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
      baixarArquivo('retorno-nr-historico.csv', `﻿${csv}`, 'text/csv')
    }

    const cols: [string, number | undefined][] = [['Data', 96], ['Treinamentos', 180], ['Ação', 96], ['Texto', undefined], ['', 160]]

    return (
      <>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Histórico de registros</h1>
        <p style={{ color: MUTED, margin: '0 0 22px', fontSize: 14 }}>Tudo o que você já lançou no GT0100 a partir deste módulo.</p>

        <div style={S.panel}>
          <div style={S.panelBody}>
            {historico.length > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
                  <button style={btnStyle('ghost', true)} onClick={exportarCsv}>Exportar CSV</button>
                  <button style={btnStyle('danger', true)} onClick={limpar}>Limpar histórico</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(to bottom, #FAFCFE, #F5F8FC)' }}>
                        {cols.map(([h, w]) => (
                          <th key={h} style={{ textAlign: 'left', fontSize: 10, color: 'var(--text-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.9px', padding: '8px 10px', borderBottom: '1px solid var(--border-soft)', width: w }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map(r => (
                        <tr key={r.id} className="gt3-table-row-hover">
                          <td style={S.cell}>{dataBR(r.data)}</td>
                          <td style={S.cell}>{r.alvo}</td>
                          <td style={S.cell}>{r.acao}</td>
                          <td style={S.cell}>{r.texto}</td>
                          <td style={{ ...S.cell, whiteSpace: 'nowrap' }}>
                            <button style={btnStyle('ghost', true)} onClick={() => copiar(r.texto, `h-${r.id}`)}>
                              {copiado === `h-${r.id}` ? 'Copiado' : 'Copiar'}
                            </button>
                            <button style={{ ...btnStyle('danger', true), marginLeft: 6 }} onClick={() => excluir(r.id)}>Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={S.empty}>Nenhum registro salvo ainda. Gere uma observação em um card e clique em &quot;Salvar no histórico&quot;.</div>
            )}
          </div>
        </div>
      </>
    )
  }

  function renderConfig() {
    const abas: [CfgTab, string][] = [
      ['treinamentos', 'Treinamentos e textos'],
      ['combos', 'Combinações'],
      ['modelos', 'Modelos de registro'],
      ['atalhos', 'Atalhos prontos'],
      ['email', 'E-mail padrão'],
      ['geral', 'Geral'],
    ]
    return (
      <>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Configurações</h1>
        <p style={{ color: MUTED, margin: '0 0 22px', fontSize: 14 }}>Tudo que aparece nos cards é definido aqui — e vale para toda a equipe.</p>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20, borderBottom: `1px solid ${BORDER}` }}>
          {abas.map(([k, l]) => (
            <Tab key={k} ativo={cfgTab === k} onClick={() => { setCfgTab(k); setEditando(null) }}>{l}</Tab>
          ))}
        </div>

        {cfgTab === 'treinamentos' && (editando ? renderEditorTreino() : renderListaTreinos())}
        {cfgTab === 'combos'       && renderCfgCombos()}
        {cfgTab === 'modelos'      && renderCfgModelos()}
        {cfgTab === 'atalhos'      && renderCfgAtalhos()}
        {cfgTab === 'email'        && renderCfgEmail()}
        {cfgTab === 'geral'        && renderCfgGeral()}
      </>
    )
  }

  function renderListaTreinos() {
    async function novo() {
      const nome = prompt('Nome do treinamento (ex.: NR 06):')
      if (!nome?.trim()) return
      const res = await fetch('/api/retorno-de-nr/treinamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          itens: [
            { id: uid(), chave: 'envio', texto: COMUNS.envio },
            { id: uid(), chave: 'ead', texto: COMUNS.ead },
          ],
        }),
      })
      if (!res.ok) { showToast('Erro ao criar treinamento.'); return }
      const criado: Treino = await res.json()
      const normalizado = { ...criado, itens: criado.itens ?? [] }
      setTreinos(prev => [...prev, normalizado])
      abrirEditor(normalizado)
    }

    return (
      <div style={S.panel}>
        <div style={S.panelHead}>
          <h3 style={S.panelTitle}>Treinamentos cadastrados</h3>
          <button style={{ ...btnStyle('primary', true), marginLeft: 'auto' }} onClick={novo}>+ Novo treinamento</button>
        </div>
        <div style={S.panelBody}>
          {treinos.map(t => (
            <div key={t.id} style={S.listItem}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{t.nome}</div>
                <div style={{ fontSize: 12.5, color: MUTED }}>{t.descricao || 'sem descrição'} · {t.itens.length} exigências</div>
              </div>
              <button style={btnStyle('ghost', true)} onClick={() => abrirEditor(t)}>Editar textos</button>
            </div>
          ))}
          {treinos.length === 0 && <div style={S.empty}>Nenhum treinamento cadastrado.</div>}
        </div>
      </div>
    )
  }

  function renderEditorTreino() {
    const t = treinos.find(x => x.id === editando)
    if (!t) return renderListaTreinos()

    async function salvar() {
      const itens = draft.itens.filter(i => i.texto.trim())
      if (!draft.nome.trim()) { showToast('Informe o nome do treinamento.'); return }
      setSalvando(true)
      const res = await fetch(`/api/retorno-de-nr/treinamentos/${t!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: draft.nome, descricao: draft.descricao, itens }),
      })
      setSalvando(false)
      if (!res.ok) { showToast('Erro ao salvar treinamento.'); return }
      const atualizado: Treino = await res.json()
      setTreinos(prev => prev.map(x => x.id === atualizado.id ? { ...atualizado, itens: atualizado.itens ?? [] } : x))
      setEditando(null)
      showToast('Treinamento salvo')
    }

    async function excluir() {
      if (!confirm(`Excluir "${t!.nome}"? As combinações que o usam também serão ajustadas.`)) return
      const res = await fetch(`/api/retorno-de-nr/treinamentos/${t!.id}`, { method: 'DELETE' })
      if (!res.ok) { showToast('Erro ao excluir.'); return }
      setTreinos(prev => prev.filter(x => x.id !== t!.id))
      setCombos(prev => prev
        .map(c => ({ ...c, treinamento_ids: c.treinamento_ids.filter(i => i !== t!.id) }))
        .filter(c => c.treinamento_ids.length > 1))
      setEditando(null)
      showToast('Treinamento excluído')
    }

    return (
      <div style={S.panel}>
        <div style={S.panelHead}>
          <h3 style={S.panelTitle}>Editando {t.nome}</h3>
          <button style={{ ...btnStyle('ghost', true), marginLeft: 'auto' }} onClick={() => setEditando(null)}>Voltar à lista</button>
        </div>
        <div style={S.panelBody}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 14 }}>
            <label>
              <span style={S.label}>Nome do treinamento</span>
              <input value={draft.nome} onChange={e => setDraft(d => ({ ...d, nome: e.target.value }))} style={S.input} />
            </label>
            <label>
              <span style={S.label}>Descrição curta (aparece no card)</span>
              <input value={draft.descricao} onChange={e => setDraft(d => ({ ...d, descricao: e.target.value }))} style={S.input} />
            </label>
          </div>

          <div style={S.callout}>
            Itens com a mesma <b>chave de item comum</b> em NRs diferentes aparecem uma única vez quando você mescla.
            Deixe a chave vazia para exigências exclusivas desta NR.
          </div>

          <span style={S.label}>Exigências enviadas ao prestador</span>
          {draft.itens.map(it => (
            <div key={it.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 9, flexWrap: 'wrap' }}>
              <input value={it.chave} placeholder="chave comum"
                onChange={e => setDraft(d => ({ ...d, itens: d.itens.map(x => x.id === it.id ? { ...x, chave: e.target.value } : x) }))}
                style={{ ...S.input, width: 160, flex: 'none' }} />
              <textarea value={it.texto}
                onChange={e => setDraft(d => ({ ...d, itens: d.itens.map(x => x.id === it.id ? { ...x, texto: e.target.value } : x) }))}
                style={{ ...S.textarea, flex: 1, minWidth: 220, minHeight: 62 }} />
              <button style={btnStyle('danger', true)}
                onClick={() => setDraft(d => ({ ...d, itens: d.itens.filter(x => x.id !== it.id) }))}>Excluir</button>
            </div>
          ))}
          <button style={btnStyle('ghost', true)}
            onClick={() => setDraft(d => ({ ...d, itens: [...d.itens, { id: uid(), chave: '', texto: '' }] }))}>
            + Adicionar exigência
          </button>

          <div style={S.divider} />
          <button style={btnStyle('primary')} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar treinamento'}
          </button>
          <button style={{ ...btnStyle('danger'), marginLeft: 8 }} onClick={excluir}>Excluir treinamento</button>
        </div>
      </div>
    )
  }

  function renderCfgCombos() {
    async function criar() {
      if (comboSel.length < 2) { showToast('Selecione ao menos dois treinamentos.'); return }
      const nome = comboNome.trim() || nomesTreinos(comboSel, treinos).join(' + ')
      setSalvando(true)
      const res = await fetch('/api/retorno-de-nr/combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, treinamento_ids: comboSel }),
      })
      setSalvando(false)
      if (!res.ok) { showToast('Erro ao criar combinação.'); return }
      const criado: Combo = await res.json()
      setCombos(prev => [...prev, criado])
      setComboSel([])
      setComboNome('')
      setComboNomeAuto(true)
      showToast('Combinação criada')
    }

    async function excluir(id: string) {
      const res = await fetch(`/api/retorno-de-nr/combos/${id}`, { method: 'DELETE' })
      if (!res.ok) { showToast('Erro ao excluir.'); return }
      setCombos(prev => prev.filter(c => c.id !== id))
    }

    const previa = comboSel.length >= 2 ? mesclar(comboSel, treinos) : null

    return (
      <>
        <div style={{ ...S.panel, marginBottom: 18 }}>
          <div style={S.panelHead}><h3 style={S.panelTitle}>Nova combinação</h3></div>
          <div style={S.panelBody}>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={S.label}>Nome (aparece no card)</span>
              <input value={comboNome} placeholder="Ex.: NR 11 Empilhadeira + NR 35"
                onChange={e => { setComboNome(e.target.value); setComboNomeAuto(false) }} style={S.input} />
            </label>

            <span style={S.label}>Treinamentos incluídos</span>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {treinos.map(t => (
                <Opcao key={t.id} on={comboSel.includes(t.id)}
                  onClick={() => {
                    const novo = comboSel.includes(t.id) ? comboSel.filter(i => i !== t.id) : [...comboSel, t.id]
                    setComboSel(novo)
                    if (comboNomeAuto) setComboNome(nomesTreinos(novo, treinos).join(' + '))
                  }}>
                  {t.nome}
                </Opcao>
              ))}
            </div>
            <div style={S.hint}>Exigências repetidas entre as NRs escolhidas aparecem uma única vez.</div>

            {previa && (
              <div style={{ ...S.callout, marginTop: 14, marginBottom: 0 }}>
                {previa.comuns.length} exigência(s) em comum serão exibidas uma vez;{' '}
                {previa.blocos.reduce((a, x) => a + x.itens.length, 0)} exigência(s) permanecem específicas.
              </div>
            )}

            <button style={{ ...btnStyle('primary'), marginTop: 14 }} onClick={criar} disabled={salvando}>Criar combinação</button>
          </div>
        </div>

        <div style={S.panel}>
          <div style={S.panelHead}><h3 style={S.panelTitle}>Combinações existentes</h3></div>
          <div style={S.panelBody}>
            {combos.length > 0 ? combos.map(c => (
              <div key={c.id} style={S.listItem}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{c.nome}</div>
                  <div style={{ fontSize: 12.5, color: MUTED }}>
                    {nomesTreinos(c.treinamento_ids, treinos).join(' + ')} · {mesclar(c.treinamento_ids, treinos).comuns.length} itens em comum
                  </div>
                </div>
                <button style={btnStyle('danger', true)} onClick={() => excluir(c.id)}>Excluir</button>
              </div>
            )) : <div style={S.empty}>Nenhuma combinação criada.</div>}
          </div>
        </div>
      </>
    )
  }

  function renderCfgAtalhos() {
    function resumoAtalho(a: Atalho) {
      const partes: string[] = []
      if (a.acao) partes.push(a.acao === 'inclusao' ? config.rotulos.inclusao : config.rotulos.remocao)
      if (a.origem) partes.push(a.origem === 'contratante' ? 'Contratante' : a.origem === 'empresa' ? 'Empresa' : 'Atividade')
      if (a.contato) partes.push(a.contato)
      return partes.length ? partes.join(' · ') : 'Nenhum campo pré-definido'
    }

    async function criar() {
      const nome = atalhoNome.trim()
      if (!nome) { showToast('Dê um nome ao atalho.'); return }
      const novo: Atalho = { id: uid(), nome, acao: atalhoAcao, origem: atalhoOrigem, contato: atalhoContato }
      await salvarConfig({ atalhos: [...config.atalhos, novo] }, 'Atalho criado')
      setAtalhoNome('')
      setAtalhoAcao(null)
      setAtalhoOrigem(null)
      setAtalhoContato(null)
    }

    async function excluir(id: string) {
      await salvarConfig({ atalhos: config.atalhos.filter(a => a.id !== id) }, 'Atalho excluído')
    }

    return (
      <>
        <div style={{ ...S.panel, marginBottom: 18 }}>
          <div style={S.panelHead}><h3 style={S.panelTitle}>Novo atalho</h3></div>
          <div style={S.panelBody}>
            <div style={S.callout}>
              Defina só os campos que já vêm prontos ao clicar no atalho — os que você deixar sem marcar continuam
              para preencher na hora, como hoje.
            </div>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={S.label}>Nome do atalho (aparece como botão no card)</span>
              <input value={atalhoNome} onChange={e => setAtalhoNome(e.target.value)}
                placeholder="Ex.: Inclusão via WhatsApp da empresa" style={S.input} />
            </label>

            <div style={{ marginBottom: 14 }}>
              <span style={S.label}>Ação (opcional)</span>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                <Opcao on={atalhoAcao === 'inclusao'} onClick={() => setAtalhoAcao(a => a === 'inclusao' ? null : 'inclusao')}>
                  {config.rotulos.inclusao}
                </Opcao>
                <Opcao on={atalhoAcao === 'remocao'} onClick={() => setAtalhoAcao(a => a === 'remocao' ? null : 'remocao')}>
                  {config.rotulos.remocao}
                </Opcao>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={S.label}>Origem da solicitação (opcional)</span>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {(['contratante', 'empresa', 'atividade'] as const).map(o => (
                  <Opcao key={o} on={atalhoOrigem === o} onClick={() => setAtalhoOrigem(v => v === o ? null : o)}>
                    {o === 'contratante' ? 'Contratante' : o === 'empresa' ? 'Empresa' : 'Atividade'}
                  </Opcao>
                ))}
              </div>
              <div style={S.hint}>Se marcada, o campo &quot;Qual contratante&quot; continua livre para escolher na hora.</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={S.label}>Forma de contato (opcional)</span>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {config.formas_contato.map(f => (
                  <Opcao key={f} gold on={atalhoContato === f} onClick={() => setAtalhoContato(v => v === f ? null : f)}>
                    {f}
                  </Opcao>
                ))}
              </div>
            </div>

            <button style={btnStyle('primary')} onClick={criar} disabled={salvando}>Criar atalho</button>
          </div>
        </div>

        <div style={S.panel}>
          <div style={S.panelHead}><h3 style={S.panelTitle}>Atalhos existentes</h3></div>
          <div style={S.panelBody}>
            {config.atalhos.length > 0 ? config.atalhos.map(a => (
              <div key={a.id} style={{
                ...S.listItem,
                borderLeft: `4px solid ${a.acao === 'inclusao' ? OK : a.acao === 'remocao' ? DANGER : ACCENT}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{a.nome}</div>
                  <div style={{ fontSize: 12.5, color: MUTED }}>{resumoAtalho(a)}</div>
                </div>
                <button style={btnStyle('danger', true)} onClick={() => excluir(a.id)}>Excluir</button>
              </div>
            )) : <div style={S.empty}>Nenhum atalho criado ainda.</div>}
          </div>
        </div>
      </>
    )
  }

  function renderCfgModelos() {
    const marcadores = ['{{data}}', '{{acao}}', '{{treinamentos}}', '{{contratante}}', '{{contato}}', '{{usuario}}']
    const origens: [keyof Config['modelos'], string][] = [
      ['contratante', 'Quando a origem for Contratante'],
      ['empresa', 'Quando a origem for Empresa'],
      ['atividade', 'Quando a origem for Atividade'],
    ]

    return (
      <div style={S.panel}>
        <div style={S.panelHead}><h3 style={S.panelTitle}>Texto do registro no GT0100</h3></div>
        <div style={S.panelBody}>
          <div style={S.callout}>
            Marcadores disponíveis:{' '}
            {marcadores.map(m => <span key={m} style={{ ...S.mono, marginRight: 6 }}>{m}</span>)}
          </div>

          {origens.map(([k, label]) => (
            <label key={k} style={{ display: 'block', marginBottom: 14 }}>
              <span style={S.label}>{label}</span>
              <textarea value={config.modelos[k]}
                onChange={e => setConfig(c => ({ ...c, modelos: { ...c.modelos, [k]: e.target.value } }))}
                style={S.textarea} />
            </label>
          ))}

          <div style={S.divider} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
            <label>
              <span style={S.label}>Palavra usada na inclusão</span>
              <input value={config.acoes.inclusao} onChange={e => setConfig(c => ({ ...c, acoes: { ...c.acoes, inclusao: e.target.value } }))} style={S.input} />
            </label>
            <label>
              <span style={S.label}>Palavra usada na remoção</span>
              <input value={config.acoes.remocao} onChange={e => setConfig(c => ({ ...c, acoes: { ...c.acoes, remocao: e.target.value } }))} style={S.input} />
            </label>
            <label>
              <span style={S.label}>Rótulo do botão de inclusão</span>
              <input value={config.rotulos.inclusao} onChange={e => setConfig(c => ({ ...c, rotulos: { ...c.rotulos, inclusao: e.target.value } }))} style={S.input} />
            </label>
            <label>
              <span style={S.label}>Rótulo do botão de remoção</span>
              <input value={config.rotulos.remocao} onChange={e => setConfig(c => ({ ...c, rotulos: { ...c.rotulos, remocao: e.target.value } }))} style={S.input} />
            </label>
          </div>

          <div style={S.divider} />

          <span style={S.label}>Formas de contato</span>
          {config.formas_contato.map((f, i) => (
            <div key={`${f}-${i}`} style={S.listItem}>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{f}</div>
              <button style={btnStyle('danger', true)}
                onClick={() => salvarConfig({ formas_contato: config.formas_contato.filter((_, j) => j !== i) }, 'Forma removida')}>
                Excluir
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={novaForma} onChange={e => setNovaForma(e.target.value)} placeholder="Nova forma de contato" style={S.input} />
            <button style={btnStyle('ghost', true)}
              onClick={() => {
                const v = novaForma.trim()
                if (!v) return
                salvarConfig({ formas_contato: [...config.formas_contato, v] }, 'Forma adicionada')
                setNovaForma('')
              }}>
              Adicionar
            </button>
          </div>

          <div style={S.divider} />
          <button style={btnStyle('primary')} disabled={salvando}
            onClick={() => salvarConfig({ modelos: config.modelos, acoes: config.acoes, rotulos: config.rotulos }, 'Modelos salvos')}>
            Salvar modelos
          </button>
        </div>
      </div>
    )
  }

  function renderCfgEmail() {
    return (
      <div style={S.panel}>
        <div style={S.panelHead}><h3 style={S.panelTitle}>E-mail enviado ao prestador</h3></div>
        <div style={S.panelBody}>
          <div style={S.callout}>
            Use <span style={S.mono}>{'{{treinamentos}}'}</span> para inserir o nome das NRs do card.
            A lista de exigências é montada automaticamente entre o cabeçalho e o rodapé.
          </div>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={S.label}>Título do bloco de itens comuns</span>
            <input value={config.email.tituloComuns}
              onChange={e => setConfig(c => ({ ...c, email: { ...c.email, tituloComuns: e.target.value } }))} style={S.input} />
          </label>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={S.label}>Cabeçalho</span>
            <textarea value={config.email.cabecalho}
              onChange={e => setConfig(c => ({ ...c, email: { ...c.email, cabecalho: e.target.value } }))} style={{ ...S.textarea, minHeight: 110 }} />
          </label>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={S.label}>Rodapé</span>
            <textarea value={config.email.rodape}
              onChange={e => setConfig(c => ({ ...c, email: { ...c.email, rodape: e.target.value } }))} style={{ ...S.textarea, minHeight: 110 }} />
          </label>
          <button style={btnStyle('primary')} disabled={salvando} onClick={() => salvarConfig({ email: config.email }, 'E-mail padrão salvo')}>
            Salvar e-mail padrão
          </button>
        </div>
      </div>
    )
  }

  function renderCfgGeral() {
    function exportar() {
      const dump = { treinamentos: treinos, combos, config, exportado_em: new Date().toISOString() }
      baixarArquivo('retorno-nr-config.json', JSON.stringify(dump, null, 2), 'application/json')
    }

    return (
      <>
        <div style={{ ...S.panel, marginBottom: 18 }}>
          <div style={S.panelHead}><h3 style={S.panelTitle}>Identificação de quem registra</h3></div>
          <div style={S.panelBody}>
            <span style={S.label}>Nome usado no marcador {'{{usuario}}'}</span>
            <input value={usuario} readOnly style={{ ...S.input, background: '#F7F8FB', color: MUTED }} />
            <div style={S.hint}>Vem direto do seu login. Para alterar, edite seu nome em Perfil.</div>
          </div>
        </div>

        <div style={{ ...S.panel, marginBottom: 18 }}>
          <div style={S.panelHead}><h3 style={S.panelTitle}>Contratantes</h3></div>
          <div style={S.panelBody}>
            <div style={{ fontSize: 13.5, color: MUTED }}>
              {contratantes.length} contratante(s) sincronizado(s) do módulo <b>Cadastro Contratantes</b>.
              A lista do campo &quot;Qual contratante&quot; vem sempre de lá — não há cadastro paralelo aqui.
            </div>
          </div>
        </div>

        <div style={S.panel}>
          <div style={S.panelHead}><h3 style={S.panelTitle}>Backup</h3></div>
          <div style={S.panelBody}>
            <button style={btnStyle('ghost')} onClick={exportar}>Exportar configurações</button>
            <div style={{ ...S.hint, marginTop: 10 }}>
              Gera um JSON com treinamentos, textos, combinações e modelos. Os dados ficam no Supabase e são
              compartilhados por toda a equipe.
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'grid', placeItems: 'center', color: MUTED, fontFamily: "'Inter',system-ui,sans-serif" }}>
        Carregando…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14.5 }}>

      {/* Cabeçalho do módulo */}
      <div style={{ background: SURF, borderBottom: `1px solid ${BORDER}`, padding: '16px 28px 0' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Retorno de NR</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
          Orientação ao prestador e registro no GT0100 a partir dos treinamentos exigidos
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          <Tab ativo={view === 'home' || view === 'detalhe'} onClick={() => setView('home')}>Retornos</Tab>
          <Tab ativo={view === 'historico'} onClick={() => setView('historico')}>Histórico</Tab>
          <Tab ativo={view === 'config'} onClick={() => setView('config')}>Configurações</Tab>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 60px' }}>
        {view === 'home'      && renderHome()}
        {view === 'detalhe'   && renderDetalhe()}
        {view === 'historico' && renderHistorico()}
        {view === 'config'    && renderConfig()}
      </div>

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 26, left: '50%', zIndex: 200,
        transform: `translateX(-50%) translateY(${toast.show ? 0 : 80}px)`,
        opacity: toast.show ? 1 : 0, transition: 'all .25s',
        background: PRIMARY_DARK, color: '#fff', padding: '11px 20px', borderRadius: 9,
        boxShadow: '0 8px 24px rgba(0,0,0,.22)', fontWeight: 500, pointerEvents: 'none',
      }}>
        {toast.msg}
      </div>
    </div>
  )
}
