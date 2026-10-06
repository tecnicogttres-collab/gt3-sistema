import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getCaller } from '../../../../lib/api-helpers'
import { resolverDestinatarios } from '../../../../lib/campanhas-destinatarios'

type Params = { params: Promise<{ id: string }> }

/** Quem abriu o link da campanha e quem ainda não — só gestor/admin (igual às atas). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['gestor', 'admin'].includes(caller.role)) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data: camp } = await admin.from('campanhas').select('destinatarios, autor_id').eq('id', id).single()
  if (!camp) return Response.json({ error: 'Campanha não encontrada' }, { status: 404 })

  const [{ data: leituras }, alvo] = await Promise.all([
    admin.from('campanhas_lidas').select('user_id, lido_em, leitor:profiles!user_id(nome)').eq('campanha_id', id),
    resolverDestinatarios(admin, camp.destinatarios ?? [], camp.autor_id),
  ])

  const lidoSet = new Set((leituras ?? []).map((l: { user_id: string }) => l.user_id))
  // Conta desativada some da cobrança (resolverDestinatarios já filtra); o histórico de quem leu permanece.
  const leram = (leituras ?? []).map((l: { user_id: string; lido_em: string; leitor: unknown }) => ({
    user_id: l.user_id, lido_em: l.lido_em, nome: (l.leitor as { nome: string } | null)?.nome ?? '—',
  })).sort((a, b) => a.lido_em.localeCompare(b.lido_em))
  const naoLeram = alvo.filter(u => !lidoSet.has(u.id)).map(u => ({ user_id: u.id, nome: u.nome }))

  return Response.json({ leram, naoLeram })
}
