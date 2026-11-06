'use client'

// Aviso da amostragem do trabalho (camada 3). Montado no AppShell: nos horarios sorteados de uma
// amostragem ativa, pergunta "O que voce esta fazendo agora?" (atividade + contratante, 2 cliques).
// Aviso nao respondido em 20 min expira sem registro (o horario sorteado ja passou).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useUser } from '../components/UserContext'
import { hojeIso, horariosDoDia, OPCOES_AMOSTRA, participa, type Amostragem, type ChaveAmostra } from './cs-suporte-lib'
import './custo-servir.css'

const JANELA_MS = 20 * 60_000
const CHAVE_PULADOS = 'cs_amostra_pulados'

type Pendente = { amostragem: Amostragem; previsto: Date }
type Ctt = { contratante_cod: string; nome: string }

const lerPulados = (): string[] => { try { return JSON.parse(sessionStorage.getItem(CHAVE_PULADOS) || '[]') } catch { return [] } }
const pular = (k: string) => { try { sessionStorage.setItem(CHAVE_PULADOS, JSON.stringify([...lerPulados(), k].slice(-50))) } catch { /* ignore */ } }

export default function CsAmostraAviso() {
  const { profile } = useUser()
  const uid = profile?.id ?? ''
  const supabase = useMemo(() => createClient(), [])
  const [amostragens, setAmostragens] = useState<Amostragem[]>([])
  const [respondidos, setRespondidos] = useState<Set<string>>(new Set())
  const [ctts, setCtts] = useState<Ctt[]>([])
  const [agora, setAgora] = useState(() => Date.now())
  const [ativ, setAtiv] = useState<ChaveAmostra | null>(null)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [, setPuladosVer] = useState(0)

  const carregar = useCallback(async () => {
    if (!uid) return
    const hoje = hojeIso()
    const { data, error } = await supabase.from('cs_amostragens').select('*').eq('ativa', true).lte('inicio', hoje).gte('fim', hoje)
    if (error) return   // tabela ainda nao criada: nada a fazer
    const minhas = ((data ?? []) as Amostragem[]).filter(a => participa(a, uid))
    setAmostragens(minhas)
    if (!minhas.length) return
    const inicioDia = new Date(hoje + 'T00:00:00').toISOString()
    const [{ data: am }, { data: cs }] = await Promise.all([
      supabase.from('cs_amostras').select('amostragem_id, previsto_em').eq('usuario_id', uid).gte('previsto_em', inicioDia),
      supabase.from('cs_contratantes_fin').select('contratante_cod, nome'),
    ])
    setRespondidos(new Set(((am ?? []) as { amostragem_id: string; previsto_em: string }[]).map(x => x.amostragem_id + '|' + new Date(x.previsto_em).toISOString())))
    setCtts(((cs ?? []) as Ctt[]).sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0)))
  }, [supabase, uid])

  useEffect(() => {
    if (!uid) return
    const t0 = setTimeout(() => { void carregar() }, 0)
    const t1 = setInterval(() => { void carregar() }, 10 * 60_000)
    const t2 = setInterval(() => setAgora(Date.now()), 30_000)
    return () => { clearTimeout(t0); clearInterval(t1); clearInterval(t2) }
  }, [uid, carregar])

  const pendente: Pendente | null = useMemo(() => {
    if (!uid) return null
    const pulados = lerPulados()
    const hoje = hojeIso(new Date(agora))
    let melhor: Pendente | null = null
    for (const a of amostragens) {
      for (const h of horariosDoDia(a, uid, hoje)) {
        const k = a.id + '|' + h.toISOString()
        const atraso = agora - h.getTime()
        if (atraso < 0 || atraso > JANELA_MS || respondidos.has(k) || pulados.includes(k)) continue
        if (!melhor || h < melhor.previsto) melhor = { amostragem: a, previsto: h }
      }
    }
    return melhor
  }, [amostragens, respondidos, agora, uid])

  if (!pendente) return null
  const k = pendente.amostragem.id + '|' + pendente.previsto.toISOString()
  const opc = OPCOES_AMOSTRA.find(o => o.chave === ativ)

  async function registrar(contratante: string | null) {
    if (!ativ || salvando) return
    setSalvando(true)
    const { error } = await supabase.from('cs_amostras').insert({
      amostragem_id: pendente!.amostragem.id, usuario_id: uid, previsto_em: pendente!.previsto.toISOString(),
      atividade: ativ, contratante_cod: contratante,
    })
    setSalvando(false)
    if (error && error.code !== '23505') { alert('Não foi possível registrar: ' + error.message); return }
    setRespondidos(prev => new Set(prev).add(k))
    setAtiv(null); setBusca('')
  }

  const lista = busca.trim()
    ? ctts.filter(c => (c.contratante_cod + ' ' + c.nome).toLowerCase().includes(busca.trim().toLowerCase()))
    : ctts

  return (
    <div className="cs-modal" style={{ alignItems: 'center' }}>
      <div className="cs" style={{ maxWidth: 560 }} role="dialog" aria-label="Amostragem do trabalho">
        <div className="row between">
          <div>
            <div className="eyebrow">GT3 · amostragem do trabalho</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--cs-edge-2)' }}>O que você está fazendo agora?</h2>
            <p className="note">{pendente.previsto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · responda em 2 cliques. Mede o contratante, não a pessoa.</p>
          </div>
          <button type="button" className="link" onClick={() => { pular(k); setPuladosVer(x => x + 1); setAtiv(null) }}>agora não</button>
        </div>
        {!ativ ? (
          <div className="grid2" style={{ gap: 8 }}>
            {OPCOES_AMOSTRA.map(o => (
              <button key={o.chave} type="button" className="dcard" disabled={salvando}
                onClick={() => setAtiv(o.chave)}>
                <b>{o.label}</b><span className="note">{o.inclui}</span>
              </button>
            ))}
          </div>
        ) : opc && !opc.pedeContratante ? (
          <div className="box">
            <p><b>{opc.label}</b>: {opc.inclui}.</p>
            <div className="row">
              <button type="button" className="btn solid" disabled={salvando} onClick={() => registrar(null)}>Registrar</button>
              <button type="button" className="link" onClick={() => setAtiv(null)}>voltar</button>
            </div>
          </div>
        ) : (
          <div className="box">
            <div className="row between">
              <b>{opc?.label} · para qual contratante?</b>
              <button type="button" className="link" onClick={() => { setAtiv(null); setBusca('') }}>voltar</button>
            </div>
            <input type="search" autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contratante (código ou nome)" />
            <div style={{ maxHeight: 280, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button type="button" className="btn sm" style={{ textAlign: 'left' }} disabled={salvando} onClick={() => registrar(null)}>Não é de um contratante</button>
              {lista.map(c => (
                <button key={c.contratante_cod} type="button" className="btn sm" style={{ textAlign: 'left', whiteSpace: 'normal' }} disabled={salvando}
                  onClick={() => registrar(c.contratante_cod)}>
                  <span className="mono">{c.contratante_cod}</span> · {c.nome}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
