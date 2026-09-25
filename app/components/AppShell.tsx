'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import { TabContentCache } from './TabContentCache'
import { MODULE_COMPONENT_MAP } from './moduleComponentMap'
import Tabbar from './Tabbar'
import type { Role } from '../lib/modules'
import { useUser } from './UserContext'
import { useModules } from './ModulesContext'
import {
  DEFAULT_SPLIT, loadSplitState, saveSplitState, pinnableModules,
  SplitDivider, PinnedPane, SplitViewButton, useSplitDrag,
  type SplitState,
} from './SplitView'
import { createClient } from '../lib/supabase'
import { isLembreteOverdue } from '../lib/lembretes'
import PrioridadeNotificacao from './PrioridadeNotificacao'
import AtaNotificacao from './AtaNotificacao'
import SugestaoNotificacao from './SugestaoNotificacao'
import EnqueteNotificacao from './EnqueteNotificacao'
import LembreteNotificacao from './LembreteNotificacao'
import PdiCriadoNotificacao from './PdiCriadoNotificacao'
import QuoteBanner from './QuoteBanner'
import IntroScreen, { shouldShowIntro } from './IntroScreen'
import { displayName } from './UserContext'

function useBreadcrumb(pathname: string): string {
  const { modules } = useModules()
  if (pathname === '/') return ''
  const mod = modules.find((m) => m.path === pathname)
  return mod ? `Sistema Interno GT3 › ${mod.label}` : 'Sistema Interno GT3'
}

const PAPEL_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
  trainee: 'Trainee',
}

// ─── UserMenu ─────────────────────────────────────────────────────────────────

const ROLE_COMMANDS: Record<string, Role> = {
  '/gestor/':      'gestor',
  '/colaborador/': 'colaborador',
  '/admin/':       'admin',
  '/trainee/':     'trainee',
}

function HeaderSearch() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const router = useRouter()
  const { profile, roleOverride, setRoleOverride } = useUser()
  const { modules: MODULES } = useModules()
  const papel = profile?.papel as Role | null

  const results = query.trim() && !ROLE_COMMANDS[query.trim().toLowerCase()]
    ? MODULES.filter(m => {
        if (!papel) return m.allowedRoles.includes('colaborador')
        if (papel === 'admin') return true
        return m.allowedRoles.includes(papel)
      }).filter(m => m.label.toLowerCase().includes(query.toLowerCase()))
    : []

  function go(path: string) {
    setQuery('')
    setFocused(false)
    router.push(path)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const cmd = ROLE_COMMANDS[query.trim().toLowerCase()]
    if (cmd) {
      setRoleOverride(cmd)
      setQuery('')
      setFocused(false)
      router.push('/')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {roleOverride && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: '#FEF3C7', border: '1px solid #F59E0B',
          borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#92400E',
          cursor: 'pointer', userSelect: 'none',
        }}
          title="Clique para voltar ao perfil original"
          onClick={() => { setRoleOverride(null); router.push('/') }}
        >
          ⚡ Modo {roleOverride}  ✕
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid #E2E8F0', borderRadius: 20,
          padding: '5px 12px', background: focused ? '#fff' : '#F8FAFC',
          transition: 'background 0.15s, border-color 0.15s',
          borderColor: focused ? '#2A4F96' : '#E2E8F0',
          width: 200,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A0AEC0" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar módulo..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 12, color: '#1E293B', width: '100%', fontFamily: 'inherit',
            }}
          />
        </div>
        {focused && results.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 300,
            minWidth: 200, overflow: 'hidden',
          }}>
            {results.map(m => (
              <button key={m.id} onMouseDown={() => go(m.path)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', background: 'transparent',
                fontSize: 13, color: '#1E293B', cursor: 'pointer',
                borderBottom: '1px solid #F1F5F9',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EBF0FB' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserMenu({ name, onSignOut, onAlterarSenha }: { name: string; onSignOut: () => void; onAlterarSenha: () => void }) {
  const [open, setOpen] = useState(false)

  const btnStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '9px 16px',
    background: 'transparent', border: 'none', textAlign: 'left',
    fontSize: 13, color: '#1E293B', cursor: 'pointer',
    transition: 'background 0.12s',
  }

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Trigger */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 500, color: '#1E293B',
        padding: '4px 10px', borderRadius: 6, cursor: 'default', userSelect: 'none',
        background: open ? '#F1F5F9' : 'transparent',
        transition: 'background 0.15s',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7A99" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        {name}
      </div>

      {/* Dropdown — top:100% sem gap para o mouse não sair do wrapper */}
      <div style={{
        position: 'absolute', right: 0, top: '100%',
        paddingTop: 6,
        background: 'transparent',
        minWidth: 180, zIndex: 200,
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0)' : 'translateY(-6px)',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.18s, transform 0.18s',
      }}>
        <div style={{
          background: '#fff', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}>
        <button
          onClick={onAlterarSenha}
          style={btnStyle}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          🔑 Alterar senha
        </button>
        <div style={{ height: 1, background: '#F1F5F9' }} />
        <button
          onClick={onSignOut}
          style={{ ...btnStyle, color: '#DC2626' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          ← Sair
        </button>
        </div>
      </div>
    </div>
  )
}

// ─── Prioridades helpers ──────────────────────────────────────────────────────

type PrioridadeNotif = { id: string; empresa: string }

export async function markPrioridadeVista(id: string, userId: string) {
  try {
    const supabase = createClient()
    await supabase.from('prioridades_vistas')
      .upsert({ aviso_id: id, user_id: userId }, { onConflict: 'aviso_id,user_id', ignoreDuplicates: true })
  } catch { /* noop */ }
}

// ─── Atas helpers ─────────────────────────────────────────────────────────────

type AtaNotif = { id: string; data: string; titulo: string | null; created_at: string }

/** Itens criados antes da conta do usuário existir não devem virar notificação/leitura pendente. */
function criadoAposConta(createdAt: string | null | undefined, profileCreatedAt: string | null | undefined) {
  if (!createdAt || !profileCreatedAt) return true
  return new Date(createdAt).getTime() >= new Date(profileCreatedAt).getTime()
}

export async function markAtaNotifVista(id: string, userId: string) {
  try {
    const supabase = createClient()
    await supabase.from('atas_leituras')
      .upsert({ ata_id: id, user_id: userId }, { onConflict: 'ata_id,user_id', ignoreDuplicates: true })
  } catch { /* noop */ }
}

// (atas banner dismiss moved to DB-only — no session storage)

// ─── Sugestões helpers ────────────────────────────────────────────────────────

function sugestaoNotifDismissKey(userId: string) { return `sugestoes_notif_dismissed_${userId}` }
function getSugestaoNotifDismissed(userId: string): string[] {
  try { return JSON.parse(sessionStorage.getItem(sugestaoNotifDismissKey(userId)) ?? '[]') } catch { return [] }
}
function dismissSugestaoNotifStorage(id: string, userId: string) {
  try {
    const dismissed = getSugestaoNotifDismissed(userId)
    if (!dismissed.includes(id)) {
      sessionStorage.setItem(sugestaoNotifDismissKey(userId), JSON.stringify([...dismissed, id]))
    }
  } catch { /* noop */ }
}

// ─── PDI Conversa helpers ─────────────────────────────────────────────────────

type PdiConversaBanner = { cicloId: string; pdiId: string; dataConversa: string }
type PdiNotifBanner = { pdiId: string; dataAcao: string | null }

function pdiConversaDismissKey(userId: string) { return `pdi_conversa_dismissed_${userId}` }
// Armazena { [cicloId]: dataConversa } — invalida automaticamente ao reagendar
function getPdiConversaDismissed(userId: string): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(pdiConversaDismissKey(userId)) ?? '{}') } catch { return {} }
}
function dismissPdiConversaBannerStorage(cicloId: string, dataConversa: string, userId: string) {
  try {
    const dismissed = getPdiConversaDismissed(userId)
    dismissed[cicloId] = dataConversa
    sessionStorage.setItem(pdiConversaDismissKey(userId), JSON.stringify(dismissed))
  } catch { /* noop */ }
}

function pdiNotifDismissKey(userId: string) { return `pdi_notif_dismissed_${userId}` }
function getPdiNotifDismissed(userId: string): string[] {
  try { return JSON.parse(sessionStorage.getItem(pdiNotifDismissKey(userId)) ?? '[]') } catch { return [] }
}
function dismissPdiNotifStorage(pdiId: string, userId: string) {
  try {
    const dismissed = getPdiNotifDismissed(userId)
    if (!dismissed.includes(pdiId)) {
      sessionStorage.setItem(pdiNotifDismissKey(userId), JSON.stringify([...dismissed, pdiId]))
    }
  } catch { /* noop */ }
}

// ─── Lembretes helpers ────────────────────────────────────────────────────────

function lembreteSnoozeKey(userId: string) { return `lembretes_notif_snoozed_ate_${userId}` }
function getLembreteSnoozedAte(userId: string): string {
  try { return localStorage.getItem(lembreteSnoozeKey(userId)) ?? '' } catch { return '' }
}
/** Adia o pop-up de lembretes pendentes até a data informada (YYYY-MM-DD), inclusive. */
function snoozeLembreteNotifStorage(userId: string, ateIso: string) {
  try { localStorage.setItem(lembreteSnoozeKey(userId), ateIso) } catch { /* noop */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [hoverVisible, setHoverVisible] = useState(false)

  // ── Tela dividida ──────────────────────────────────────────────────────
  const [split, setSplit] = useState<SplitState>(DEFAULT_SPLIT)
  const [splitHydrated, setSplitHydrated] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSplit(loadSplitState())
    setSplitHydrated(true)
  }, [])

  useEffect(() => {
    if (!splitHydrated) return
    saveSplitState(split)
  }, [split, splitHydrated])

  const setSplitRatio = useCallback((ratio: number) => {
    setSplit(prev => ({ ...prev, ratio }))
  }, [])
  const startDrag = useSplitDrag(containerRef, split.side, setSplitRatio)

  const [prioQueue, setPrioQueue] = useState<PrioridadeNotif[]>([])
  const [ataQueue, setAtaQueue] = useState<AtaNotif[]>([])
  const [sugestaoQueue, setSugestaoQueue] = useState<Array<{ id: string }>>([])
  const [enqueteQueue, setEnqueteQueue] = useState<Array<{ id: string; titulo: string }>>([])
  const [lembreteCount, setLembreteCount] = useState(0)
  const [showLembreteNotif, setShowLembreteNotif] = useState(false)

  const [unreadAtas, setUnreadAtas] = useState<AtaNotif[]>([])
  const [legislacoesPendentes, setLegislacoesPendentes] = useState(0)
  const [pdiConversaBanner, setPdiConversaBanner] = useState<PdiConversaBanner | null>(null)
  const [pdiNotifBanner, setPdiNotifBanner] = useState<PdiNotifBanner | null>(null)
  const [pdiCriadoNotif, setPdiCriadoNotif] = useState<PdiNotifBanner | null>(null)
  const pathname = usePathname()
  const breadcrumb = useBreadcrumb(pathname)
  const { profile, loading, signOut } = useUser()
  const { modules } = useModules()
  const router = useRouter()

  const splitModules = pinnableModules(
    modules,
    (profile?.papel as Role | null) ?? null,
    profile?.modulos_permitidos ?? null,
  )
  const splitActive = split.open && !!split.path && !!MODULE_COMPONENT_MAP[split.path]

  const [introVisible, setIntroVisible] = useState(false)

  useLayoutEffect(() => {
    if (shouldShowIntro()) setIntroVisible(true)
  }, [])

  // Aniversário do usuário logado — comparação direta com profiles.aniversario_dia/mes.
  const today = new Date()
  const isBirthdayToday = !!profile && profile.aniversario_dia === today.getDate() && profile.aniversario_mes === today.getMonth() + 1

  const isColabOrTrainee = profile?.papel === 'colaborador' || profile?.papel === 'trainee'

  const loadLegislacoesPendentes = useCallback(async (profileCreatedAt: string | null | undefined) => {
    try {
      const res = await fetch('/api/legislacoes')
      if (!res.ok) return
      const data: Array<{ lida: boolean; para_mim: boolean; created_at: string }> = await res.json()
      setLegislacoesPendentes(data.filter(l => !l.lida && l.para_mim && criadoAposConta(l.created_at, profileCreatedAt)).length)
    } catch { /* noop */ }
  }, [])

  const loadUnreadAtas = useCallback(async (userId: string, profileCreatedAt: string | null | undefined) => {
    if (!isColabOrTrainee) return
    try {
      const res = await fetch('/api/atas')
      if (!res.ok) return
      const atas: AtaNotif[] = await res.json()
      const sup = createClient()
      const { data: leituras } = await sup
        .from('atas_leituras')
        .select('ata_id')
        .eq('user_id', userId)
      const seenSet = new Set((leituras ?? []).map(r => r.ata_id))
      setUnreadAtas(atas.filter(a => !seenSet.has(a.id) && criadoAposConta(a.created_at, profileCreatedAt)))
    } catch { /* noop */ }
  }, [isColabOrTrainee])

  useEffect(() => {
    if (!profile) return
    const userId = profile.id
    const userPapel = profile.papel
    const supabase = createClient()
    let mounted = true

    async function checkUnseenPrio() {
      try {
        const { data: avisos } = await supabase
          .from('prioridades_avisos')
          .select('id, empresa')
          .order('created_at', { ascending: true })
        if (!mounted || !avisos) return
        const { data: vistas } = await supabase
          .from('prioridades_vistas')
          .select('aviso_id')
          .eq('user_id', userId)
        const seenSet = new Set((vistas ?? []).map(r => r.aviso_id))
        const unseen = avisos.filter(r => !seenSet.has(r.id))
        if (unseen.length > 0) setPrioQueue(unseen)
      } catch { /* tabela não existe */ }
    }

    async function checkUnseenAtas() {
      if (!isColabOrTrainee) return
      try {
        const res = await fetch('/api/atas')
        if (!mounted || !res.ok) return
        const atas: AtaNotif[] = await res.json()
        const { data: leituras } = await supabase
          .from('atas_leituras')
          .select('ata_id')
          .eq('user_id', userId)
        const seenSet = new Set((leituras ?? []).map(r => r.ata_id))
        const unnotified = atas.filter(a => !seenSet.has(a.id) && criadoAposConta(a.created_at, profile?.created_at))
        if (unnotified.length > 0) setAtaQueue(unnotified)
        setUnreadAtas(unnotified)
      } catch { /* noop */ }
    }

    async function checkUnseenPdiConversa() {
      if (!isColabOrTrainee) return
      try {
        const res = await fetch('/api/pdi/conversa-pendente')
        if (!mounted || !res.ok) return
        const row = await res.json() as { cicloId: string; pdiId: string; dataConversa: string } | null
        if (!row) { if (mounted) setPdiConversaBanner(null); return }
        if (mounted) setPdiConversaBanner(row)
      } catch { /* noop */ }
    }

    async function checkPdiNotif() {
      if (!isColabOrTrainee) return
      try {
        const res = await fetch('/api/pdi/notificacoes')
        if (!mounted || !res.ok) return
        const { count, pdiId, tipo, dataAcao } = await res.json() as { count: number; pdiId: string | null; tipo: string; dataAcao: string | null }
        if (count > 0 && pdiId) {
          const dismissed = getPdiNotifDismissed(userId)
          if (!dismissed.includes(pdiId)) {
            if (tipo === 'criado') {
              setPdiCriadoNotif({ pdiId, dataAcao: null })
            } else {
              setPdiNotifBanner({ pdiId, dataAcao })
            }
          }
        }
      } catch { /* noop */ }
    }

    async function checkUnseenSugestoes() {
      if (isColabOrTrainee) return
      try {
        const res = await fetch('/api/sugestoes')
        if (!mounted || !res.ok) return
        const data: Array<{ id: string; lida: boolean }> = await res.json()
        const dismissed = getSugestaoNotifDismissed(userId)
        const unnotified = data.filter(s => !s.lida && !dismissed.includes(s.id))
        if (unnotified.length > 0) setSugestaoQueue(unnotified)
      } catch { /* noop */ }
    }

    async function checkUnseenEnquetes() {
      try {
        const res = await fetch('/api/enquetes')
        if (!mounted || !res.ok) return
        const data: Array<{ id: string; titulo: string; status: string; ja_votou: boolean }> = await res.json()
        const pendentes = data.filter(e => e.status === 'active' && !e.ja_votou)
        if (pendentes.length > 0) setEnqueteQueue(pendentes)
      } catch { /* noop */ }
    }

    async function checkLembretesPendentes() {
      try {
        const res = await fetch('/api/lembretes')
        if (!mounted || !res.ok) return
        const data: Array<{ data_inicio: string; periodo: 'unico' | 'diario' | 'semanal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'mensal_dia_semana'; hora_inicio: string | null; dia_semana?: number | null; semana_ordinal?: number | null; concluido: boolean; confirmado?: boolean; criado_por: string | null }> = await res.json()
        const today = new Date().toISOString().split('T')[0]
        const snoozedAte = getLembreteSnoozedAte(userId)
        if (snoozedAte && today <= snoozedAte) return
        // Gestor/admin enxergam lembrete de toda a equipe (visibilidade "todos"), mas o
        // pop-up de atraso é só sobre o próprio — lembrete de colaborador fica visível
        // na tela inicial do módulo, sem interromper com pop-up quem não é o dono dele.
        const isGestorOuAdmin = userPapel === 'gestor' || userPapel === 'admin'
        const meus = isGestorOuAdmin ? data.filter(r => r.criado_por === userId) : data
        // Só conta como atrasado quem tem ocorrência real neste mês (não apenas
        // uma data_inicio antiga) — senão um lembrete "único" já confirmado no
        // passado volta a acusar atraso todo mês, sem nenhuma forma de resolver.
        const count = meus.filter(r => isLembreteOverdue(r, !!r.confirmado)).length
        if (count > 0) { setLembreteCount(count); setShowLembreteNotif(true) }
      } catch { /* noop */ }
    }

    void Promise.all([
      checkUnseenPrio(),
      checkUnseenAtas(),
      checkUnseenPdiConversa(),
      checkPdiNotif(),
      checkUnseenSugestoes(),
      checkUnseenEnquetes(),
      checkLembretesPendentes(),
      loadLegislacoesPendentes(profile.created_at),
    ])

    let pollTimer: ReturnType<typeof setInterval> | null = null
    function startPoll() {
      if (pollTimer !== null) return
      // Backstop pro realtime abaixo (que já cobre pdi_ciclos ao vivo) — não precisa ser tão frequente.
      pollTimer = setInterval(() => {
        checkUnseenPdiConversa()
        checkPdiNotif()
      }, 120_000)
    }
    function stopPoll() {
      if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
    }
    startPoll()
    const onVisibilityChange = () => {
      if (document.hidden) stopPoll()
      else { startPoll(); void Promise.all([checkUnseenPdiConversa(), checkPdiNotif()]) }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const channel = supabase
      .channel(`global-notif-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prioridades_avisos' },
        (payload) => {
          const record = payload.new as PrioridadeNotif
          if (!record?.id) return
          setPrioQueue(prev => prev.some(p => p.id === record.id) ? prev : [...prev, record])
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'atas', filter: 'status=eq.Validada' },
        (payload) => {
          const record = payload.new as { id: string; data: string; titulo: string | null; status: string; created_at: string }
          if (record?.status !== 'Validada' || !record?.id) return
          setAtaQueue(prev => prev.some(a => a.id === record.id) ? prev : [...prev, record])
          setUnreadAtas(prev =>
            prev.some(a => a.id === record.id) ? prev : [...prev, { id: record.id, data: record.data, titulo: record.titulo, created_at: record.created_at }]
          )
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'atas', filter: 'status=eq.Validada' },
        (payload) => {
          const record = payload.new as { id: string; data: string; titulo: string | null; status: string; created_at: string }
          if (record?.status !== 'Validada' || !record?.id) return
          setAtaQueue(prev => prev.some(a => a.id === record.id) ? prev : [...prev, record])
          setUnreadAtas(prev =>
            prev.some(a => a.id === record.id) ? prev : [...prev, { id: record.id, data: record.data, titulo: record.titulo, created_at: record.created_at }]
          )
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sugestoes' },
        (payload) => {
          if (isColabOrTrainee) return
          const record = payload.new as { id: string }
          if (!record?.id) return
          setSugestaoQueue(prev => prev.some(s => s.id === record.id) ? prev : [...prev, record])
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'enquetes', filter: 'status=eq.active' },
        (payload) => {
          const record = payload.new as { id: string; titulo: string; status: string }
          if (!record?.id || record.status !== 'active') return
          setEnqueteQueue(prev => prev.some(e => e.id === record.id) ? prev : [...prev, { id: record.id, titulo: record.titulo }])
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pdi_ciclos' },
        (payload) => {
          if (!isColabOrTrainee) return
          const anterior = payload.old as { data_conversa?: string | null; autoavaliacao_salva?: boolean }
          const atual = payload.new as { id: string; pdi_id: string; data_conversa?: string | null; autoavaliacao_salva?: boolean }
          // Nova conversa agendada
          if (!anterior.data_conversa && atual.data_conversa) {
            setPdiConversaBanner({ cicloId: atual.id, pdiId: atual.pdi_id, dataConversa: atual.data_conversa! })
          }
          // Autoavaliação salva → limpa o banner imediatamente
          if (!anterior.autoavaliacao_salva && atual.autoavaliacao_salva) {
            setPdiConversaBanner(prev => prev?.cicloId === atual.id ? null : prev)
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopPoll()
      supabase.removeChannel(channel)
    }
  }, [profile, isColabOrTrainee, loadLegislacoesPendentes])

  // Reload unread banner when navigating away from atas / legislacoes
  useEffect(() => {
    if (!profile || !isColabOrTrainee) return
    loadUnreadAtas(profile.id, profile.created_at)
  }, [pathname, profile, isColabOrTrainee, loadUnreadAtas])

  useEffect(() => {
    if (!profile) return
    loadLegislacoesPendentes(profile.created_at)
  }, [pathname, profile, loadLegislacoesPendentes])

  // Login e link público do questionário (respondente externo) aparecem sem o shell do sistema
  if (pathname === '/login' || pathname.startsWith('/questionario/')) return <>{children}</>

  const fullName = profile?.nome?.trim() || profile?.usuario?.trim() || '—'

  if (introVisible) {
    return <IntroScreen name={profile ? displayName(profile).split(' ')[0] : ''} isBirthday={isBirthdayToday} onDone={() => setIntroVisible(false)} />
  }

  function dismissTopPrio() {
    const top = prioQueue[0]
    if (!top || !profile) return
    void markPrioridadeVista(top.id, profile.id)
    setPrioQueue(prev => prev.slice(1))
  }

  function dismissTopAta() {
    // "Ver depois": fecha o popup, mas o banner persiste até a ata ser lida
    setAtaQueue(prev => prev.slice(1))
  }

  function handleLerAgora(ataId: string) {
    if (!profile) return
    void markAtaNotifVista(ataId, profile.id)
    setAtaQueue(prev => prev.slice(1))
    setUnreadAtas(prev => prev.filter(a => a.id !== ataId))
    router.push(`/atas?ata=${ataId}`)
  }

  async function handleVerPdi() {
    if (!pdiConversaBanner) return
    const { cicloId, pdiId } = pdiConversaBanner
    // Não dispensa o banner — ele some apenas quando autoavaliação for salva
    try {
      await fetch(`/api/pdi/ciclos/${cicloId}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversa_confirmada_em: new Date().toISOString() }),
      })
    } catch { /* noop */ }
    router.push(`/pdi/${pdiId}?tab=avaliacoes`)
  }

  async function handleVerPdiNotif() {
    if (!pdiNotifBanner) return
    const { pdiId } = pdiNotifBanner
    setPdiNotifBanner(null)
    try {
      await fetch(`/api/pdi/${pdiId}/notificacoes/vista`, { method: 'POST' })
    } catch { /* noop */ }
    router.push(`/pdi/${pdiId}?tab=avaliacoes`)
  }

  function dispensarPdiNotif() {
    if (!pdiNotifBanner || !profile) return
    dismissPdiNotifStorage(pdiNotifBanner.pdiId, profile.id)
    setPdiNotifBanner(null)
  }

  function handleVerPdiCriado() {
    if (!pdiCriadoNotif || !profile) return
    dismissPdiNotifStorage(pdiCriadoNotif.pdiId, profile.id)
    setPdiCriadoNotif(null)
    router.push('/pdi')
  }

  function dismissTopSugestao() {
    const top = sugestaoQueue[0]
    if (!top || !profile) return
    dismissSugestaoNotifStorage(top.id, profile.id)
    setSugestaoQueue(prev => prev.slice(1))
  }

  function handleVerSugestao() {
    const top = sugestaoQueue[0]
    if (!top || !profile) return
    dismissSugestaoNotifStorage(top.id, profile.id)
    setSugestaoQueue(prev => prev.slice(1))
    router.push('/sugestoes')
  }

  function dismissTopEnquete() {
    setEnqueteQueue(prev => prev.slice(1))
  }

  function handleResponderAgora() {
    setEnqueteQueue(prev => prev.slice(1))
    router.push('/enquetes')
  }

  const showPrioNotif = prioQueue.length > 0
  const showAtaNotif = !showPrioNotif && ataQueue.length > 0
  const showSugestaoNotif = !showPrioNotif && !showAtaNotif && sugestaoQueue.length > 0
  const showEnqueteNotif = !showPrioNotif && !showAtaNotif && !showSugestaoNotif && enqueteQueue.length > 0
  const showLembrete = !showPrioNotif && !showAtaNotif && !showSugestaoNotif && !showEnqueteNotif && showLembreteNotif

  const bannerAta = pathname !== '/atas' && isColabOrTrainee && unreadAtas.length > 0 ? unreadAtas[0] : null
  const bannerPdiConversa = isColabOrTrainee && pdiConversaBanner && !pathname.startsWith('/pdi') ? pdiConversaBanner : null
  const bannerPdiNotif = isColabOrTrainee && pdiNotifBanner && !pdiCriadoNotif && !pathname.startsWith('/pdi') ? pdiNotifBanner : null

  const dtPdi = bannerPdiConversa ? new Date(bannerPdiConversa.dataConversa) : null
  const dataPdi = dtPdi?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const horaPdi = dtPdi?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {isBirthdayToday && (
        <style>{`@keyframes gt3-bday-shimmer { 0% { background-position: 0% 0; } 100% { background-position: 300% 0; } }`}</style>
      )}
      <div ref={containerRef} style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {splitActive && split.side === 'left' && (
          <PinnedPane
            path={split.path!}
            label={splitModules.find(m => m.path === split.path)?.label ?? split.path!}
            color={splitModules.find(m => m.path === split.path)?.color ?? '#1E3A6E'}
            width={`${split.ratio * 100}%`}
            onClose={() => setSplit(prev => ({ ...prev, open: false }))}
            onSwapSide={() => setSplit(prev => ({ ...prev, side: 'right' }))}
          />
        )}
        {splitActive && <SplitDivider onMouseDown={startDrag} />}
        <div style={{
          position: 'relative', display: 'flex', flexDirection: 'column',
          flex: splitActive ? undefined : 1,
          width: splitActive ? `${(1 - split.ratio) * 100}%` : undefined,
          minWidth: 0, overflow: 'hidden',
        }}>
          <header style={{
            backgroundColor: '#fff', borderBottom: isBirthdayToday ? 'none' : '1px solid #E2E8F0',
            padding: '10px 24px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0, gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => router.back()}
                title="Voltar"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#A0AEC0', fontSize: 13, lineHeight: 1,
                  padding: '6px 10px', borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1E3A6E' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#A0AEC0' }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>←</span>
                <span>{breadcrumb}</span>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {splitModules.length > 0 && (
                <SplitViewButton split={split} modules={splitModules} onChange={setSplit} />
              )}
              <HeaderSearch />
              <UserMenu name={isBirthdayToday ? `${fullName} 🎂` : fullName} onSignOut={signOut} onAlterarSenha={() => router.push('/perfil')} />
            </div>
          </header>

          {isBirthdayToday && (
            <div style={{
              height: 3, flexShrink: 0,
              background: 'linear-gradient(90deg, #D1AE6E, #E8A9C0, #2A4F96, #D1AE6E)',
              backgroundSize: '300% 100%',
              animation: 'gt3-bday-shimmer 6s linear infinite',
            }} />
          )}

          {bannerPdiNotif && (
            <div style={{
              backgroundColor: '#F0FFF4', borderBottom: '1px solid #6EE7B7',
              padding: '10px 24px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0, gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#065F46' }}>
                📝 Seu PDI foi atualizado pelo gestor — verifique as notas e ações
                {bannerPdiNotif.dataAcao && (
                  <span style={{ marginLeft: 6, color: '#047857', fontWeight: 600 }}>
                    · adicionado em {new Date(bannerPdiNotif.dataAcao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={handleVerPdiNotif} style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none',
                  background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Ver PDI</button>
              </div>
            </div>
          )}

          {bannerPdiConversa && (
            <div style={{
              backgroundColor: '#FEF2F2', borderBottom: '2px solid #FCA5A5',
              padding: '10px 24px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0, gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#7F1D1D', fontWeight: 500 }}>
                🔴 Conversa de PDI agendada para <strong>{dataPdi} às {horaPdi}</strong>
                {' — '}preencha sua autoavaliação antes da conversa
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={handleVerPdi} style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none',
                  background: '#DC2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Ver PDI</button>
              </div>
            </div>
          )}

          {bannerAta && (
            <div style={{
              backgroundColor: '#FFFBEB', borderBottom: '2px solid #F59E0B',
              padding: '10px 24px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0, gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#92400E', fontWeight: 500 }}>
                📋 Leitura pendente:{' '}
                <strong>{bannerAta.titulo?.trim() || `Ata de ${bannerAta.data}`}</strong>
                <span style={{ fontWeight: 400, marginLeft: 6 }}>— confirme a leitura para dispensar este aviso</span>
              </span>
              <button
                onClick={() => router.push(`/atas?ata=${bannerAta.id}`)}
                style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none',
                  background: '#D97706', color: '#fff', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                }}
              >
                Ler agora
              </button>
            </div>
          )}

          {pathname !== '/legislacoes' && legislacoesPendentes > 0 && (
            <div style={{
              backgroundColor: '#FEF3C7', borderBottom: '2px solid #F59E0B',
              padding: '10px 24px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0, gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#92400E', fontWeight: 500 }}>
                📜 {legislacoesPendentes === 1
                  ? '1 legislação aguarda confirmação de leitura'
                  : `${legislacoesPendentes} legislações aguardam confirmação de leitura`}
                <span style={{ fontWeight: 400, marginLeft: 6 }}>— confirme para dispensar este aviso</span>
              </span>
              <button
                onClick={() => router.push('/legislacoes')}
                style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none',
                  background: '#D97706', color: '#fff', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                }}
              >
                Ver agora
              </button>
            </div>
          )}

          <Tabbar />

          <TabContentCache
            pathname={pathname}
            content={children}
            mainStyle={{ flex: 1, overflow: 'auto', backgroundColor: '#F4F6FA', padding: 24, paddingBottom: 80 }}
            componentMap={MODULE_COMPONENT_MAP}
          />

          {pathname === '/' && (
            <div style={{
              position: 'absolute', bottom: 0,
              left: 0, right: 0, zIndex: 100,
            }}>
              <QuoteBanner />
            </div>
          )}

          {/* Hover-mode sidebar overlay — ancorado a esta coluna (não à viewport),
              para acompanhar o app principal quando ele fica do lado direito na tela dividida. */}
          <div style={{
            position: 'absolute',
            left: 0, top: 0,
            height: '100%',
            width: 220,
            zIndex: 200,
            pointerEvents: 'none',
          }}>
            {/* Trigger pill — visible when sidebar is hidden */}
            <div
              onMouseEnter={() => setHoverVisible(true)}
              style={{
                position: 'absolute',
                left: 0,
                top: pathname === '/' ? '50%' : 'auto',
                bottom: pathname === '/' ? 'auto' : '24px',
                transform: pathname === '/' ? 'translateY(-50%)' : 'none',
                transition: 'opacity 0.2s, top 0.25s ease, transform 0.25s ease',
                pointerEvents: hoverVisible ? 'none' : 'auto',
                opacity: hoverVisible ? 0 : 1,
                cursor: 'pointer',
                background: isBirthdayToday
                  ? 'linear-gradient(135deg, #1E3A6E, #6A3B6E)'
                  : '#1E3A6E',
                borderRadius: '0 20px 20px 0',
                padding: '10px 12px 10px 8px',
                boxShadow: isBirthdayToday ? '2px 0 10px rgba(209,174,110,0.45)' : '2px 0 10px rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 1,
                lineHeight: 1,
              }}>GT3</span>
              {isBirthdayToday && <span style={{ fontSize: 13, lineHeight: 1 }}>🎂</span>}
            </div>

            {/* Sidebar overlay — slides in on hover */}
            <div
              onMouseLeave={() => setHoverVisible(false)}
              style={{
                position: 'absolute',
                left: 0, top: 0,
                height: '100%',
                width: '100%',
                transform: hoverVisible ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.25s ease',
                pointerEvents: hoverVisible ? 'auto' : 'none',
                boxShadow: hoverVisible ? '4px 0 20px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              <Sidebar
                collapsed={false}
                onToggle={() => {}}
                mode="hover"
              />
            </div>
          </div>
        </div>
        {splitActive && split.side === 'right' && <SplitDivider onMouseDown={startDrag} />}
        {splitActive && split.side === 'right' && (
          <PinnedPane
            path={split.path!}
            label={splitModules.find(m => m.path === split.path)?.label ?? split.path!}
            color={splitModules.find(m => m.path === split.path)?.color ?? '#1E3A6E'}
            width={`${split.ratio * 100}%`}
            onClose={() => setSplit(prev => ({ ...prev, open: false }))}
            onSwapSide={() => setSplit(prev => ({ ...prev, side: 'left' }))}
          />
        )}
      </div>

      {showPrioNotif && (
        <PrioridadeNotificacao empresa={prioQueue[0].empresa} onOk={dismissTopPrio} />
      )}
      {showAtaNotif && (
        <AtaNotificacao
          ataId={ataQueue[0].id}
          data={ataQueue[0].data}
          titulo={ataQueue[0].titulo}
          onLerAgora={handleLerAgora}
          onVerDepois={dismissTopAta}
        />
      )}
      {showSugestaoNotif && (
        <SugestaoNotificacao
          onVerSugestao={handleVerSugestao}
          onVerDepois={dismissTopSugestao}
        />
      )}
      {showEnqueteNotif && (
        <EnqueteNotificacao
          titulo={enqueteQueue[0].titulo}
          onResponderAgora={handleResponderAgora}
          onVerDepois={dismissTopEnquete}
        />
      )}
      {showLembrete && profile && (
        <LembreteNotificacao
          count={lembreteCount}
          onVerAgora={() => {
            setShowLembreteNotif(false)
            snoozeLembreteNotifStorage(profile.id, new Date().toISOString().split('T')[0])
            router.push('/lembretes')
          }}
          onAdiar={ateIso => { setShowLembreteNotif(false); snoozeLembreteNotifStorage(profile.id, ateIso) }}
          onDescartar={() => {
            setShowLembreteNotif(false)
            snoozeLembreteNotifStorage(profile.id, new Date().toISOString().split('T')[0])
          }}
        />
      )}

      {pdiCriadoNotif && (
        <PdiCriadoNotificacao onVerAgora={handleVerPdiCriado} />
      )}
    </>
  )
}
