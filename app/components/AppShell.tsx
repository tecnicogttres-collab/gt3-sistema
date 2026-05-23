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
import QuoteBanner from './QuoteBanner'

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

type PdiConversaBanner = { cicloId: string; pdiId: string; dataConversa: string }
type PdiNotifBanner = { pdiId: string }

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true)
  const [prioQueue, setPrioQueue] = useState<PrioridadeNotif[]>([])
  const [ataQueue, setAtaQueue] = useState<AtaNotif[]>([])
  const [unreadAtas, setUnreadAtas] = useState<AtaNotif[]>([])
  const [pdiConversaBanner, setPdiConversaBanner] = useState<PdiConversaBanner | null>(null)
  const [pdiNotifBanner, setPdiNotifBanner] = useState<PdiNotifBanner | null>(null)
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
        const res = await fetch('/api/pdi/conversa-pendente')
        if (!mounted || !res.ok) return
        const row = await res.json() as { cicloId: string; pdiId: string; dataConversa: string } | null
        if (!row) { if (mounted) setPdiConversaBanner(null); return }
        const dismissed = getPdiConversaDismissed(userId)
        if (dismissed[row.cicloId] !== row.dataConversa) {
          setPdiConversaBanner(row)
        }
      } catch { /* noop */ }
    }

    async function checkPdiNotif() {
      if (!isColabOrTrainee) return
      try {
        const res = await fetch('/api/pdi/notificacoes')
        if (!mounted || !res.ok) return
        const { count, pdiId } = await res.json() as { count: number; pdiId: string | null }
        if (count > 0 && pdiId) {
          const dismissed = getPdiNotifDismissed(userId)
          if (!dismissed.includes(pdiId)) setPdiNotifBanner({ pdiId })
        }
      } catch { /* noop */ }
    }

    checkUnseenPrio()
    checkUnseenAtas()
    checkUnseenPdiConversa()
    checkPdiNotif()

    const pollTimer = setInterval(() => {
      checkUnseenPdiConversa()
      checkPdiNotif()
    }, 30_000)

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
        { event: 'UPDATE', schema: 'public', table: 'pdi_ciclos' },
        (payload) => {
          if (!isColabOrTrainee) return
          const anterior = payload.old as { data_conversa?: string | null }
          const atual = payload.new as { id: string; pdi_id: string; data_conversa?: string | null }
          if (!anterior.data_conversa && atual.data_conversa) {
            const dismissed = getPdiConversaDismissed(userId)
            if (!dismissed.includes(atual.id)) {
              setPdiConversaBanner({ cicloId: atual.id, pdiId: atual.pdi_id, dataConversa: atual.data_conversa! })
            }
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      clearInterval(pollTimer)
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

  async function handleVerPdi() {
    if (!pdiConversaBanner) return
    const { cicloId, pdiId, dataConversa } = pdiConversaBanner
    setPdiConversaBanner(null)
    if (profile) dismissPdiConversaBannerStorage(cicloId, dataConversa, profile.id)
    try {
      await fetch(`/api/pdi/ciclos/${cicloId}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversa_confirmada_em: new Date().toISOString() }),
      })
    } catch { /* noop */ }
    router.push(`/pdi/${pdiId}?tab=avaliacoes`)
  }

  function dispensarPdiConversa() {
    if (!pdiConversaBanner || !profile) return
    dismissPdiConversaBannerStorage(pdiConversaBanner.cicloId, pdiConversaBanner.dataConversa, profile.id)
    setPdiConversaBanner(null)
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

  const showPrioNotif = prioQueue.length > 0
  const showAtaNotif = !showPrioNotif && ataQueue.length > 0

  const bannerAta = pathname !== '/atas' && isColabOrTrainee && unreadAtas.length > 0 ? unreadAtas[0] : null
  const bannerPdiConversa = isColabOrTrainee && pdiConversaBanner && !pathname.startsWith('/pdi') ? pdiConversaBanner : null
  const bannerPdiNotif = isColabOrTrainee && pdiNotifBanner && !pathname.startsWith('/pdi') ? pdiNotifBanner : null

  const dtPdi = bannerPdiConversa ? new Date(bannerPdiConversa.dataConversa) : null
  const dataPdi = dtPdi?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const horaPdi = dtPdi?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <header style={{
            backgroundColor: '#fff', borderBottom: '1px solid #E2E8F0',
            padding: '10px 24px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0, gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => router.back()}
                title="Voltar"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#A0AEC0', fontSize: 16, lineHeight: 1,
                  padding: '2px 4px', borderRadius: 4,
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1E3A6E' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#A0AEC0' }}
              >
                ←
              </button>
              <span style={{ fontSize: 13, color: '#6B7A99' }}>{breadcrumb}</span>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 500, padding: '3px 12px',
              borderRadius: 999, backgroundColor: '#EBF0FB', color: '#2A4F96',
            }}>
              {papelLabel}
            </span>
          </header>

          {bannerPdiNotif && (
            <div style={{
              backgroundColor: '#F0FFF4', borderBottom: '1px solid #6EE7B7',
              padding: '10px 24px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0, gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#065F46' }}>
                📝 Seu PDI foi atualizado pelo gestor — verifique as notas e ações
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={handleVerPdiNotif} style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none',
                  background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Ver PDI</button>
                <button onClick={dispensarPdiNotif} style={{
                  padding: '4px 12px', borderRadius: 6, border: '1px solid #059669',
                  background: 'transparent', color: '#065F46', fontSize: 12, cursor: 'pointer',
                }}>Dispensar</button>
              </div>
            </div>
          )}

          {bannerPdiConversa && (
            <div style={{
              backgroundColor: '#EBF0FB', borderBottom: '1px solid #93C5FD',
              padding: '10px 24px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0, gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#1A2340' }}>
                📅 Conversa de PDI agendada para <strong>{dataPdi} às {horaPdi}</strong>
                {' — '}preencha sua autoavaliação antes da conversa
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={handleVerPdi} style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none',
                  background: '#2A4F96', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Ver PDI</button>
                <button onClick={dispensarPdiConversa} style={{
                  padding: '4px 12px', borderRadius: 6, border: '1px solid #2A4F96',
                  background: 'transparent', color: '#1A2340', fontSize: 12, cursor: 'pointer',
                }}>Dispensar</button>
              </div>
            </div>
          )}

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

          <main style={{ flex: 1, overflow: 'auto', backgroundColor: '#F4F6FA', padding: 24, paddingBottom: 80 }}>
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

      <div style={{
        position: 'fixed', bottom: 0,
        left: collapsed ? 60 : 220,
        right: 0, zIndex: 100,
        transition: 'left 0.25s ease',
      }}>
        <QuoteBanner />
      </div>
    </>
  )
}
