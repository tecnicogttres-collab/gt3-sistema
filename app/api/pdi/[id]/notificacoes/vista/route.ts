import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../../lib/api-helpers'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  await admin
    .from('pdi_notificacoes')
    .update({ visto: true })
    .eq('pdi_id', id)
    .eq('colaborador_id', user.id)
    .eq('visto', false)

  return Response.json({ ok: true })
}
