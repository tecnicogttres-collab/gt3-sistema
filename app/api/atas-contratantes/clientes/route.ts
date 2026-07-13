import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { createClient } from '../../../lib/supabase-server'

async function requireGestorOrAdmin() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { error: Response.json({ error: 'Não autenticado' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return { error: Response.json({ error: 'Perfil não encontrado' }, { status: 403 }) }

  if (profile.papel !== 'gestor' && profile.papel !== 'admin') {
    return { error: Response.json({ error: 'Sem permissão' }, { status: 403 }) }
  }
  return { admin, userId: user.id }
}

export async function GET() {
  const auth = await requireGestorOrAdmin()
  if (auth.error) return auth.error

  const { data, error } = await auth.admin
    .from('atas_contratantes_clientes_arquivados')
    .select('cliente')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json((data ?? []).map(r => r.cliente))
}

export async function POST(request: NextRequest) {
  const auth = await requireGestorOrAdmin()
  if (auth.error) return auth.error

  const body = await request.json() as { cliente?: string; arquivado?: boolean }
  const cliente = body.cliente?.trim()
  if (!cliente) return Response.json({ error: 'Campo obrigatório: cliente' }, { status: 400 })

  if (body.arquivado === false) {
    const { error } = await auth.admin
      .from('atas_contratantes_clientes_arquivados')
      .delete()
      .eq('cliente', cliente)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ cliente, arquivado: false })
  }

  const { error } = await auth.admin
    .from('atas_contratantes_clientes_arquivados')
    .upsert({ cliente, arquivado_por: auth.userId })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cliente, arquivado: true })
}
