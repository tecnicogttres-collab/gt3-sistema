'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import Tabbar from './Tabbar'
import { MODULES } from '../lib/modules'
import { useUser } from './UserContext'
import { createClient } from '../lib/supabase'
import PrioridadeNotificacao from './PrioridadeNotificacao'
import AtaNotificacao from './AtaNotificacao'
import PdiConversaNotificacao from './PdiConversaNotificacao'

function useBreadcrumb(pathname: string): string {
  if (pathname === '/') return 'Dashboard'
  const mod = MODULES.find((m) => m.path === pathname)
  return mod ? `GT3 Sistema › ${mod.label}` : 'GT3 Sistema'
}

const PAPEL_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
  trainee: 'Trainee',
}

// ─── Prioridades helpers ──────────────────────────────────────────────────────

type PrioridadeNotif = { id: string; empresa: string }

function prioKey(userId: string) { return `prioridades_vistas_${userId}` }
function getPrioSeenIds(userId: string): string[] {
  try { return JSON.parse(localStorage.getItem(prioKey(userId)) ?? '[]') } catch { return [] }
}
export function markPrioridadeVista(id: string, userId: string) {
  try {
    const seen = getPrioSeenIds(userId)
    if (!seen.includes(id)) localStorage.setItem(prioKey(userId), JSON.stringify([...seen, id]))
  } catch { /* noop */ }
}

// ─── Atas helpers ─────────────────────────────────────────────────────────────

type AtaNotif = { id: string; data: string; titulo: string | null }

function ataKey(userId: string) { return `atas_notif_vistas_${userId}` }
function getAtaSeenIds(userId: string): string[] {
  try { return JSON.parse(localStorage.getItem(ataKey(userId)) ?? '[]') } catch { return [] }
}
export function markAtaNotifVista(id: string, userId: string) {
  try {
    const seen = getAtaSeenIds(userId)
    if (!seen.includes(id)) localStorage.setItem(ataKey(userId), JSON.stringify([...seen, id]))
  } catch { /* noop */ }
}

function ataBannerKey(userId: string) { return `atas_banner_dismissed_${userId}` }
function getBannerDismissed(userId: string): string[] {
  try { return JSON.parse(sessionStorage.getItem(ataBannerKey(userId)) ?? '[]') } catch { return [] }
}
function dismissBanner(ataId: string, userId: string) {
  try {
    const dismissed = getBannerDismissed(userId)
    if (!dismissed.includes(ataId)) {
      sessionStorage.setItem(ataBannerKey(userId), JSON.stringify([...dismissed, ataId]))
    }
  } catch { /* noop */ }
}

// ─── PDI Conversa helpers ─────────────────────────────────────────────────────

type PdiConversaAviso = { id: string; ciclo_id: string; data_conversa: string }

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [prioQueue, setPrioQueue] = useState<PrioridadeNotif[]>([])
  const [ataQueue, setAtaQueue] = useState<AtaNotif[]>([])
  const [unreadAtas, setUnreadAtas] = useState<AtaNotif[]>([])
  const [pdiConversaQueue, setPdiConversaQueue] = useState<PdiConversaAviso[]>([])
  const pathname = usePathname()
  const breadcrumb = useBreadcrumb(pathname)
  const { profile, loading } = useUser()
  const router = useRouter()

  const isColabOrTrainee = profile?.papel === 'colaborador' || profile?.papel === 'trainee'

  const loadUnreadAtas = useCallback(async (userId: string) => {
    if (!isColabOrTrainee) return
    try {
      const res = await fetch('/api/atas')
      if (!res.ok) return
      const atas: AtaNotif[] = await res.json()
      const seen = getAtaSeenIds(userId)
      const dismissed = getBannerDismissed(userId)
      setUnreadAtas(atas.filter(a => !seen.includes(a.id) && !dismissed.includes(a.id)))
    } catch { /* noop */ }
  }, [isColabOrTrainee])

  useEffect(() => {
    if (!profile) return
    const userId = profile.id
    const supabase = createClient()
    let mounted = true

    async function checkUnseenPrio() {
      try {
        const { data } = await supabase.from('prioridades_avisos').select('id, empresa').order('created_at', { ascending: true })
        if (!mounted || !data) return
        const seen = getPrioSeenIds(userId)
        const unseen = (data as PrioridadeNotif[]).filter(r => !seen.includes(r.id))
        if (unseen.length > 0) setPrioQueue(unseen)
      } catch { /* tabela não existe */ }
    }

    async function checkUnseenAtas() {
      if (!isColabOrTrainee) return
      try {
        const res = await fetch('/api/atas')
        if (!mounted || !res.ok) return
        const atas: AtaNotif[] = await res.json()
        const seen = getAtaSeenIds(userId)
        const dismissed = getBannerDismissed(userId)
        const unnotified = atas.filter(a => !seen.includes(a.id))
        if (unnotified.length > 0) setAtaQueue(unnotified)
        setUnreadAtas(atas.filter(a => !seen.includes(a.id) && !dismissed.includes(a.id)))
      } catch { /* noop */ }
    }

    async function checkUnseenPdiConversa() {
      if (!isColabOrTrainee) return
      try {
        const { data } = await supabase
          .from('pdi_ciclos')
          .select('id, data_conversa')
          .eq('colaborador_id', userId)
          .not('data_conversa', 'is', null)
          .is('conversa_confirmada_em', null)
        if (!mounted || !data) return
        const pending = (data as { id: string; data_conversa: string }[])
          .map(r => ({ id: r.id, ciclo_id: r.id, data_conversa: r.data_conversa }))
        if (pending.length > 0) setPdiConversaQueue(pending)
      } catch { /* noop */ }
    }

    checkUnseenPrio()
    checkUnseenAtas()
    checkUnseenPdiConversa()

    const channel = supabase
      .channel(`global-notif-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prioridades_avisos' },
        (payload) => {
          const record = payload.new as PrioridadeNotif
          if (!record?.id) return
          const seen = getPrioSeenIds(userId)
          if (!seen.includes(record.id)) {
            setPrioQueue(prev => prev.some(p => p.id === record.id) ? prev : [...prev, record])
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'atas', filter: 'status=eq.Validada' },
        (payload) => {
          const record = payload.new as { id: string; data: string; titulo: string | null; status: string }
          if (record?.status !== 'Validada' || !record?.id) return
          const seen = getAtaSeenIds(userId)
          if (!seen.includes(record.id)) {
            setAtaQueue(prev => prev.some(a => a.id === record.id) ? prev : [...prev, record])
            setUnreadAtas(prev => {
              const dismissed = getBannerDismissed(userId)
              if (prev.some(a => a.id === record.id) || dismissed.includes(record.id)) return prev
              return [...prev, { id: record.id, data: record.data, titulo: record.titulo }]
            })
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pdi_conversa_avisos', filter: `colaborador_id=eq.${userId}` },
        (payload) => {
          if (!isColabOrTrainee) return
          const r = payload.new as { id: string; ciclo_id: string; data_conversa: string }
          if (!r?.ciclo_id) return
          setPdiConversaQueue(prev =>
            prev.some(p => p.ciclo_id === r.ciclo_id) ? prev : [...prev, { id: r.id, ciclo_id: r.ciclo_id, data_conversa: r.data_conversa }]
          )
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [profile, isColabOrTrainee])

  // Reload unread banner when navigating away from atas
  useEffect(() => {
    if (!profile || !isColabOrTrainee) return
    loadUnreadAtas(profile.id)
  }, [pathname, profile, isColabOrTrainee, loadUnreadAtas])

  if (pathname === '/login') return <>{children}</>

  const papelLabel = loading ? '...' : profile?.papel ? PAPEL_LABELS[profile.papel] ?? profile.papel : '—'

  function dismissTopPrio() {
    const top = prioQueue[0]
    if (!top || !profile) return
    markPrioridadeVista(top.id, profile.id)
    setPrioQueue(prev => prev.slice(1))
  }

  function dismissTopAta(markSeen: boolean) {
    const top = ataQueue[0]
    if (!top || !profile) return
    if (markSeen) markAtaNotifVista(top.id, profile.id)
    setAtaQueue(prev => prev.slice(1))
    setUnreadAtas(prev => prev.filter(a => a.id !== top.id))
  }

  function handleLerAgora(ataId: string) {
    if (!profile) return
    markAtaNotifVista(ataId, profile.id)
    dismissTopAta(false)
    router.push(`/atas?ata=${ataId}`)
  }

  async function confirmPdiConversa() {
    const top = pdiConversaQueue[0]
    if (!top) return
    setPdiConversaQueue(prev => prev.slice(1))
    try {
      await fetch(`/api/pdi/ciclos/${top.ciclo_id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversa_confirmada_em: new Date().toISOString() }),
      })
    } catch { /* noop */ }
  }

  // Priority: PDI conversa > prioridade > ata
  const showPdiConversa = pdiConversaQueue.length > 0
  const showPrioNotif = !showPdiConversa && prioQueue.length > 0
  const showAtaNotif = !showPdiConversa && !showPrioNotif && ataQueue.length > 0

  // Top unread banner: show only if not on /atas page
  const bannerAta = pathname !== '/atas' && isColabOrTrainee && unreadAtas.length > 0 ? unreadAtas[0] : null

  return (
    <>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <header style={{
            backgroundColor: '#fff', borderBottom: '1px solid #E2E8F0',
            padding: '10px 24px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, color: '#6B7A99' }}>{breadcrumb}</span>
            <span style={{
              fontSize: 12, fontWeight: 500, padding: '3px 12px',
              borderRadius: 999, backgroundColor: '#EBF0FB', color: '#2A4F96',
            }}>
              {papelLabel}
            </span>
          </header>

          {bannerAta && (
            <div style={{
              backgroundColor: '#FFFBEB', borderBottom: '1px solid #FCD34D',
              padding: '10px 24px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0, gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#92400E' }}>
                📋 Nova ata disponível para leitura:{' '}
                <strong>{bannerAta.titulo?.trim() || `Ata de ${bannerAta.data}`}</strong>
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => router.push(`/atas?ata=${bannerAta.id}`)}
                  style={{
                    padding: '4px 14px', borderRadius: 6, border: 'none',
                    background: '#D97706', color: '#fff', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Ler agora
                </button>
                <button
                  onClick={() => {
                    if (profile) dismissBanner(bannerAta.id, profile.id)
                    setUnreadAtas(prev => prev.filter(a => a.id !== bannerAta.id))
                  }}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: '1px solid #D97706',
                    background: 'transparent', color: '#92400E', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Dispensar
                </button>
              </div>
            </div>
          )}

          <Tabbar />

          <main style={{ flex: 1, overflow: 'auto', backgroundColor: '#F4F6FA', padding: 24 }}>
            {children}
          </main>
        </div>
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
          onVerDepois={() => dismissTopAta(true)}
        />
      )}
      {showPdiConversa && (
        <PdiConversaNotificacao
          dataConversa={pdiConversaQueue[0].data_conversa}
          onCiente={confirmPdiConversa}
        />
      )}
    </>
  )
}
