'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'
import { useUser } from '../components/UserContext'

const PAPEL_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  rh: 'RH',
  colaborador: 'Colaborador',
}

export default function PerfilClient() {
  const { user, profile } = useUser()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const supabase = createClient()

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    if (newPassword !== confirmPassword) {
      setStatus('error')
      setMessage('Nova senha e confirmação não coincidem.')
      return
    }
    // Verify current password
    const email = user?.email ?? ''
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (signInError) {
      setStatus('error')
      setMessage('Senha atual incorreta.')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setStatus('error')
      setMessage(updateError.message)
      return
    }

    setStatus('success')
    setMessage('Senha alterada com sucesso.')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const username = profile?.nome ?? user?.email?.split('@')[0].toUpperCase() ?? '—'
  const papel = profile?.papel ? PAPEL_LABELS[profile.papel] ?? profile.papel : '—'
  const initials = username.replace('GT3.', '').slice(0, 2)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Avatar card */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: '28px 32px',
          marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: '#1E3A6E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D1AE6E',
            fontWeight: 700,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#1E293B' }}>{username}</div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 4,
              fontSize: 12,
              fontWeight: 500,
              padding: '2px 10px',
              borderRadius: 999,
              backgroundColor: '#EBF0FB',
              color: '#2A4F96',
            }}
          >
            {papel}
          </div>
        </div>
      </div>

      {/* Password change card */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: '28px 32px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <h2 style={{ margin: '0 0 24px', fontSize: 16, fontWeight: 600, color: '#1E293B' }}>
          Alterar senha
        </h2>

        <form onSubmit={handleChangePassword}>
          {[
            { label: 'Senha atual', value: currentPassword, set: setCurrentPassword },
            { label: 'Nova senha', value: newPassword, set: setNewPassword },
            { label: 'Confirmar nova senha', value: confirmPassword, set: setConfirmPassword },
          ].map(({ label, value, set }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: 6,
                }}
              >
                {label}
              </label>
              <input
                type="password"
                required
                value={value}
                onChange={(e) => set(e.target.value)}
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #D1D5DB',
                  fontSize: 14,
                  color: '#1E293B',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#2A4F96' }}
                onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
              />
            </div>
          ))}

          {message && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                backgroundColor: status === 'success' ? '#F0FFF4' : '#FEF2F2',
                border: `1px solid ${status === 'success' ? '#BBF7D0' : '#FECACA'}`,
                color: status === 'success' ? '#166534' : '#DC2626',
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              padding: '10px 24px',
              backgroundColor: status === 'loading' ? '#9BB3D4' : '#2A4F96',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'loading' ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
