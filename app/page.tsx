'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MODULES } from './lib/modules'
import PdiCard from './components/PdiCard'
import { useUser } from './components/UserContext'
import type { Role } from './lib/modules'

export default function DashboardPage() {
  const { profile, loading } = useUser()
  const role = (profile?.papel ?? 'colaborador') as Role
  const [moduleNotifs, setModuleNotifs] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!profile) return
    fetch('/api/notificacoes/usuario')
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, number>) => setModuleNotifs(data))
      .catch(() => {})
  }, [profile])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6B7A99', fontSize: 14 }}>
        Carregando...
      </div>
    )
  }

  const pdi = MODULES.find((m) => m.id === 'pdi')

  const dashboardModules = MODULES.filter((m) => {
    if (m.id === 'pdi') return false
    const visible = m.dashboardRoles ?? m.allowedRoles
    return visible.includes(role)
  })

  const showPdi = !!pdi && (pdi.dashboardRoles ?? pdi.allowedRoles).includes(role)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1E253D', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: '#6B7A99', marginTop: 4 }}>
          Bem-vindo ao GT3 Sistema — selecione um módulo abaixo
        </p>
      </div>

      <div className="module-grid">
        {dashboardModules.map((mod) => {
          const hasNotif = (moduleNotifs[mod.id] ?? 0) > 0
          return (
            <div key={mod.id} style={{ position: 'relative' }}>
              {hasNotif && (
                <span style={{
                  position: 'absolute', top: 10, right: 10, zIndex: 1,
                  width: 10, height: 10, borderRadius: '50%',
                  backgroundColor: '#EF4444', border: '2px solid #F4F6FA',
                  pointerEvents: 'none',
                }} />
              )}
              <Link href={mod.path} className="module-card-link">
                <div className="module-card">
                  <div style={{ height: 4, backgroundColor: mod.color }} />
                  <div style={{ padding: 16 }}>
                    <div
                      className="module-card-icon"
                      style={{ backgroundColor: `${mod.color}1A` }}
                    >
                      <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: mod.color }} />
                    </div>
                    <h2 className="module-card-title">{mod.label}</h2>
                    <p className="module-card-desc">{mod.description}</p>
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {showPdi && <PdiCard path={pdi!.path} />}
    </div>
  )
}
