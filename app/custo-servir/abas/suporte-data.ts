'use client'

// Dados das camadas 2 e 3 (tabelas cs_atividades, cs_atividade_medicoes, cs_volume_*, cs_amostragens, cs_amostras,
// cs_camada3_atividades).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { C3_PADRAO, CHAVES_FIXAS, colunasContratantes, type Amostra, type AtividadeC3, type Amostragem, type AtivMedicao, type Atividade, type VolumeLinha, type VolumeLote } from '../cs-suporte-lib'

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
type Base = { ativs: Atividade[]; meds: AtivMedicao[]; lotes: VolumeLote[]; amostragens: Amostragem[]; c3: AtividadeC3[]; c3Tabela: boolean }
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
    carregarC3(),
  ]).then(([ativs, m, lotes, amostragens, c3]) => {
    const b: Base = { ativs, meds: m.map(x => ({ ...x, contratante_cod: x.contratante_cod ?? null, grupo: !!x.grupo })), lotes, amostragens, c3: c3.lista, c3Tabela: c3.tabela }
    Object.assign(cache, b)
    return b
  }).finally(() => { emVoo = null })
  return emVoo
}

/** Atividades da camada 3. Sem a tabela (migracao nao rodou), vale a lista padrao e a edicao fica bloqueada. */
export async function carregarC3(): Promise<{ lista: AtividadeC3[]; tabela: boolean }> {
  const { data, error } = await createClient().from('cs_camada3_atividades').select('chave, label, inclui, ordem, ativo').order('ordem')
  if (error) return { lista: C3_PADRAO, tabela: false }
  return { lista: (data ?? []) as AtividadeC3[], tabela: true }
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
  const [c3, setC3] = useState<AtividadeC3[]>(() => cache.c3 ?? C3_PADRAO)
  const [c3Tabela, setC3Tabela] = useState(() => cache.c3Tabela ?? false)
  const [carregando, setCarregando] = useState(() => !cache.ativs)
  const [faltaSql, setFaltaSql] = useState(false)
  const [loteId, setLoteId] = useState<string | null>(null)
  const [amId, setAmId] = useState<string | null>(null)
  const [linhasDe, setLinhasDe] = useState<{ id: string; linhas: VolumeLinha[] } | null>(() => cache.linhasDe ?? null)
  const [amostrasDe, setAmostrasDe] = useState<{ id: string; amostras: Amostra[] } | null>(() => cache.amostrasDe ?? null)

  // Mantem o cache igual ao estado (inclui o que as acoes de salvar/excluir mudam)
  useEffect(() => { if (!carregando) Object.assign(cache, { ativs, meds, lotes, amostragens, c3, c3Tabela }) }, [carregando, ativs, meds, lotes, amostragens, c3, c3Tabela])
  useEffect(() => { cache.linhasDe = linhasDe }, [linhasDe])
  useEffect(() => { cache.amostrasDe = amostrasDe }, [amostrasDe])

  const carregar = useCallback(async () => {
    try {
      const b = await buscarBase()
      setAtivs(b.ativs); setMeds(b.meds); setLotes(b.lotes); setAmostragens(b.amostragens); setC3(b.c3); setC3Tabela(b.c3Tabela); setFaltaSql(false)
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
  const registrarAmostra = useCallback(async (amostragem_id: string, atividade: Amostra['atividade'], contratantes: string[]) => {
    const res = await supabase.from('cs_amostras').insert({
      amostragem_id, usuario_id: meuId, previsto_em: new Date().toISOString(), atividade, ...colunasContratantes(contratantes), espontanea: true,
    }).select('*').single()
    if (res.error && /contratantes/.test(res.error.message)) throw new Error('Vários contratantes ainda não estão liberados: rode sql/custo-servir-base-perks.sql no Supabase. Por enquanto marque só um.')
    const r = ok(res) as Amostra
    setAmostrasDe(p => (p && p.id === amostragem_id ? { id: p.id, amostras: [...p.amostras, r] } : p))
    return r
  }, [supabase, meuId])
  const excluirAmostragem = useCallback(async (id: string) => {
    ok(await supabase.from('cs_amostragens').delete().eq('id', id))
    setAmId(null); setAmostragens(p => p.filter(a => a.id !== id))
  }, [supabase])

  // ── Atividades da camada 3 (Extra portal) ─────────────────────────────────
  const SEM_TABELA_C3 = 'Rode a migração sql/custo-servir-camada3-atividades.sql no Supabase para editar as atividades da camada 3.'
  const adicionarC3 = useCallback(async (label: string, inclui: string) => {
    if (!c3Tabela) throw new Error(SEM_TABELA_C3)
    const base = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'atividade'
    const usadas = new Set([...CHAVES_FIXAS, ...c3.map(a => a.chave)])
    let chave = base
    for (let i = 2; usadas.has(chave); i++) chave = `${base}_${i}`
    const ordem = Math.max(0, ...c3.map(a => a.ordem)) + 1
    const r = ok(await supabase.from('cs_camada3_atividades').insert({ chave, label, inclui: inclui || null, ordem }).select('chave, label, inclui, ordem, ativo').single()) as AtividadeC3
    setC3(p => [...p, r])
  }, [supabase, c3, c3Tabela])
  const salvarC3 = useCallback(async (chave: string, patch: Partial<Pick<AtividadeC3, 'label' | 'inclui' | 'ordem' | 'ativo'>>) => {
    if (!c3Tabela) throw new Error(SEM_TABELA_C3)
    ok(await supabase.from('cs_camada3_atividades').update(patch).eq('chave', chave))
    setC3(p => p.map(a => (a.chave === chave ? { ...a, ...patch } : a)))
  }, [supabase, c3Tabela])
  /** Remove: com respostas gravadas, so desativa (o historico continua contando); sem respostas, exclui. */
  const removerC3 = useCallback(async (chave: string): Promise<'excluida' | 'desativada'> => {
    if (!c3Tabela) throw new Error(SEM_TABELA_C3)
    const { count, error } = await supabase.from('cs_amostras').select('id', { count: 'exact', head: true }).eq('atividade', chave)
    if (error) throw new Error(error.message)
    if (count) {
      ok(await supabase.from('cs_camada3_atividades').update({ ativo: false }).eq('chave', chave))
      setC3(p => p.map(a => (a.chave === chave ? { ...a, ativo: false } : a)))
      return 'desativada'
    }
    ok(await supabase.from('cs_camada3_atividades').delete().eq('chave', chave))
    setC3(p => p.filter(a => a.chave !== chave))
    return 'excluida'
  }, [supabase, c3Tabela])

  return {
    c3, c3Tabela, adicionarC3, salvarC3, removerC3,
    carregando, faltaSql, recarregar: carregar, ativs, meds, lotes, loteSel, setLoteId, linhas, amostragens, amSel, setAmId, amostras,
    recarregarAmostras, salvarAtividade, adicionarAtividade, excluirAtividade, registrarMedAtiv, alternarMedAtiv, excluirMedAtiv,
    importarLote, adicionarLinhas, atualizarLote, excluirLote, criarAmostragem, salvarAmostragem, excluirAmostragem, registrarAmostra,
  }
}
export type SuporteApi = ReturnType<typeof useSuporte>
