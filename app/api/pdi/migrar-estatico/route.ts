import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function POST(req: NextRequest) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (!['gestor', 'admin'].includes(profile?.papel ?? ''))
    return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { staticId, nome, funcao } = await req.json() as { staticId: string; nome: string; funcao: string }
  if (!staticId || !nome?.trim())
    return Response.json({ error: 'staticId e nome obrigatórios' }, { status: 400 })

  // Cria o registro definitivo no banco
  const { data: newPdi, error: insertErr } = await admin
    .from('pdis')
    .insert({ nome: nome.trim(), funcao: (funcao ?? '').trim() })
    .select('id')
    .single()

  if (insertErr || !newPdi)
    return Response.json({ error: insertErr?.message ?? 'Erro ao criar PDI' }, { status: 500 })

  const newId = newPdi.id as string

  // Migra todas as referências do slug estático para o novo UUID em paralelo
  await Promise.all([
    admin.from('profiles').update({ pdi_slug: newId }).eq('pdi_slug', staticId),
    admin.from('pdi_ciclos').update({ pdi_id: newId }).eq('pdi_id', staticId),
    admin.from('pdi_acoes').update({ pdi_id: newId }).eq('pdi_id', staticId),
    admin.from('pdi_notificacoes').update({ pdi_id: newId }).eq('pdi_id', staticId),
  ])

  return Response.json({ id: newId })
}
