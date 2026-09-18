'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '../components/UserContext'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const BG_PAGE = '#F4F6FA'
const SUCCESS = '#16A34A'
const SUCCESS_LIGHT = '#F0FFF4'

// ─── Types ─────────────────────────────────────────────────────────────────────

type EnqueteItem = {
  id: string
  titulo: string
  descricao: string | null
  encerramento: string | null
  publico_alvo: string
  status: 'draft' | 'active' | 'closed'
  anonima: boolean
  permitir_alterar_voto: boolean
  mostrar_resultados_parciais: boolean
  criado_em: string
  total_perguntas: number
  total_respostas: number
  ja_votou: boolean
}

type Opcao = { id: string; ordem: number; texto: string }
type Pergunta = {
  id: string
  ordem: number
  texto: string
  tipo: 'text' | 'radio' | 'checkbox'
  obrigatoria: boolean
  opcoes: Opcao[]
}
type EnqueteDetail = EnqueteItem & {
  perguntas: Pergunta[]
  minhas_respostas: Array<{ pergunta_id: string; opcao_id: string | null; texto_livre: string | null }>
}

type ResultadoPergunta = {
  pergunta_id: string
  texto: string
  tipo: string
  total_respostas?: number
  opcoes?: Array<{ id: string; texto: string; votos: number }>
  respostas_texto?: string[]
}
type Resultados = { total_voters: number; results: ResultadoPergunta[] }

type FormPergunta = {
  texto: string
  tipo: 'text' | 'radio' | 'checkbox'
  obrigatoria: boolean
  opcoes: string[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function statusBadge(status: string): { label: string; color: string; bg: string } {
  if (status === 'draft') return { label: 'Rascunho', color: '#6B7A99', bg: '#F1F5F9' }
  if (status === 'active') return { label: 'Ativa', color: '#16A34A', bg: '#F0FFF4' }
  return { label: 'Encerrada', color: '#DC2626', bg: '#FEF2F2' }
}

const INPUT: React.CSSProperties = {
  width: '100%', borderRadius: 8, border: `1.5px solid ${BORDER}`,
  padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', color: INK,
  background: '#fff', outline: 'none', boxSizing: 'border-box',
}

// ─── Resultados View ───────────────────────────────────────────────────────────

function ResultadosView({ enqueteId, titulo, onBack }: { enqueteId: string; titulo: string; onBack: () => void }) {
  const [data, setData] = useState<Resultados | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/enquetes/${enqueteId}/resultados`)
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? 'Erro')))
      .then(setData)
      .catch((e: unknown) => setError(typeof e === 'string' ? e : 'Erro ao carregar resultados'))
      .finally(() => setLoading(false))
  }, [enqueteId])

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: '0 0 16px', fontSize: 13, fontFamily: 'inherit' }}>
        ← Voltar
      </button>
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: '24px 28px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: INK }}>{titulo}</h2>
        {loading ? (
          <div style={{ color: MUTED, fontSize: 14, padding: '32px 0', textAlign: 'center' }}>Carregando...</div>
        ) : error ? (
          <div style={{ color: '#DC2626', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>{error}</div>
        ) : data ? (
          <>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: MUTED }}>
              {data.total_voters} participante{data.total_voters !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {data.results.map((r, i) => (
                <div key={r.pergunta_id} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none', paddingTop: i > 0 ? 24 : 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 14 }}>{i + 1}. {r.texto}</div>
                  {r.tipo === 'text' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(r.respostas_texto ?? []).length === 0
                        ? <span style={{ fontSize: 13, color: MUTED }}>Nenhuma resposta.</span>
                        : (r.respostas_texto ?? []).map((t, j) => (
                          <div key={j} style={{ background: BG_PAGE, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: INK }}>{t}</div>
                        ))
                      }
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(r.opcoes ?? []).map(o => {
                        const total = (r.opcoes ?? []).reduce((acc, x) => acc + x.votos, 0)
                        const pct = total > 0 ? Math.round((o.votos / total) * 100) : 0
                        return (
                          <div key={o.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                              <span style={{ color: INK }}>{o.texto}</span>
                              <span style={{ color: MUTED, fontWeight: 600 }}>{o.votos} voto{o.votos !== 1 ? 's' : ''} ({pct}%)</span>
                            </div>
                            <div style={{ background: BORDER, borderRadius: 4, height: 8, overflow: 'hidden' }}>
                              <div style={{ background: PRIMARY, height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.5s ease' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── Vote View ─────────────────────────────────────────────────────────────────

function VoteView({ enqueteId, onBack, onVoted }: { enqueteId: string; onBack: () => void; onVoted: () => void }) {
  const [enquete, setEnquete] = useState<EnqueteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/enquetes/${enqueteId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: EnqueteDetail | null) => {
        if (!d) return
        setEnquete(d)
        if (d.ja_votou && d.permitir_alterar_voto) {
          const pre: Record<string, string | string[]> = {}
          d.perguntas.forEach(p => {
            const resps = d.minhas_respostas.filter(r => r.pergunta_id === p.id)
            if (p.tipo === 'text') pre[p.id] = resps[0]?.texto_livre ?? ''
            else if (p.tipo === 'radio') pre[p.id] = resps[0]?.opcao_id ?? ''
            else pre[p.id] = resps.map(r => r.opcao_id ?? '').filter(Boolean)
          })
          setAnswers(pre)
        }
      })
      .finally(() => setLoading(false))
  }, [enqueteId])

  async function handleSubmit() {
    if (!enquete) return
    setError('')

    for (const p of enquete.perguntas) {
      if (!p.obrigatoria) continue
      const ans = answers[p.id]
      const empty = !ans || (Array.isArray(ans) ? ans.length === 0 : !String(ans).trim())
      if (empty) { setError(`Por favor, responda: "${p.texto}"`); return }
    }

    setSubmitting(true)
    const respostas: Array<{ pergunta_id: string; opcao_id?: string; texto_livre?: string }> = []

    for (const p of enquete.perguntas) {
      const ans = answers[p.id]
      if (p.tipo === 'text') {
        if (typeof ans === 'string' && ans.trim()) respostas.push({ pergunta_id: p.id, texto_livre: ans.trim() })
      } else if (p.tipo === 'radio') {
        if (typeof ans === 'string' && ans) respostas.push({ pergunta_id: p.id, opcao_id: ans })
      } else {
        (Array.isArray(ans) ? ans : []).forEach(oid => respostas.push({ pergunta_id: p.id, opcao_id: oid }))
      }
    }

    const res = await fetch(`/api/enquetes/${enqueteId}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respostas }),
    })

    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Erro ao enviar')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
    onVoted()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '56px 0', color: MUTED }}>Carregando...</div>
  if (!enquete) return <div style={{ textAlign: 'center', padding: '56px 0', color: MUTED }}>Enquete não encontrada.</div>

  if (submitted) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ background: SUCCESS_LIGHT, border: `1px solid #BBF7D0`, borderRadius: 16, padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: SUCCESS, marginBottom: 8 }}>Resposta registrada!</div>
          <div style={{ fontSize: 14, color: '#4ADE80', marginBottom: 24 }}>Obrigado por participar.</div>
          <button onClick={onBack} style={{ padding: '8px 24px', borderRadius: 8, border: `1.5px solid #BBF7D0`, background: 'transparent', color: SUCCESS, fontSize: 14, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
            Voltar às enquetes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 20px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: '0 0 16px', fontSize: 13, fontFamily: 'inherit' }}>
        ← Voltar
      </button>
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: '24px 28px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: INK }}>{enquete.titulo}</h2>
        {enquete.descricao && <p style={{ margin: '0 0 16px', fontSize: 14, color: MUTED }}>{enquete.descricao}</p>}
        {enquete.anonima && (
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
            🔒 Suas respostas são anônimas.
          </div>
        )}
        {enquete.ja_votou && (
          <div style={{ background: PRIMARY_LIGHT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: PRIMARY, marginBottom: 20 }}>
            Você já respondeu esta enquete.{enquete.permitir_alterar_voto ? ' Pode alterar sua resposta abaixo.' : ''}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {enquete.perguntas.map((p, i) => (
            <div key={p.id}>
              <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 10 }}>
                {i + 1}. {p.texto}
                {p.obrigatoria && <span style={{ color: '#DC2626', marginLeft: 4 }}>*</span>}
              </div>
              {p.tipo === 'text' ? (
                <textarea
                  value={(answers[p.id] as string) ?? ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [p.id]: e.target.value }))}
                  rows={3}
                  placeholder="Sua resposta..."
                  style={{ ...INPUT, resize: 'none' }}
                  onFocus={e => { e.target.style.borderColor = PRIMARY }}
                  onBlur={e => { e.target.style.borderColor = BORDER }}
                />
              ) : p.tipo === 'radio' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {p.opcoes.map(o => {
                    const checked = answers[p.id] === o.id
                    return (
                      <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${checked ? PRIMARY : BORDER}`, background: checked ? PRIMARY_LIGHT : '#fff', transition: 'all 0.15s' }}>
                        <input type="radio" name={p.id} value={o.id} checked={checked} onChange={() => setAnswers(prev => ({ ...prev, [p.id]: o.id }))} style={{ accentColor: PRIMARY }} />
                        <span style={{ fontSize: 14, color: INK }}>{o.texto}</span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {p.opcoes.map(o => {
                    const selected = (answers[p.id] as string[]) ?? []
                    const checked = selected.includes(o.id)
                    return (
                      <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${checked ? PRIMARY : BORDER}`, background: checked ? PRIMARY_LIGHT : '#fff', transition: 'all 0.15s' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const cur = (answers[p.id] as string[]) ?? []
                            setAnswers(prev => ({ ...prev, [p.id]: checked ? cur.filter(x => x !== o.id) : [...cur, o.id] }))
                          }}
                          style={{ accentColor: PRIMARY }}
                        />
                        <span style={{ fontSize: 14, color: INK }}>{o.texto}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 20, padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ marginTop: 24, width: '100%', padding: 12, borderRadius: 8, border: 'none', background: submitting ? '#CBD5E1' : PRIMARY, color: '#fff', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {submitting ? 'Enviando...' : enquete.ja_votou ? 'Alterar resposta' : 'Enviar resposta'}
        </button>
      </div>
    </div>
  )
}

// ─── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [encerramento, setEncerramento] = useState('')
  const [publicoAlvo, setPublicoAlvo] = useState('todos')
  const [statusVal, setStatusVal] = useState<'active' | 'draft'>('active')
  const [anonima, setAnonima] = useState(true)
  const [permitirAlterar, setPermitirAlterar] = useState(true)
  const [mostrarParciais, setMostrarParciais] = useState(false)
  const [perguntas, setPerguntas] = useState<FormPergunta[]>([{ texto: '', tipo: 'radio', obrigatoria: false, opcoes: ['', ''] }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updatePerg(i: number, field: keyof FormPergunta, value: unknown) {
    setPerguntas(prev => prev.map((p, j) => j === i ? { ...p, [field]: value } : p))
  }

  async function handleSave() {
    if (!titulo.trim()) { setError('Título obrigatório'); return }
    const validPergs = perguntas.filter(p => p.texto.trim())
    if (validPergs.length === 0) { setError('Adicione pelo menos uma pergunta'); return }
    setSaving(true); setError('')

    const res = await fetch('/api/enquetes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        encerramento: encerramento || null,
        publico_alvo: publicoAlvo,
        status: statusVal,
        anonima,
        permitir_alterar_voto: permitirAlterar,
        mostrar_resultados_parciais: mostrarParciais,
        perguntas: validPergs.map(p => ({
          texto: p.texto.trim(),
          tipo: p.tipo,
          obrigatoria: p.obrigatoria,
          opcoes: p.tipo !== 'text' ? p.opcoes.filter(o => o.trim()) : [],
        })),
      }),
    })

    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Erro ao criar')
      setSaving(false)
      return
    }
    onCreated()
  }

  return (
    <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
      <div className="gt3-drop-in" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, padding: '28px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>Nova Enquete</h2>
          <button onClick={onClose} className="gt3-close-btn" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: MUTED, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>TÍTULO *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Pesquisa de clima organizacional" style={INPUT} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = BORDER} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>DESCRIÇÃO</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} placeholder="Contexto ou instruções para os participantes..." style={{ ...INPUT, resize: 'none' }} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = BORDER} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>ENCERRAMENTO</label>
              <input type="date" value={encerramento} onChange={e => setEncerramento(e.target.value)} style={INPUT} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>PÚBLICO-ALVO</label>
              <select value={publicoAlvo} onChange={e => setPublicoAlvo(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                <option value="todos">Todos</option>
                <option value="colaboradores">Colaboradores</option>
                <option value="trainees">Trainees</option>
                <option value="gestores">Gestores</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>STATUS INICIAL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['active', 'draft'] as const).map(s => (
                <button key={s} onClick={() => setStatusVal(s)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${statusVal === s ? PRIMARY : BORDER}`, background: statusVal === s ? PRIMARY_LIGHT : '#fff', color: statusVal === s ? PRIMARY : MUTED, fontSize: 13, fontWeight: statusVal === s ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {s === 'active' ? 'Ativa' : 'Rascunho'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>OPÇÕES</label>
            {([
              ['anonima', 'Respostas anônimas', anonima, setAnonima],
              ['alterar', 'Permitir alterar voto', permitirAlterar, setPermitirAlterar],
              ['parciais', 'Mostrar resultados antes de encerrar', mostrarParciais, setMostrarParciais],
            ] as [string, string, boolean, (v: boolean) => void][]).map(([key, label, val, set]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: INK }}>
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ accentColor: PRIMARY, width: 14, height: 14 }} />
                {label}
              </label>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 10 }}>PERGUNTAS</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {perguntas.map((p, i) => (
                <div key={i} style={{ background: BG_PAGE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input value={p.texto} onChange={e => updatePerg(i, 'texto', e.target.value)} placeholder={`Pergunta ${i + 1}`} style={{ ...INPUT, flex: 1 }} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = BORDER} />
                    {perguntas.length > 1 && (
                      <button onClick={() => setPerguntas(prev => prev.filter((_, j) => j !== i))} style={{ padding: '0 10px', borderRadius: 8, border: `1px solid #FECACA`, background: '#FEF2F2', color: '#DC2626', fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={p.tipo} onChange={e => updatePerg(i, 'tipo', e.target.value)} style={{ borderRadius: 6, border: `1px solid ${BORDER}`, padding: '5px 8px', fontSize: 12, color: INK, background: '#fff', cursor: 'pointer' }}>
                      <option value="radio">Múltipla escolha</option>
                      <option value="checkbox">Caixas de seleção</option>
                      <option value="text">Texto livre</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: MUTED, cursor: 'pointer' }}>
                      <input type="checkbox" checked={p.obrigatoria} onChange={e => updatePerg(i, 'obrigatoria', e.target.checked)} style={{ accentColor: PRIMARY }} />
                      Obrigatória
                    </label>
                  </div>
                  {(p.tipo === 'radio' || p.tipo === 'checkbox') && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {p.opcoes.map((o, oi) => (
                        <div key={oi} style={{ display: 'flex', gap: 6 }}>
                          <input
                            value={o}
                            onChange={e => updatePerg(i, 'opcoes', p.opcoes.map((x, k) => k === oi ? e.target.value : x))}
                            placeholder={`Opção ${oi + 1}`}
                            style={{ ...INPUT, flex: 1, padding: '6px 10px', fontSize: 13 }}
                            onFocus={e => e.target.style.borderColor = PRIMARY}
                            onBlur={e => e.target.style.borderColor = BORDER}
                          />
                          {p.opcoes.length > 2 && (
                            <button onClick={() => updatePerg(i, 'opcoes', p.opcoes.filter((_, k) => k !== oi))} style={{ padding: '0 8px', borderRadius: 6, border: `1px solid #FECACA`, background: '#FEF2F2', color: '#DC2626', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => updatePerg(i, 'opcoes', [...p.opcoes, ''])} style={{ alignSelf: 'flex-start', background: 'none', border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: MUTED, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Opção
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setPerguntas(prev => [...prev, { texto: '', tipo: 'radio', obrigatoria: false, opcoes: ['', ''] }])} style={{ marginTop: 10, width: '100%', background: 'none', border: `1.5px dashed ${BORDER}`, borderRadius: 8, padding: '8px 0', fontSize: 13, color: MUTED, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Adicionar pergunta
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: MUTED, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 11, borderRadius: 8, border: 'none', background: saving ? '#CBD5E1' : PRIMARY, color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Salvando...' : 'Criar enquete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

type View =
  | { mode: 'list' }
  | { mode: 'vote'; id: string }
  | { mode: 'results'; id: string; titulo: string }

export default function EnquetesClient() {
  const { profile } = useUser()
  const isGestorAdmin = profile?.papel === 'gestor' || profile?.papel === 'admin'

  const [enquetes, setEnquetes] = useState<EnqueteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>({ mode: 'list' })
  const [showCreate, setShowCreate] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft' | 'closed'>('all')

  const fetchList = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/enquetes')
    if (res.ok) setEnquetes(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  async function handleActivate(id: string) {
    await fetch(`/api/enquetes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) })
    fetchList()
  }

  async function handleClose(id: string) {
    await fetch(`/api/enquetes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'closed' }) })
    fetchList()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta enquete? Todas as respostas serão perdidas.')) return
    await fetch(`/api/enquetes/${id}`, { method: 'DELETE' })
    fetchList()
  }

  if (view.mode === 'vote') return <VoteView enqueteId={view.id} onBack={() => { setView({ mode: 'list' }); fetchList() }} onVoted={fetchList} />
  if (view.mode === 'results') return <ResultadosView enqueteId={view.id} titulo={view.titulo} onBack={() => setView({ mode: 'list' })} />

  const filtered = isGestorAdmin && filterStatus !== 'all'
    ? enquetes.filter(e => e.status === filterStatus)
    : enquetes

  return (
    <div style={{ padding: '24px 20px', maxWidth: 760, margin: '0 auto' }}>
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchList() }} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK }}>Enquetes</h1>
          {!loading && <p style={{ margin: '3px 0 0', fontSize: 13, color: MUTED }}>{enquetes.length} enquete{enquetes.length !== 1 ? 's' : ''}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchList} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Atualizar
          </button>
          {isGestorAdmin && (
            <button onClick={() => setShowCreate(true)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Nova enquete
            </button>
          )}
        </div>
      </div>

      {/* Filtro de status (gestor/admin) */}
      {isGestorAdmin && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['all', 'active', 'draft', 'closed'] as const).map(s => {
            const labels = { all: 'Todas', active: 'Ativas', draft: 'Rascunhos', closed: 'Encerradas' }
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterStatus === s ? PRIMARY : BORDER}`, background: filterStatus === s ? PRIMARY_LIGHT : '#fff', color: filterStatus === s ? PRIMARY : MUTED, fontSize: 12, fontWeight: filterStatus === s ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {labels[s]}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '56px 0', color: MUTED, fontSize: 14 }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0', color: MUTED, fontSize: 14 }}>
          {enquetes.length === 0 ? 'Nenhuma enquete disponível.' : 'Nenhuma enquete neste filtro.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(e => {
            const st = statusBadge(e.status)
            const expired = e.encerramento && new Date(e.encerramento) < new Date()
            const canVote = !isGestorAdmin && e.status === 'active' && (!e.ja_votou || e.permitir_alterar_voto)
            const canSeeResults = isGestorAdmin || (e.ja_votou && e.mostrar_resultados_parciais) || e.status === 'closed'
            return (
              <div key={e.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: INK }}>{e.titulo}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                      {e.ja_votou && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#F0FFF4', color: SUCCESS }}>✓ Respondida</span>}
                      {!e.ja_votou && e.status === 'active' && !isGestorAdmin && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#FFF7ED', color: '#D97706' }}>Pendente</span>
                      )}
                    </div>
                    {e.descricao && <p style={{ margin: '0 0 6px', fontSize: 13, color: MUTED }}>{e.descricao}</p>}
                    <div style={{ fontSize: 12, color: MUTED, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{e.total_perguntas} pergunta{e.total_perguntas !== 1 ? 's' : ''}</span>
                      <span>{e.total_respostas} resposta{e.total_respostas !== 1 ? 's' : ''}</span>
                      {e.encerramento && <span>Encerra: {formatDate(e.encerramento)}</span>}
                      {expired && e.status === 'active' && <span style={{ color: '#DC2626' }}>Prazo vencido</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {canVote && (
                      <button onClick={() => setView({ mode: 'vote', id: e.id })} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {e.ja_votou ? 'Alterar' : 'Responder'}
                      </button>
                    )}
                    {canSeeResults && (
                      <button onClick={() => setView({ mode: 'results', id: e.id, titulo: e.titulo })} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Resultados
                      </button>
                    )}
                    {isGestorAdmin && e.status === 'draft' && (
                      <button onClick={() => handleActivate(e.id)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid #BBF7D0`, background: '#F0FFF4', color: SUCCESS, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Ativar
                      </button>
                    )}
                    {isGestorAdmin && e.status === 'active' && (
                      <button onClick={() => handleClose(e.id)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid #FECACA`, background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Encerrar
                      </button>
                    )}
                    {isGestorAdmin && (
                      <button onClick={() => handleDelete(e.id)} title="Excluir" style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: '#DC2626', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
