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

  // Nomes/competências de PDIs do banco.
  // ATENÇÃO: pdis.id é UUID, mas alguns pdi_ciclos.pdi_id são slugs estáticos
  // (ex.: "mariane-borges"). Passar slugs no .in() quebra o filtro com
  // "invalid input syntax for type uuid" e zera o dbMap — por isso só enviamos UUIDs.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const pdiIds = [...new Set((ciclos ?? []).map(c => c.pdi_id))].filter(id => UUID_RE.test(id))
  const { data: dbPdis } = await admin
    .from('pdis')
    .select('id, nome, competencias')
    .in('id', pdiIds)

  const dbMap = Object.fromEntries((dbPdis ?? []).map(p => [
    p.id,
    { nome: p.nome as string, competencias: (p.competencias as string[] | null) ?? [] },
  ]))

  // Agrupa por PERÍODO do ciclo (data_inicio + data_fim), não por numero_ciclo:
  // assim todos os colaboradores do mesmo período (ex.: dez/25–mai/26) caem no mesmo
  // card, mesmo que o número do ciclo varie entre eles (novas contratações etc.).
  // Deduplica por nome (há registros estáticos + migrados da mesma pessoa).
  type Pessoa = { nome: string; diretiva: number[]; auto: number[]; ambicao: number[] }
  type Grupo = {
    data_inicio: string | null
    data_fim: string | null
    numeros: Set<number>
    competencias: string[]
    pessoas: Map<string, Pessoa>
  }
  const grupos = new Map<string, Grupo>()

  const filledCount = (a: number[]) => a.filter(v => v && v > 0).length
  const pickArr = (a: number[], b: number[]) => (filledCount(b) > filledCount(a) ? b : a)
  // Prefere nome em caixa normal a um nome todo em maiúsculas
  const pickNome = (a: string, b: string) => {
    const aOk = /[a-zà-ÿ]/.test(a), bOk = /[a-zà-ÿ]/.test(b)
    if (aOk && !bOk) return a
    if (bOk && !aOk) return b
    return a
  }

  for (const c of ciclos ?? []) {
    const dir: number[] = c.avaliacao_diretiva ?? []
    const auto: number[] = c.autoavaliacao ?? []
    const amb: number[] = c.ambicao ?? []

    // Ignora ciclos sem nenhum dado preenchido
    if (!dir.length && !auto.length && !amb.length) continue

    const info = staticMap[c.pdi_id] ?? dbMap[c.pdi_id]
    if (!info) continue

    const key = `${c.data_inicio ?? '?'}|${c.data_fim ?? '?'}`
    let g = grupos.get(key)
    if (!g) {
      g = {
        data_inicio: (c.data_inicio as string | null) ?? null,
        data_fim: (c.data_fim as string | null) ?? null,
        numeros: new Set(),
        competencias: [],
        pessoas: new Map(),
      }
      grupos.set(key, g)
    }
    g.numeros.add(c.numero_ciclo)
    if (!g.competencias.length && info.competencias.length) g.competencias = info.competencias

    const nomeKey = info.nome.trim().toLowerCase()
    const ex = g.pessoas.get(nomeKey)
    if (!ex) {
      g.pessoas.set(nomeKey, { nome: info.nome, diretiva: dir, auto, ambicao: amb })
    } else {
      g.pessoas.set(nomeKey, {
        nome: pickNome(ex.nome, info.nome),
        diretiva: pickArr(ex.diretiva, dir),
        auto: pickArr(ex.auto, auto),
        ambicao: pickArr(ex.ambicao, amb),
      })
    }
  }

  const result = [...grupos.entries()]
    .map(([key, g]) => ({
      key,
      numero: Math.min(...g.numeros),
      data_inicio: g.data_inicio,
      data_fim: g.data_fim,
      competencias: g.competencias,
      pessoas: [...g.pessoas.values()]
        .map(p => ({ nome: shortenName(p.nome), diretiva: p.diretiva, auto: p.auto, ambicao: p.ambicao }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }))
    // Mais recente primeiro
    .sort((a, b) => (b.data_inicio ?? '').localeCompare(a.data_inicio ?? ''))

  return Response.json(result)
}
