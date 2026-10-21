import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../lib/api-helpers'

const TABELA = 'workflow_programas_concessoes_psico'
const CAMPOS = [
  'empresa', 'cnpj', 'contratante_id', 'contratante_nome', 'autorizado_por', 'data_autorizacao',
  'prazo_original', 'prazo_concedido', 'obs', 'encerrada_em', 'encerrada_motivo', 'encerrada_analise_id',
] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of CAMPOS) if (body[k] !== undefined) updates[k] = body[k]

  const admin = createAdminClient()
  let q = admin.from(TABELA).update(updates).eq('id', id)
  // Encerramento automático: só grava se ainda estiver ativa — duas abas abertas ao mesmo
  // tempo não sobrescrevem a data/análise do primeiro encerramento.
  if (body.encerrada_motivo === 'checklist_aprovado') q = q.is('encerrada_em', null)
  const { data, error } = await q.select().maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) {
    const { data: atual } = await admin.from(TABELA).select('*').eq('id', id).maybeSingle()
    if (!atual) return Response.json({ error: 'Concessão não encontrada' }, { status: 404 })
    return Response.json(atual)
  }
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: prof } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  const papel = (prof as { papel?: string } | null)?.papel ?? ''
  const { data: row } = await admin.from(TABELA).select('criado_por').eq('id', id).single()

  if (row && row.criado_por !== user.id && !['admin', 'gestor'].includes(papel)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { error } = await admin.from(TABELA).delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
