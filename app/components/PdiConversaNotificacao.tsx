'use client'

import { useState } from 'react'

type Props = {
  dataConversa: string
  onCiente: () => void
}

export default function PdiConversaNotificacao({ dataConversa, onCiente }: Props) {
  const [checked, setChecked] = useState(false)

  const dt = new Date(dataConversa)
  const data = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '36px 40px',
        maxWidth: 460, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
      }}>
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>📅</div>

        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
          color: '#2A4F96', marginBottom: 10,
          textTransform: 'uppercase', textAlign: 'center',
        }}>
          Conversa de PDI Agendada
        </div>

        <div style={{
          background: '#EBF0FB', borderRadius: 10, padding: '14px 18px',
          marginBottom: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: '#6B7A99', marginBottom: 4 }}>Data e horário</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2340', textTransform: 'capitalize' }}>
            {data}
          </div>
          <div style={{ fontSize: 15, color: '#2A4F96', fontWeight: 600 }}>às {hora}</div>
        </div>

        <div style={{
          background: '#FFFBEB', border: '1px solid #FCD34D',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📝</span>
          <div style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
            <strong>Lembre-se:</strong> após a conversa, preencha sua nova autoavaliação
            no módulo PDI para registrar sua evolução no ciclo atual.
          </div>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', marginBottom: 24, padding: '10px 14px',
          border: `2px solid ${checked ? '#2A4F96' : '#E2E8F0'}`,
          borderRadius: 8, transition: 'border-color 0.15s',
          background: checked ? '#EBF0FB' : '#FAFAFA',
        }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#2A4F96', cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: '#1A2340', fontWeight: checked ? 600 : 400 }}>
            Estou ciente do agendamento e das instruções acima
          </span>
        </label>

        <button
          onClick={onCiente}
          disabled={!checked}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
            background: checked ? '#2A4F96' : '#CBD5E0',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: checked ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          Confirmar ciência
        </button>
      </div>
    </div>
  )
}
