import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser, requireGestorAdmin } from '../../../lib/api-helpers'

const SELECT = 'id, nome, cor, ordem'

// Categorias usadas enquanto a tabela repositorio_categorias ainda não existe (migração pendente)
const CATEGORIAS_PADRAO = [
  { id: 'SST',      nome: 'SST',      cor: 'verde',   ordem: 1 },
  { id: 'Fiscal',   nome: 'Fiscal',   cor: 'azul',    ordem: 2 },
  { id: 'Jurídico', nome: 'Jurídico', cor: 'roxo',    ordem: 3 },
  { id: 'RH',       nome: 'RH',       cor: 'laranja', ordem: 4 },
  { id: 'Outros',   nome: 'Outros',   cor: 'cinza',   ordem: 5 },
]

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('repositorio_categorias')
    .select(SELECT)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (error || !data?.length) return Response.json(CATEGORIAS_PADRAO)
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { nome?: string; cor?: string }
  const nome = String(body.nome ?? '').trim()
  if (!nome) return Response.json({ error: 'Informe o nome da categoria' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existentes, error: listErr } = await admin.from('repositorio_categorias').select('nome, ordem')
  if (listErr) return Response.json({ error: 'Tabela de categorias não encontrada — rode a migração sql/repositorio-modelos-categorias.sql' }, { status: 500 })
  if ((existentes ?? []).some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
    return Response.json({ error: 'Já existe uma categoria com esse nome' }, { status: 400 })
  }
  const ordem = Math.max(0, ...(existentes ?? []).map(c => c.ordem ?? 0)) + 1

  const { data, error } = await admin
    .from('repositorio_categorias')
    .insert({ nome, cor: body.cor || 'cinza', ordem })
    .select(SELECT)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

/** Reordena: recebe a lista completa de ids na nova ordem. */
export async function PUT(req: NextRequest) {
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { ordem?: string[] }
  const ordem = Array.isArray(body.ordem) ? body.ordem : []
  const admin = createAdminClient()
  for (const [i, id] of ordem.entries()) {
    const { error } = await admin.from('repositorio_categorias').update({ ordem: i + 1 }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
