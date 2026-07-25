'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

function toEmail(usuario: string): string {
  const nome = usuario.trim().replace(/^GT3\./i, '').toLowerCase()
  return `gt3.${nome}@gt3.internal`
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7A99" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7A99" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.7 19.7 0 0 1 4.22-5.64M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a19.7 19.7 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  )
}

export default function LoginClient() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function checkCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))
  }

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
        position: 'relative',
      }}
    >
      <img src="/bg-login.jpeg" alt="" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -1 }} />
      {/* overlay escuro sutil para legibilidade */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 30, 60, 0.45)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />

      <div
        style={{
          position: 'relative', zIndex: 1,
          width: 380,
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderRadius: 16,
          padding: '40px 36px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/logo-sidebar.jpeg"
            alt="GT3"
            style={{ height: 52, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 16px', borderRadius: 6 }}
          />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1E293B' }}>
            Sistema Interno
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
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={checkCaps}
                onKeyUp={checkCaps}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 40px 10px 12px', borderRadius: 8,
                  border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B',
                  outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#2A4F96' }}
                onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
              />
              <span
                onMouseEnter={() => setShowPassword(true)}
                onMouseLeave={() => setShowPassword(false)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}
              >
                <EyeIcon open={showPassword} />
              </span>
            </div>
            {capsOn && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B45309' }}>
                ⚠ Caps Lock está ativado
              </p>
            )}
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
