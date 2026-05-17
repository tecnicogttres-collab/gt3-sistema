import { NextRequest } from 'next/server'
import { createClient } from '../../../../../lib/supabase-server'
import { createAdminClient } from '../../../../../lib/supabase-admin'

async function requireGestorAdmin() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { user: null, ok: false as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  const papel = profile?.papel as string | null
  if (!papel || !['gestor', 'admin'].includes(papel)) return { user, ok: false as const }
  return { user, ok: true as const }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; acaoId: string }> }
) {
  const { id, acaoId } = await params
  const { ok } = await requireGestorAdmin()
  if (!ok) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()

  const setConcluido: Record<string, unknown> = {}
  if (body.status === 'Concluído') {
    // Check if concluido_em already set
    const { data: current } = await admin.from('pdi_acoes').select('concluido_em').eq('id', acaoId).single()
    if (!current?.concluido_em) setConcluido.concluido_em = new Date().toISOString()
  } else {
    setConcluido.concluido_em = null
  }

  const { data, error } = await admin
    .from('pdi_acoes')
    .update({
      competencia: body.competencia ?? '',
      desenvolver: body.desenvolver ?? '',
      acoes: body.acoes ?? '',
      resultados_esperados: body.resultados_esperados ?? '',
      inicio: body.inicio ?? '',
      termino: body.termino ?? '',
      status: body.status ?? '',
      updated_at: new Date().toISOString(),
      ...setConcluido,
    })
    .eq('id', acaoId)
    .eq('pdi_id', id)
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

  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; acaoId: string }> }
) {
  const { id, acaoId } = await params
  const { ok } = await requireGestorAdmin()
  if (!ok) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('pdi_acoes')
    .delete()
    .eq('id', acaoId)
    .eq('pdi_id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
