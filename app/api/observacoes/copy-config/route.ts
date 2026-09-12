import { NextRequest } from 'next/server'
import { getAuthUser, getCaller } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'

const CONFIG_ID = 1
const TEMPLATE_PADRAO = '{{data}} - {{observacao}} - {{nome}}'

/** Modelo do texto copiado dos cards de Observações (data + observação + nome de quem
 *  copiou) — qualquer autenticado pode ler, só gestor/admin edita. */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('observacoes_copy_config')
    .select('template')
    .eq('id', CONFIG_ID)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ template: data?.template ?? TEMPLATE_PADRAO })
}

export async function PUT(req: NextRequest) {
  const caller = await getCaller()
  if (!caller || !['gestor', 'admin'].includes(caller.role)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const template = String(body.template ?? '').trim()
  if (!template) return Response.json({ error: 'Modelo não pode ficar vazio' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('observacoes_copy_config')
    .upsert({ id: CONFIG_ID, template, updated_at: new Date().toISOString() })
    .select('template')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
