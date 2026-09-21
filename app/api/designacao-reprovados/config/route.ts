import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller, requireGestorAdmin } from '../../../lib/api-helpers'

const DEFAULTS = {
  id: 'default',
  assunto_template: 'Portal GT3 - Acompanhamento de documentação - {{empresa}}',
  saudacao_template: 'Olá! Identificamos que você possui documentos de {{setores}} reprovados no Portal GT3.',
  fechamento_template: 'Você precisa de alguma ajuda com este(s) documento(s)?',
  historico_dias: 15,
}

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('desig_config').select('*').eq('id', 'default').maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? DEFAULTS)
}

export async function PATCH(req: NextRequest) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const patch: Record<string, string | number> = {}
  for (const k of ['assunto_template', 'saudacao_template', 'fechamento_template'] as const) {
    if (typeof body[k] === 'string') patch[k] = body[k]
  }
  if (typeof body.historico_dias === 'number' && body.historico_dias > 0) {
    patch.historico_dias = Math.floor(body.historico_dias)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('desig_config')
    .upsert({ id: 'default', ...patch, updated_at: new Date().toISOString() })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
