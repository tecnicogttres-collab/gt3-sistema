// Persistência das configurações de associação (a associação em si não é gravada). Usa o Supabase; se as tabelas ainda não existem
// (SQL sql/contratantes-associacoes.sql não executado), cai para o localStorage
// deste navegador — dá para testar em localhost antes de rodar o SQL.

import { createClient } from '../../lib/supabase'
import type { PerfilAssoc } from './model'

const LS_PERFIS = 'gt3-assoc-perfis'

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

export async function carregarPerfis(): Promise<Record<string, PerfilAssoc>> {
  const { data, error } = await createClient().from('contratantes_assoc_perfis').select('contratante_id, dados')
  if (tabelaAusente(error)) { modoLocal = true; return lsLer<PerfilAssoc>(LS_PERFIS) }
  if (error) console.error('Erro ao carregar configurações de associação:', error)
  const perfis: Record<string, PerfilAssoc> = {}
  for (const r of data ?? []) perfis[r.contratante_id] = { ...(r.dados as PerfilAssoc), contratanteId: r.contratante_id }
  return perfis
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
