import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({})

  const admin = createAdminClient()
  const { data } = await admin
    .from('notificacoes_usuario')
    .select('modulo')
    .eq('usuario_id', user.id)
    .eq('visto', false)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.modulo] = (counts[row.modulo] ?? 0) + 1
  }
  return Response.json(counts)
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { modulo } = await request.json() as { modulo: string }
  if (!modulo) return Response.json({ error: 'modulo obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  await admin
    .from('notificacoes_usuario')
    .update({ visto: true })
    .eq('usuario_id', user.id)
    .eq('modulo', modulo)
    .eq('visto', false)

  return Response.json({ success: true })
}
