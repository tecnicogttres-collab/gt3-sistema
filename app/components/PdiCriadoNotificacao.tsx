'use client'

type Props = {
  onVerAgora: () => void
}

export default function PdiCriadoNotificacao({ onVerAgora }: Props) {
  return (
    <div className="gt3-overlay-fade" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="gt3-toast-in" style={{
        background: '#fff', borderRadius: 16, padding: '36px 40px',
        maxWidth: 420, width: '100%', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        margin: '0 16px',
      }}>
        <div style={{ fontSize: 42, marginBottom: 12, lineHeight: 1 }}>📋</div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          color: '#2A4F96', marginBottom: 10, textTransform: 'uppercase',
        }}>
          Plano de Desenvolvimento Individual
        </div>
        <div style={{
          fontSize: 17, fontWeight: 700, color: '#1E253D',
          marginBottom: 10,
        }}>
          Seu PDI foi criado
        </div>
        <div style={{
          fontSize: 13, color: '#6B7A99', marginBottom: 28, lineHeight: 1.65,
        }}>
          Seu Plano de Desenvolvimento Individual foi criado.
          Acesse para começar o preenchimento.
        </div>
        <button
          onClick={onVerAgora}
          style={{
            width: '100%', padding: '12px 32px', borderRadius: 8, border: 'none',
            background: '#2A4F96', color: '#fff', fontSize: 14,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A6E' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A4F96' }}
        >
          Ver agora
        </button>
      </div>
    </div>
  )
}
