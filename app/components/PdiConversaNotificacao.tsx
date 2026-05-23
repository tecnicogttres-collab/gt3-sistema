'use client'

type Props = {
  dataConversa: string
  onCiente: () => void
}

export default function PdiConversaNotificacao({ dataConversa, onCiente }: Props) {
  const dt = new Date(dataConversa)
  const data = dt.toLocaleDateString('pt-BR')
  const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
        <div style={{ fontSize: 42, marginBottom: 12 }}>📅</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: '#2A4F96', marginBottom: 8, textTransform: 'uppercase' }}>
          Conversa de PDI Agendada
        </div>
        <div style={{ fontSize: 15, color: '#1A2340', marginBottom: 6, lineHeight: 1.6 }}>
          Sua conversa de PDI foi agendada para<br />
          <strong>{data} às {hora}</strong>
        </div>
        <div style={{ fontSize: 12, color: '#6B7A99', marginBottom: 28 }}>
          Confirme o recebimento abaixo
        </div>
        <button
          onClick={onCiente}
          style={{
            padding: '11px 32px', borderRadius: 8, border: 'none',
            background: '#2A4F96', color: '#fff', fontSize: 14,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          Ciente ✓
        </button>
      </div>
    </div>
  )
}
