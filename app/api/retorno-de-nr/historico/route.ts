import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCallerWithNome } from '../../../lib/api-helpers'

/** Histórico é pessoal: cada usuário vê apenas os registros que lançou. */
export async function GET() {
  const caller = await getCallerWithNome()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('rnr_historico')
    .select('*')
    .eq('user_id', caller.user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const caller = await getCallerWithNome()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const texto = String(body.texto ?? '').trim()
  if (!texto) return Response.json({ error: 'Texto obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('rnr_historico')
    .insert({
      user_id: caller.user.id,
      user_nome: caller.nome,
      data: body.data || null,
      alvo: String(body.alvo ?? '').trim(),
      acao: String(body.acao ?? '').trim(),
      origem: String(body.origem ?? '').trim(),
      contratante: String(body.contratante ?? '').trim(),
      contato: String(body.contato ?? '').trim(),
      texto,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

/** Sem ?id= limpa todo o histórico do usuário; com ?id= remove um registro. */
export async function DELETE(req: NextRequest) {
  const caller = await getCallerWithNome()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  const admin = createAdminClient()
  let query = admin.from('rnr_historico').delete().eq('user_id', caller.user.id)
  if (id) query = query.eq('id', id)

  const { error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
