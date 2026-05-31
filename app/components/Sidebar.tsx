'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { MODULES } from '../lib/modules'
import type { Role } from '../lib/modules'
import { useUser } from './UserContext'

type Props = {
  collapsed: boolean
  onToggle: () => void
  onHoverEnter?: () => void
  onHoverLeave?: () => void
  mode?: 'classic' | 'hover'
  onModeToggle?: () => void
}

const SIDEBAR_BG = '#1E3A6E'
const ACCENT = '#D1AE6E'

export default function Sidebar({ collapsed, onToggle, onHoverEnter, onHoverLeave, mode = 'classic', onModeToggle }: Props) {
  const pathname = usePathname()
  const { profile, loading } = useUser()
  const [pdiNotifCount, setPdiNotifCount] = useState(0)
  const [moduleNotifs, setModuleNotifs] = useState<Record<string, number>>({})

  const papel = profile?.papel as Role | null
  const visibleModules = useMemo(() => papel
    ? MODULES.filter((m) => {
        if (papel === 'admin') return true
        const allowed = profile?.modulos_permitidos ?? null
        if (allowed !== null) return allowed.includes(m.id)
        return m.allowedRoles.includes(papel)
      })
    : loading
    ? []
    : MODULES.filter((m) => m.allowedRoles.includes('colaborador')),
  [papel, profile?.modulos_permitidos, loading])

  // PDI notifications (tabela pdi_notificacoes — sistema existente para colaboradores)
  useEffect(() => {
    if (!profile || profile.papel !== 'colaborador') return
    fetch('/api/pdi/notificacoes')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(data => setPdiNotifCount(data.count ?? 0))
      .catch(() => {})
  }, [profile, pathname])

  // Notificações gerais por módulo (tabela notificacoes_usuario)
  useEffect(() => {
    if (!profile) return
    fetch('/api/notificacoes/usuario')
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, number>) => setModuleNotifs(data))
      .catch(() => {})
  }, [profile, pathname])

  // Marca como visto ao entrar num módulo
  useEffect(() => {
    if (!profile) return
    const activeModule = MODULES.find(
      m => pathname === m.path || pathname.startsWith(m.path + '/')
    )
    if (!activeModule || !(moduleNotifs[activeModule.id] > 0)) return
    fetch('/api/notificacoes/usuario', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modulo: activeModule.id }),
    }).catch(() => {})
    setModuleNotifs(prev => ({ ...prev, [activeModule.id]: 0 }))
  }, [pathname, profile])

  function itemStyle(isActive: boolean): React.CSSProperties {
    return {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: collapsed ? 0 : 12,
      padding: collapsed ? '12px 0' : '10px 16px',
      justifyContent: collapsed ? 'center' : undefined,
      borderLeft: `2px solid ${isActive ? ACCENT : 'transparent'}`,
      backgroundColor: isActive ? 'rgba(255,255,255,0.10)' : undefined,
      color: isActive ? ACCENT : 'rgba(255,255,255,0.85)',
      fontSize: 14,
      fontWeight: isActive ? 500 : 400,
      transition: 'all 0.15s',
      cursor: 'pointer',
    }
  }

  return (
    <aside
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      style={{
        width: collapsed ? 60 : 220,
        backgroundColor: SIDEBAR_BG,
        flexShrink: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <img
            src="/logo-gt3.png"
            alt="GT3"
            style={{ height: 28, width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        )}
        {mode !== 'hover' && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir' : 'Recolher'}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}
          >
            {collapsed ? '›' : '‹'}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <Link href="/" style={itemStyle(pathname === '/')}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.8)', flexShrink: 0 }} />
          {!collapsed && <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>Dashboard</span>}
        </Link>

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

        {visibleModules.map((mod) => {
          const isActive = pathname === mod.path || pathname.startsWith(mod.path + '/')
          const hasBadge =
            (mod.id === 'pdi' && pdiNotifCount > 0) ||
            (moduleNotifs[mod.id] ?? 0) > 0
          return (
            <Link key={mod.id} href={mod.path} style={itemStyle(isActive)}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: mod.color, flexShrink: 0 }} />
              {!collapsed && <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{mod.label}</span>}
              {hasBadge && (
                <span style={{
                  position: 'absolute',
                  top: collapsed ? 8 : 7,
                  right: collapsed ? 10 : 14,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                  border: '1.5px solid #1E3A6E',
                  flexShrink: 0,
                }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      {onModeToggle && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <button
            onClick={onModeToggle}
            title={mode === 'hover' ? 'Mudar para modo fixo' : 'Mudar para modo hover'}
            style={{
              width: '100%', background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.25)', fontSize: 11,
              cursor: 'pointer', padding: collapsed ? '8px 0' : '8px 16px',
              textAlign: collapsed ? 'center' : 'left', display: 'block',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}
          >
            {collapsed ? '⊟' : (mode === 'hover' ? '⊡ Modo fixo' : '⊟ Modo hover')}
          </button>
        </div>
      )}
    </aside>
  )
}
