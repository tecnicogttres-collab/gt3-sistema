'use client'

import { useState } from 'react'

type Props = {
  count: number
  onVerAgora: () => void
  onAdiar: (ateIso: string) => void
}

function addDaysIso(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export default function LembreteNotificacao({ count, onVerAgora, onAdiar }: Props) {
  const [personalizado, setPersonalizado] = useState(false)
  const [dataCustom, setDataCustom] = useState(addDaysIso(1))

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
          marginBottom: 24, lineHeight: 1.4,
        }}>
          {count === 1
            ? 'Há 1 lembrete vencendo hoje ou em atraso'
            : `Há ${count} lembretes vencendo hoje ou em atraso`}
        </div>

        <button
          onClick={onVerAgora}
          style={{
            width: '100%', padding: '11px 22px', borderRadius: 8, border: 'none',
            background: '#B85C1A', color: '#fff', fontSize: 14,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#7A3A0E' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#B85C1A' }}
        >
          Ver agora
        </button>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 8 }}>
          Ou adiar este aviso por
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={() => onAdiar(addDaysIso(1))}
            style={{ flex: 1, padding: '9px 10px', borderRadius: 8, border: '1px solid #CBD5E0', background: '#fff', color: '#4A5568', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            1 dia
          </button>
          <button
            onClick={() => onAdiar(addDaysIso(7))}
            style={{ flex: 1, padding: '9px 10px', borderRadius: 8, border: '1px solid #CBD5E0', background: '#fff', color: '#4A5568', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            7 dias
          </button>
          <button
            onClick={() => setPersonalizado(v => !v)}
            style={{
              flex: 1, padding: '9px 10px', borderRadius: 8,
              border: `1px solid ${personalizado ? '#B85C1A' : '#CBD5E0'}`,
              background: personalizado ? '#FFF8F0' : '#fff', color: personalizado ? '#B85C1A' : '#4A5568',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: personalizado ? 600 : 400,
            }}
          >
            Personalizado
          </button>
        </div>

        {personalizado && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
            <input
              type="date"
              value={dataCustom}
              min={addDaysIso(1)}
              onChange={e => setDataCustom(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13, fontFamily: 'inherit', color: '#1E253D' }}
            />
            <button
              onClick={() => onAdiar(dataCustom)}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#B85C1A', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Adiar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
