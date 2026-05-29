import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

async function getCaller() {
  const server = await createClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('nome').eq('id', user.id).single()
  return { user, nome: (profile?.nome as string | null) ?? 'Usuário' }
}

export async function PATCH(_req: Request, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: terceira } = await admin.from('terceiras').select('etapas').eq('id', id).single()
  if (!terceira) return Response.json({ error: 'Não encontrada' }, { status: 404 })

  const etapas = { ...(terceira.etapas as Record<string, string>) }
  if (etapas.cnpj_liberado === 'nao_evoluiu') etapas.cnpj_liberado = 'nao_liberado'

  const { error } = await admin
    .from('terceiras')
    .update({ status: 'ativo', arquivado_em: null, etapas })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await admin.from('terceiras_historico').insert({
    terceira_id: id,
    who: caller.nome,
    user_id: caller.user.id,
    what: 'Terceira reativada — voltou para a lista de ativos',
  })

  const { data: atualizada } = await admin
    .from('terceiras')
    .select(`
      id, contratante_id, razao_social, contato, data, tem_sub, subcontratante,
      observacao, status, arquivado_em, etapas, created_at,
      contratante:terceiras_contratantes(id, nome, requer_cc),
      historico:terceiras_historico(id, ts, who, what)
    `)
    .eq('id', id)
    .single()

  return Response.json(atualizada)
}
