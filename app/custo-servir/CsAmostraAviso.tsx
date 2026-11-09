'use client'

// Pop-up do Extra portal (amostragem do trabalho). Montado no AppShell: nos horarios sorteados de uma
// amostragem ativa, pergunta "O que voce esta fazendo agora?" (atividade + contratante, 2 cliques).
// Aviso nao respondido em 20 min expira sem registro (o horario sorteado ja passou).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useUser } from '../components/UserContext'
import { hojeIso, horariosDoDia, opcoesDe, participa, type Amostragem, type ChaveAmostra } from './cs-suporte-lib'
import './custo-servir.css'

const JANELA_MS = 20 * 60_000
const CHAVE_PULADOS = 'cs_amostra_pulados'

type Pendente = { amostragem: Amostragem; previsto: Date }
type Ctt = { contratante_cod: string; nome: string }

const lerPulados = (): string[] => { try { return JSON.parse(sessionStorage.getItem(CHAVE_PULADOS) || '[]') } catch { return [] } }
const pular = (k: string) => { try { sessionStorage.setItem(CHAVE_PULADOS, JSON.stringify([...lerPulados(), k].slice(-50))) } catch { /* ignore */ } }

/** Escolha da resposta: 1o clique na atividade, 2o no contratante (quando a atividade pede). */
export function EscolherResposta({ amostragem, ctts, salvando, onRegistrar }: {
  amostragem: Amostragem; ctts: Ctt[]; salvando: boolean
  onRegistrar: (atividade: ChaveAmostra, contratante: string | null) => Promise<boolean>
}) {
  const [ativ, setAtiv] = useState<ChaveAmostra | null>(null)
  const [busca, setBusca] = useState('')
  const opcoes = opcoesDe(amostragem)
  const opc = opcoes.find(o => o.chave === ativ)
  const registrar = async (c: string | null) => {
    if (!ativ) return
    if (await onRegistrar(ativ, c)) { setAtiv(null); setBusca('') }
  }
  const q = busca.trim().toLowerCase()
  const lista = q ? ctts.filter(c => (c.contratante_cod + ' ' + c.nome).toLowerCase().includes(q)) : ctts

  if (!opc) {
    return (
      <div className="grid2" style={{ gap: 8 }}>
        {opcoes.map(o => (
          <button key={o.chave} type="button" className="dcard" disabled={salvando} onClick={() => setAtiv(o.chave)}>
            <b>{o.label}</b><span className="note">{o.inclui}</span>
          </button>
        ))}
      </div>
    )
  }
  if (!opc.pedeContratante) {
    return (
      <div className="box">
        <p><b>{opc.label}</b>: {opc.inclui}.</p>
        <div className="row">
          <button type="button" className="btn solid" disabled={salvando} onClick={() => void registrar(null)}>Registrar</button>
          <button type="button" className="link" onClick={() => setAtiv(null)}>voltar</button>
        </div>
      </div>
    )
  }
  return (
    <div className="box">
      <div className="row between">
        <b>{opc.label} · para qual contratante?</b>
        <button type="button" className="link" onClick={() => { setAtiv(null); setBusca('') }}>voltar</button>
      </div>
      <input type="search" autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contratante (código ou nome)" />
      <div style={{ maxHeight: 280, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button type="button" className="btn sm" style={{ textAlign: 'left' }} disabled={salvando} onClick={() => void registrar(null)}>Não é de um contratante</button>
        {lista.map(c => (
          <button key={c.contratante_cod} type="button" className="btn sm" style={{ textAlign: 'left', whiteSpace: 'normal' }} disabled={salvando}
            onClick={() => void registrar(c.contratante_cod)}>
            <span className="mono">{c.contratante_cod}</span> · {c.nome}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function CsAmostraAviso() {
  const { profile } = useUser()
  const uid = profile?.id ?? ''
  const supabase = useMemo(() => createClient(), [])
  const [amostragens, setAmostragens] = useState<Amostragem[]>([])
  const [respondidos, setRespondidos] = useState<Set<string>>(new Set())
  const [ctts, setCtts] = useState<Ctt[]>([])
  const [agora, setAgora] = useState(() => Date.now())
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

  async function registrar(atividade: ChaveAmostra, contratante: string | null) {
    if (salvando) return false
    setSalvando(true)
    const { error } = await supabase.from('cs_amostras').insert({
      amostragem_id: pendente!.amostragem.id, usuario_id: uid, previsto_em: pendente!.previsto.toISOString(),
      atividade, contratante_cod: contratante,
    })
    setSalvando(false)
    if (error && error.code !== '23505') { alert('Não foi possível registrar: ' + error.message); return false }
    setRespondidos(prev => new Set(prev).add(k))
    return true
  }

  return (
    <div className="cs-modal" style={{ alignItems: 'center' }}>
      <div className="cs" style={{ maxWidth: 560 }} role="dialog" aria-label="Extra portal">
        <div className="row between">
          <div>
            <div className="eyebrow">GT3 · extra portal</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--cs-edge-2)' }}>O que você está fazendo agora?</h2>
            <p className="note">{pendente.previsto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · responda em 2 cliques. Mede o contratante, não a pessoa.</p>
          </div>
          <button type="button" className="link" onClick={() => { pular(k); setPuladosVer(x => x + 1) }}>agora não</button>
        </div>
        <EscolherResposta key={k} amostragem={pendente.amostragem} ctts={ctts} salvando={salvando} onRegistrar={registrar} />
      </div>
    </div>
  )
}
