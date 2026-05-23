import { NextRequest } from 'next/server'
import { createClient } from '../../../../../lib/supabase-server'
import { createAdminClient } from '../../../../../lib/supabase-admin'

type Params = { params: Promise<{ cicloId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { cicloId } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as { conversa_confirmada_em?: string }
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('pdi_ciclos')
    .update({ conversa_confirmada_em: body.conversa_confirmada_em ?? new Date().toISOString() })
    .eq('id', cicloId)
    .eq('colaborador_id', user.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
