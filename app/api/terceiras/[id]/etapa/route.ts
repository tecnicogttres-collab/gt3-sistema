import { NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

const ETAPAS_ORDEM = ['gt0100', 'cc_notif', 'pasta_rede', 'gt0180', 'cnpj_liberado', 'gt8005', 'email']
const ESTADOS_COMPLETOS = ['ok', 'na', 'sob_demanda', 'mensal', 'validado', 'liberado']
const ETAPAS_REQUER_GESTOR = ['gt0180']

function calcProgresso(etapas: Record<string, string>, requerCC: boolean): number {
  const ativas = ETAPAS_ORDEM.filter(e => e !== 'cc_notif' || requerCC)
  const ok = ativas.filter(e => ESTADOS_COMPLETOS.includes(etapas[e] ?? '')).length
  return ativas.length === 0 ? 0 : Math.round((ok / ativas.length) * 100)
}

async function getCaller() {
  const server = await createClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('nome, papel').eq('id', user.id).single()
  return { user, nome: (profile?.nome as string | null) ?? 'Usuário', papel: (profile?.papel as string | null) ?? 'colaborador' }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { etapa_id, novo_estado, obs } = await req.json()
  if (!etapa_id || !novo_estado) return Response.json({ error: 'etapa_id e novo_estado obrigatórios' }, { status: 400 })

  // Restrição: só gestor/admin pode marcar como 'validado' em etapas especiais
  if (novo_estado === 'validado' && ETAPAS_REQUER_GESTOR.includes(etapa_id)) {
    if (!['admin', 'gestor'].includes(caller.papel)) {
      return Response.json({ error: 'Apenas gestor ou admin pode validar esta etapa' }, { status: 403 })
    }
  }

  const admin = createAdminClient()
  const { data: terceira } = await admin
    .from('terceiras')
    .select('id, status, etapas, contratante:terceiras_contratantes(requer_cc)')
    .eq('id', id)
    .single()

  if (!terceira) return Response.json({ error: 'Terceira não encontrada' }, { status: 404 })
  if (terceira.status !== 'ativo') return Response.json({ error: 'Terceira está arquivada' }, { status: 400 })

  const etapas = { ...(terceira.etapas as Record<string, string>) }
  const estadoAntigo = etapas[etapa_id] ?? '—'
  etapas[etapa_id] = novo_estado

  const ct = terceira.contratante as unknown as { requer_cc: boolean } | null
  const requerCC = !!ct?.requer_cc
  const progresso = calcProgresso(etapas, requerCC)

  const ehArquivamentoPorNaoEvoluiu = etapa_id === 'cnpj_liberado' && novo_estado === 'nao_evoluiu'
  const ehConclusao = progresso === 100

  const update: Record<string, unknown> = { etapas }
  let historicoWhat = `${etapa_id.toUpperCase()}: ${estadoAntigo} → ${novo_estado}`
  if (obs?.trim()) historicoWhat += ` · obs: ${obs.trim()}`

  if (ehArquivamentoPorNaoEvoluiu) {
    update.status = 'nao_evoluiu'
    update.arquivado_em = new Date().toISOString()
    historicoWhat = `CNPJ Liberado marcado como "Não evoluiu" — arquivado`
  } else if (ehConclusao) {
    update.status = 'concluido'
    update.arquivado_em = new Date().toISOString()
  }

  const { error } = await admin.from('terceiras').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await admin.from('terceiras_historico').insert({
    terceira_id: id,
    who: caller.nome,
    user_id: caller.user.id,
    what: historicoWhat,
  })

  if (ehConclusao && !ehArquivamentoPorNaoEvoluiu) {
    await admin.from('terceiras_historico').insert({
      terceira_id: id,
      who: caller.nome,
      user_id: caller.user.id,
      what: 'Cadastro concluído (100%) — arquivado automaticamente',
    })
  }

  const { data: atualizada } = await admin
    .from('terceiras')
    .select(`
      id, contratante_id, razao_social, contato, data, tem_sub, subcontratante,
      observacao, status, arquivado_em, etapas, created_at,
      contratante:terceiras_contratantes(id, nome, requer_cc),
      historico:terceiras_historico(id, ts, who, what)
    `)
    .eq('id', id)
    .single()

  return Response.json({ terceira: atualizada, arquivada: ehArquivamentoPorNaoEvoluiu || ehConclusao, motivo: ehArquivamentoPorNaoEvoluiu ? 'nao_evoluiu' : ehConclusao ? 'concluido' : null })
}
