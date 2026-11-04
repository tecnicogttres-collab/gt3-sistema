import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getCaller } from '../../../../lib/api-helpers'
import { podeAcessarQn } from '../../../../lib/questionarios-acesso'

type Params = { params: Promise<{ id: string }> }

/** Remove um destinatário (e a resposta dele, se já respondeu). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data: conv } = await admin.from('questionario_convites').select('questionario_id').eq('id', id).maybeSingle()
  if (!conv || !await podeAcessarQn(admin, conv.questionario_id, caller.role)) return Response.json({ error: 'Destinatário não encontrado' }, { status: 404 })
  const { error } = await admin.from('questionario_convites').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
