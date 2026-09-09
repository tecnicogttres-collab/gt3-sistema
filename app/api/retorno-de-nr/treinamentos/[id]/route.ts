import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../lib/api-helpers'
import { normalizaItens } from '../../itens'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.nome !== undefined) {
    const nome = String(body.nome).trim()
    if (!nome) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })
    updates.nome = nome
  }
  if (body.descricao !== undefined) updates.descricao = String(body.descricao).trim()
  if (body.ativo !== undefined) updates.ativo = Boolean(body.ativo)
  if (body.ordem !== undefined) updates.ordem = Number(body.ordem) || 0
  if (body.itens !== undefined) updates.itens = normalizaItens(body.itens)

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }
  updates.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('rnr_treinamentos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Remove o treinamento das combinações e descarta as que ficarem com menos de dois.
  const { data: combos } = await admin.from('rnr_combos').select('id, treinamento_ids')
  for (const c of (combos ?? []) as { id: string; treinamento_ids: string[] }[]) {
    if (!c.treinamento_ids.includes(id)) continue
    const restantes = c.treinamento_ids.filter(t => t !== id)
    if (restantes.length > 1) await admin.from('rnr_combos').update({ treinamento_ids: restantes }).eq('id', c.id)
    else await admin.from('rnr_combos').delete().eq('id', c.id)
  }

  const { error } = await admin.from('rnr_treinamentos').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
