'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useModules } from './ModulesContext'
import { evictTabContent } from './TabContentCache'

// Guardamos apenas id/path; nome e cor são resolvidos ao vivo a partir do
// contexto de módulos, para que renomear um módulo atualize as abas abertas.
type Tab = {
  id: string
  path: string
}

const HOME_TAB: Tab = {
  id: 'home',
  path: '/',
}

export default function Tabbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { modules: MODULES } = useModules()
  const [tabs, setTabs] = useState<Tab[]>([HOME_TAB])

  const meta = useMemo(() => {
    const map: Record<string, { label: string; color: string }> = {
      home: { label: 'Dashboard', color: '#2A4F96' },
    }
    for (const m of MODULES) map[m.id] = { label: m.label, color: m.color }
    return map
  }, [MODULES])

  useEffect(() => {
    if (pathname === '/') return
    const mod = MODULES.find((m) => m.path === pathname)
    if (!mod) return
    setTabs((prev) => {
      if (prev.some((t) => t.path === pathname)) return prev
      return [...prev, { id: mod.id, path: mod.path }]
    })
  }, [pathname, MODULES])

  function isUnderTab(tabPath: string) {
    return pathname === tabPath || pathname.startsWith(tabPath + '/')
  }

  function closeTab(tabId: string, tabPath: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setTabs((prev) => prev.filter((t) => t.id !== tabId))
    // Fechar de verdade "esquece" o módulo: a próxima abertura começa do zero,
    // em vez de reaparecer na tela em que o usuário tinha deixado antes.
    evictTabContent(tabPath)
    if (isUnderTab(tabPath)) router.push('/')
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        backgroundColor: '#fff',
        borderBottom: '1px solid #E2E8F0',
        paddingLeft: 240,
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = isUnderTab(tab.path)
        const { label, color } = meta[tab.id] ?? { label: tab.id, color: '#2A4F96' }
        return (
          <Link
            key={tab.id}
            href={tab.path}
            title={label}
            className={`gt3-tab${isActive ? ' gt3-tab-active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              width: 168,
              minWidth: 168,
              maxWidth: 168,
              flexShrink: 0,
              borderBottom: '2px solid transparent', // reserva o mesmo espaço de antes — a barra ativa agora é o ::after
              color: isActive ? '#1E253D' : '#6B7A99',
              fontWeight: isActive ? 500 : 400,
              transition: 'background-color var(--duration-gt3) var(--ease-gt3), color var(--duration-gt3) var(--ease-gt3)',
              backgroundColor: isActive ? '#fff' : 'transparent',
              cursor: 'pointer',
              ['--tab-active-color' as string]: color,
            } as React.CSSProperties}
          >
            {tab.id !== 'home' && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: color,
                  flexShrink: 0,
                }}
              />
            )}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
              {label}
            </span>
            {tab.id !== 'home' && (
              <button
                onClick={(e) => closeTab(tab.id, tab.path, e)}
                aria-label={`Fechar ${label}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9CA3AF',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: '0 2px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                }}
              >
                ×
              </button>
            )}
          </Link>
        )
      })}
    </div>
  )
}
