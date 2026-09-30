import { getCaller } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'

/** Designações do caller para o widget "Designação de Reprovados" do dashboard: as que aguardam
 *  a ciência DELE (aguardando_ciencia = true) e as que ele já deu ciência e seguem em andamento.
 *  Dar ciência move o item de "aguardando" para "em andamento" (ver PATCH .../[id] action=ciencia). */
export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json([], { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('designacoes')
    .select('id, empresa, setores, data_verificacao, ciencia_por, tratativa')
    .contains('responsaveis', JSON.stringify([caller.user.id]))
    .order('data_verificacao', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const jaCiente = (d: { ciencia_por: unknown }) => ((d.ciencia_por as string[] | null) ?? []).includes(caller.user.id)
  const pendentes = (data ?? []).filter(d =>
    !jaCiente(d) ? !['resolvido', 'excluido'].includes(d.tratativa as string) : ['ciente', 'andamento'].includes(d.tratativa as string))

  const setorIds = [...new Set(pendentes.flatMap(d => (d.setores as string[] | null) ?? []))]
  const { data: setoresData } = setorIds.length
    ? await admin.from('desig_setores').select('id, nome').in('id', setorIds)
    : { data: [] as { id: string; nome: string }[] }
  const nomeMap = new Map((setoresData ?? []).map((s: { id: string; nome: string }) => [s.id, s.nome]))

  const result = pendentes.map(d => ({
    id: d.id as string,
    empresa: d.empresa as string,
    data_verificacao: d.data_verificacao as string,
    aguardando_ciencia: !jaCiente(d),
    setores: ((d.setores as string[] | null) ?? []).map(id => nomeMap.get(id) ?? '—'),
  }))

  return Response.json(result)
}
