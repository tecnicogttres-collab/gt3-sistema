import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { createClient } from '../../../lib/supabase-server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: ata, error } = await admin
    .from('atas_contratantes')
    .select('*, autor:profiles!autor_id(nome)')
    .eq('id', id)
    .single()

  if (error || !ata) return Response.json({ error: 'Ata não encontrada' }, { status: 404 })
  return Response.json(ata)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })

  if (profile.papel !== 'gestor' && profile.papel !== 'admin') {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json() as Record<string, unknown>
  const updates: Record<string, unknown> = {}
  const VALID_STATUS = ['Rascunho', 'Aguardando Validação', 'Validada']

  if (body.titulo !== undefined) updates.titulo = (body.titulo as string)?.trim() || null
  if (body.conteudo !== undefined) updates.conteudo = body.conteudo
  if (body.data !== undefined) updates.data = body.data
  if (body.cliente !== undefined) updates.cliente = (body.cliente as string)?.trim() || null
  if (body.local_reuniao !== undefined) updates.local_reuniao = (body.local_reuniao as string)?.trim() || null
  if (body.numero_ata !== undefined) updates.numero_ata = (body.numero_ata as string)?.trim() || null
  if (body.participantes !== undefined) updates.participantes = (body.participantes as string)?.trim() || null
  if (body.status !== undefined) {
    if (!VALID_STATUS.includes(body.status as string)) {
      return Response.json({ error: 'Status inválido' }, { status: 400 })
    }
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('atas_contratantes')
    .update(updates)
    .eq('id', id)
    .select('*, autor:profiles!autor_id(nome)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })

  if (profile.papel !== 'admin' && profile.papel !== 'gestor') {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { error } = await admin.from('atas_contratantes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
