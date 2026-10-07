import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../lib/api-helpers'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (profile?.papel !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const { data: sugestao } = await admin
    .from('sugestoes')
    .select('autor_id')
    .eq('id', id)
    .single()

  if (!sugestao) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!sugestao.autor_id) return Response.json({ nome: 'Enviado sem sessão ativa' })

  const { data: autor } = await admin
    .from('profiles')
    .select('nome')
    .eq('id', sugestao.autor_id)
    .single()

  return Response.json({ nome: autor?.nome ?? 'Usuário desconhecido' })
}
