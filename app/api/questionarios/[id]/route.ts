import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'
import { QN_SELECT } from '../../../questionarios/types'
import { podeAcessarQn, ehGestorAdmin, naoEncontrado } from '../../../lib/questionarios-acesso'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })
  const admin = createAdminClient()
  if (!await podeAcessarQn(admin, id, caller.role)) return naoEncontrado()

  const body = await req.json() as Record<string, unknown>
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.titulo === 'string') patch.titulo = body.titulo
  if (body.publico === 'Contratante' || body.publico === 'Prestador' || body.publico === 'Colaborador') patch.publico = body.publico
  if (typeof body.restrito === 'boolean') {
    if (!ehGestorAdmin(caller.role)) return Response.json({ error: 'Só admin e gestor podem mudar quem vê o questionário' }, { status: 403 })
    patch.restrito = body.restrito
  }
  if (body.status === 'rascunho' || body.status === 'ativo' || body.status === 'encerrado') patch.status = body.status
  if (Array.isArray(body.perguntas)) patch.perguntas = body.perguntas
  if (body.painel_config && typeof body.painel_config === 'object') patch.painel_config = body.painel_config

  const { data, error } = await admin
    .from('questionarios')
    .update(patch)
    .eq('id', id)
    .select(QN_SELECT)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

/** Exclui o questionário e, em cascata, os convites e respostas dele. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  if (!await podeAcessarQn(admin, id, caller.role)) return naoEncontrado()
  const { error } = await admin.from('questionarios').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
