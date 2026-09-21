import { NextRequest } from 'next/server'
import { createClient } from '../../lib/supabase-server'
import { createAdminClient } from '../../lib/supabase-admin'

const ETAPAS_ORDEM = ['gt0100', 'cc_notif', 'pasta_rede', 'gt0180', 'cnpj_liberado', 'gt8005', 'email'] as const
const ESTADOS_COMPLETOS = ['ok', 'na', 'sob_demanda', 'mensal', 'validado', 'liberado']

function etapasPadrao(requerCC: boolean): Record<string, string> {
  const defaults: Record<string, string> = {
    gt0100: 'pendente',
    pasta_rede: 'pendente',
    gt0180: 'pendente',
    cnpj_liberado: 'nao_liberado',
    gt8005: 'pendente',
    email: 'pendente',
  }
  if (requerCC) defaults.cc_notif = 'pendente'
  return defaults
}

export function calcProgresso(etapas: Record<string, string>, requerCC: boolean): number {
  const ativas = ETAPAS_ORDEM.filter(e => e !== 'cc_notif' || requerCC)
  const total = ativas.length
  const ok = ativas.filter(e => ESTADOS_COMPLETOS.includes(etapas[e] ?? '')).length
  return total === 0 ? 0 : Math.round((ok / total) * 100)
}

async function getCaller() {
  const server = await createClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('nome, papel').eq('id', user.id).single()
  const rawPapel = (profile?.papel as string | null) ?? 'colaborador'
  return { user, nome: (profile?.nome as string | null) ?? 'Usuário', papel: rawPapel === 'trainee' ? 'colaborador' : rawPapel }
}

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const PAGE = 1000
  let terceiras: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('terceiras')
      .select(`
        id, contratante_id, razao_social, contato, data, tem_sub, subcontratante,
        observacao, sem_prazo, status, arquivado_em, etapas, created_at,
        contratante:terceiras_contratantes(id, nome, requer_cc),
        historico:terceiras_historico(id, ts, who, what)
      `)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    terceiras = terceiras.concat(data ?? [])
    if (!data || data.length < PAGE) break
  }

  return Response.json(terceiras)
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { contratante_id, razao_social, contato, data, tem_sub, subcontratante, observacao, sem_prazo } = body

  if (!contratante_id) return Response.json({ error: 'Contratante obrigatório' }, { status: 400 })
  if (!razao_social?.trim()) return Response.json({ error: 'Razão social obrigatória' }, { status: 400 })
  if (tem_sub && !subcontratante?.trim()) return Response.json({ error: 'Informe o nome da empresa subcontratante' }, { status: 400 })

  const admin = createAdminClient()
  const { data: contratante } = await admin
    .from('terceiras_contratantes')
    .select('requer_cc')
    .eq('id', contratante_id)
    .single()

  const requerCC = !!contratante?.requer_cc
  const etapas = etapasPadrao(requerCC)

  const { data: nova, error } = await admin
    .from('terceiras')
    .insert({
      contratante_id,
      razao_social: razao_social.trim().toUpperCase(),
      contato: contato?.trim() || null,
      data: data || new Date().toISOString().slice(0, 10),
      tem_sub: !!tem_sub,
      subcontratante: tem_sub ? (subcontratante?.trim() || null) : null,
      observacao: observacao?.trim() || null,
      sem_prazo: !!sem_prazo,
      status: 'ativo',
      etapas,
      created_by: caller.user.id,
    })
    .select('id')
    .single()

  if (error || !nova) return Response.json({ error: error?.message ?? 'Erro ao criar' }, { status: 500 })

  await admin.from('terceiras_historico').insert({
    terceira_id: nova.id,
    who: caller.nome,
    user_id: caller.user.id,
    what: 'Terceira cadastrada no sistema',
  })

  const { data: completa } = await admin
    .from('terceiras')
    .select(`
      id, contratante_id, razao_social, contato, data, tem_sub, subcontratante,
      observacao, sem_prazo, status, arquivado_em, etapas, created_at,
      contratante:terceiras_contratantes(id, nome, requer_cc),
      historico:terceiras_historico(id, ts, who, what)
    `)
    .eq('id', nova.id)
    .single()

  return Response.json(completa)
}
