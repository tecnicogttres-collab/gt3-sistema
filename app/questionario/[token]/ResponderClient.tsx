'use client'

import { useEffect, useState } from 'react'
import type { Pergunta } from '../../questionarios/types'

// Tela PÚBLICA do respondente — abre sem login, pelo link único do convite.

const PRIMARY = '#2A4F96'
const PRIMARY_SOFT = '#E2E9F6'
const BORDER = '#DCE3EE'
const SURF2 = '#EBF0F9'
const TEXT = '#1C2530'
const MUTED = '#6F7A8C'
const DANGER = '#C53030'

type Dados = {
  titulo: string
  empresa: string
  vinculo: string | null
  disponivel: boolean
  respondido: boolean
  perguntas: Pergunta[]
  total_perguntas: number
}

type Estado =
  | { k: 'carregando' }
  | { k: 'invalido' }
  | { k: 'form'; d: Dados }
  | { k: 'enviado'; d: Dados }

export default function ResponderClient({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>({ k: 'carregando' })
  const [respostas, setRespostas] = useState<Record<string, string | number>>({})
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/questionario-publico/${encodeURIComponent(token)}`)
      .then(async r => {
        if (cancelled) return
        if (!r.ok) { setEstado({ k: 'invalido' }); return }
        setEstado({ k: 'form', d: await r.json() })
      })
      .catch(() => { if (!cancelled) setEstado({ k: 'invalido' }) })
    return () => { cancelled = true }
  }, [token])

  async function enviar(d: Dados) {
    const faltando = d.perguntas.some(q => q.type !== 'texto' && respostas[q.id] == null)
    if (faltando) { setErro('Responda todas as perguntas de nota e de múltipla escolha.'); return }
    setEnviando(true); setErro('')
    try {
      const res = await fetch(`/api/questionario-publico/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respostas }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(body.error ?? 'Não foi possível enviar. Tente novamente.'); return }
      setEstado({ k: 'enviado', d })
    } finally {
      setEnviando(false)
    }
  }

  const topo = (d: Dados | null) => (
    <div style={{ background: PRIMARY, color: '#fff', padding: '18px 22px' }}>
      <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 3, fontWeight: 600 }}>GT3 Consultoria</div>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{d?.titulo ?? 'Questionário'}</div>
      {d && (
        <div style={{ marginTop: 4, fontSize: 12.5, opacity: 0.9 }}>
          {d.empresa} · {d.total_perguntas} pergunta{d.total_perguntas === 1 ? '' : 's'}
        </div>
      )}
    </div>
  )

  const aviso = (icone: string, cor: string, titulo: string, texto: string) => (
    <div style={{ textAlign: 'center', padding: '36px 22px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 46, height: 46, borderRadius: '50%', background: `${cor}22`, color: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>{icone}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>{titulo}</div>
      <div style={{ fontSize: 13, color: MUTED, maxWidth: '34ch', lineHeight: 1.45 }}>{texto}</div>
    </div>
  )

  let conteudo: React.ReactNode
  if (estado.k === 'carregando') {
    conteudo = <>{topo(null)}<div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 14 }}>Carregando…</div></>
  } else if (estado.k === 'invalido') {
    conteudo = <>{topo(null)}{aviso('!', '#B7791F', 'Link inválido', 'Não encontramos este questionário. Confira se o link foi copiado por completo.')}</>
  } else if (estado.k === 'enviado') {
    const d = estado.d
    conteudo = <>{topo(d)}{aviso('✓', '#0B7A0B', 'Resposta registrada', `Obrigado! Sua resposta foi registrada para ${d.empresa}${d.vinculo ? ` (contratante: ${d.vinculo})` : ''}.`)}</>
  } else {
    const d = estado.d
    if (d.respondido) {
      conteudo = <>{topo(d)}{aviso('!', '#B7791F', 'Este link já foi utilizado', 'A resposta deste convite já foi registrada. Cada link aceita uma única resposta.')}</>
    } else if (!d.disponivel) {
      conteudo = <>{topo(d)}{aviso('!', '#B7791F', 'Questionário indisponível', 'Este questionário não está recebendo respostas no momento.')}</>
    } else {
      conteudo = (
        <>
          {topo(d)}
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {d.perguntas.map((q, i) => (
              <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: TEXT }}>{i + 1}. {q.label}</div>
                {q.type === 'escala' && (
                  <>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map(n => {
                        const sel = respostas[q.id] === n
                        return (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={sel}
                            onClick={() => setRespostas(r => ({ ...r, [q.id]: n }))}
                            style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: `1px solid ${sel ? PRIMARY : BORDER}`, background: sel ? PRIMARY : SURF2, color: sel ? '#fff' : '#52514e', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                          >
                            {n}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUTED, marginTop: -3 }}>
                      <span>{q.min}</span><span>{q.max}</span>
                    </div>
                  </>
                )}
                {q.type === 'multipla' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {(q.options ?? []).map(o => {
                      const sel = respostas[q.id] === o
                      return (
                        <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 9, border: `1px solid ${sel ? PRIMARY : BORDER}`, background: sel ? PRIMARY_SOFT : '#fff', borderRadius: 9, padding: '11px 12px', cursor: 'pointer', fontSize: 14, color: TEXT }}>
                          <input type="radio" name={`rq-${q.id}`} checked={sel} onChange={() => setRespostas(r => ({ ...r, [q.id]: o }))} style={{ accentColor: PRIMARY, margin: 0 }} />
                          {o}
                        </label>
                      )
                    })}
                  </div>
                )}
                {q.type === 'texto' && (
                  <textarea
                    rows={3}
                    placeholder="Escreva sua resposta…"
                    value={String(respostas[q.id] ?? '')}
                    onChange={e => setRespostas(r => ({ ...r, [q.id]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', borderRadius: 8, border: `1px solid ${BORDER}`, resize: 'vertical', lineHeight: 1.4 }}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {erro && <div style={{ fontSize: 13, fontWeight: 600, color: DANGER }}>{erro}</div>}
            <button
              onClick={() => void enviar(d)}
              disabled={enviando}
              style={{ width: '100%', padding: 13, borderRadius: 9, border: 'none', background: enviando ? '#94A3B8' : PRIMARY, color: '#fff', fontWeight: 700, fontSize: 14, cursor: enviando ? 'default' : 'pointer' }}
            >
              {enviando ? 'Enviando…' : 'Enviar respostas'}
            </button>
          </div>
        </>
      )
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6FA', padding: '28px 16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 50px -24px rgba(27,58,115,0.35)' }}>
        {conteudo}
      </div>
    </div>
  )
}
