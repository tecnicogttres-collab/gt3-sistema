import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getPdiAcesso } from '../../../../lib/pdi-acesso'

// Histórico (quem fez o quê e quando). Só gestão. ?acao=<id> filtra por ação.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const acao = req.nextUrl.searchParams.get('acao')
  const admin = createAdminClient()
  let q = admin.from('pdi_historico').select('id, acao_id, evento, detalhe, usuario_nome, created_at').eq('pdi_id', id)
  if (acao) q = q.eq('acao_id', acao)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
