import { NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

async function getAuth() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { user: null, papel: null, pdiSlug: null }
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('papel, pdi_slug').eq('id', user.id).single()
  return { user, papel: p?.papel as string | null, pdiSlug: p?.pdi_slug as string | null }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { user, papel, pdiSlug } = await getAuth()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (papel === 'colaborador' && pdiSlug !== id)
    return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdi_ciclos')
    .select('id, pdi_id, colaborador_id, numero_ciclo, status, avaliacao_diretiva, autoavaliacao, ambicao, autoavaliacao_salva, data_conversa, conversa_confirmada_em, rascunho_conversa, arquivado_em, criado_em, data_inicio, data_fim')
    .eq('pdi_id', id)
    .order('numero_ciclo', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { user, papel } = await getAuth()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['gestor', 'admin'].includes(papel ?? ''))
    return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as {
    colaborador_id: string
    avaliacao_diretiva?: number[]
    autoavaliacao?: number[]
    ambicao?: number[]
    autoavaliacao_salva?: boolean
    seed?: boolean
  }

  const admin = createAdminClient()

  // Find current max numero_ciclo
  const { data: existing } = await admin
    .from('pdi_ciclos')
    .select('id, numero_ciclo, ambicao')
    .eq('pdi_id', id)
    .order('numero_ciclo', { ascending: false })
    .limit(1)

  const maxCiclo = existing?.[0]?.numero_ciclo ?? 0
  const isFirst = maxCiclo === 0

  // Archive current active cycle
  if (!isFirst) {
    await admin
      .from('pdi_ciclos')
      .update({ status: 'arquivado', arquivado_em: new Date().toISOString() })
      .eq('pdi_id', id)
      .eq('status', 'ativo')
  }

  // Resolve colaborador_id — use body value or fall back to profile lookup
  let resolvedColabId: string | null = body.colaborador_id ?? null
  if (!resolvedColabId) {
    const { data: colab } = await admin
      .from('profiles')
      .select('id')
      .eq('pdi_slug', id)
      .maybeSingle()
    resolvedColabId = colab?.id ?? null
  }

  // Ambicao from ciclo 1 (or from body for seed)
  const ciclo1 = isFirst ? null : await admin
    .from('pdi_ciclos')
    .select('ambicao')
    .eq('pdi_id', id)
    .eq('numero_ciclo', 1)
    .single()
  const ambicaoBase = isFirst
    ? (body.ambicao ?? [])
    : (ciclo1?.data?.ambicao ?? existing?.[0]?.ambicao ?? [])

  const now = new Date()
  const dataInicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: novo, error } = await admin
    .from('pdi_ciclos')
    .insert({
      pdi_id: id,
      colaborador_id: resolvedColabId,
      numero_ciclo: maxCiclo + 1,
      status: 'ativo',
      avaliacao_diretiva: isFirst ? (body.avaliacao_diretiva ?? []) : [],
      autoavaliacao: isFirst ? (body.autoavaliacao ?? []) : [],
      ambicao: ambicaoBase,
      autoavaliacao_salva: isFirst ? (body.autoavaliacao_salva ?? false) : false,
      criado_por: user.id,
      data_inicio: dataInicio,
      data_fim: null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(novo, { status: 201 })
}
