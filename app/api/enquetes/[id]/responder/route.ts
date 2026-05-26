import { NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: enquete } = await admin
    .from('enquetes')
    .select('status, permitir_alterar_voto, encerramento')
    .eq('id', id)
    .single()

  if (!enquete || enquete.status !== 'active') return Response.json({ error: 'Enquete não disponível' }, { status: 400 })
  if (enquete.encerramento && new Date(enquete.encerramento) < new Date()) return Response.json({ error: 'Enquete encerrada' }, { status: 400 })

  const { data: existing } = await admin
    .from('enquete_respostas')
    .select('id')
    .eq('enquete_id', id)
    .eq('usuario_id', user.id)
    .limit(1)

  if (existing && existing.length > 0) {
    if (!enquete.permitir_alterar_voto) return Response.json({ error: 'Voto já registrado' }, { status: 400 })
    await admin.from('enquete_respostas').delete().eq('enquete_id', id).eq('usuario_id', user.id)
  }

  const { respostas } = await req.json() as { respostas: Array<{ pergunta_id: string; opcao_id?: string; texto_livre?: string }> }
  const rows = respostas.map(r => ({
    enquete_id: id,
    usuario_id: user.id,
    pergunta_id: r.pergunta_id,
    opcao_id: r.opcao_id ?? null,
    texto_livre: r.texto_livre ?? null,
  }))

  if (rows.length > 0) {
    const { error } = await admin.from('enquete_respostas').insert(rows)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
