import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller, getCallerWithNome } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const SELECT_FIELDS = 'id, nome, periodo, dados, created_at, updated_at, atualizado_por_nome'

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('anotacoes_cic')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCallerWithNome()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    atualizado_por: caller.user.id,
    atualizado_por_nome: caller.nome || caller.user.email || 'Usuário',
  }
  if (body.nome !== undefined) update.nome = String(body.nome).trim()
  if (body.periodo !== undefined) update.periodo = String(body.periodo).trim()
  if (body.dados !== undefined) update.dados = body.dados

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('anotacoes_cic')
    .update(update)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Auto-populate banco_empresas_cic with any new company names
  if (body.dados && Array.isArray(body.dados)) {
    const nomes = (body.dados as { nome?: string }[])
      .map(e => (e.nome ?? '').trim())
      .filter(Boolean)
      .map(nome => ({ nome }))
    if (nomes.length) {
      await admin.from('banco_empresas_cic').upsert(nomes, { onConflict: 'nome', ignoreDuplicates: true })
    }
  }

  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.from('anotacoes_cic').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
