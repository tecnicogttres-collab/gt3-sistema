import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getPdiAcesso } from '../../../../lib/pdi-acesso'

// Respostas dos pop-ups deste PDI, com o título/perguntas do pop-up (gestão e o próprio colaborador).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!ac.podeVer) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdi_popup_respostas')
    .select('id, popup_id, ocorrencia, respostas, usuario_nome, created_at, pdi_popups(titulo, icone, cor, perguntas)')
    .eq('pdi_id', id)
    .order('created_at', { ascending: false })
    .limit(400)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json((data ?? []).map(r => {
    const p = (Array.isArray(r.pdi_popups) ? r.pdi_popups[0] : r.pdi_popups) as { titulo: string; icone: string; cor: string; perguntas: unknown[] } | null
    return { id: r.id, popup_id: r.popup_id, ocorrencia: r.ocorrencia, respostas: r.respostas, usuario_nome: r.usuario_nome, created_at: r.created_at, titulo: p?.titulo ?? 'Pop-up', icone: p?.icone ?? '⚡', cor: p?.cor ?? '#2A4F96', perguntas: p?.perguntas ?? [] }
  }))
}
