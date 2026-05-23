import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { createClient } from '../../lib/supabase-server'

export async function GET() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })

  const isColabOrTrainee = profile.papel === 'colaborador' || profile.papel === 'trainee'

  let query = admin
    .from('atas')
    .select('id, titulo, data, status, autor_id, created_at, updated_at, autor:profiles!autor_id(nome)')
    .order('data', { ascending: false })

  if (isColabOrTrainee) query = query.eq('status', 'Validada')

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
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

  const body = await request.json() as {
    titulo?: string; conteudo?: string; data: string; status?: string
  }

  const VALID_STATUS = ['Rascunho', 'Aguardando Validação', 'Validada']
  if (!body.data) return Response.json({ error: 'Campo obrigatório: data' }, { status: 400 })
  if (body.status && !VALID_STATUS.includes(body.status)) {
    return Response.json({ error: 'Status inválido' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('atas')
    .insert({
      titulo: body.titulo?.trim() || null,
      conteudo: body.conteudo ?? '',
      data: body.data,
      status: body.status ?? 'Rascunho',
      autor_id: user.id,
    })
    .select('*, autor:profiles!autor_id(nome)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
