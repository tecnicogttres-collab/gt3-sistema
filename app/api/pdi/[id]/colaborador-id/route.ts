import { NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (!['gestor', 'admin'].includes(profile?.papel ?? ''))
    return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { data: colab } = await admin
    .from('profiles')
    .select('id')
    .eq('pdi_slug', id)
    .maybeSingle()

  return Response.json({ colaborador_id: colab?.id ?? null })
}
