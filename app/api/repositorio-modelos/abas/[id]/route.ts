import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { label?: string }
  const label = String(body.label ?? '').trim()
  if (!label) return Response.json({ error: 'Informe o nome da aba' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('repositorio_abas')
    .update({ label })
    .eq('id', id)
    .select('id, label, ordem')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

/** Só exclui aba vazia — os arquivos precisam ser movidos ou excluídos antes. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { count } = await admin
    .from('repositorio_modelos')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', id)

  if ((count ?? 0) > 0) {
    return Response.json({ error: 'A aba ainda tem arquivos — mova ou exclua-os antes' }, { status: 400 })
  }

  const { count: total } = await admin.from('repositorio_abas').select('id', { count: 'exact', head: true })
  if ((total ?? 0) <= 1) return Response.json({ error: 'É preciso manter ao menos uma aba' }, { status: 400 })

  const { error } = await admin.from('repositorio_abas').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
