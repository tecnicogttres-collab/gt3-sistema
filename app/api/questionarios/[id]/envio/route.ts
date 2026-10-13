import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'
import { CONVITE_SELECT } from '../../../../questionarios/types'

type Params = { params: Promise<{ id: string }> }

/** Registro MANUAL do envio (a mala direta sai fora do sistema):
 *  - marcar:   Não enviado → Enviado manualmente (canal manual, data de agora)
 *  - desfazer: Enviado manualmente → Não enviado (zera data e lembretes)
 *  - lembrete: soma 1 em lembretes_enviados de quem está Enviado manualmente
 *  Quem já respondeu NUNCA é alterado — o filtro `status <> respondido` está em todas as gravações. */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Só admin e gestor podem registrar envios' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { acao?: string; ids?: unknown }
  const acao = body.acao
  if (acao !== 'marcar' && acao !== 'desfazer' && acao !== 'lembrete') return Response.json({ error: 'Ação inválida' }, { status: 400 })
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : []
  if (!ids.length) return Response.json({ error: 'Nenhum destinatário selecionado' }, { status: 400 })

  const admin = createAdminClient()
  const agora = new Date().toISOString()
  let alterados = 0

  if (acao === 'marcar' || acao === 'desfazer') {
    const patch = acao === 'marcar'
      ? { status_envio: 'enviado', canal_envio: 'manual', enviado_em: agora }
      : { status_envio: 'nao_enviado', canal_envio: null, enviado_em: null, lembretes_enviados: 0, ultimo_lembrete_em: null }
    const { data, error } = await admin
      .from('questionario_convites')
      .update(patch)
      .eq('questionario_id', id)
      .in('id', ids)
      .eq('status_envio', acao === 'marcar' ? 'nao_enviado' : 'enviado')
      .neq('status', 'respondido')
      .select('id')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    alterados = data?.length ?? 0
  } else {
    // Sem RPC de incremento: lê o valor atual e grava +1 só se ninguém mudou no meio do caminho
    const { data: atuais, error } = await admin
      .from('questionario_convites')
      .select('id, lembretes_enviados')
      .eq('questionario_id', id)
      .in('id', ids)
      .eq('status_envio', 'enviado')
      .neq('status', 'respondido')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    for (const c of atuais ?? []) {
      const { data: up, error: upErr } = await admin
        .from('questionario_convites')
        .update({ lembretes_enviados: (c.lembretes_enviados ?? 0) + 1, ultimo_lembrete_em: agora })
        .eq('id', c.id)
        .eq('lembretes_enviados', c.lembretes_enviados ?? 0)
        .neq('status', 'respondido')
        .select('id')
      if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
      alterados += up?.length ?? 0
    }
  }

  const { data: todos } = await admin.from('questionario_convites').select(CONVITE_SELECT).eq('questionario_id', id).order('created_at')
  return Response.json({ alterados, ignorados: ids.length - alterados, convites: todos ?? [] })
}
