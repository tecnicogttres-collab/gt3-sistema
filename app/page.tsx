'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import PdiCard from './components/PdiCard'
import { useUser } from './components/UserContext'
import { useModules } from './components/ModulesContext'
import type { Role } from './lib/modules'
import DashboardSidebar from './dashboard/DashboardSidebar'

function greeting(profile: ReturnType<typeof useUser>['profile']): string {
  const first = profile?.nome?.trim().split(' ')[0] || ''
  const n = first ? `, ${first}` : ''

  const now = new Date()
  const day = now.getDay() // 0=dom, 1=seg, ..., 5=sex, 6=sáb
  const total = now.getHours() * 60 + now.getMinutes()

  if (day === 0 || day === 6) return `Não seria dia de estar aqui${n}...`

  if (total >= 360 && total < 720)  return day === 1 ? `Boa semana${n}!` : `Bom dia${n}!`
  if (total >= 720 && total < 1080) return `Boa tarde${n}!`
  if (total >= 1080 && total <= 1260) return `Boa noite${n}!`
  return `Essa hora, você aqui${n}!`
}

export default function DashboardPage() {
  const { profile, loading } = useUser()
  const { modules: MODULES } = useModules()
  const role = (profile?.papel ?? 'colaborador') as Role
  const [moduleNotifs, setModuleNotifs] = useState<Record<string, number>>({})
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!profile) return
    fetch('/api/notificacoes/usuario')
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, number>) => setModuleNotifs(data))
      .catch(() => {})
  }, [profile])

  const modulos_permitidos = role === 'admin' ? null : (profile?.modulos_permitidos ?? null)
  const modulos_dashboard = role === 'admin' ? null : (profile?.modulos_dashboard ?? null)

  const dashboardModules = useMemo(() => MODULES.filter((m) => {
    if (m.id === 'pdi') return false
    if (role === 'admin') return (m.dashboardRoles ?? m.allowedRoles).includes(role)
    if (modulos_dashboard !== null) return modulos_dashboard.includes(m.id)
    if (modulos_permitidos !== null) return modulos_permitidos.includes(m.id)
    return (m.dashboardRoles ?? m.allowedRoles).includes(role)
  }), [role, modulos_dashboard, modulos_permitidos, MODULES])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6B7A99', fontSize: 14 }}>
        Carregando...
      </div>
    )
  }

  const pdi = MODULES.find((m) => m.id === 'pdi')

  const showPdi = !!pdi && (
    role === 'admin'
      ? (pdi.dashboardRoles ?? pdi.allowedRoles).includes(role)
      : modulos_dashboard !== null
        ? modulos_dashboard.includes('pdi')
        : modulos_permitidos !== null
          ? modulos_permitidos.includes('pdi')
          : (pdi.dashboardRoles ?? pdi.allowedRoles).includes(role)
  )

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', paddingLeft: 216 }}>
      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 960 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1E253D', margin: 0 }}>
            {greeting(profile)}
          </h1>
          <p style={{ fontSize: 13, color: '#6B7A99', marginTop: 4 }}>
            Bem-vindo ao Sistema Interno GT3 — selecione um módulo abaixo
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
                    </div>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>

        {showPdi && <PdiCard path={pdi!.path} />}
      </div>

      {/* Right panel */}
      <DashboardSidebar role={role} />
    </div>
  )
}
