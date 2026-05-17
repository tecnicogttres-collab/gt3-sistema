'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useUser } from './UserContext'

export default function PdiCard({ path }: { path: string }) {
  const { profile } = useUser()
  const [hasNotif, setHasNotif] = useState(false)

  useEffect(() => {
    if (!profile || profile.papel !== 'colaborador') return
    fetch('/api/pdi/notificacoes')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(data => setHasNotif((data.count ?? 0) > 0))
      .catch(() => {})
  }, [profile])

  return (
    <Link href={path} className="pdi-card-link">
      <div className="pdi-card">
        <div style={{ height: 4, backgroundColor: '#D1AE6E' }} />
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="pdi-icon" style={{ position: 'relative' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#D1AE6E' }} />
            {hasNotif && (
              <span style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                border: '2px solid #fff',
              }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1E253D', margin: 0 }}>
                PDI — Plano de Desenvolvimento Individual
              </h2>
              <span className="pdi-badge">Destaque</span>
            </div>
            <p style={{ fontSize: 13, color: '#6B7A99', margin: 0, lineHeight: 1.5 }}>
              Acompanhe o seu desenvolvimento individual — metas, ações e prazos.
            </p>
          </div>
          <span style={{ fontSize: 22, color: '#D1AE6E', fontWeight: 300 }}>→</span>
        </div>
      </div>
    </Link>
  )
}
