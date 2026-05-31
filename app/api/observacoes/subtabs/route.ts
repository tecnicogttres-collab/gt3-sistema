import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller as _getCaller } from '../../../lib/api-helpers'

async function getCaller() {
  const caller = await _getCaller()
  if (!caller) return { user: null, papel: null }
  return { user: caller.user, papel: caller.role }
}

export async function GET(req: NextRequest) {
  const { user } = await getCaller()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria')
  if (!categoria) return Response.json({ error: 'categoria obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('observacoes_subtabs')
    .select('id, categoria, subtab, criado_por, created_at')
    .eq('categoria', categoria)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { user, papel } = await getCaller()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['gestor', 'admin'].includes(papel ?? '')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const { categoria, subtab } = body
  if (!categoria || !subtab?.trim()) {
    return Response.json({ error: 'categoria e subtab obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('observacoes_subtabs')
    .insert({ categoria, subtab: subtab.trim(), criado_por: user.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'Já existe uma subcategoria com esse nome' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data, { status: 201 })
}
