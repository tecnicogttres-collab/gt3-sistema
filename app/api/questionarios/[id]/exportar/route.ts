import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'
import { CONVITE_SELECT, gerarToken, type Convite } from '../../../../questionarios/types'

type Params = { params: Promise<{ id: string }> }

/** Lista para a planilha da mala direta (o arquivo é montado no navegador).
 *  - convites:  quem está "Não enviado" (e não respondeu); gera o link de quem ainda não tem.
 *  - lembretes: quem está "Enviado manualmente" e ainda não respondeu.
 *  Quem não tem e-mail volta separado, em `semEmail`, para corrigir o cadastro.
 *  Não marca nada como enviado — isso só acontece depois, na confirmação (rota /envio). */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Só admin e gestor podem exportar' }, { status: 403 })

  const { tipo } = await req.json().catch(() => ({})) as { tipo?: string }
  if (tipo !== 'convites' && tipo !== 'lembretes') return Response.json({ error: 'Tipo de exportação inválido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: qn } = await admin.from('questionarios').select('status').eq('id', id).single()
  if (!qn) return Response.json({ error: 'Questionário não encontrado' }, { status: 404 })
  if (qn.status !== 'ativo') return Response.json({ error: 'Ative o questionário antes de exportar' }, { status: 400 })

  const statusEnvio = tipo === 'convites' ? 'nao_enviado' : 'enviado'

  if (tipo === 'convites') {
    // Gera o link de quem ainda não tem (pendente → enviado no ciclo do link, igual a "Gerar links")
    const { data: semLink, error } = await admin
      .from('questionario_convites')
      .select('id')
      .eq('questionario_id', id)
      .eq('status', 'pendente')
      .is('token', null)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    for (const p of semLink ?? []) {
      const { error: upErr } = await admin
        .from('questionario_convites')
        .update({ token: gerarToken(), status: 'enviado' })
        .eq('id', p.id)
        .eq('status', 'pendente')
        .is('token', null)
      if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
    }
  }

  const { data, error } = await admin
    .from('questionario_convites')
    .select(CONVITE_SELECT)
    .eq('questionario_id', id)
    .eq('status_envio', statusEnvio)
    .neq('status', 'respondido')
    .order('empresa')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const lista = (data ?? []) as Convite[]
  const comEmail = lista.filter(c => c.email.trim() && c.token)
  const semEmail = lista.filter(c => !c.email.trim())

  // Lista atualizada do questionário inteiro (os links novos aparecem na tela sem recarregar)
  const { data: todos } = await admin.from('questionario_convites').select(CONVITE_SELECT).eq('questionario_id', id).order('created_at')

  return Response.json({
    linhas: comEmail.map(c => ({ id: c.id, nome: c.nome, empresa: c.empresa, email: c.email.trim(), token: c.token })),
    semEmail: semEmail.map(c => ({ nome: c.nome, empresa: c.empresa })),
    convites: todos ?? [],
  })
}
