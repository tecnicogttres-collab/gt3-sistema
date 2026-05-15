'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULES } from '../lib/modules'
import type { Role } from '../lib/modules'
import { useUser } from './UserContext'

type Props = { collapsed: boolean; onToggle: () => void }

const SIDEBAR_BG = '#1E3A6E'
const ACCENT = '#D1AE6E'

const PAPEL_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname()
  const { profile, loading, signOut } = useUser()

  const papel = profile?.papel as Role | null
  const visibleModules = papel
    ? MODULES.filter((m) => m.allowedRoles.includes(papel))
    : loading
    ? []
    : MODULES.filter((m) => m.allowedRoles.includes('colaborador'))

  function itemStyle(isActive: boolean): React.CSSProperties {
    return {
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

  const displayName = profile?.nome ?? '—'
  const initials = displayName.replace(/^GT3\./, '').slice(0, 2) || '?'

  return (
    <aside
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
      {/* Logo */}
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
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>GT3</span>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir' : 'Recolher'}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <Link href="/" style={itemStyle(pathname === '/')}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.8)', flexShrink: 0 }} />
          {!collapsed && <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>Dashboard</span>}
        </Link>

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

        {visibleModules.map((mod) => {
          const isActive = pathname === mod.path
          return (
            <Link key={mod.id} href={mod.path} style={itemStyle(isActive)}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: mod.color, flexShrink: 0 }} />
              {!collapsed && <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{mod.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        {profile && (
          <Link
            href="/perfil"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '10px 0' : '12px 16px 8px',
              justifyContent: collapsed ? 'center' : undefined,
              textDecoration: 'none',
            }}
            title={collapsed ? displayName : undefined}
          >
            <div
              style={{
                width: 30, height: 30, borderRadius: '50%',
                backgroundColor: 'rgba(209,174,110,0.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: ACCENT, fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}
            >
              {initials}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                {profile.papel && (
                  <div style={{ color: ACCENT, fontSize: 11 }}>
                    {PAPEL_LABELS[profile.papel] ?? profile.papel}
                  </div>
                )}
              </div>
            )}
          </Link>
        )}

        <button
          onClick={signOut}
          style={{
            width: '100%', background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.45)', fontSize: collapsed ? 15 : 13,
            cursor: 'pointer', padding: collapsed ? '10px 0' : '6px 16px 12px',
            textAlign: collapsed ? 'center' : 'left', display: 'block',
          }}
          onMouseEnter={(e) => { (e.currentTarget).style.color = 'rgba(255,255,255,0.85)' }}
          onMouseLeave={(e) => { (e.currentTarget).style.color = 'rgba(255,255,255,0.45)' }}
        >
          {collapsed ? '↩' : '← Sair'}
        </button>
      </div>
    </aside>
  )
}
