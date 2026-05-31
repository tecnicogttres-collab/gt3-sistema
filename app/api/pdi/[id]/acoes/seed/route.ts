import { NextRequest } from 'next/server'
import { createClient } from '../../../../../lib/supabase-server'
import { createAdminClient } from '../../../../../lib/supabase-admin'
import type { AcaoPdi } from '../../../../../../data/pdis/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (!profile?.papel || !['gestor', 'admin'].includes(profile.papel as string)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // If rows already exist, return them without inserting
  const { data: existing } = await admin
    .from('pdi_acoes')
    .select('id, pdi_id, competencia, desenvolver, acoes, resultados_esperados, inicio, termino, status, concluido_em, created_at, updated_at')
    .eq('pdi_id', id)
    .order('created_at')

  if (existing && existing.length > 0) {
    return Response.json(existing)
  }

  const body = await req.json() as { acoes: AcaoPdi[] }
  if (!Array.isArray(body.acoes) || body.acoes.length === 0) {
    return Response.json([])
  }

  const toInsert = body.acoes.map((a: AcaoPdi) => ({
    pdi_id: id,
    competencia: a.competencia ?? '',
    desenvolver: a.desenvolver ?? '',
    acoes: a.acoes ?? '',
    resultados_esperados: a.resultadosEsperados ?? '',
    inicio: a.inicio ?? '',
    termino: a.termino ?? '',
    status: a.status ?? '',
  }))

  const { data: inserted, error } = await admin
    .from('pdi_acoes')
    .insert(toInsert)
    .select()
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(inserted ?? [], { status: 201 })
}
