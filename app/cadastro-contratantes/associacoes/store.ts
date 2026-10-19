// Persistência das associações. Usa o Supabase; se as tabelas ainda não existem
// (SQL sql/contratantes-associacoes.sql não executado), cai para o localStorage
// deste navegador — dá para testar em localhost antes de rodar o SQL.

import { createClient } from '../../lib/supabase'
import type { Associacao, PerfilAssoc } from './model'

const LS_PERFIS = 'gt3-assoc-perfis'
const LS_ASSOC = 'gt3-assoc-associacoes'

let modoLocal = false
export function emModoLocal() { return modoLocal }

function tabelaAusente(err: { code?: string; message?: string } | null) {
  if (!err) return false
  return err.code === '42P01' || err.code === 'PGRST205' || /does not exist|could not find the table/i.test(err.message ?? '')
}

function lsLer<T>(k: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(k) || '{}') } catch { return {} }
}
function lsGravar<T>(k: string, v: Record<string, T>) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch {}
}

export async function carregarTudo(): Promise<{ perfis: Record<string, PerfilAssoc>; associacoes: Associacao[] }> {
  const supabase = createClient()
  const [p, a] = await Promise.all([
    supabase.from('contratantes_assoc_perfis').select('contratante_id, dados'),
    supabase.from('contratantes_associacoes').select('id, dados').order('updated_at', { ascending: false }),
  ])
  if (tabelaAusente(p.error) || tabelaAusente(a.error)) {
    modoLocal = true
    const assoc = Object.values(lsLer<Associacao>(LS_ASSOC)).sort((x, y) => y.atualizadoEm.localeCompare(x.atualizadoEm))
    return { perfis: lsLer<PerfilAssoc>(LS_PERFIS), associacoes: assoc }
  }
  if (p.error) console.error('Erro ao carregar configurações de associação:', p.error)
  if (a.error) console.error('Erro ao carregar associações:', a.error)
  const perfis: Record<string, PerfilAssoc> = {}
  for (const r of p.data ?? []) perfis[r.contratante_id] = { ...(r.dados as PerfilAssoc), contratanteId: r.contratante_id }
  const associacoes = (a.data ?? []).map(r => ({ ...(r.dados as Associacao), id: r.id }))
  return { perfis, associacoes }
}

export async function salvarPerfil(perfil: PerfilAssoc): Promise<boolean> {
  if (modoLocal) {
    const all = lsLer<PerfilAssoc>(LS_PERFIS); all[perfil.contratanteId] = perfil; lsGravar(LS_PERFIS, all)
    return true
  }
  const { error } = await createClient().from('contratantes_assoc_perfis')
    .upsert({ contratante_id: perfil.contratanteId, dados: perfil })
  if (error) console.error('Erro ao salvar configuração:', error)
  return !error
}

export async function salvarAssociacao(a: Associacao): Promise<boolean> {
  if (modoLocal) {
    const all = lsLer<Associacao>(LS_ASSOC); all[a.id] = a; lsGravar(LS_ASSOC, all)
    return true
  }
  const { error } = await createClient().from('contratantes_associacoes')
    .upsert({ id: a.id, dados: a, status: a.status })
  if (error) console.error('Erro ao salvar associação:', error)
  return !error
}

export async function excluirAssociacao(id: string): Promise<boolean> {
  if (modoLocal) {
    const all = lsLer<Associacao>(LS_ASSOC); delete all[id]; lsGravar(LS_ASSOC, all)
    return true
  }
  const { error } = await createClient().from('contratantes_associacoes').delete().eq('id', id)
  if (error) console.error('Erro ao excluir associação:', error)
  return !error
}

export async function nomeUsuarioAtual(): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return ''
  const { data: p } = await supabase.from('profiles').select('nome').eq('id', data.user.id).maybeSingle()
  return (p?.nome as string | undefined) ?? data.user.email ?? ''
}
