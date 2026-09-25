import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { requireGestorAdmin } from '../../lib/api-helpers'
import { QN_SELECT, CONVITE_SELECT } from '../../questionarios/types'

/** Tudo de uma vez: questionários + convites (metadados pequenos, o painel filtra no cliente). */
export async function GET() {
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const [qns, convs] = await Promise.all([
    admin.from('questionarios').select(QN_SELECT).order('created_at', { ascending: false }),
    admin.from('questionario_convites').select(CONVITE_SELECT).order('created_at', { ascending: true }),
  ])
  if (qns.error) return Response.json({ error: qns.error.message }, { status: 500 })
  if (convs.error) return Response.json({ error: convs.error.message }, { status: 500 })
  return Response.json({ questionarios: qns.data ?? [], convites: convs.data ?? [] })
}

export async function POST(req: NextRequest) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { titulo?: string; publico?: string }
  const titulo = String(body.titulo ?? '').trim()
  if (!titulo) return Response.json({ error: 'Informe o nome do questionário' }, { status: 400 })
  const publico = body.publico === 'Prestador' ? 'Prestador' : 'Contratante'

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('questionarios')
    .insert({ titulo, publico, status: 'rascunho', perguntas: [], criado_por: caller.user.id })
    .select(QN_SELECT)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
