import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })

  const isTrainee = profile.papel === 'trainee'

  const { data: existing } = await admin
    .from('revisoes_registros')
    .select('criado_por, data_dia, status')
    .eq('id', id)
    .single()

  if (!existing) return Response.json({ error: 'Registro não encontrado' }, { status: 404 })

  // Trainee can only edit their own records
  if (isTrainee && existing.criado_por !== user.id) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Check date is not finalized
  const { data: dateRow } = await admin
    .from('revisoes_datas')
    .select('finalizado')
    .eq('data', existing.data_dia)
    .maybeSingle()

  if (dateRow?.finalizado) {
    return Response.json({ error: 'Este dia já foi finalizado' }, { status: 400 })
  }

  const body = await request.json() as Record<string, unknown>

  // Trainee can update: empresa, colaborador, documento
  // Revisor can update: status, nota_revisor
  let updates: Record<string, unknown> = {}

  if (isTrainee) {
    if (body.empresa !== undefined) updates.empresa = (body.empresa as string).trim()
    if (body.colaborador !== undefined) updates.colaborador = (body.colaborador as string).trim()
    if (body.documento !== undefined) updates.documento = (body.documento as string).trim()
    // Auto-reset flagged status when trainee edits their record
    if (Object.keys(updates).length > 0 && (existing.status === 'red' || existing.status === 'yellow')) {
      updates.status = 'pending'
      updates.nota_revisor = null
      updates.revisado_por = null
      updates.revisado_em = null
    }
  } else {
    if (body.status !== undefined) {
      const validStatus = ['pending', 'red', 'yellow', 'green']
      if (!validStatus.includes(body.status as string)) {
        return Response.json({ error: 'Status inválido' }, { status: 400 })
      }
      updates.status = body.status
      updates.nota_revisor = body.nota_revisor ?? null
      updates.revisado_por = user.id
      updates.revisado_em = new Date().toISOString()
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { data: updated, error } = await admin
    .from('revisoes_registros')
    .update(updates)
    .eq('id', id)
    .select('*, criado_por_profile:profiles!criado_por(nome), revisado_por_profile:profiles!revisado_por(nome)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(updated)
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })

  const isTrainee = profile.papel === 'trainee'

  const { data: existing } = await admin
    .from('revisoes_registros')
    .select('criado_por, data_dia')
    .eq('id', id)
    .single()

  if (!existing) return Response.json({ error: 'Registro não encontrado' }, { status: 404 })

  // Trainee can only delete their own records
  if (isTrainee && existing.criado_por !== user.id) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Non-trainee (revisores) can delete any record

  // Check date is not finalized
  const { data: dateRow } = await admin
    .from('revisoes_datas')
    .select('finalizado')
    .eq('data', existing.data_dia)
    .maybeSingle()

  if (dateRow?.finalizado) {
    return Response.json({ error: 'Este dia já foi finalizado' }, { status: 400 })
  }

  const { error } = await admin
    .from('revisoes_registros')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return new Response(null, { status: 204 })
}
