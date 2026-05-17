import Link from 'next/link'
import { MODULES } from './lib/modules'
import PdiCard from './components/PdiCard'

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
      <PdiCard path={pdi.path} />
    </div>
  )
}
