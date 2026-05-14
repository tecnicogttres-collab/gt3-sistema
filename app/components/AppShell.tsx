'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Tabbar from './Tabbar'
import { MODULES } from '../lib/modules'

function useBreadcrumb(pathname: string): string {
  if (pathname === '/') return 'Dashboard'
  const mod = MODULES.find((m) => m.path === pathname)
  return mod ? `GT3 Sistema › ${mod.label}` : 'GT3 Sistema'
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const breadcrumb = useBreadcrumb(pathname)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Topbar */}
        <header
          style={{
            backgroundColor: '#fff',
            borderBottom: '1px solid #E2E8F0',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, color: '#6B7A99' }}>
            {breadcrumb}
          </span>

          {/* Role pill */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: '3px 12px',
              borderRadius: 999,
              backgroundColor: '#EBF0FB',
              color: '#2A4F96',
            }}
          >
            Admin
          </span>
        </header>

        {/* Tabbar */}
        <Tabbar />

        {/* Content area */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: '#F4F6FA',
            padding: 24,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
