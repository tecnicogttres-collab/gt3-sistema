import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: ata_id } = await params
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

  const body = await request.json() as { userIds?: string[] }
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : []
  if (!userIds.length) return Response.json({ ok: true, count: 0 })

  const rows = userIds.map(user_id => ({ ata_id, user_id }))
  const { error } = await admin
    .from('atas_contratantes_notificacoes')
    .upsert(rows, { onConflict: 'ata_id,user_id', ignoreDuplicates: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, count: userIds.length })
}
