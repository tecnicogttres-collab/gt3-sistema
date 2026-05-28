import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

export type AgendaItem = {
  id: string
  pdi_id: string
  colaborador_id: string | null
  numero_ciclo: number
  data_conversa: string
  conversa_confirmada_em: string | null
  colaborador_nome: string
}

export async function GET(_req: NextRequest) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (!['gestor', 'admin'].includes(profile?.papel ?? '')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('pdi_ciclos')
    .select('id, pdi_id, colaborador_id, numero_ciclo, data_conversa, conversa_confirmada_em')
    .not('data_conversa', 'is', null)
    .order('data_conversa', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const ciclos = (data ?? []) as Array<{
    id: string; pdi_id: string; colaborador_id: string | null
    numero_ciclo: number; data_conversa: string; conversa_confirmada_em: string | null
  }>

  // Batch fetch collaborator names
  const colabIds = [...new Set(ciclos.map(c => c.colaborador_id).filter((id): id is string => id !== null))]
  const profilesMap: Record<string, string> = {}
  if (colabIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, nome').in('id', colabIds)
    for (const p of profiles ?? []) profilesMap[p.id] = p.nome as string
  }

  const result: AgendaItem[] = ciclos.map(c => ({
    id: c.id,
    pdi_id: c.pdi_id,
    colaborador_id: c.colaborador_id,
    numero_ciclo: c.numero_ciclo,
    data_conversa: c.data_conversa,
    conversa_confirmada_em: c.conversa_confirmada_em,
    colaborador_nome: c.colaborador_id ? (profilesMap[c.colaborador_id] ?? 'Colaborador') : 'Colaborador',
  }))

  return Response.json(result)
}
