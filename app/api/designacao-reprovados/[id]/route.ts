import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const SELECT = 'id, empresa, contratante, setores, documentos, situacao_id, responsaveis, motivo, data_verificacao, tratativa, ciencia_por, retorno_recebido, retorno_em, retorno_tipo, retorno_obs, retorno_por, ligacao_em, ligacao_por, contatos_email, criado_por, created_at, updated_at'

const TRAT_LABEL: Record<string, string> = {
  aguardando: 'Aguardando ciência',
  ciente: 'Ciente',
  andamento: 'Em andamento',
  resolvido: 'Resolvido',
  excluido: 'Doc(s) excluído',
}

const RETORNO_TIPO_LABEL: Record<string, string> = {
  ligacao: 'ligação ou WhatsApp',
  email: 'e-mail',
  outro: 'outro',
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
    .select('id, tratativa, ciencia_por, responsaveis, criado_por, contatos_email, ligacao_em')
    .eq('id', id)
    .single()

  if (fetchError || !atual) return Response.json({ error: 'Designação não encontrada' }, { status: 404 })

  const responsaveis: string[] = atual.responsaveis ?? []
  const souResponsavel = responsaveis.includes(caller.user.id)
  // Quem designou acompanha e pode tratar o item também (excluído, retorno, resolvido...).
  const souCriador = atual.criado_por === caller.user.id
  // Registro de contato por e-mail vale para quem gerou o e-mail, seja quem for.
  if (action !== 'contato_email' && !souResponsavel && !souCriador) {
    return Response.json({ error: 'Só os responsáveis ou quem designou podem alterar esta designação' }, { status: 403 })
  }

  let update: Record<string, unknown> = {}
  let acaoHistorico = ''

  if (action === 'contato_email') {
    // "Baixe o e-mail pronto" / "Abrir no Outlook": registra quando e quem contatou a empresa.
    const contatos = Array.isArray(atual.contatos_email) ? atual.contatos_email : []
    update = { contatos_email: [...contatos, { em: new Date().toISOString(), por: caller.user.id }] }
    acaoHistorico = 'Empresa contatada sobre a reprovação (e-mail)'
  } else if (action === 'ciencia') {
    if (!souResponsavel) {
      return Response.json({ error: 'Só os responsáveis dão ciência' }, { status: 403 })
    }
    const cienciaPor: string[] = atual.ciencia_por ?? []
    if (cienciaPor.includes(caller.user.id)) {
      // já deu ciência — idempotente
      const { data } = await admin.from('designacoes').select(SELECT).eq('id', id).single()
      return Response.json(data)
    }
    const novaCiencia = [...cienciaPor, caller.user.id]
    update = { ciencia_por: novaCiencia }
    // Dar ciência já coloca o item em andamento (o aviso passa a ficar no dashboard como andamento).
    if (['aguardando', 'ciente'].includes(atual.tratativa)) update.tratativa = 'andamento'
    acaoHistorico = 'Ciente e e-mail enviado — em andamento'
  } else if (action === 'tratativa') {
    const novo = body?.tratativa as string
    if (!['andamento', 'resolvido', 'excluido'].includes(novo)) {
      return Response.json({ error: 'Tratativa inválida' }, { status: 400 })
    }
    const cienciaPor: string[] = atual.ciencia_por ?? []
    // Quem designou não precisa dar ciência (a designação foi dele) para tratar o item.
    if (!souCriador && !cienciaPor.includes(caller.user.id)) {
      return Response.json({ error: 'É preciso dar ciência antes de avançar a tratativa' }, { status: 403 })
    }
    if (['resolvido', 'excluido'].includes(atual.tratativa)) {
      return Response.json({ error: 'Designação já finalizada' }, { status: 400 })
    }
    update = { tratativa: novo }
    acaoHistorico = `Tratativa → ${TRAT_LABEL[novo] ?? novo}`
  } else if (action === 'retorno') {
    // Marcador independente da tratativa — a empresa respondeu ao e-mail, mesmo que o
    // caso ainda não esteja resolvido. Alterna (permite desmarcar se foi engano).
    // Ao marcar, registra como a empresa retornou + texto livre (para mensurar depois).
    const ligar = body?.retorno !== false
    const agora = new Date().toISOString()
    if (ligar) {
      const tipo = body?.tipo as string
      if (!RETORNO_TIPO_LABEL[tipo]) {
        return Response.json({ error: 'Informe como a empresa retornou' }, { status: 400 })
      }
      const obs = typeof body?.obs === 'string' ? body.obs.trim().slice(0, 2000) : ''
      update = { retorno_recebido: true, retorno_em: agora, retorno_tipo: tipo, retorno_obs: obs || null, retorno_por: caller.user.id }
      // Retorno por ligação/WhatsApp já conta como "ligação feita".
      if (tipo === 'ligacao' && !atual.ligacao_em) {
        update.ligacao_em = agora
        update.ligacao_por = caller.user.id
      }
      acaoHistorico = `Empresa retornou (${RETORNO_TIPO_LABEL[tipo]})${obs ? `: ${obs}` : ''}`
    } else {
      update = { retorno_recebido: false, retorno_em: null, retorno_tipo: null, retorno_obs: null, retorno_por: null }
      acaoHistorico = 'Retorno da empresa desmarcado'
    }
  } else if (action === 'ligacao') {
    // Bolinha "ligação feita": guarda quando e quem marcou. Alterna (permite desmarcar se foi engano).
    const ligar = body?.ligacao !== false
    update = { ligacao_em: ligar ? new Date().toISOString() : null, ligacao_por: ligar ? caller.user.id : null }
    acaoHistorico = ligar ? 'Ligação ou WhatsApp feito' : 'Ligação ou WhatsApp desmarcado'
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
