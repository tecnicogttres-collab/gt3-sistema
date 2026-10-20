'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { perguntasVisiveis, montarRespostas, respostaVazia, type Pergunta, type Respostas } from '../enquetes/condicional'

type Pendente = { id: string; titulo: string }
type Detalhe = { id: string; titulo: string; descricao: string | null; anonima: boolean; perguntas: Pergunta[] }

const COR = '#2A4F96'
const COR_CLARA = '#EBF0FB'
const BORDA = '#E2E8F0'

/** Enquete pendente respondida direto no Dashboard: uma pergunta por vez, envia ao fim e some. */
export default function EnqueteDashboardCard() {
  const router = useRouter()
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [answers, setAnswers] = useState<Respostas>({})
  const [passo, setPasso] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [salva, setSalva] = useState(false)
  const [erro, setErro] = useState('')
  const salvaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const carregar = useCallback(() => {
    fetch('/api/enquetes')
      .then(r => r.ok ? r.json() : [])
      .then((d: Array<Pendente & { status: string; ja_votou: boolean; para_mim: boolean }>) => {
        setPendentes(d.filter(e => e.status === 'active' && e.para_mim && !e.ja_votou).map(e => ({ id: e.id, titulo: e.titulo })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    carregar()
    // Respondida no módulo / nova enquete ativada: o AppShell e o módulo disparam este evento
    window.addEventListener('enquetes:atualizar', carregar)
    const onVis = () => { if (document.visibilityState === 'visible') carregar() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('enquetes:atualizar', carregar)
      document.removeEventListener('visibilitychange', onVis)
      if (salvaTimer.current) clearTimeout(salvaTimer.current)
    }
  }, [carregar])

  const atualId = pendentes[0]?.id ?? null
  useEffect(() => {
    if (!atualId) return
    let cancelado = false
    fetch(`/api/enquetes/${atualId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: Detalhe | null) => {
        if (cancelado) return
        setDetalhe(d)
        setAnswers({})
        setPasso(0)
        setErro('')
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [atualId])

  async function enviar(resps: Respostas) {
    if (!detalhe) return
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch(`/api/enquetes/${detalhe.id}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respostas: montarRespostas(detalhe.perguntas, resps) }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setErro(d.error ?? 'Erro ao salvar a resposta')
        return
      }
      const respondida = detalhe.id
      setDetalhe(null)
      setPendentes(prev => prev.filter(p => p.id !== respondida))
      setSalva(true)
      if (salvaTimer.current) clearTimeout(salvaTimer.current)
      salvaTimer.current = setTimeout(() => setSalva(false), 2200)
      // Tira o pop-up de enquete pendente do AppShell também
      window.dispatchEvent(new Event('enquetes:atualizar'))
    } finally {
      setEnviando(false)
    }
  }

  /** Avança com as respostas já atualizadas (a próxima visível pode depender da resposta dada agora). */
  function avancar(resps: Respostas) {
    if (!detalhe) return
    const vis = perguntasVisiveis(detalhe.perguntas, resps)
    if (passo + 1 < vis.length) setPasso(passo + 1)
    else void enviar(resps)
  }

  const avisoSalva = salva && (
    <div className="gt3-pop-in" style={{ background: '#F0FFF4', borderRadius: 8, borderLeft: '4px solid #16A34A', padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontSize: 13, fontWeight: 600, color: '#15803D' }}>
      ✅ Resposta salva!
    </div>
  )

  const abrirNoModulo = () => detalhe && router.push(`/enquetes?enquete=${detalhe.id}`)

  // Enquete com descrição: a pessoa precisa lê-la antes de responder, então só avisa e leva ao módulo
  if (detalhe && pendentes.length && detalhe.descricao?.trim()) {
    return (
      <>
      {avisoSalva}
      <div style={{ background: '#fff', borderRadius: 8, borderLeft: `4px solid ${COR}`, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COR, marginBottom: 6 }}>
          🗳️ Enquete para responder{pendentes.length > 1 ? ` (1 de ${pendentes.length})` : ''}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1E253D', marginBottom: 6 }}>{detalhe.titulo}</div>
        <div style={{ fontSize: 12, color: '#6B7A99', marginBottom: 10 }}>
          Esta enquete tem instruções que precisam ser lidas antes de responder.
        </div>
        <button onClick={abrirNoModulo} style={{ width: '100%', padding: '7px 12px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: COR, color: '#fff', cursor: 'pointer' }}>
          Responder no módulo →
        </button>
      </div>
      </>
    )
  }

  const visiveis = detalhe ? perguntasVisiveis(detalhe.perguntas, answers) : []
  const atual = visiveis[Math.min(passo, visiveis.length - 1)]
  if (!detalhe || !pendentes.length || !atual) return avisoSalva || null
  const ultima = passo >= visiveis.length - 1
  const resposta = answers[atual.id]
  const podeSeguir = !atual.obrigatoria || !respostaVazia(resposta)

  const botao = (ativo: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    background: ativo ? COR : '#CBD5E1', color: '#fff', cursor: ativo ? 'pointer' : 'not-allowed',
  })

  return (
    <>
    {avisoSalva}
    <div style={{ background: '#fff', borderRadius: 8, borderLeft: `4px solid ${COR}`, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: COR }}>
          🗳️ Enquete{pendentes.length > 1 ? ` (1 de ${pendentes.length})` : ''}
        </span>
        <button
          onClick={abrirNoModulo}
          title="Abrir esta enquete no módulo Enquetes"
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: COR, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
        >
          Ir para o módulo →
        </button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: '#1E253D', marginBottom: 6 }}>{detalhe.titulo}</div>

      {detalhe.anonima ? (
        <div style={{ fontSize: 12, fontWeight: 600, color: '#15803D', background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '4px 8px', marginBottom: 10 }}>
          🔒 Respostas anônimas — ninguém vê quem respondeu o quê.
        </div>
      ) : (
        <div style={{ fontSize: 12, fontWeight: 600, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '4px 8px', marginBottom: 10 }}>
          👤 Respostas identificadas (esta enquete não é anônima).
        </div>
      )}

      {visiveis.length > 1 && (
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
          Pergunta {passo + 1} de {visiveis.length}
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8 }}>
        {atual.texto}
        {atual.obrigatoria && <span style={{ color: '#DC2626', marginLeft: 3 }}>*</span>}
      </div>

      {atual.tipo === 'radio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {atual.opcoes.map(o => (
            <button
              key={o.id}
              disabled={enviando}
              // Múltipla escolha: clicar já responde e segue para a próxima (ou salva, se for a última)
              onClick={() => { const r = { ...answers, [atual.id]: o.id }; setAnswers(r); avancar(r) }}
              style={{
                textAlign: 'left', padding: '6px 10px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
                border: `1.5px solid ${resposta === o.id ? COR : BORDA}`, background: resposta === o.id ? COR_CLARA : '#fff',
                color: '#1E253D', cursor: enviando ? 'wait' : 'pointer',
              }}
            >
              {o.texto}
            </button>
          ))}
        </div>
      )}

      {atual.tipo === 'checkbox' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {atual.opcoes.map(o => {
            const marcadas = Array.isArray(resposta) ? resposta : []
            const marcada = marcadas.includes(o.id)
            return (
              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: `1.5px solid ${marcada ? COR : BORDA}`, background: marcada ? COR_CLARA : '#fff' }}>
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={() => setAnswers(prev => ({ ...prev, [atual.id]: marcada ? marcadas.filter(x => x !== o.id) : [...marcadas, o.id] }))}
                  style={{ accentColor: COR }}
                />
                {o.texto}
              </label>
            )
          })}
        </div>
      )}

      {atual.tipo === 'text' && (
        <textarea
          value={typeof resposta === 'string' ? resposta : ''}
          onChange={e => setAnswers(prev => ({ ...prev, [atual.id]: e.target.value }))}
          rows={3}
          placeholder="Sua resposta..."
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 6, border: `1.5px solid ${BORDA}`, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
        />
      )}

      {erro && <div style={{ marginTop: 8, fontSize: 12, color: '#DC2626' }}>{erro}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
        {passo > 0 ? (
          <button onClick={() => setPasso(passo - 1)} disabled={enviando} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#6B7A99', cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Anterior
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 6 }}>
          {!atual.obrigatoria && atual.tipo !== 'text' && respostaVazia(resposta) && (
            <button onClick={() => avancar(answers)} disabled={enviando} style={{ ...botao(!enviando), background: '#fff', color: '#6B7A99', border: `1px solid ${BORDA}` }}>
              Pular
            </button>
          )}
          {atual.tipo !== 'radio' && (
            <button onClick={() => avancar(answers)} disabled={!podeSeguir || enviando} style={botao(podeSeguir && !enviando)}>
              {enviando ? 'Salvando...' : ultima ? 'Enviar' : 'Próxima'}
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
