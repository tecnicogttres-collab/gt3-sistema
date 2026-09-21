import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const SELECT = 'id, empresa, contratante, setores, documentos, situacao_id, responsaveis, motivo, data_verificacao, tratativa, ciencia_por, retorno_recebido, retorno_em, criado_por, created_at, updated_at'

const TRAT_LABEL: Record<string, string> = {
  aguardando: 'Aguardando ciência',
  ciente: 'Ciente',
  andamento: 'Em andamento',
  resolvido: 'Resolvido',
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const action = body?.action as string

  const admin = createAdminClient()
  const { data: atual, error: fetchError } = await admin
    .from('designacoes')
    .select('id, tratativa, ciencia_por, responsaveis')
    .eq('id', id)
    .single()

  if (fetchError || !atual) return Response.json({ error: 'Designação não encontrada' }, { status: 404 })

  const responsaveis: string[] = atual.responsaveis ?? []
  if (!responsaveis.includes(caller.user.id)) {
    return Response.json({ error: 'Você não é responsável por esta designação' }, { status: 403 })
  }

  let update: Record<string, unknown> = {}
  let acaoHistorico = ''

  if (action === 'ciencia') {
    const cienciaPor: string[] = atual.ciencia_por ?? []
    if (cienciaPor.includes(caller.user.id)) {
      // já deu ciência — idempotente
      const { data } = await admin.from('designacoes').select(SELECT).eq('id', id).single()
      return Response.json(data)
    }
    const novaCiencia = [...cienciaPor, caller.user.id]
    update = { ciencia_por: novaCiencia }
    if (atual.tratativa === 'aguardando') update.tratativa = 'ciente'
    acaoHistorico = 'Ciência registrada'
  } else if (action === 'tratativa') {
    const novo = body?.tratativa as string
    if (!['andamento', 'resolvido'].includes(novo)) {
      return Response.json({ error: 'Tratativa inválida' }, { status: 400 })
    }
    const cienciaPor: string[] = atual.ciencia_por ?? []
    if (!cienciaPor.includes(caller.user.id)) {
      return Response.json({ error: 'É preciso dar ciência antes de avançar a tratativa' }, { status: 403 })
    }
    if (atual.tratativa === 'resolvido') {
      return Response.json({ error: 'Designação já resolvida' }, { status: 400 })
    }
    update = { tratativa: novo }
    acaoHistorico = `Tratativa → ${TRAT_LABEL[novo] ?? novo}`
  } else if (action === 'retorno') {
    // Marcador independente da tratativa — a empresa respondeu ao e-mail, mesmo que o
    // caso ainda não esteja resolvido. Alterna (permite desmarcar se foi engano).
    const ligar = body?.retorno !== false
    update = { retorno_recebido: ligar, retorno_em: ligar ? new Date().toISOString() : null }
    acaoHistorico = ligar ? 'Empresa retornou' : 'Retorno da empresa desmarcado'
  } else {
    return Response.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('designacoes')
    .update(update)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  try {
    await admin.from('designacoes_historico').insert({
      designacao_id: id,
      por: caller.user.id,
      acao: acaoHistorico,
    })
  } catch { /* não bloqueia a resposta */ }

  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: atual, error: fetchError } = await admin
    .from('designacoes')
    .select('criado_por')
    .eq('id', id)
    .single()

  if (fetchError || !atual) return Response.json({ error: 'Designação não encontrada' }, { status: 404 })

  const podeExcluir = ['gestor', 'admin'].includes(caller.role) || atual.criado_por === caller.user.id
  if (!podeExcluir) {
    return Response.json({ error: 'Só quem criou a designação, gestor ou admin pode excluir' }, { status: 403 })
  }

  const { error } = await admin.from('designacoes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
