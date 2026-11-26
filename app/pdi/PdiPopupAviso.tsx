'use client'

// Pop-ups do PDI. Montado no AppShell (como o aviso da camada 3 da Custo de Operação).
// Mostra, um de cada vez, os pop-ups configurados pela gestão no PDI da pessoa cuja
// abertura está em vigor e ainda não foi respondida. "Agora não" (se permitido) adia
// pelo tempo configurado, só nesta sessão. Não gera notificação nem e-mail.

import { useCallback, useEffect, useState } from 'react'
import { PopupFormulario, type PerguntaComItens, type Valores } from './popup-ui'
import { fmtQuando } from '../lib/pdi-popup'
import './[id]/acompanhamento/pdi.css'

type Pendente = {
  id: string; titulo: string; intro: string; icone: string; cor: string
  comportamento: { adiar: boolean; adiar_min: number }
  ocorrencia: string; fecha: string; perguntas: PerguntaComItens[]
}

const CHAVE = 'pdi_popup_adiado'
const lerAdiados = (): Record<string, number> => { try { return JSON.parse(sessionStorage.getItem(CHAVE) || '{}') } catch { return {} } }

export default function PdiPopupAviso() {
  const [lista, setLista] = useState<Pendente[]>([])
  const [valores, setValores] = useState<Valores>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState<Pendente | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/pdi/popup')
      if (r.ok) setLista(((await r.json()) as { pendentes: Pendente[] }).pendentes ?? [])
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    const t0 = setTimeout(() => { void carregar() }, 4000)
    const t1 = setInterval(() => { void carregar() }, 5 * 60_000) // aleatórios abrem em qualquer minuto da janela
    const t2 = setInterval(() => setAgora(Date.now()), 30_000)
    return () => { clearTimeout(t0); clearInterval(t1); clearInterval(t2) }
  }, [carregar])

  const adiados = lerAdiados()
  const atual = ok ?? lista.find(p => (adiados[`${p.id}|${p.ocorrencia}`] ?? 0) <= agora)
  if (!atual) return null

  function adiar() {
    const a = lerAdiados()
    a[`${atual!.id}|${atual!.ocorrencia}`] = Date.now() + atual!.comportamento.adiar_min * 60_000
    try { sessionStorage.setItem(CHAVE, JSON.stringify(a)) } catch { /* ignore */ }
    setValores({}); setErro(''); setAgora(Date.now())
  }

  async function enviar() {
    setSalvando(true); setErro('')
    try {
      const r = await fetch('/api/pdi/popup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ popup_id: atual!.id, ocorrencia: atual!.ocorrencia, respostas: valores }) })
      const d = await r.json().catch(() => ({})) as { error?: string }
      if (!r.ok) throw new Error(d.error ?? 'Não foi possível registrar.')
      const feito = atual!
      setOk(feito)
      setTimeout(() => { setOk(null); setValores({}); setLista(l => l.filter(p => !(p.id === feito.id && p.ocorrencia === feito.ocorrencia))) }, 1600)
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  const fila = lista.length
  const adiarTxt = atual.comportamento.adiar_min >= 60 ? `${Math.round(atual.comportamento.adiar_min / 60)}h` : `${atual.comportamento.adiar_min} min`

  return (
    <div className="pdi2">
      <div className="p2-modal-bg" style={{ zIndex: 1200 }}>
        <div className="p2-modal" role="dialog" aria-label={atual.titulo} style={{ maxWidth: 620 }} key={atual.id + atual.ocorrencia}>
          {ok ? (
            <div style={{ padding: '48px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 42, animation: 'p2Pop .4s var(--p2-ease-out) both' }}>🙌</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 8 }}>Registrado, obrigado!</div>
              {fila > 1 && <div style={{ fontSize: 13, color: 'var(--p2-mu)', marginTop: 4 }}>Tem mais {fila - 1} rapidinho.</div>}
            </div>
          ) : (
            <>
              <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--p2-line-soft)', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 5, borderRadius: '18px 18px 0 0', background: atual.cor }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 26, width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: atual.cor + '18', flexShrink: 0 }}>{atual.icone}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: atual.cor }}>Seu PDI{fila > 1 ? ` · 1 de ${fila}` : ''}</div>
                    <h2 style={{ margin: '2px 0 0', fontSize: 19, fontWeight: 800 }}>{atual.titulo}</h2>
                    {atual.intro && <div style={{ fontSize: 13, color: 'var(--p2-mu)', marginTop: 4, whiteSpace: 'pre-line' }}>{atual.intro}</div>}
                  </div>
                  {atual.comportamento.adiar && <button type="button" className="p2-link" onClick={adiar} style={{ color: 'var(--p2-mu)', whiteSpace: 'nowrap' }} title={`Volta em ${adiarTxt}`}>agora não</button>}
                </div>
              </div>
              <div style={{ padding: '14px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
                <PopupFormulario perguntas={atual.perguntas} cor={atual.cor} valores={valores} setValores={setValores} disabled={salvando} />
              </div>
              <div className="p2-card-f" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderRadius: '0 0 18px 18px' }}>
                <span style={{ fontSize: 11.5, color: 'var(--p2-mu)', flex: 1 }}>Aberto até {fmtQuando(atual.fecha)} · sua liderança vê estas respostas no seu PDI</span>
                {erro && <span style={{ fontSize: 12, color: 'var(--p2-no)' }}>{erro}</span>}
                <button type="button" className="p2-btn pri" style={{ background: atual.cor }} onClick={enviar} disabled={salvando}>{salvando ? 'Enviando…' : 'Enviar'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
