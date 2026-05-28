'use client'

type Props = {
  count: number
  onVerAgora: () => void
  onVerDepois: () => void
}

export default function LembreteNotificacao({ count, onVerAgora, onVerDepois }: Props) {
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
        <div style={{ fontSize: 42, marginBottom: 12, lineHeight: 1 }}>📌</div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          color: '#B85C1A', marginBottom: 10, textTransform: 'uppercase',
        }}>
          Lembretes Pendentes
        </div>
        <div style={{
          fontSize: 16, fontWeight: 600, color: '#1E253D',
          marginBottom: 28, lineHeight: 1.4,
        }}>
          {count === 1
            ? 'Há 1 lembrete vencendo hoje ou em atraso'
            : `Há ${count} lembretes vencendo hoje ou em atraso`}
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
            onClick={onVerAgora}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: '#B85C1A', color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#7A3A0E' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#B85C1A' }}
          >
            Ver agora
          </button>
        </div>
      </div>
    </div>
  )
}
