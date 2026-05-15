'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

function toEmail(usuario: string): string {
  const nome = usuario.trim().replace(/^GT3\./i, '').toLowerCase()
  return `gt3.${nome}@gt3.internal`
}

export default function LoginClient() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(usuario),
      password,
    })

    if (error) {
      setError('Usuário ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F4F6FA',
      }}
    >
      <div
        style={{
          width: 380,
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: '40px 36px',
          boxShadow: '0 4px 24px rgba(42,79,150,0.10)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: '#1E3A6E',
              marginBottom: 16,
            }}
          >
            <span style={{ color: '#D1AE6E', fontWeight: 800, fontSize: 20 }}>GT3</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1E293B' }}>
            GT3 Sistema
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6B7A99' }}>
            Entre com sua conta
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Usuário
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="GT3.NOME"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#2A4F96' }}
              onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Senha
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#2A4F96' }}
              onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16, padding: '10px 12px', borderRadius: 8,
                backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                fontSize: 13, color: '#DC2626',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
              backgroundColor: loading ? '#9BB3D4' : '#2A4F96',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
