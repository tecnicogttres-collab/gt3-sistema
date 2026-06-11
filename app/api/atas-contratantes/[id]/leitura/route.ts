import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: ata_id } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: ata } = await admin
    .from('atas_contratantes').select('status').eq('id', ata_id).single()
  if (!ata) return Response.json({ error: 'Ata não encontrada' }, { status: 404 })
  if (ata.status !== 'Validada') {
    return Response.json({ error: 'Só é possível registrar leitura de ata Validada' }, { status: 400 })
  }

  const { error } = await admin.from('atas_contratantes_leituras').upsert(
    { ata_id, user_id: user.id },
    { onConflict: 'ata_id,user_id', ignoreDuplicates: true }
  )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
