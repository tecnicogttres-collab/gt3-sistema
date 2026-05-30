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
  const { etapa_id, novo_estado, obs } = await req.json()
  if (!etapa_id || !novo_estado) return Response.json({ error: 'etapa_id e novo_estado obrigatórios' }, { status: 400 })

  const admin = createAdminClient()

  // Stage 1 — auth + fetch completo da terceira em paralelo
  const [caller, { data: terceira }] = await Promise.all([
    getCaller(),
    admin.from('terceiras')
      .select(`
        id, contratante_id, razao_social, contato, data, tem_sub, subcontratante,
        observacao, status, arquivado_em, etapas, created_at,
        contratante:terceiras_contratantes(id, nome, requer_cc),
        historico:terceiras_historico(id, ts, who, what)
      `)
      .eq('id', id)
      .single(),
  ])

  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!terceira) return Response.json({ error: 'Terceira não encontrada' }, { status: 404 })
  if (terceira.status !== 'ativo') return Response.json({ error: 'Terceira está arquivada' }, { status: 400 })

  if (novo_estado === 'validado' && ETAPAS_REQUER_GESTOR.includes(etapa_id)) {
    if (!['admin', 'gestor'].includes(caller.papel)) {
      return Response.json({ error: 'Apenas gestor ou admin pode validar esta etapa' }, { status: 403 })
    }
  }

  const ct = terceira.contratante as unknown as { requer_cc: boolean } | null
  const requerCC = !!ct?.requer_cc
  const etapas = { ...(terceira.etapas as Record<string, string>) }
  const estadoAntigo = etapas[etapa_id] ?? '—'
  etapas[etapa_id] = novo_estado
  const progresso = calcProgresso(etapas, requerCC)

  const ehArquivamentoPorNaoEvoluiu = etapa_id === 'cnpj_liberado' && novo_estado === 'nao_evoluiu'
  const ehConclusao = progresso === 100

  const update: Record<string, unknown> = { etapas }
  if (ehArquivamentoPorNaoEvoluiu) {
    update.status = 'nao_evoluiu'
    update.arquivado_em = new Date().toISOString()
  } else if (ehConclusao) {
    update.status = 'concluido'
    update.arquivado_em = new Date().toISOString()
  }

  let historicoWhat = `${etapa_id.toUpperCase()}: ${estadoAntigo} → ${novo_estado}`
  if (obs?.trim()) historicoWhat += ` · obs: ${obs.trim()}`
  if (ehArquivamentoPorNaoEvoluiu) historicoWhat = `CNPJ Liberado marcado como "Não evoluiu" — arquivado`

  const historicoInserts = [
    { terceira_id: id, who: caller.nome, user_id: caller.user.id, what: historicoWhat },
    ...(ehConclusao && !ehArquivamentoPorNaoEvoluiu
      ? [{ terceira_id: id, who: caller.nome, user_id: caller.user.id, what: 'Cadastro concluído (100%) — arquivado automaticamente' }]
      : []),
  ]

  // Stage 2 — update + insert do histórico em paralelo
  const [{ error }, { data: novoHistorico }] = await Promise.all([
    admin.from('terceiras').update(update).eq('id', id),
    admin.from('terceiras_historico').insert(historicoInserts).select('id, ts, who, what'),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Monta resposta localmente — sem re-fetch
  const atualizada = {
    ...terceira,
    etapas,
    status: (update.status ?? terceira.status) as string,
    arquivado_em: (update.arquivado_em ?? terceira.arquivado_em) as string | null,
    historico: [...(terceira.historico as { id: string; ts: string; who: string; what: string }[] ?? []), ...(novoHistorico ?? [])],
  }

  return Response.json({
    terceira: atualizada,
    arquivada: ehArquivamentoPorNaoEvoluiu || ehConclusao,
    motivo: ehArquivamentoPorNaoEvoluiu ? 'nao_evoluiu' : ehConclusao ? 'concluido' : null,
  })
}
