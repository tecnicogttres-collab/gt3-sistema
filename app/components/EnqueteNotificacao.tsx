'use client'

type Props = {
  titulo: string
  onResponderAgora: () => void
  onVerDepois: () => void
}

export default function EnqueteNotificacao({ titulo, onResponderAgora, onVerDepois }: Props) {
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
        <div style={{ fontSize: 42, marginBottom: 12, lineHeight: 1 }}>📊</div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          color: '#2A4F96', marginBottom: 10, textTransform: 'uppercase',
        }}>
          Nova Enquete Disponível
        </div>
        <div style={{
          fontSize: 16, fontWeight: 600, color: '#1E253D',
          marginBottom: 28, lineHeight: 1.4,
        }}>
          {titulo}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onVerDepois}
            style={{
              padding: '10px 22px', borderRadius: 8, border: '1px solid #CBD5E0',
              background: '#fff', color: '#4A5568', fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Ver depois
          </button>
          <button
            onClick={onResponderAgora}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: '#2A4F96', color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A6E' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A4F96' }}
          >
            Responder agora
          </button>
        </div>
      </div>
    </div>
  )
}
