import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'

const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Aniversário fica em profiles quando vinculado a um login; entradas sem
 * login (pessoas sem conta no sistema) continuam livres na tabela `aniversarios`.
 */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: vinculados, error: e1 }, { data: livres, error: e2 }, { data: todosUsuarios, error: e3 }] = await Promise.all([
    admin.from('profiles').select('id, nome, aniversario_dia, aniversario_mes').not('aniversario_dia', 'is', null).not('aniversario_mes', 'is', null),
    admin.from('aniversarios').select('id, nome, dia, mes'),
    admin.from('profiles').select('id, nome, usuario, aniversario_dia, aniversario_mes').order('nome', { ascending: true }),
  ])
  if (e1) return Response.json({ error: e1.message }, { status: 500 })
  if (e2) return Response.json({ error: e2.message }, { status: 500 })
  if (e3) return Response.json({ error: e3.message }, { status: 500 })

  return Response.json({
    vinculados: (vinculados ?? []).map(p => ({ usuario_id: p.id, nome: p.nome, dia: p.aniversario_dia, mes: p.aniversario_mes })),
    livres: livres ?? [],
    usuarios: (todosUsuarios ?? []).map(p => ({
      id: p.id, nome: p.nome, usuario: p.usuario,
      vinculado: p.aniversario_dia != null && p.aniversario_mes != null,
    })),
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as { usuario_id?: string; dia?: number; mes?: number }
  const { usuario_id, dia, mes } = body
  if (!usuario_id || !dia || !mes) return Response.json({ error: 'usuario_id, dia e mes são obrigatórios' }, { status: 400 })
  if (mes < 1 || mes > 12 || dia < 1 || dia > DIAS_NO_MES[mes - 1]) {
    return Response.json({ error: 'Data inválida' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ aniversario_dia: dia, aniversario_mes: mes }).eq('id', usuario_id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const usuario_id = new URL(request.url).searchParams.get('usuario_id')
  if (!usuario_id) return Response.json({ error: 'usuario_id obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ aniversario_dia: null, aniversario_mes: null }).eq('id', usuario_id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
