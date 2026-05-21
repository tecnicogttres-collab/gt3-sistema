import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

/**
 * POST /api/notificacoes/disparar
 * Body: { modulo: string }
 *
 * Lê a config do módulo em notificacoes_config e insere um registro
 * em notificacoes_usuario para cada usuário cujo papel está na lista
 * perfis_notificados — excluindo quem acabou de agir (o caller).
 */
export async function POST(request: NextRequest) {
  const serverClient = await createClient()
  const { data: { user: caller } } = await serverClient.auth.getUser()
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { modulo } = await request.json() as { modulo?: string }
  if (!modulo) return Response.json({ error: 'modulo obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  // Verifica se o módulo tem notificação ativa
  const { data: cfg } = await admin
    .from('notificacoes_config')
    .select('perfis_notificados, ativo')
    .eq('modulo', modulo)
    .single()

  if (!cfg?.ativo || !cfg.perfis_notificados?.length) {
    return Response.json({ skipped: true })
  }

  // Busca todos os usuários com os perfis configurados (exceto o caller)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id')
    .in('papel', cfg.perfis_notificados)
    .neq('id', caller.id)

  if (!profiles?.length) return Response.json({ notified: 0 })

  const rows = profiles.map((p: { id: string }) => ({
    usuario_id: p.id,
    modulo,
    visto: false,
  }))

  await admin.from('notificacoes_usuario').insert(rows)

  return Response.json({ notified: rows.length })
}
