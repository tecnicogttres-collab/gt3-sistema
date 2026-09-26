import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../lib/api-helpers'

// Ordem/seção das observações dentro de cada coluna (tabela observacoes_card_ordem)

export async function GET(req: NextRequest) {
  const categoria = new URL(req.url).searchParams.get('categoria')
  if (!categoria) return Response.json([])

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('observacoes_card_ordem')
    .select('subtab, coluna, motivo, group_name, ordem')
    .eq('categoria', categoria)
    .order('ordem', { ascending: true })

  // Tabela ainda não criada → segue sem ordem customizada
  if (error) return Response.json([])
  return Response.json(data ?? [])
}

// Substitui a ordem inteira de uma coluna
export async function POST(req: NextRequest) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as {
    categoria: string
    subtab: string
    coluna: string
    items: Array<{ motivo: string; group_name: string | null }>
  }
  if (!body.categoria || !body.coluna || !Array.isArray(body.items)) {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const seen = new Set<string>()
  const rows = body.items
    .filter(i => i.motivo && !seen.has(i.motivo) && seen.add(i.motivo))
    .map((i, idx) => ({
      categoria: body.categoria,
      subtab: body.subtab ?? '',
      coluna: body.coluna,
      motivo: i.motivo,
      group_name: i.group_name?.trim() || null,
      ordem: idx,
      atualizado_por: caller.user.id,
      updated_at: new Date().toISOString(),
    }))

  const admin = createAdminClient()
  const { error: delError } = await admin
    .from('observacoes_card_ordem')
    .delete()
    .eq('categoria', body.categoria)
    .eq('subtab', body.subtab ?? '')
    .eq('coluna', body.coluna)
  if (delError) return Response.json({ error: delError.message }, { status: 500 })

  if (rows.length > 0) {
    const { error } = await admin.from('observacoes_card_ordem').insert(rows)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
