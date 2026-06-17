import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

async function getCallerAndRole() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { user: null, papel: null }
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()
  return { user, papel: profile?.papel as string | null }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, papel } = await getCallerAndRole()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!papel || !['gestor', 'admin'].includes(papel)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const { motivo, parecer, imagem_url } = body
  if (!motivo?.trim()) {
    return Response.json({ error: 'motivo obrigatório' }, { status: 400 })
  }
  if (!imagem_url && !parecer?.trim()) {
    return Response.json({ error: 'parecer ou imagem obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('observacoes')
    .update({
      motivo: motivo.trim(),
      parecer: parecer.trim(),
      editado_por: user.id,
      imagem_url: imagem_url !== undefined ? imagem_url : undefined,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, papel } = await getCallerAndRole()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  async function withProfile(row: Record<string, unknown>) {
    if (!row.atualizado_por) return { ...row, atualizado_por_profile: null }
    const { data: prof } = await admin.from('profiles').select('nome').eq('id', row.atualizado_por as string).single()
    return { ...row, atualizado_por_profile: prof ? { nome: prof.nome } : null }
  }

  if (body.action === 'validate') {
    if (!['gestor', 'admin'].includes(papel ?? '')) {
      return Response.json({ error: 'Sem permissão' }, { status: 403 })
    }
    const { data, error } = await admin
      .from('observacoes')
      .update({ status_edicao: 'validado' })
      .eq('id', id)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(await withProfile(data))
  }

  const { parecer, motivo } = body
  if (!parecer?.trim()) return Response.json({ error: 'parecer obrigatório' }, { status: 400 })

  const { data: current } = await admin
    .from('observacoes')
    .select('parecer')
    .eq('id', id)
    .single()

  const updatePayload: Record<string, unknown> = {
    parecer: parecer.trim(),
    parecer_anterior: current?.parecer ?? null,
    atualizado_por: user.id,
    atualizado_em: new Date().toISOString(),
    status_edicao: 'pendente_validacao',
  }
  if (motivo?.trim()) updatePayload.motivo = motivo.trim()

  const { data, error } = await admin
    .from('observacoes')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(await withProfile(data))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, papel } = await getCallerAndRole()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!papel || !['gestor', 'admin'].includes(papel)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('observacoes').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
