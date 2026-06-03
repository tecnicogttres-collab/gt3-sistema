import { NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as { mes_referencia?: string }
  if (!body.mes_referencia) {
    return Response.json({ error: 'mes_referencia obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('nome')
    .eq('id', user.id)
    .single()
  const userName = (profile?.nome as string | null) ?? 'Usuário'

  // upsert: insere ou retorna o existente sem erro
  const { data, error } = await admin
    .from('lembretes_confirmacoes')
    .upsert(
      { lembrete_id: id, user_id: user.id, mes_referencia: body.mes_referencia },
      { onConflict: 'lembrete_id,user_id,mes_referencia', ignoreDuplicates: false }
    )
    .select('id, lembrete_id, user_id, mes_referencia, confirmado_em')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ...data, confirmado_por_nome: userName })
}
