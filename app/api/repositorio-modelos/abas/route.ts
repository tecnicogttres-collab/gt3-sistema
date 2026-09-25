import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser, requireGestorAdmin } from '../../../lib/api-helpers'

// Abas usadas enquanto a tabela repositorio_abas ainda não existe (migração pendente)
const ABAS_PADRAO = [
  { id: 'empresas',     label: 'Empresas',     ordem: 1 },
  { id: 'funcionarios', label: 'Funcionários', ordem: 2 },
  { id: 'gt3',          label: 'GT3',          ordem: 3 },
]

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('repositorio_abas')
    .select('id, label, ordem')
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (error || !data?.length) return Response.json(ABAS_PADRAO)
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { label?: string }
  const label = String(body.label ?? '').trim()
  if (!label) return Response.json({ error: 'Informe o nome da aba' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existentes, error: listErr } = await admin.from('repositorio_abas').select('id, ordem')
  if (listErr) return Response.json({ error: 'Tabela de abas não encontrada — rode a migração sql/repositorio-modelos-abas.sql' }, { status: 500 })

  const ids = new Set((existentes ?? []).map(a => a.id))
  const base = slugify(label) || 'aba'
  let id = base
  for (let i = 2; ids.has(id); i++) id = `${base}-${i}`
  const ordem = Math.max(0, ...(existentes ?? []).map(a => a.ordem ?? 0)) + 1

  const { data, error } = await admin
    .from('repositorio_abas')
    .insert({ id, label, ordem })
    .select('id, label, ordem')
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
    const { error } = await admin.from('repositorio_abas').update({ ordem: i + 1 }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
