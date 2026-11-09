'use client'

// Dados das camadas 2 e 3 (tabelas cs_atividades, cs_atividade_medicoes, cs_volume_*, cs_amostragens, cs_amostras).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../lib/supabase'
import type { Amostra, Amostragem, AtivMedicao, Atividade, VolumeLinha, VolumeLote } from '../cs-suporte-lib'

type PageRes<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>
async function todas<T>(q: (a: number, b: number) => PageRes<T>): Promise<T[]> {
  const out: T[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await q(a, a + 999)
    if (error) throw Object.assign(new Error(error.message), { code: error.code })
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}
function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) {
    const m = r.error.message
    if (/janelas/.test(m)) throw new Error('Rode a migração sql/custo-servir-amostragem-janelas.sql no Supabase para usar faixas de horário.')
    if (/espontanea|aberta_todos|opcoes/.test(m)) throw new Error('Rode a migração sql/custo-servir-extra-portal.sql no Supabase para usar o Extra portal.')
    throw new Error(m)
  }
  return r.data
}

// ── Cache em memoria ──────────────────────────────────────────────────────────
// A aba Suporte (e o Fechamento) desmontam ao trocar de aba; sem cache, cada entrada
// buscava tudo de novo e travava em "Carregando…". Agora a 1a busca e feita em segundo
// plano quando o modulo abre (prefetchSuporte) e as entradas seguintes sao instantaneas,
// com atualizacao silenciosa por tras.
type Base = { ativs: Atividade[]; meds: AtivMedicao[]; lotes: VolumeLote[]; amostragens: Amostragem[] }
type Cache = Partial<Base> & { linhasDe?: { id: string; linhas: VolumeLinha[] } | null; amostrasDe?: { id: string; amostras: Amostra[] } | null }
const cache: Cache = {}
let emVoo: Promise<Base> | null = null

function buscarBase(): Promise<Base> {
  if (emVoo) return emVoo
  const supabase = createClient()
  emVoo = Promise.all([
    todas<Atividade>((x, y) => supabase.from('cs_atividades').select('*').order('ordem').range(x, y)),
    todas<AtivMedicao>((x, y) => supabase.from('cs_atividade_medicoes').select('*').order('created_at', { ascending: false }).range(x, y)),
    todas<VolumeLote>((x, y) => supabase.from('cs_volume_lotes').select('*').order('created_at', { ascending: false }).range(x, y)),
    todas<Amostragem>((x, y) => supabase.from('cs_amostragens').select('*').order('inicio', { ascending: false }).range(x, y)),
  ]).then(([ativs, m, lotes, amostragens]) => {
    const b: Base = { ativs, meds: m.map(x => ({ ...x, contratante_cod: x.contratante_cod ?? null, grupo: !!x.grupo })), lotes, amostragens }
    Object.assign(cache, b)
    return b
  }).finally(() => { emVoo = null })
  return emVoo
}

/** Comeca a carregar o suporte em segundo plano (chamado quando o modulo abre). */
export function prefetchSuporte() {
  if (cache.ativs || emVoo) return
  buscarBase().catch(() => { /* a aba mostra o erro ao abrir */ })
}

export function useSuporte(meuId: string) {
  const supabase = useMemo(() => createClient(), [])
  const [ativs, setAtivs] = useState<Atividade[]>(() => cache.ativs ?? [])
  const [meds, setMeds] = useState<AtivMedicao[]>(() => cache.meds ?? [])
  const [lotes, setLotes] = useState<VolumeLote[]>(() => cache.lotes ?? [])
  const [amostragens, setAmostragens] = useState<Amostragem[]>(() => cache.amostragens ?? [])
  const [carregando, setCarregando] = useState(() => !cache.ativs)
  const [faltaSql, setFaltaSql] = useState(false)
  const [loteId, setLoteId] = useState<string | null>(null)
  const [amId, setAmId] = useState<string | null>(null)
  const [linhasDe, setLinhasDe] = useState<{ id: string; linhas: VolumeLinha[] } | null>(() => cache.linhasDe ?? null)
  const [amostrasDe, setAmostrasDe] = useState<{ id: string; amostras: Amostra[] } | null>(() => cache.amostrasDe ?? null)

  // Mantem o cache igual ao estado (inclui o que as acoes de salvar/excluir mudam)
  useEffect(() => { if (!carregando) Object.assign(cache, { ativs, meds, lotes, amostragens }) }, [carregando, ativs, meds, lotes, amostragens])
  useEffect(() => { cache.linhasDe = linhasDe }, [linhasDe])
  useEffect(() => { cache.amostrasDe = amostrasDe }, [amostrasDe])

  const carregar = useCallback(async () => {
    try {
      const b = await buscarBase()
      setAtivs(b.ativs); setMeds(b.meds); setLotes(b.lotes); setAmostragens(b.amostragens); setFaltaSql(false)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === '42P01' || code === 'PGRST205') setFaltaSql(true)
    } finally { setCarregando(false) }
  }, [])

  useEffect(() => {
    if (!meuId) return
    const t = setTimeout(() => { void carregar() }, 0)
    return () => clearTimeout(t)
  }, [meuId, carregar])

  const loteSel = useMemo(() => lotes.find(x => x.id === loteId) ?? lotes[0] ?? null, [lotes, loteId])
  const amSel = useMemo(() => amostragens.find(x => x.id === amId) ?? amostragens[0] ?? null, [amostragens, amId])

  const buscandoL = useRef<string | null>(null)
  useEffect(() => {
    if (!loteSel || linhasDe?.id === loteSel.id || buscandoL.current === loteSel.id) return
    const id = loteSel.id
    buscandoL.current = id
    todas<VolumeLinha>((x, y) => supabase.from('cs_volume_linhas').select('atividade_id, contratantes, quantidade, prestador, referencia').eq('lote_id', id).order('id').range(x, y))
      .catch(() => [] as VolumeLinha[])
      .then(ls => { if (buscandoL.current === id) buscandoL.current = null; setLinhasDe({ id, linhas: ls.map(r => ({ ...r, quantidade: +r.quantidade || 0 })) }) })
  }, [loteSel, linhasDe, supabase])

  const buscandoA = useRef<string | null>(null)
  const recarregarAmostras = useCallback((id: string) => {
    buscandoA.current = id
    todas<Amostra>((x, y) => supabase.from('cs_amostras').select('*').eq('amostragem_id', id).order('previsto_em').range(x, y))
      .catch(() => [] as Amostra[])
      .then(as => { if (buscandoA.current === id) buscandoA.current = null; setAmostrasDe({ id, amostras: as }) })
  }, [supabase])
  useEffect(() => {
    if (!amSel || amostrasDe?.id === amSel.id || buscandoA.current === amSel.id) return
    recarregarAmostras(amSel.id)
  }, [amSel, amostrasDe, recarregarAmostras])

  const linhas = useMemo(() => (loteSel && linhasDe?.id === loteSel.id ? linhasDe.linhas : []), [loteSel, linhasDe])
  const amostras = useMemo(() => (amSel && amostrasDe?.id === amSel.id ? amostrasDe.amostras : []), [amSel, amostrasDe])

  // ── Atividades ──────────────────────────────────────────────────────────────
  const salvarAtividade = useCallback(async (id: string, patch: Partial<Atividade>) => {
    ok(await supabase.from('cs_atividades').update(patch).eq('id', id))
    setAtivs(p => p.map(a => (a.id === id ? { ...a, ...patch } : a)))
  }, [supabase])
  const adicionarAtividade = useCallback(async (nome: string, unidade: Atividade['unidade']) => {
    const chave = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now().toString(36).slice(-4)
    const ordem = Math.max(0, ...ativs.map(a => a.ordem)) + 1
    const a = ok(await supabase.from('cs_atividades').insert({ chave, nome, unidade, ordem }).select('*').single()) as Atividade
    setAtivs(p => [...p, a])
  }, [supabase, ativs])
  const registrarMedAtiv = useCallback(async (atividade_id: string, ms: number, situacao: AtivMedicao['situacao'], motivo: string | null, contratante_cod: string | null = null, grupo = false) => {
    const row: Record<string, unknown> = { atividade_id, duracao_ms: Math.round(ms), situacao, motivo, avaliador_id: meuId }
    if (contratante_cod) { row.contratante_cod = contratante_cod; row.grupo = grupo }
    const m = ok(await supabase.from('cs_atividade_medicoes').insert(row).select('*').single()) as AtivMedicao
    setMeds(p => [{ ...m, contratante_cod: m.contratante_cod ?? null, grupo: !!m.grupo }, ...p])
  }, [supabase, meuId])
  const alternarMedAtiv = useCallback(async (m: AtivMedicao) => {
    const patch = m.situacao === 'validada' ? { situacao: 'descartada' as const, motivo: 'Descartada na revisão' } : { situacao: 'validada' as const, motivo: null }
    ok(await supabase.from('cs_atividade_medicoes').update(patch).eq('id', m.id))
    setMeds(p => p.map(x => (x.id === m.id ? { ...x, ...patch } : x)))
  }, [supabase])

  /** Exclui a atividade; as medicoes e as linhas de volume dela saem junto (ON DELETE CASCADE). */
  const excluirAtividade = useCallback(async (id: string) => {
    ok(await supabase.from('cs_atividades').delete().eq('id', id))
    setAtivs(p => p.filter(a => a.id !== id))
    setMeds(p => p.filter(m => m.atividade_id !== id))
    setLinhasDe(p => (p ? { ...p, linhas: p.linhas.filter(l => l.atividade_id !== id) } : p))
  }, [supabase])
  const excluirMedAtiv = useCallback(async (id: string) => {
    ok(await supabase.from('cs_atividade_medicoes').delete().eq('id', id))
    setMeds(p => p.filter(m => m.id !== id))
  }, [supabase])

  // ── Volumes ─────────────────────────────────────────────────────────────────
  const importarLote = useCallback(async (nome: string, dias: number | null, ls: VolumeLinha[]) => {
    const lote = ok(await supabase.from('cs_volume_lotes').insert({ nome, dias_uteis: dias, created_by: meuId }).select('*').single()) as VolumeLote
    try {
      for (let i = 0; i < ls.length; i += 500) ok(await supabase.from('cs_volume_linhas').insert(ls.slice(i, i + 500).map(l => ({ ...l, lote_id: lote.id }))))
    } catch (e) { await supabase.from('cs_volume_lotes').delete().eq('id', lote.id); throw e }
    setLinhasDe({ id: lote.id, linhas: ls }); setLoteId(lote.id); setLotes(p => [lote, ...p])
  }, [supabase, meuId])
  const adicionarLinhas = useCallback(async (lote: string, ls: VolumeLinha[]) => {
    ok(await supabase.from('cs_volume_linhas').insert(ls.map(l => ({ ...l, lote_id: lote }))))
    setLinhasDe(p => (p && p.id === lote ? { id: lote, linhas: [...p.linhas, ...ls] } : p))
  }, [supabase])
  const atualizarLote = useCallback(async (id: string, patch: Partial<VolumeLote>) => {
    ok(await supabase.from('cs_volume_lotes').update(patch).eq('id', id))
    setLotes(p => p.map(l => (l.id === id ? { ...l, ...patch } : l)))
  }, [supabase])
  const excluirLote = useCallback(async (id: string) => {
    ok(await supabase.from('cs_volume_lotes').delete().eq('id', id))
    setLoteId(null); setLotes(p => p.filter(l => l.id !== id))
  }, [supabase])

  // ── Amostragens ─────────────────────────────────────────────────────────────
  const criarAmostragem = useCallback(async (a: Omit<Amostragem, 'id' | 'created_at' | 'created_by'>) => {
    const r = ok(await supabase.from('cs_amostragens').insert({ ...a, created_by: meuId }).select('*').single()) as Amostragem
    setAmostragens(p => [r, ...p]); setAmId(r.id)
  }, [supabase, meuId])
  const salvarAmostragem = useCallback(async (id: string, patch: Partial<Amostragem>) => {
    ok(await supabase.from('cs_amostragens').update(patch).eq('id', id))
    setAmostragens(p => p.map(a => (a.id === id ? { ...a, ...patch } : a)))
  }, [supabase])
  /** Registro por conta propria no Extra portal (sem pop-up): horario = agora. */
  const registrarAmostra = useCallback(async (amostragem_id: string, atividade: Amostra['atividade'], contratante_cod: string | null) => {
    const r = ok(await supabase.from('cs_amostras').insert({
      amostragem_id, usuario_id: meuId, previsto_em: new Date().toISOString(), atividade, contratante_cod, espontanea: true,
    }).select('*').single()) as Amostra
    setAmostrasDe(p => (p && p.id === amostragem_id ? { id: p.id, amostras: [...p.amostras, r] } : p))
    return r
  }, [supabase, meuId])
  const excluirAmostragem = useCallback(async (id: string) => {
    ok(await supabase.from('cs_amostragens').delete().eq('id', id))
    setAmId(null); setAmostragens(p => p.filter(a => a.id !== id))
  }, [supabase])

  return {
    carregando, faltaSql, recarregar: carregar, ativs, meds, lotes, loteSel, setLoteId, linhas, amostragens, amSel, setAmId, amostras,
    recarregarAmostras, salvarAtividade, adicionarAtividade, excluirAtividade, registrarMedAtiv, alternarMedAtiv, excluirMedAtiv,
    importarLote, adicionarLinhas, atualizarLote, excluirLote, criarAmostragem, salvarAmostragem, excluirAmostragem, registrarAmostra,
  }
}
export type SuporteApi = ReturnType<typeof useSuporte>
