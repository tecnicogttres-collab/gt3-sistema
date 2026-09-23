import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller as _getCaller, getAuthUser } from '../../lib/api-helpers'

async function getCaller() {
  const caller = await _getCaller()
  if (!caller) return { user: null, papel: null }
  return { user: caller.user, papel: caller.role }
}

export async function GET(req: NextRequest) {
  // Leitura não depende de papel — evita o round-trip extra em profiles.
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria')
  if (!categoria) return Response.json({ error: 'categoria obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  type ObsRow = {
    id: string; categoria: string; subtab: string; coluna: string; motivo: string
    parecer: string | null; parecer_anterior: string | null; group_name: string | null
    imagem_url: string | null; criado_por: string | null; editado_por: string | null
    atualizado_por: string | null; atualizado_em: string | null; status_edicao: string | null
    created_at: string; updated_at: string
  }
  const PAGE = 1000
  let rows: ObsRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('observacoes')
      .select('id, categoria, subtab, coluna, motivo, parecer, parecer_anterior, group_name, imagem_url, criado_por, editado_por, atualizado_por, atualizado_em, status_edicao, created_at, updated_at')
      .eq('categoria', categoria)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    rows = rows.concat(data ?? [])
    if (!data || data.length < PAGE) break
  }

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
  const { categoria, subtab, coluna, motivo, parecer, group_name, imagem_url } = body
  if (!categoria || !subtab || !coluna || !motivo?.trim()) {
    return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }
  if (!imagem_url && !parecer?.trim()) {
    return Response.json({ error: 'Observação ou imagem obrigatórios' }, { status: 400 })
  }

  // Criação por gestor/admin já entra validada — só colaborador gera pendência.
  const isPrivileged = ['gestor', 'admin'].includes(papel)

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
      ...(isPrivileged
        ? { status_edicao: 'original' }
        : { status_edicao: 'pendente_validacao', atualizado_por: user.id, atualizado_em: new Date().toISOString() }),
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
