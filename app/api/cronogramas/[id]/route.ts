import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../lib/api-helpers'
import { CRONO_SELECT } from '../../../cronogramas/model'

type Params = { params: Promise<{ id: string }> }

function itensValidos(v: unknown): boolean {
  return Array.isArray(v) && v.every(i => i && typeof i === 'object' && typeof (i as { id?: unknown }).id === 'string' && typeof (i as { t?: unknown }).t === 'string')
}

/** Salva as etapas (lista completa) e/ou renomeia contratante/projeto. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.cliente === 'string' && body.cliente.trim()) patch.cliente = body.cliente.trim()
  if (typeof body.projeto === 'string' && body.projeto.trim()) patch.projeto = body.projeto.trim()
  if (body.itens !== undefined) {
    if (!itensValidos(body.itens)) return Response.json({ error: 'Lista de etapas inválida' }, { status: 400 })
    patch.itens = body.itens
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cronogramas')
    .update(patch)
    .eq('id', id)
    .select(CRONO_SELECT)
    .single()
  if (error) {
    if (error.code === '23505') return Response.json({ error: 'Já existe um cronograma desse contratante com esse nome de projeto' }, { status: 409 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('cronogramas').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
