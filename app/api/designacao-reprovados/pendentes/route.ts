import { getCaller } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'

/** Designações do caller aguardando a ciência DELE especificamente (não da tratativa
 *  geral) — alimenta o widget "Designação de Reprovados" do dashboard. Dar ciência tira
 *  o item daqui na hora (ver PATCH .../[id] action=ciencia). */
export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json([], { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('designacoes')
    .select('id, empresa, setores, data_verificacao, ciencia_por')
    .contains('responsaveis', [caller.user.id])
    .order('data_verificacao', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const pendentes = (data ?? []).filter(d => !((d.ciencia_por as string[] | null) ?? []).includes(caller.user.id))

  const setorIds = [...new Set(pendentes.flatMap(d => (d.setores as string[] | null) ?? []))]
  const { data: setoresData } = setorIds.length
    ? await admin.from('desig_setores').select('id, nome').in('id', setorIds)
    : { data: [] as { id: string; nome: string }[] }
  const nomeMap = new Map((setoresData ?? []).map((s: { id: string; nome: string }) => [s.id, s.nome]))

  const result = pendentes.map(d => ({
    id: d.id as string,
    empresa: d.empresa as string,
    data_verificacao: d.data_verificacao as string,
    setores: ((d.setores as string[] | null) ?? []).map(id => nomeMap.get(id) ?? '—'),
  }))

  return Response.json(result)
}
