import { NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

async function getCallerAndRole() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { user: null, papel: null }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel, pdi_slug').eq('id', user.id).single()
  return { user, papel: profile?.papel as string | null, pdiSlug: profile?.pdi_slug as string | null }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, papel, pdiSlug } = await getCallerAndRole()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  if (papel === 'colaborador' && pdiSlug !== id) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdi_acoes')
    .select('id, pdi_id, competencia, desenvolver, acoes, resultados_esperados, inicio, termino, status, concluido_em, created_at, updated_at')
    .eq('pdi_id', id)
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, papel } = await getCallerAndRole()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!papel || !['gestor', 'admin'].includes(papel)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('pdi_acoes')
    .insert({
      pdi_id: id,
      competencia: body.competencia ?? '',
      desenvolver: body.desenvolver ?? '',
      acoes: body.acoes ?? '',
      resultados_esperados: body.resultados_esperados ?? '',
      inicio: body.inicio ?? '',
      termino: body.termino ?? '',
      status: body.status ?? '',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Notify collaborator
  const { data: colaborador } = await admin
    .from('profiles')
    .select('id')
    .eq('pdi_slug', id)
    .maybeSingle()

  if (colaborador?.id) {
    await admin.from('pdi_notificacoes').insert({
      pdi_id: id,
      colaborador_id: colaborador.id,
      visto: false,
    })
  }

  return Response.json(data, { status: 201 })
}
