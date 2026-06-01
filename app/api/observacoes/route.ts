import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller as _getCaller } from '../../lib/api-helpers'

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
    .from('observacoes')
    .select('id, categoria, subtab, coluna, motivo, parecer, group_name, imagem_url, criado_por, editado_por, atualizado_por, atualizado_em, status_edicao, created_at, updated_at')
    .eq('categoria', categoria)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const ids = [...new Set(rows.map(r => r.atualizado_por).filter(Boolean))] as string[]
  let nameMap: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, nome').in('id', ids)
    nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.nome]))
  }
  const enriched = rows.map(r => ({
    ...r,
    atualizado_por_profile: r.atualizado_por ? { nome: nameMap[r.atualizado_por] ?? null } : null,
  }))
  return Response.json(enriched)
}

export async function POST(req: NextRequest) {
  const { user, papel } = await getCaller()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!papel || !['colaborador', 'gestor', 'admin'].includes(papel)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const { categoria, subtab, coluna, motivo, parecer, group_name, imagem_url, status_edicao } = body
  if (!categoria || !subtab || !coluna || !motivo?.trim()) {
    return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }
  if (!imagem_url && !parecer?.trim()) {
    return Response.json({ error: 'Observação ou imagem obrigatórios' }, { status: 400 })
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
      ...(status_edicao ? { status_edicao } : {}),
      ...(status_edicao === 'pendente_validacao' ? { atualizado_por: user.id, atualizado_em: new Date().toISOString() } : {}),
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
