import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getPdiAcesso, logPdi } from '../../../../lib/pdi-acesso'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!ac.podeVer) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdi_etapas')
    .select('*')
    .eq('pdi_id', id)
    .order('ordem')
    .order('created_at')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { acao_id?: string; titulo?: string; responsavel?: string; prazo?: string | null }
  if (!body.acao_id || !body.titulo?.trim()) return Response.json({ error: 'Informe a etapa' }, { status: 400 })

  const admin = createAdminClient()
  const { data: ultima } = await admin
    .from('pdi_etapas').select('ordem').eq('acao_id', body.acao_id)
    .order('ordem', { ascending: false }).limit(1).maybeSingle()

  const { data, error } = await admin
    .from('pdi_etapas')
    .insert({
      pdi_id: id,
      acao_id: body.acao_id,
      titulo: body.titulo.trim(),
      responsavel: body.responsavel?.trim() ?? '',
      prazo: body.prazo || null,
      ordem: (ultima?.ordem ?? -1) + 1,
    })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await logPdi(admin, { pdiId: id, acaoId: body.acao_id, evento: 'Etapa criada', detalhe: data.titulo, userId: ac.userId, nome: ac.nome })
  return Response.json(data, { status: 201 })
}
