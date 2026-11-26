import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getPdiAcesso } from '../../../../lib/pdi-acesso'

// Respostas do registro rápido deste PDI (gestão e o próprio colaborador).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!ac.podeVer) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdi_checkins')
    .select('id, acao_id, periodo_ref, situacao, nota, usuario_nome, created_at')
    .eq('pdi_id', id)
    .order('periodo_ref', { ascending: false })
    .limit(300)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
