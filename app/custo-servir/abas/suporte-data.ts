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
function ok<T>(r: { data: T; error: { message: string } | null }): T { if (r.error) throw new Error(r.error.message); return r.data }

export function useSuporte(meuId: string) {
  const supabase = useMemo(() => createClient(), [])
  const [ativs, setAtivs] = useState<Atividade[]>([])
  const [meds, setMeds] = useState<AtivMedicao[]>([])
  const [lotes, setLotes] = useState<VolumeLote[]>([])
  const [amostragens, setAmostragens] = useState<Amostragem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [faltaSql, setFaltaSql] = useState(false)
  const [loteId, setLoteId] = useState<string | null>(null)
  const [amId, setAmId] = useState<string | null>(null)
  const [linhasDe, setLinhasDe] = useState<{ id: string; linhas: VolumeLinha[] } | null>(null)
  const [amostrasDe, setAmostrasDe] = useState<{ id: string; amostras: Amostra[] } | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [a, m, l, s] = await Promise.all([
        todas<Atividade>((x, y) => supabase.from('cs_atividades').select('*').order('ordem').range(x, y)),
        todas<AtivMedicao>((x, y) => supabase.from('cs_atividade_medicoes').select('*').order('created_at', { ascending: false }).range(x, y)),
        todas<VolumeLote>((x, y) => supabase.from('cs_volume_lotes').select('*').order('created_at', { ascending: false }).range(x, y)),
        todas<Amostragem>((x, y) => supabase.from('cs_amostragens').select('*').order('inicio', { ascending: false }).range(x, y)),
      ])
      setAtivs(a); setMeds(m.map(x => ({ ...x, contratante_cod: x.contratante_cod ?? null, grupo: !!x.grupo }))); setLotes(l); setAmostragens(s); setFaltaSql(false)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === '42P01' || code === 'PGRST205') setFaltaSql(true)
    } finally { setCarregando(false) }
  }, [supabase])

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
  const excluirAmostragem = useCallback(async (id: string) => {
    ok(await supabase.from('cs_amostragens').delete().eq('id', id))
    setAmId(null); setAmostragens(p => p.filter(a => a.id !== id))
  }, [supabase])

  return {
    carregando, faltaSql, recarregar: carregar, ativs, meds, lotes, loteSel, setLoteId, linhas, amostragens, amSel, setAmId, amostras,
    recarregarAmostras, salvarAtividade, adicionarAtividade, registrarMedAtiv, alternarMedAtiv,
    importarLote, adicionarLinhas, atualizarLote, excluirLote, criarAmostragem, salvarAmostragem, excluirAmostragem,
  }
}
export type SuporteApi = ReturnType<typeof useSuporte>
