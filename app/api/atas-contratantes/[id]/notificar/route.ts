import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: ata_id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })
  if (profile.papel !== 'gestor' && profile.papel !== 'admin') {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json() as { userIds?: string[] }
  // Quem validou não recebe aviso da própria ata
  const userIds = Array.isArray(body.userIds) ? [...new Set(body.userIds.filter(id => id && id !== user.id))] : []
  if (!userIds.length) return Response.json({ ok: true, count: 0 })

  const rows = userIds.map(user_id => ({ ata_id, user_id }))
  const { error } = await admin
    .from('atas_contratantes_notificacoes')
    .upsert(rows, { onConflict: 'ata_id,user_id', ignoreDuplicates: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Badge na sidebar (notificacoes_usuario); o pop-up vem de GET /api/atas-contratantes/notificacoes
  await admin.from('notificacoes_usuario')
    .insert(userIds.map(usuario_id => ({ usuario_id, modulo: 'atas-contratantes', visto: false })))

  return Response.json({ ok: true, count: userIds.length })
}
