'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULES } from '../lib/modules'

type Props = {
  collapsed: boolean
  onToggle: () => void
}

const SIDEBAR_BG = '#1E3A6E'
const ACCENT = '#D1AE6E'

export default function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname()

  function itemStyle(isActive: boolean) {
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
    } as React.CSSProperties
  }

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
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>
            GT3
          </span>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 4,
          }}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {/* Dashboard */}
        <Link href="/" style={itemStyle(pathname === '/')}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.8)',
              flexShrink: 0,
            }}
          />
          {!collapsed && <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>Dashboard</span>}
        </Link>

        {/* Separator */}
        <div
          style={{
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.08)',
            margin: '8px 0',
          }}
        />

        {/* Modules */}
        {MODULES.map((mod) => {
          const isActive = pathname === mod.path
          return (
            <Link key={mod.id} href={mod.path} style={itemStyle(isActive)}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: mod.color,
                  flexShrink: 0,
                }}
              />
              {!collapsed && (
                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {mod.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          GT3 Consultoria © 2025
        </div>
      )}
    </aside>
  )
}
