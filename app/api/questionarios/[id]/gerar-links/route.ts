import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getCaller } from '../../../../lib/api-helpers'
import { CONVITE_SELECT, gerarToken } from '../../../../questionarios/types'
import { podeAcessarQn, naoEncontrado } from '../../../../lib/questionarios-acesso'

type Params = { params: Promise<{ id: string }> }

/** Gera o link único de cada destinatário ainda sem link (pendente → enviado). */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  if (!await podeAcessarQn(admin, id, caller.role)) return naoEncontrado()
  const { data: qn } = await admin.from('questionarios').select('status').eq('id', id).single()
  if (!qn) return Response.json({ error: 'Questionário não encontrado' }, { status: 404 })
  if (qn.status !== 'ativo') return Response.json({ error: 'Só dá para gerar links com o questionário Ativo' }, { status: 400 })

  const { data: pendentes, error } = await admin
    .from('questionario_convites')
    .select('id')
    .eq('questionario_id', id)
    .eq('status', 'pendente')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  for (const p of pendentes ?? []) {
    const { error: upErr } = await admin
      .from('questionario_convites')
      .update({ token: gerarToken(), status: 'enviado' })
      .eq('id', p.id)
      .eq('status', 'pendente')
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
  }

  const { data } = await admin.from('questionario_convites').select(CONVITE_SELECT).eq('questionario_id', id).order('created_at')
  return Response.json(data ?? [])
}
