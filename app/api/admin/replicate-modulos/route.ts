import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { createClient } from '../../../lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: caller } = await admin.from('profiles').select('papel').eq('id', user.id).single()
    if (caller?.papel !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json() as { source_id: string; target_role: string }
    const { source_id, target_role } = body

    if (!source_id || !target_role) {
      return Response.json({ error: 'source_id e target_role são obrigatórios' }, { status: 400 })
    }

    // Busca perfil de origem pelo ID (sempre preenchido)
    const { data: source, error: srcErr } = await admin
      .from('profiles')
      .select('*')
      .eq('id', source_id)
      .single()

    if (srcErr || !source) {
      return Response.json({ error: `Perfil "${source_id}" não encontrado` }, { status: 404 })
    }

    // Monta payload apenas com o que realmente existe no perfil de origem
    const payload: Record<string, unknown> = {}
    if ('modulos_permitidos' in source) payload.modulos_permitidos = source.modulos_permitidos ?? null
    if ('modulos_dashboard' in source) payload.modulos_dashboard = source.modulos_dashboard ?? null

    if (Object.keys(payload).length === 0) {
      return Response.json({ error: 'Nenhuma configuração de módulo encontrada no usuário de origem' }, { status: 400 })
    }

    const { error: updateErr, count } = await admin
      .from('profiles')
      .update(payload, { count: 'exact' })
      .eq('papel', target_role)
      .neq('id', source.id)

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 500 })
    }

    return Response.json({
      success: true,
      updated: count ?? 0,
      modulos_permitidos: source.modulos_permitidos ?? null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
