import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller, requireGestorAdmin } from '../../../lib/api-helpers'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('desig_pertinencia')
    .select('setor_id, usuario_id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

// Toggle: se o par (setor_id, usuario_id) já existe, remove; senão, cria.
export async function POST(req: NextRequest) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { setor_id, usuario_id } = await req.json()
  if (!setor_id || !usuario_id) {
    return Response.json({ error: 'setor_id e usuario_id obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('desig_pertinencia')
    .select('setor_id')
    .eq('setor_id', setor_id)
    .eq('usuario_id', usuario_id)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('desig_pertinencia')
      .delete()
      .eq('setor_id', setor_id)
      .eq('usuario_id', usuario_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ on: false })
  }

  const { error } = await admin.from('desig_pertinencia').insert({ setor_id, usuario_id })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ on: true })
}
