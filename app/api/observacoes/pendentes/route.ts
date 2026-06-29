import { createAdminClient } from '../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../lib/api-helpers'

// Observações aguardando validação (criadas/editadas), para o dashboard do gestor/admin.
// Quando o gestor/admin valida, status_edicao vira 'validado' e some daqui.
export async function GET() {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json([]) // colaborador/sem permissão: nada a validar

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('observacoes')
    .select('id, categoria, coluna, motivo, criado_por, atualizado_por, atualizado_em, created_at')
    .eq('status_edicao', 'pendente_validacao')
    .order('atualizado_em', { ascending: false, nullsFirst: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const ids = [...new Set(rows.flatMap(r => [r.atualizado_por, r.criado_por]).filter(Boolean))] as string[]
  let nameMap: Record<string, string> = {}
  if (ids.length) {
    const { data: profs } = await admin.from('profiles').select('id, nome').in('id', ids)
    nameMap = Object.fromEntries((profs ?? []).map(p => [p.id, p.nome as string]))
  }

  return Response.json(rows.map(r => ({
    id: r.id,
    categoria: r.categoria,
    coluna: r.coluna,
    motivo: r.motivo,
    autor: nameMap[(r.atualizado_por ?? r.criado_por) as string] ?? null,
    quando: r.atualizado_em ?? r.created_at,
  })))
}
