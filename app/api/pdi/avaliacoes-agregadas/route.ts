import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'
import * as allPdis from '../../../../data/pdis/index'
import type { PdiColaborador } from '../../../../data/pdis/types'

const staticMap = Object.values(allPdis).reduce<Record<string, { nome: string; competencias: string[] }>>((acc, p) => {
  const pdi = p as PdiColaborador
  acc[pdi.id] = { nome: pdi.nome, competencias: pdi.matrizAvaliacao.competencias }
  return acc
}, {})

function shortenName(nome: string): string {
  const parts = nome.trim().split(' ')
  if (parts.length <= 2) return nome
  return `${parts[0]} ${parts[parts.length - 1]}`
}

export async function GET() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (!['gestor', 'admin'].includes(profile?.papel ?? ''))
    return Response.json({ error: 'Sem permissão' }, { status: 403 })

  // Ciclos com dados de avaliação
  const { data: ciclos, error } = await admin
    .from('pdi_ciclos')
    .select('pdi_id, numero_ciclo, avaliacao_diretiva, autoavaliacao, ambicao, data_inicio, data_fim')
    .order('numero_ciclo', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Nomes de PDIs do banco (UUIDs migrados)
  const pdiIds = [...new Set((ciclos ?? []).map(c => c.pdi_id))]
  const { data: dbPdis } = await admin
    .from('pdis')
    .select('id, nome, competencias')
    .in('id', pdiIds)

  const dbMap = Object.fromEntries((dbPdis ?? []).map(p => [
    p.id,
    { nome: p.nome as string, competencias: (p.competencias as string[] | null) ?? [] },
  ]))

  // Agrupa por numero_ciclo; registra data_inicio/data_fim do primeiro ciclo do grupo
  const grouped = new Map<number, { nome: string; diretiva: number[]; auto: number[]; ambicao: number[] }[]>()
  const groupMeta = new Map<number, { data_inicio: string | null; data_fim: string | null }>()
  let competencias: string[] = []

  for (const c of ciclos ?? []) {
    const dir: number[] = c.avaliacao_diretiva ?? []
    const auto: number[] = c.autoavaliacao ?? []
    const amb: number[] = c.ambicao ?? []

    // Ignora ciclos sem nenhum dado preenchido
    if (!dir.length && !auto.length && !amb.length) continue

    const info = staticMap[c.pdi_id] ?? dbMap[c.pdi_id]
    if (!info) continue

    if (!competencias.length && info.competencias.length) competencias = info.competencias

    const pessoas = grouped.get(c.numero_ciclo) ?? []
    pessoas.push({ nome: shortenName(info.nome), diretiva: dir, auto, ambicao: amb })
    grouped.set(c.numero_ciclo, pessoas)

    if (!groupMeta.has(c.numero_ciclo)) {
      groupMeta.set(c.numero_ciclo, {
        data_inicio: (c.data_inicio as string | null) ?? null,
        data_fim: (c.data_fim as string | null) ?? null,
      })
    }
  }

  const result = Array.from(grouped.entries())
    .map(([numero, pessoas]) => ({
      numero,
      data_inicio: groupMeta.get(numero)?.data_inicio ?? null,
      data_fim: groupMeta.get(numero)?.data_fim ?? null,
      competencias,
      pessoas: pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }))

  return Response.json(result)
}
