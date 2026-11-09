'use client'

// Custo de Servir — carga e gravacao no Supabase (tabelas cs_*), exposta por contexto.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useUser } from '../components/UserContext'
import {
  indexarMedicoes,
  type Config, type Contratante, type Ctx, type DocCtt, type Documento, type Grupo, type LinhaRel, type Medicao,
  type Relatorio, type Resultado, type Situacao, type Turno, type Usuario,
} from './cs-lib'

export type Hist = { id: string; medicao_id: string; acao: string; detalhe: string | null; usuario_id: string; created_at: string }

export const ACOES: Record<string, string> = {
  registrou_validou: 'Registrou e validou',
  registrou_descartou: 'Registrou e descartou',
  descartou: 'Descartou',
  restaurou: 'Restaurou para a média',
  moveu: 'Moveu de grupo',
  transportou: 'Recebeu como tempo padrão',
}

type Dados = {
  cfg: Config | null
  grupos: Grupo[]
  docs: Documento[]
  gd: { grupo_id: string; documento_id: string }[]
  meds: Medicao[]
  turnos: Turno[]
  ctts: Contratante[]
  rels: Relatorio[]
  usuarios: Usuario[]
  exig: DocCtt[]
}

const VAZIO: Dados = { cfg: null, grupos: [], docs: [], gd: [], meds: [], turnos: [], ctts: [], rels: [], usuarios: [], exig: [] }

type PageRes<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
/** Le todas as linhas, de 1000 em 1000 (limite padrao do PostgREST). */
async function todas<T>(q: (from: number, to: number) => PageRes<T>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

function erroTurno(e: { code?: string; message: string }) {
  if (e.code === '23505') return 'Esse turno já existe.'
  if (e.code === '23503') return 'Contratante não cadastrado. Cadastre-o em Contratantes antes.'
  return e.message
}

function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

function useCsDataInterno() {
  const supabase = useMemo(() => createClient(), [])
  const { profile } = useUser()
  const meuId = profile?.id ?? ''
  const papelBruto = profile?.papel ?? 'colaborador'
  const papel = papelBruto === 'trainee' ? 'colaborador' : papelBruto

  const [d, setD] = useState<Dados>(VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [relId, setRelId] = useState<string | null>(null)
  // Linhas do relatorio carregado, marcadas com o id dele
  const [linhasDe, setLinhasDe] = useState<{ id: string; linhas: LinhaRel[] } | null>(null)

  const carregarMedicoes = useCallback(async () => {
    const meds = await todas<Medicao>((a, b) =>
      supabase.from('cs_medicoes').select('*').order('created_at', { ascending: false }).range(a, b))
    setD(prev => ({ ...prev, meds }))
  }, [supabase])

  const carregar = useCallback(async () => {
    try {
      // Vinculos GT0010 (tabela opcional: se ainda nao existir, segue sem)
      const exig = await todas<DocCtt>((a, b) => supabase.from('cs_documento_contratantes').select('*').range(a, b)).catch(() => [] as DocCtt[])
      const [cfg, grupos, gc, docs, gd, meds, turnos, ctts, rels, usuarios] = await Promise.all([
        supabase.from('cs_config').select('*').eq('id', 1).maybeSingle().then(ok),
        supabase.from('cs_grupos').select('*').order('ordem').order('created_at').then(ok),
        supabase.from('cs_grupo_contratantes').select('*').then(ok),
        todas<Documento>((a, b) => supabase.from('cs_documentos').select('*').order('nome').range(a, b)),
        todas<{ grupo_id: string; documento_id: string }>((a, b) =>
          supabase.from('cs_grupo_documentos').select('grupo_id, documento_id').range(a, b)),
        todas<Medicao>((a, b) => supabase.from('cs_medicoes').select('*').order('created_at', { ascending: false }).range(a, b)),
        supabase.from('cs_turnos').select('*').then(ok),
        supabase.from('cs_contratantes_fin').select('*').then(ok),
        supabase.from('cs_relatorios').select('*').order('created_at', { ascending: false }).then(ok),
        fetch('/api/custo-servir/usuarios').then(r => (r.ok ? r.json() : [])),
      ])
      const contr = (gc ?? []) as { grupo_id: string; contratante_cod: string }[]
      setD({
        cfg: (cfg as Config | null) ?? null,
        grupos: ((grupos ?? []) as Omit<Grupo, 'contratantes'>[]).map(g => ({
          ...g, contratantes: contr.filter(c => c.grupo_id === g.id).map(c => c.contratante_cod),
        })),
        docs: docs.map(x => ({ ...x, tipo: x.tipo ?? null })), gd, meds,
        turnos: ((turnos ?? []) as Turno[]).map(t => ({ ...t, descricao: t.descricao ?? null, codigo_integracao: t.codigo_integracao ?? null })).sort((a, b) => (+a.turno_cod || 0) - (+b.turno_cod || 0) || a.turno_cod.localeCompare(b.turno_cod)),
        ctts: ((ctts ?? []) as Contratante[]).map(c => ({ ...c, faturamento_mensal: +c.faturamento_mensal || 0, contratante_pai: c.contratante_pai ?? null }))
          .sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0)),
        rels: (rels ?? []) as Relatorio[],
        usuarios: usuarios as Usuario[],
        exig,
      })
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setCarregando(false)
    }
  }, [supabase])

  // Carga inicial fora do corpo do efeito (evita render em cascata e a carga dupla do StrictMode)
  useEffect(() => {
    if (!meuId) return
    const t = setTimeout(() => { void carregar() }, 0)
    return () => clearTimeout(t)
  }, [meuId, carregar])

  // Relatorio selecionado: o mais recente, ate o usuario escolher outro
  const relSel = useMemo(() => d.rels.find(r => r.id === relId) ?? d.rels[0] ?? null, [d.rels, relId])
  const buscando = useRef<string | null>(null)
  useEffect(() => {
    if (!relSel || linhasDe?.id === relSel.id || buscando.current === relSel.id) return
    const id = relSel.id
    buscando.current = id
    todas<LinhaRel>((a, b) => supabase.from('cs_relatorio_linhas')
      .select('data, cod_documento, documento, status, empresa_pessoa, cod_cadastro, razao_social, cnpj, vinculacao, ignorados, gt0010, turnos, usuario')
      .eq('relatorio_id', id).order('id').range(a, b))
      .catch(() => [] as LinhaRel[])
      .then(ls => { if (buscando.current === id) buscando.current = null; setLinhasDe({ id, linhas: ls }) })
  }, [relSel, linhasDe, supabase])
  const linhas = useMemo(() => (relSel && linhasDe?.id === relSel.id ? linhasDe.linhas : []), [relSel, linhasDe])
  const carregandoLinhas = !!relSel && linhasDe?.id !== relSel.id

  // Contexto de calculo
  const ctx: Ctx | null = useMemo(() => {
    if (!d.cfg) return null
    const gd = new Map<string, Set<string>>()
    for (const r of d.gd) { const s = gd.get(r.grupo_id); if (s) s.add(r.documento_id); else gd.set(r.grupo_id, new Set([r.documento_id])) }
    return {
      cfg: d.cfg,
      grupos: d.grupos,
      docs: new Map(d.docs.map(x => [x.id, x])),
      gd,
      idx: indexarMedicoes(d.meds),
      turnos: new Map(d.turnos.map(t => [t.turno_cod, t.contratante_cod])),
      catraca: d.turnos.reduce((m, t) => (t.codigo_integracao?.trim() ? m.set(t.contratante_cod, (m.get(t.contratante_cod) ?? 0) + 1) : m), new Map<string, number>()),
      ctts: new Map(d.ctts.map(c => [c.contratante_cod, c])),
      exige: d.exig.filter(x => x.ativo).reduce((m, x) => { const s = m.get(x.documento_id); if (s) s.add(x.contratante_cod); else m.set(x.documento_id, new Set([x.contratante_cod])); return m }, new Map<string, Set<string>>()),
    }
  }, [d])

  // ── Medicoes ────────────────────────────────────────────────────────────────
  const hist = useCallback(async (medicao_id: string, acao: string, detalhe: string | null = null) => {
    ok(await supabase.from('cs_medicoes_hist').insert({ medicao_id, acao, detalhe, usuario_id: meuId }))
  }, [supabase, meuId])

  const registrarMedicao = useCallback(async (p: { g: string; d: string; ms: number; res: Resultado; situacao: Situacao; motivo: string | null }) => {
    const row = ok(await supabase.from('cs_medicoes').insert({
      grupo_id: p.g, documento_id: p.d, duracao_ms: Math.round(p.ms), resultado: p.res,
      situacao: p.situacao, motivo: p.motivo, avaliador_id: meuId,
    }).select('*').single()) as Medicao
    setD(prev => ({ ...prev, meds: [row, ...prev.meds] }))
    await hist(row.id, p.situacao === 'validada' ? 'registrou_validou' : 'registrou_descartou', p.motivo)
    return row
  }, [supabase, meuId, hist])

  const alternarMedicao = useCallback(async (m: Medicao, motivo = 'Descartada na revisão') => {
    const descartar = m.situacao === 'validada'
    const patch = descartar ? { situacao: 'descartada' as const, motivo } : { situacao: 'validada' as const, motivo: null }
    ok(await supabase.from('cs_medicoes').update(patch).eq('id', m.id))
    setD(prev => ({ ...prev, meds: prev.meds.map(x => (x.id === m.id ? { ...x, ...patch } : x)) }))
    await hist(m.id, descartar ? 'descartou' : 'restaurou', descartar ? motivo : null)
  }, [supabase, hist])

  const historico = useCallback(async (medicao_id: string) =>
    ok(await supabase.from('cs_medicoes_hist').select('*').eq('medicao_id', medicao_id).order('created_at')) as Hist[]
  , [supabase])

  // ── Grupos ──────────────────────────────────────────────────────────────────
  const criarGrupo = useCallback(async (nome: string) => {
    const ordem = Math.max(0, ...d.grupos.map(g => g.ordem)) + 1
    const g = ok(await supabase.from('cs_grupos').insert({ nome, ordem }).select('*').single()) as Omit<Grupo, 'contratantes'>
    setD(prev => ({ ...prev, grupos: [...prev.grupos, { ...g, contratantes: [] }] }))
  }, [supabase, d.grupos])

  const renomearGrupo = useCallback(async (id: string, nome: string) => {
    ok(await supabase.from('cs_grupos').update({ nome }).eq('id', id))
    setD(prev => ({ ...prev, grupos: prev.grupos.map(g => (g.id === id ? { ...g, nome } : g)) }))
  }, [supabase])

  const setContratantesGrupo = useCallback(async (id: string, cods: string[]) => {
    const atuais = d.grupos.find(g => g.id === id)?.contratantes ?? []
    const sair = atuais.filter(c => !cods.includes(c)), entrar = cods.filter(c => !atuais.includes(c))
    if (sair.length) ok(await supabase.from('cs_grupo_contratantes').delete().eq('grupo_id', id).in('contratante_cod', sair))
    if (entrar.length) {
      const r = await supabase.from('cs_grupo_contratantes').insert(entrar.map(c => ({ grupo_id: id, contratante_cod: c })))
      if (r.error) {
        await carregar()
        throw new Error(r.error.code === '23505' ? 'Um contratante só pode estar em um grupo.' : r.error.message)
      }
    }
    setD(prev => ({ ...prev, grupos: prev.grupos.map(g => (g.id === id ? { ...g, contratantes: cods } : g)) }))
  }, [supabase, d.grupos, carregar])

  const excluirGrupo = useCallback(async (id: string) => {
    ok(await supabase.from('cs_grupos').delete().eq('id', id))
    setD(prev => ({
      ...prev,
      grupos: prev.grupos.filter(g => g.id !== id),
      gd: prev.gd.filter(x => x.grupo_id !== id),
      meds: prev.meds.map(m => (m.grupo_id === id ? { ...m, grupo_id: null } : m)),
    }))
  }, [supabase])

  // ── Documentos por grupo ────────────────────────────────────────────────────
  const copiarDocs = useCallback(async (to: string, ids: string[]) => {
    const novos = ids.filter(id => !d.gd.some(x => x.grupo_id === to && x.documento_id === id))
    if (novos.length) {
      ok(await supabase.from('cs_grupo_documentos').insert(novos.map(id => ({ grupo_id: to, documento_id: id, created_by: meuId }))))
      setD(prev => ({ ...prev, gd: [...prev.gd, ...novos.map(id => ({ grupo_id: to, documento_id: id }))] }))
    }
  }, [supabase, d.gd, meuId])

  const moverDocs = useCallback(async (from: string, to: string, ids: string[]) => {
    await copiarDocs(to, ids)
    ok(await supabase.from('cs_grupo_documentos').delete().eq('grupo_id', from).in('documento_id', ids))
    let levar = d.meds.filter(m => m.grupo_id === from && ids.includes(m.documento_id))
    // Copias de tempo padrao que ficariam repetidas no destino (mesma medicao original) saem antes
    const noDestino = d.meds.filter(m => m.grupo_id === to)
    const raizesDestino = new Set(noDestino.map(m => m.origem_id ?? m.id))
    const levarRaizes = new Set(levar.map(m => m.origem_id ?? m.id))
    const repetidas = [
      ...levar.filter(m => m.origem_id && raizesDestino.has(m.origem_id)),
      ...noDestino.filter(m => m.origem_id && levarRaizes.has(m.origem_id)),
    ].map(m => m.id)
    if (repetidas.length) {
      ok(await supabase.from('cs_medicoes').delete().in('id', repetidas))
      setD(prev => ({ ...prev, meds: prev.meds.filter(m => !repetidas.includes(m.id)) }))
      levar = levar.filter(m => !repetidas.includes(m.id))
    }
    if (levar.length) {
      ok(await supabase.from('cs_medicoes').update({ grupo_id: to }).eq('grupo_id', from).in('documento_id', ids))
      const nf = d.grupos.find(g => g.id === from)?.nome ?? '', nt = d.grupos.find(g => g.id === to)?.nome ?? ''
      ok(await supabase.from('cs_medicoes_hist').insert(levar.map(m => ({
        medicao_id: m.id, acao: 'moveu', detalhe: `De ${nf} para ${nt}`, usuario_id: meuId,
      }))))
    }
    setD(prev => ({
      ...prev,
      gd: prev.gd.filter(x => !(x.grupo_id === from && ids.includes(x.documento_id))),
      meds: prev.meds.map(m => (m.grupo_id === from && ids.includes(m.documento_id) ? { ...m, grupo_id: to } : m)),
    }))
  }, [supabase, copiarDocs, d.meds, d.grupos, meuId])

  /** Exclui a medicao (e as copias de tempo padrao feitas a partir dela). Sai do calculo na hora. */
  const excluirMedicao = useCallback(async (m: Medicao) => {
    ok(await supabase.from('cs_medicoes').delete().eq('id', m.id))
    setD(prev => ({ ...prev, meds: prev.meds.filter(x => x.id !== m.id && x.origem_id !== m.id) }))
  }, [supabase])

  /** Usa medicoes validadas como "tempo padrao" em outros grupos (copias ligadas a medicao original).
   *  O documento entra no grupo de destino se ainda nao estiver. Devolve quantas copias criou. */
  const transportarMedicoes = useCallback(async (meds: Medicao[], destinos: string[]) => {
    const rows: Record<string, unknown>[] = []
    const docsPorGrupo = new Map<string, Set<string>>()
    for (const m of meds) {
      if (m.situacao !== 'validada') continue
      const raiz = d.meds.find(x => x.id === (m.origem_id ?? m.id)) ?? m
      for (const g of destinos) {
        if (!g || g === raiz.grupo_id) continue
        const jaTem = d.meds.some(x => x.grupo_id === g && (x.id === raiz.id || x.origem_id === raiz.id))
          || rows.some(r => r.grupo_id === g && r.origem_id === raiz.id)
        if (jaTem) continue
        rows.push({
          grupo_id: g, documento_id: raiz.documento_id, duracao_ms: raiz.duracao_ms, resultado: raiz.resultado,
          situacao: 'validada', motivo: null, avaliador_id: raiz.avaliador_id, origem_id: raiz.id,
        })
        const s = docsPorGrupo.get(g)
        if (s) s.add(raiz.documento_id); else docsPorGrupo.set(g, new Set([raiz.documento_id]))
      }
    }
    if (!rows.length) return 0
    for (const [g, ds] of docsPorGrupo) await copiarDocs(g, [...ds])
    const r = await supabase.from('cs_medicoes').insert(rows).select('*')
    if (r.error) {
      if (/origem_id/.test(r.error.message)) throw new Error('Rode a migração sql/custo-servir-tempo-padrao.sql no Supabase antes de transportar medições.')
      throw new Error(r.error.code === '23505' ? 'Alguma dessas medições já está nesse grupo.' : r.error.message)
    }
    const novas = (r.data ?? []) as Medicao[]
    setD(prev => ({ ...prev, meds: [...novas, ...prev.meds] }))
    const grupoDaMed = new Map(d.meds.map(x => [x.id, x.grupo_id]))
    const nomeG = (id: string | null | undefined) => d.grupos.find(g => g.id === id)?.nome ?? 'outro grupo'
    ok(await supabase.from('cs_medicoes_hist').insert(novas.map(n => ({
      medicao_id: n.id, acao: 'transportou', detalhe: 'De ' + nomeG(grupoDaMed.get(n.origem_id ?? '')), usuario_id: meuId,
    }))))
    return novas.length
  }, [supabase, d.meds, d.grupos, copiarDocs, meuId])

  const removerDoGrupo = useCallback(async (g: string, doc: string) => {
    ok(await supabase.from('cs_grupo_documentos').delete().eq('grupo_id', g).eq('documento_id', doc))
    setD(prev => ({ ...prev, gd: prev.gd.filter(x => !(x.grupo_id === g && x.documento_id === doc)) }))
  }, [supabase])

  // ── Catalogo ────────────────────────────────────────────────────────────────
  const atualizarDoc = useCallback(async (id: string, patch: Partial<Documento>) => {
    const r = await supabase.from('cs_documentos').update(patch).eq('id', id)
    if (r.error) throw new Error(r.error.code === '23505' ? 'Já existe um documento com esse nome.' : r.error.message)
    setD(prev => ({ ...prev, docs: prev.docs.map(x => (x.id === id ? { ...x, ...patch } : x)) }))
  }, [supabase])

  /** Mesmo ajuste em varios documentos (ex.: classificar tipo pelo relatorio). */
  const atualizarDocs = useCallback(async (ids: string[], patch: Partial<Documento>) => {
    if (!ids.length) return
    for (let i = 0; i < ids.length; i += 200) ok(await supabase.from('cs_documentos').update(patch).in('id', ids.slice(i, i + 200)))
    setD(prev => ({ ...prev, docs: prev.docs.map(x => (ids.includes(x.id) ? { ...x, ...patch } : x)) }))
  }, [supabase])

  const adicionarDoc = useCallback(async (nome: string) => {
    const r = await supabase.from('cs_documentos').insert({ nome }).select('*').single()
    if (r.error) throw new Error(r.error.code === '23505' ? 'Já existe um documento com esse nome.' : r.error.message)
    const doc = r.data as Documento
    setD(prev => ({ ...prev, docs: [...prev.docs, doc] }))
    const p = d.grupos.find(g => g.padrao)
    if (p) await copiarDocs(p.id, [doc.id])   // documentos nascem no grupo padrao
  }, [supabase, d.grupos, copiarDocs])

  // ── Contratantes ────────────────────────────────────────────────────────────
  const salvarCtt = useCallback(async (cod: string, patch: Partial<Contratante>) => {
    const r = await supabase.from('cs_contratantes_fin').update(patch).eq('contratante_cod', cod)
    if (r.error) throw new Error(r.error.code === '23505' ? 'Já existe um contratante com esse código.' : r.error.message)
    // Troca de codigo propaga no banco (turnos, grupos, unidades): rele tudo
    if (patch.contratante_cod && patch.contratante_cod !== cod) { await carregar(); return }
    setD(prev => ({ ...prev, ctts: prev.ctts.map(c => (c.contratante_cod === cod ? { ...c, ...patch } : c)) }))
  }, [supabase, carregar])

  const adicionarCtt = useCallback(async (c: Contratante) => {
    const r = await supabase.from('cs_contratantes_fin').insert(c)
    if (r.error) throw new Error(r.error.code === '23505' ? 'Já existe um contratante com esse código.' : r.error.message)
    setD(prev => ({ ...prev, ctts: [...prev.ctts, c] }))
  }, [supabase])

  const excluirCtt = useCallback(async (cod: string) => {
    const r = await supabase.from('cs_contratantes_fin').delete().eq('contratante_cod', cod)
    if (r.error) throw new Error(r.error.code === '23503' ? 'Esse contratante tem turnos. Exclua ou mova os turnos antes.' : r.error.message)
    await carregar()   // grupos e unidades ligados a ele mudam no banco
  }, [supabase, carregar])

  // ── Turnos ──────────────────────────────────────────────────────────────────
  const salvarTurno = useCallback(async (turno: string, patch: Partial<Turno>) => {
    const r = await supabase.from('cs_turnos').update(patch).eq('turno_cod', turno)
    if (r.error) throw new Error(erroTurno(r.error))
    setD(prev => ({ ...prev, turnos: prev.turnos.map(t => (t.turno_cod === turno ? { ...t, ...patch } : t)) }))
  }, [supabase])

  const adicionarTurno = useCallback(async (t: Turno) => {
    const r = await supabase.from('cs_turnos').insert(t)
    if (r.error) throw new Error(erroTurno(r.error))
    setD(prev => ({ ...prev, turnos: [...prev.turnos, t] }))
  }, [supabase])

  /** Varios turnos de uma vez (ex.: faixa 4-13). Os que ja existem sao avisados, nao sobrescritos. */
  const adicionarTurnos = useCallback(async (ts: Turno[]) => {
    const existentes = new Set(d.turnos.map(t => t.turno_cod))
    const repetidos = ts.filter(t => existentes.has(t.turno_cod)).map(t => t.turno_cod)
    if (repetidos.length) throw new Error('Turno(s) já cadastrado(s): ' + repetidos.join(', ') + '. Arraste-os para mudar de contratante.')
    const r = await supabase.from('cs_turnos').insert(ts)
    if (r.error) throw new Error(erroTurno(r.error))
    setD(prev => ({ ...prev, turnos: [...prev.turnos, ...ts] }))
  }, [supabase, d.turnos])

  const excluirTurno = useCallback(async (turno: string) => {
    ok(await supabase.from('cs_turnos').delete().eq('turno_cod', turno))
    setD(prev => ({ ...prev, turnos: prev.turnos.filter(t => t.turno_cod !== turno) }))
  }, [supabase])

  // ── Configuracao ────────────────────────────────────────────────────────────
  const salvarConfig = useCallback(async (patch: Partial<Config>) => {
    ok(await supabase.from('cs_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1))
    setD(prev => ({ ...prev, cfg: prev.cfg ? { ...prev.cfg, ...patch } : prev.cfg }))
  }, [supabase])

  // ── Documentos exigidos por contratante (GT0010) ───────────────────────────
  /** Garante o grupo de criterio do contratante (cria "Grupo <nome>" se ele nao estiver em nenhum) e poe o
   *  documento nele. Devolve o nome do grupo quando precisou criar. */
  const garantirGrupoDoc = useCallback(async (documento_id: string, contratante_cod: string): Promise<string | null> => {
    let grupo = d.grupos.find(g => !g.padrao && g.contratantes.includes(contratante_cod))
    let criado: string | null = null
    if (!grupo) {
      const nomeC = d.ctts.find(c => c.contratante_cod === contratante_cod)?.nome ?? contratante_cod
      let nome = 'Grupo ' + nomeC
      if (d.grupos.some(g => g.nome === nome)) nome += ' (' + contratante_cod + ')'
      const ordem = Math.max(0, ...d.grupos.map(g => g.ordem)) + 1
      const g = ok(await supabase.from('cs_grupos').insert({ nome, ordem }).select('*').single()) as Omit<Grupo, 'contratantes'>
      ok(await supabase.from('cs_grupo_contratantes').insert({ grupo_id: g.id, contratante_cod }))
      grupo = { ...g, contratantes: [contratante_cod] }
      const novo = grupo
      setD(prev => ({ ...prev, grupos: [...prev.grupos, novo] }))
      criado = nome
    }
    const gid = grupo.id
    if (!d.gd.some(x => x.grupo_id === gid && x.documento_id === documento_id)) {
      ok(await supabase.from('cs_grupo_documentos').upsert({ grupo_id: gid, documento_id, created_by: meuId }, { onConflict: 'grupo_id,documento_id', ignoreDuplicates: true }))
      setD(prev => (prev.gd.some(x => x.grupo_id === gid && x.documento_id === documento_id) ? prev : { ...prev, gd: [...prev.gd, { grupo_id: gid, documento_id }] }))
    }
    return criado
  }, [supabase, d.grupos, d.ctts, d.gd, meuId])

  /** Vincula o documento ao contratante (GT0010) e ja coloca no grupo de criterio dele. */
  const vincularDoc = useCallback(async (documento_id: string, contratante_cod: string, origem: DocCtt['origem'] = 'contratante'): Promise<string | null> => {
    if (!d.exig.some(x => x.documento_id === documento_id && x.contratante_cod === contratante_cod && x.origem === origem)) {
      const doc = d.docs.find(x => x.id === documento_id)
      const row: DocCtt = { documento_id, contratante_cod, origem, tipo_doc: doc?.tipo === 'pessoa' ? 'C' : doc?.tipo === 'empresa' ? 'E' : null, periodicidade: null, bloqueia_acesso: false, data_inicio: null, ativo: true, qtd_contratos: 1 }
      ok(await supabase.from('cs_documento_contratantes').insert(row))
      setD(prev => ({ ...prev, exig: [...prev.exig, row] }))
    }
    return garantirGrupoDoc(documento_id, contratante_cod)
  }, [supabase, d.exig, d.docs, garantirGrupoDoc])
  /** Remove o vinculo. Tira o documento do grupo do contratante se ninguem mais do grupo o exige e nao ha medicoes. */
  const desvincularDoc = useCallback(async (documento_id: string, contratante_cod: string, origem: DocCtt['origem']) => {
    ok(await supabase.from('cs_documento_contratantes').delete().eq('documento_id', documento_id).eq('contratante_cod', contratante_cod).eq('origem', origem))
    const resto = d.exig.filter(x => !(x.documento_id === documento_id && x.contratante_cod === contratante_cod && x.origem === origem))
    setD(prev => ({ ...prev, exig: prev.exig.filter(x => !(x.documento_id === documento_id && x.contratante_cod === contratante_cod && x.origem === origem)) }))
    const grupo = d.grupos.find(g => !g.padrao && g.contratantes.includes(contratante_cod))
    if (!grupo) return
    const aindaExigido = resto.some(x => x.documento_id === documento_id && x.ativo && grupo.contratantes.includes(x.contratante_cod))
    const temMedicao = d.meds.some(m => m.grupo_id === grupo.id && m.documento_id === documento_id)
    if (!aindaExigido && !temMedicao) {
      ok(await supabase.from('cs_grupo_documentos').delete().eq('grupo_id', grupo.id).eq('documento_id', documento_id))
      setD(prev => ({ ...prev, gd: prev.gd.filter(x => !(x.grupo_id === grupo.id && x.documento_id === documento_id)) }))
    }
  }, [supabase, d.exig, d.grupos, d.meds])
  const ativarVinculo = useCallback(async (v: DocCtt, ativo: boolean) => {
    ok(await supabase.from('cs_documento_contratantes').update({ ativo }).eq('documento_id', v.documento_id).eq('contratante_cod', v.contratante_cod).eq('origem', v.origem))
    setD(prev => ({ ...prev, exig: prev.exig.map(x => (x === v || (x.documento_id === v.documento_id && x.contratante_cod === v.contratante_cod && x.origem === v.origem) ? { ...x, ativo } : x)) }))
    return ativo ? garantirGrupoDoc(v.documento_id, v.contratante_cod) : null
  }, [supabase, garantirGrupoDoc])

  // ── Relatorios ──────────────────────────────────────────────────────────────
  const importarRelatorio = useCallback(async (nome: string, dias: number | null, ls: LinhaRel[]) => {
    const rel = ok(await supabase.from('cs_relatorios').insert({ nome, dias_uteis: dias, created_by: meuId }).select('*').single()) as Relatorio
    try {
      for (let i = 0; i < ls.length; i += 500) {
        ok(await supabase.from('cs_relatorio_linhas').insert(ls.slice(i, i + 500).map(l => ({ ...l, relatorio_id: rel.id }))))
      }
    } catch (e) {
      await supabase.from('cs_relatorios').delete().eq('id', rel.id)   // nao deixa relatorio pela metade
      throw e
    }
    setLinhasDe({ id: rel.id, linhas: ls })
    setRelId(rel.id)
    setD(prev => ({ ...prev, rels: [rel, ...prev.rels] }))
  }, [supabase, meuId])

  const atualizarRelatorio = useCallback(async (id: string, patch: Partial<Relatorio>) => {
    ok(await supabase.from('cs_relatorios').update(patch).eq('id', id))
    setD(prev => ({ ...prev, rels: prev.rels.map(r => (r.id === id ? { ...r, ...patch } : r)) }))
  }, [supabase])

  const excluirRelatorio = useCallback(async (id: string) => {
    ok(await supabase.from('cs_relatorios').delete().eq('id', id))
    setRelId(null)
    setD(prev => ({ ...prev, rels: prev.rels.filter(r => r.id !== id) }))
  }, [supabase])

  return {
    d, ctx, carregando, erro, meuId, papel, recarregar: carregar, carregarMedicoes,
    relSel, linhas, carregandoLinhas, selecionarRelatorio: setRelId,
    registrarMedicao, alternarMedicao, excluirMedicao, transportarMedicoes, historico,
    criarGrupo, renomearGrupo, setContratantesGrupo, excluirGrupo,
    copiarDocs, moverDocs, removerDoGrupo, atualizarDoc, atualizarDocs, adicionarDoc,
    salvarCtt, adicionarCtt, excluirCtt, salvarTurno, adicionarTurno, adicionarTurnos, excluirTurno,
    vincularDoc, desvincularDoc, ativarVinculo, salvarConfig, importarRelatorio, atualizarRelatorio, excluirRelatorio,
  }
}

export type CsApi = ReturnType<typeof useCsDataInterno> & {
  toast: (msg: string) => void
  /** Executa uma gravacao mostrando o erro em toast; devolve false se falhou. */
  tentar: (fn: () => Promise<unknown>, msgOk?: string) => Promise<boolean>
  irCronometro: (g: string, d: string) => void
  /** Abre Configuracoes numa sub-aba (ex.: 'catalogo', 'turnos'). */
  irConfig: (sub: string) => void
  cfgSub: string
  setCfgSub: (s: string) => void
}

const CsContext = createContext<CsApi | null>(null)

export function CsProvider({ children, toast, irCronometro, irConfig, cfgSub, setCfgSub }: {
  children: React.ReactNode
  toast: (msg: string) => void
  irCronometro: (g: string, d: string) => void
  irConfig: (sub: string) => void
  cfgSub: string
  setCfgSub: (s: string) => void
}) {
  const api = useCsDataInterno()
  const tentar = useCallback(async (fn: () => Promise<unknown>, msgOk?: string) => {
    try { await fn(); if (msgOk) toast(msgOk); return true }
    catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível salvar'); return false }
  }, [toast])
  const value = useMemo(() => ({ ...api, toast, tentar, irCronometro, irConfig, cfgSub, setCfgSub }), [api, toast, tentar, irCronometro, irConfig, cfgSub, setCfgSub])
  return <CsContext.Provider value={value}>{children}</CsContext.Provider>
}

export function useCs() {
  const v = useContext(CsContext)
  if (!v) throw new Error('useCs fora do CsProvider')
  return v
}
