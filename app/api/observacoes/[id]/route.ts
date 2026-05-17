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
  if (!motivo?.trim() || !parecer?.trim()) {
    return Response.json({ error: 'motivo e parecer obrigatórios' }, { status: 400 })
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
