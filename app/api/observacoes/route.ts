import { NextRequest } from 'next/server'
import { createClient } from '../../lib/supabase-server'
import { createAdminClient } from '../../lib/supabase-admin'

async function getCaller() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { user: null, papel: null }
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()
  return { user, papel: profile?.papel as string | null }
}

export async function GET(req: NextRequest) {
  const { user } = await getCaller()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria')
  if (!categoria) return Response.json({ error: 'categoria obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('observacoes')
    .select('*')
    .eq('categoria', categoria)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { user, papel } = await getCaller()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!papel || !['colaborador', 'gestor', 'admin'].includes(papel)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const { categoria, subtab, coluna, motivo, parecer, group_name, imagem_url } = body
  if (!categoria || !subtab || !coluna || !motivo?.trim() || !parecer?.trim()) {
    return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('observacoes')
    .insert({
      categoria,
      subtab,
      coluna,
      motivo: motivo.trim(),
      parecer: parecer.trim(),
      group_name: group_name ?? null,
      imagem_url: imagem_url ?? null,
      criado_por: user.id,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
