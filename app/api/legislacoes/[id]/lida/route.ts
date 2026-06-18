import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('legislacoes_lidas')
    .upsert(
      { legislacao_id: id, user_id: user.id },
      { onConflict: 'legislacao_id,user_id', ignoreDuplicates: true }
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
