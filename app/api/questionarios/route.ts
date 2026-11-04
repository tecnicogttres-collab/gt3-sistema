import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller } from '../../lib/api-helpers'
import { QN_SELECT, CONVITE_SELECT } from '../../questionarios/types'
import { ehGestorAdmin } from '../../lib/questionarios-acesso'

/** Tudo de uma vez: questionários + convites (metadados pequenos, o painel filtra no cliente).
 *  Questionários restritos (e os convites/respostas deles) só vão para gestor e admin. */
export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })
  const gestor = ehGestorAdmin(caller.role)

  const admin = createAdminClient()
  let qq = admin.from('questionarios').select(QN_SELECT).order('created_at', { ascending: false })
  if (!gestor) qq = qq.eq('restrito', false)
  const qns = await qq
  if (qns.error) return Response.json({ error: qns.error.message }, { status: 500 })
  const ids = (qns.data ?? []).map(q => q.id)
  if (!ids.length) return Response.json({ questionarios: [], convites: [] })

  const convs = await admin.from('questionario_convites').select(CONVITE_SELECT).in('questionario_id', ids).order('created_at', { ascending: true })
  if (convs.error) return Response.json({ error: convs.error.message }, { status: 500 })
  return Response.json({ questionarios: qns.data ?? [], convites: convs.data ?? [] })
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { titulo?: string; publico?: string; restrito?: boolean }
  const titulo = String(body.titulo ?? '').trim()
  if (!titulo) return Response.json({ error: 'Informe o nome do questionário' }, { status: 400 })
  const publico = body.publico === 'Prestador' || body.publico === 'Colaborador' ? body.publico : 'Contratante'
  // Só gestor/admin cria restrito (senão o próprio criador perderia o acesso).
  const restrito = body.restrito === true && ehGestorAdmin(caller.role)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('questionarios')
    .insert({ titulo, publico, restrito, status: 'rascunho', perguntas: [], criado_por: caller.user.id })
    .select(QN_SELECT)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
