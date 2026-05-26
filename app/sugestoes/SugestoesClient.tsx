'use client'

import { useState, useEffect } from 'react'
import { useUser } from '../components/UserContext'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const SUCCESS = '#16A34A'
const SUCCESS_LIGHT = '#F0FFF4'
const MAX_CHARS = 1000

type Sugestao = {
  id: string
  texto: string
  created_at: string
  autor_id?: string
  lida: boolean
  lida_em: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Vista de envio (colaborador / trainee) ────────────────────────
function SubmitView() {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const charPct = text.length / MAX_CHARS
  const charColor = charPct >= 0.95 ? '#DC2626' : charPct >= 0.8 ? '#D97706' : MUTED

  const inputStyle: React.CSSProperties = {
    width: '100%', borderRadius: 8, border: `1.5px solid ${BORDER}`,
    padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', color: INK,
    background: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  }

  async function handleSubmit() {
    if (!text.trim()) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/sugestoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: text }),
    })
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Erro ao enviar sugestão.')
      setSubmitting(false)
      return
    }
    setText('')
    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div style={{ background: SUCCESS_LIGHT, border: `1px solid #BBF7D0`, borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: SUCCESS, marginBottom: 6 }}>Sugestão enviada com sucesso!</div>
        <div style={{ fontSize: 13, color: '#4ADE80' }}>Obrigado pela contribuição. Sua ideia faz parte da nossa melhoria contínua.</div>
        <button
          onClick={() => { setSubmitted(false); setError('') }}
          style={{
            marginTop: 20, padding: '8px 20px', borderRadius: 8,
            border: `1.5px solid #BBF7D0`, background: 'transparent',
            color: SUCCESS, fontSize: 13, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          Enviar outra sugestão
        </button>
      </div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: '1.4rem' }}>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          💬 Sua sugestão
          <span style={{ fontSize: 11, background: '#FEF2F2', color: '#DC2626', borderRadius: 4, padding: '2px 7px' }}>obrigatório</span>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={6}
          maxLength={MAX_CHARS}
          placeholder="Escreva aqui sua sugestão, ideia ou melhoria para a empresa..."
          style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
          onFocus={e => { e.target.style.borderColor = PRIMARY }}
          onBlur={e => { e.target.style.borderColor = BORDER }}
        />
        <div style={{ fontSize: 12, color: charColor, textAlign: 'right', marginTop: 4 }}>
          {text.length} / {MAX_CHARS}
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: '1.4rem', display: 'flex', alignItems: 'center', gap: 4 }}>
        🔒 Sua sugestão é enviada de forma anônima.
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!text.trim() || submitting}
        style={{
          width: '100%', padding: 12, borderRadius: 8, border: 'none',
          background: text.trim() && !submitting ? PRIMARY : '#CBD5E1',
          color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: text.trim() && !submitting ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit', transition: 'background 0.15s',
        }}
      >
        {submitting ? 'Enviando...' : '✈ Enviar sugestão'}
      </button>
    </>
  )
}

// ── Vista de listagem (gestor / admin) ────────────────────────────
function ListView({ isAdmin }: { isAdmin: boolean }) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  useEffect(() => { fetchList() }, [])

  async function fetchList() {
    setLoading(true)
    setRevealed({})
    const res = await fetch('/api/sugestoes')
    if (res.ok) setSugestoes(await res.json())
    setLoading(false)
  }

  async function handleReveal(id: string) {
    if (revealed[id] !== undefined) return
    const res = await fetch(`/api/sugestoes/${id}/reveal`)
    if (res.ok) {
      const d = await res.json() as { nome: string }
      setRevealed(prev => ({ ...prev, [id]: d.nome }))
    }
  }

  async function handleMarkAsRead(id: string) {
    await fetch(`/api/sugestoes/${id}`, { method: 'PATCH' })
    setSugestoes(prev => prev.map(s => s.id === id ? { ...s, lida: true, lida_em: new Date().toISOString() } : s))
  }

  const novas = sugestoes.filter(s => !s.lida).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>Sugestões</h1>
          {!loading && (
            <p style={{ margin: '3px 0 0', fontSize: 13, color: MUTED }}>
              {sugestoes.length} sugestão{sugestoes.length !== 1 ? 'ões' : ''} recebida{sugestoes.length !== 1 ? 's' : ''}
              {novas > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 600, color: PRIMARY }}>
                  · {novas} nova{novas !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={fetchList}
          style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '56px 0', color: MUTED, fontSize: 14 }}>Carregando...</div>
      ) : sugestoes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0', color: MUTED, fontSize: 14 }}>
          Nenhuma sugestão recebida ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sugestoes.map(s => (
            <div
              key={s.id}
              style={{
                background: '#fff', borderRadius: 12,
                border: `1px solid ${s.lida ? BORDER : '#BFDBFE'}`,
                padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <p style={{ margin: '0 0 12px', fontSize: 14, color: INK, lineHeight: 1.7 }}>
                {s.texto}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                {/* Badge de status */}
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10,
                  background: s.lida ? '#F1F5F9' : PRIMARY_LIGHT,
                  color: s.lida ? MUTED : PRIMARY,
                }}>
                  {s.lida ? 'Lida' : 'Nova'}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Botão marcar como lida */}
                  {!s.lida && (
                    <button
                      onClick={() => handleMarkAsRead(s.id)}
                      style={{
                        background: 'none', border: `1px solid ${BORDER}`,
                        borderRadius: 6, padding: '3px 10px',
                        fontSize: 12, color: MUTED, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLButtonElement).style.color = PRIMARY }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.color = MUTED }}
                    >
                      Marcar como lida
                    </button>
                  )}

                  {/* Data — clicável para admin revelar autor */}
                  {isAdmin ? (
                    revealed[s.id] !== undefined ? (
                      <span style={{ fontSize: 12, color: MUTED, fontFamily: 'monospace' }}>
                        {revealed[s.id]}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleReveal(s.id)}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          fontSize: 12, color: MUTED, fontFamily: 'inherit',
                          cursor: 'pointer', transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = INK }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = MUTED }}
                      >
                        {formatDate(s.created_at)}
                      </button>
                    )
                  ) : (
                    <span style={{ fontSize: 12, color: MUTED }}>{formatDate(s.created_at)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────
export default function SugestoesClient() {
  const { profile } = useUser()
  const isGestorOrAdmin = profile?.papel === 'gestor' || profile?.papel === 'admin'
  const isAdmin = profile?.papel === 'admin'

  if (isGestorOrAdmin) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <ListView isAdmin={isAdmin} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{
        background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`,
        padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.75rem', paddingBottom: '1.25rem', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: PRIMARY_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            💡
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: INK, margin: 0 }}>Caixa de Sugestões</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: '2px 0 0' }}>Sua ideia pode fazer a diferença</p>
          </div>
        </div>
        <SubmitView />
      </div>
    </div>
  )
}
