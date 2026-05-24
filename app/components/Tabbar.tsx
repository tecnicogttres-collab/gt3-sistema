'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULES } from '../lib/modules'

type Tab = {
  id: string
  label: string
  path: string
  color: string
}

const HOME_TAB: Tab = {
  id: 'home',
  label: 'Dashboard',
  path: '/',
  color: '#2A4F96',
}

export default function Tabbar() {
  const pathname = usePathname()
  const [tabs, setTabs] = useState<Tab[]>([HOME_TAB])

  useEffect(() => {
    if (pathname === '/') return
    const mod = MODULES.find((m) => m.path === pathname)
    if (!mod) return
    const tab: Tab = { id: mod.id, label: mod.label, path: mod.path, color: mod.color }
    setTabs((prev) => {
      if (prev.some((t) => t.path === pathname)) return prev
      return [...prev, tab]
    })
  }, [pathname])

  function closeTab(tabId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setTabs((prev) => prev.filter((t) => t.id !== tabId))
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
        const isActive = tab.path === pathname
        return (
          <Link
            key={tab.id}
            href={tab.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              whiteSpace: 'nowrap',
              borderBottom: `2px solid ${isActive ? tab.color : 'transparent'}`,
              color: isActive ? '#1E253D' : '#6B7A99',
              fontWeight: isActive ? 500 : 400,
              transition: 'all 0.15s',
              backgroundColor: isActive ? '#fff' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {tab.id !== 'home' && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: tab.color,
                  flexShrink: 0,
                }}
              />
            )}
            {tab.label}
            {tab.id !== 'home' && (
              <button
                onClick={(e) => closeTab(tab.id, e)}
                aria-label={`Fechar ${tab.label}`}
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
