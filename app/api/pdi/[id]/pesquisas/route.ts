import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getCaller } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/* Aba "Pesquisas" do PDI: lê direto do módulo Questionários (fonte única) os convites ligados ao
   dono deste PDI (questionario_convites.profile_id). Mesma regra de acesso da página do PDI:
   gestor/admin veem qualquer PDI; os demais só o próprio (profiles.pdi_slug = id).
   Respostas do link anônimo nunca têm profile_id, então nunca aparecem aqui. */

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const gestao = caller.role === 'gestor' || caller.role === 'admin'
  if (!gestao) {
    const { data: me } = await admin.from('profiles').select('pdi_slug').eq('id', caller.user.id).maybeSingle()
    if (me?.pdi_slug !== id) return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { data: dono } = await admin.from('profiles').select('id').eq('pdi_slug', id).maybeSingle()
  if (!dono) return Response.json({ vinculado: false, pesquisas: [] })

  const { data: convites, error } = await admin
    .from('questionario_convites')
    .select('id, questionario_id, status, status_envio, respostas, respondido_em, enviado_em, created_at')
    .eq('profile_id', dono.id)
    .order('created_at', { ascending: false })
  if (error) {
    if (/profile_id/.test(error.message)) return Response.json({ vinculado: true, pesquisas: [] })
    return Response.json({ error: error.message }, { status: 500 })
  }
  const qnIds = [...new Set((convites ?? []).map(c => c.questionario_id as string))]
  const { data: qns } = qnIds.length
    ? await admin.from('questionarios').select('id, titulo, status, perguntas').in('id', qnIds)
    : { data: [] as { id: string; titulo: string; status: string; perguntas: unknown }[] }
  const porId = new Map((qns ?? []).map(q => [q.id as string, q]))

  const pesquisas = (convites ?? []).flatMap(c => {
    const qn = porId.get(c.questionario_id as string)
    if (!qn) return []
    const respondido = c.status === 'respondido'
    return [{
      id: c.id,
      titulo: qn.titulo,
      situacaoQuestionario: qn.status,
      status: respondido ? 'respondido' : c.status_envio === 'enviado' ? 'enviado' : 'nao_enviado',
      respondido_em: c.respondido_em,
      enviado_em: c.enviado_em,
      perguntas: respondido ? qn.perguntas : [],
      respostas: respondido ? c.respostas : {},
    }]
  })

  return Response.json({ vinculado: true, pesquisas })
}
