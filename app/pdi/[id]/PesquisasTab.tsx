'use client'

// Aba "Pesquisas" do PDI: respostas das pesquisas internas identificadas, lidas direto do módulo
// Questionários (/api/pdi/[id]/pesquisas). O colaborador vê só as próprias; gestor/admin, de todos.

import { useEffect, useState } from 'react'
import { perguntaVisivel, valoresResposta, PREFIRO_NAO, PREFIRO_NAO_LABEL, type Pergunta, type ValorResposta } from '../../questionarios/types'

type Pesquisa = {
  id: string
  titulo: string
  situacaoQuestionario: string
  status: 'respondido' | 'enviado' | 'nao_enviado'
  respondido_em: string | null
  enviado_em: string | null
  perguntas: Pergunta[]
  respostas: Record<string, ValorResposta>
}

const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }
const MUTED = '#6B7A99'

function Resposta({ q, v }: { q: Pergunta; v: ValorResposta | undefined }) {
  const vals = valoresResposta(v)
  if (!vals.length) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Sem resposta</span>
  if (vals[0] === PREFIRO_NAO) return <span style={{ color: MUTED, fontStyle: 'italic', fontSize: 13 }}>{PREFIRO_NAO_LABEL}</span>
  if (q.type === 'escala') {
    const n = Number(vals[0])
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} style={{
              width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
              background: i === n ? '#2A4F96' : '#F1F5F9', color: i === n ? '#fff' : '#94A3B8',
            }}>{i}</span>
          ))}
        </div>
        {(q.min || q.max) && <span style={{ fontSize: 11.5, color: MUTED }}>1 = {q.min ?? '—'} · 5 = {q.max ?? '—'}</span>}
      </div>
    )
  }
  if (q.type === 'multipla') {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {vals.map(x => <span key={String(x)} style={{ fontSize: 12.5, fontWeight: 600, background: '#EBF4FF', color: '#1E40AF', borderRadius: 999, padding: '3px 11px' }}>{String(x)}</span>)}
      </div>
    )
  }
  return <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, color: '#1E293B', background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>{String(vals[0])}</div>
}

export default function PesquisasTab({ pdiId, papel }: { pdiId: string; papel: string }) {
  const [dados, setDados] = useState<{ vinculado: boolean; pesquisas: Pesquisa[] } | null>(null)
  const [erro, setErro] = useState('')
  const [aberta, setAberta] = useState<string | null>(null)
  const gestao = papel === 'gestor' || papel === 'admin'

  useEffect(() => {
    let vivo = true
    fetch(`/api/pdi/${pdiId}/pesquisas`)
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error ?? 'Erro ao carregar'); return d })
      .then(d => { if (vivo) { setDados(d); setAberta((d.pesquisas as Pesquisa[]).find(p => p.status === 'respondido')?.id ?? null) } })
      .catch(e => { if (vivo) setErro(e instanceof Error ? e.message : 'Erro ao carregar') })
    return () => { vivo = false }
  }, [pdiId])

  if (erro) return <div style={{ ...CARD, color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ color: MUTED, padding: 20 }}>Carregando pesquisas…</div>
  if (!dados.vinculado) {
    return <div style={{ ...CARD, color: MUTED }}>Este PDI ainda não está ligado a um usuário do sistema, então não há pesquisas para mostrar.</div>
  }
  if (!dados.pesquisas.length) {
    return (
      <div style={{ ...CARD, color: MUTED, textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>📝</div>
        Nenhuma pesquisa interna {gestao ? 'enviada para esta pessoa' : 'enviada para você'} ainda.
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: MUTED, margin: '0 0 14px' }}>
        {gestao
          ? 'Respostas desta pessoa nas pesquisas internas identificadas (vêm do módulo Questionários). A pesquisa anônima nunca aparece aqui.'
          : 'Suas respostas nas pesquisas internas identificadas. Só você, sua liderança e a administração veem estas respostas. A pesquisa anônima nunca aparece aqui.'}
      </p>
      {dados.pesquisas.map(p => {
        const respondida = p.status === 'respondido'
        const aberto = aberta === p.id
        const visiveis = respondida ? p.perguntas.filter(q => perguntaVisivel(q, p.perguntas, p.respostas)) : []
        return (
          <div key={p.id} style={CARD}>
            <div onClick={() => respondida && setAberta(aberto ? null : p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: respondida ? 'pointer' : 'default' }}>
              {respondida && <span style={{ fontSize: 11, color: MUTED, transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>▶</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{p.titulo}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                  {respondida ? `Respondida em ${fmtData(p.respondido_em)} · ${visiveis.length} pergunta(s)`
                    : p.status === 'enviado' ? `Enviada em ${fmtData(p.enviado_em)} · aguardando resposta`
                      : 'Ainda não enviada'}
                </div>
              </div>
              <span style={{
                fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: '3px 11px',
                background: respondida ? '#F0FFF4' : '#FFFBEB', color: respondida ? '#166534' : '#92400E',
              }}>{respondida ? '✔ Respondida' : 'Pendente'}</span>
            </div>
            {respondida && aberto && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                {visiveis.map((q, i) => (
                  <div key={q.id}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>{i + 1}. {q.label}</div>
                    <Resposta q={q} v={p.respostas[q.id]} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
