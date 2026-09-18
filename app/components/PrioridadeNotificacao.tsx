'use client'

type Props = {
  empresa: string
  onOk: () => void
}

export default function PrioridadeNotificacao({ empresa, onOk }: Props) {
  return (
    <div
      className="gt3-overlay-fade"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="gt3-toast-in"
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '36px 32px',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 14, lineHeight: 1 }}>⚡</div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#2A4F96',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 10,
          }}
        >
          Nova Prioridade
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#1E293B',
            lineHeight: 1.4,
            marginBottom: 28,
          }}
        >
          {empresa}
        </div>
        <button
          onClick={onOk}
          style={{
            background: '#2A4F96',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 36px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#1E3A6E'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#2A4F96'
          }}
        >
          OK, entendido
        </button>
      </div>
    </div>
  )
}
