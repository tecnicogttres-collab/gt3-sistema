import { NextRequest } from 'next/server'
import { createClient } from '../../../../../lib/supabase-server'
import { createAdminClient } from '../../../../../lib/supabase-admin'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
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
