'use client'

type Props = {
  ataId: string
  data: string
  titulo: string | null
  onLerAgora: (ataId: string) => void
  onVerDepois: () => void
}

export default function AtaNotificacao({ ataId, data, titulo, onLerAgora, onVerDepois }: Props) {
  const label = titulo?.trim() || `Ata de ${data}`
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '36px 40px',
        maxWidth: 420, width: '100%', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
      }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: '#5B8DEF', marginBottom: 8, textTransform: 'uppercase' }}>
          Nova Ata Disponível
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1A2340', marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: '#6B7A99', marginBottom: 28 }}>{data}</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onVerDepois}
            style={{
              padding: '10px 22px', borderRadius: 8, border: '1px solid #CBD5E0',
              background: '#fff', color: '#4A5568', fontSize: 14, cursor: 'pointer',
            }}
          >
            Ver depois
          </button>
          <button
            onClick={() => onLerAgora(ataId)}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: '#5B8DEF', color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Ler agora
          </button>
        </div>
      </div>
    </div>
  )
}
