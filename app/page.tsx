import Link from 'next/link'
import { MODULES } from './lib/modules'

export default function DashboardPage() {
  const mainModules = MODULES.filter((m) => m.id !== 'pdi')
  const pdi = MODULES.find((m) => m.id === 'pdi')!

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1E253D', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: '#6B7A99', marginTop: 4 }}>
          Bem-vindo ao GT3 Sistema — selecione um módulo abaixo
        </p>
      </div>

      {/* Module cards */}
      <div className="module-grid">
        {mainModules.map((mod) => (
          <Link key={mod.id} href={mod.path} className="module-card-link">
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
        ))}
      </div>

      {/* PDI — featured card */}
      <Link href={pdi.path} className="pdi-card-link">
        <div className="pdi-card">
          <div style={{ height: 4, backgroundColor: '#D1AE6E' }} />
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div className="pdi-icon">
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#D1AE6E' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1E253D', margin: 0 }}>
                  PDI — Plano de Desenvolvimento Individual
                </h2>
                <span className="pdi-badge">Destaque</span>
              </div>
              <p style={{ fontSize: 13, color: '#6B7A99', margin: 0, lineHeight: 1.5 }}>
                Acompanhe o desenvolvimento individual de Natália e Marina — metas, ações e prazos.
              </p>
            </div>
            <span style={{ fontSize: 22, color: '#D1AE6E', fontWeight: 300 }}>→</span>
          </div>
        </div>
      </Link>
    </div>
  )
}
