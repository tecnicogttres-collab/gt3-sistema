import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'
import { QN_SELECT, gerarToken } from '../../../../questionarios/types'

type Params = { params: Promise<{ id: string }> }

/** Liga o link anônimo (ou troca por um novo — o anterior para de funcionar). */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Só admin e gestor podem gerar o link anônimo' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('questionarios')
    .update({ link_anonimo: gerarToken(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(QN_SELECT)
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Questionário não encontrado' }, { status: 404 })
  return Response.json(data)
}

/** Desliga o link anônimo. Respostas já recebidas continuam guardadas. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Só admin e gestor podem desligar o link anônimo' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('questionarios')
    .update({ link_anonimo: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(QN_SELECT)
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Questionário não encontrado' }, { status: 404 })
  return Response.json(data)
}
