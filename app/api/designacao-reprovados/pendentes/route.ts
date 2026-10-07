import { getCaller } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'

/** Designações do caller para o widget "Designação de Reprovados" do dashboard: só as que ainda
 *  aguardam a ciência DELE. Ao clicar em "Ciente e e-mail enviado" (PATCH .../[id] action=ciencia)
 *  a empresa sai do dashboard. */
export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json([], { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('designacoes')
    .select('id, empresa, setores, documentos, motivo, data_verificacao, ciencia_por, tratativa, ligacao_em, ligacao_por')
    .contains('responsaveis', JSON.stringify([caller.user.id]))
    .order('data_verificacao', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const jaCiente = (d: { ciencia_por: unknown }) => ((d.ciencia_por as string[] | null) ?? []).includes(caller.user.id)
  const pendentes = (data ?? []).filter(d => !jaCiente(d) && !['resolvido', 'excluido'].includes(d.tratativa as string))

  const setorIds = [...new Set(pendentes.flatMap(d => (d.setores as string[] | null) ?? []))]
  const docIds = [...new Set(pendentes.flatMap(d => (d.documentos as string[] | null) ?? []))]
  const userIds = [...new Set(pendentes.map(d => d.ligacao_por as string | null).filter((x): x is string => !!x))]
  const [setoresRes, docsRes, usersRes] = await Promise.all([
    setorIds.length ? admin.from('desig_setores').select('id, nome').in('id', setorIds) : { data: [] },
    docIds.length ? admin.from('desig_documentos').select('id, nome').in('id', docIds) : { data: [] },
    userIds.length ? admin.from('profiles').select('id, nome').in('id', userIds) : { data: [] },
  ])
  const mapa = (rows: { id: string; nome: string | null }[] | null) => new Map((rows ?? []).map(r => [r.id, r.nome]))
  const setorNome = mapa(setoresRes.data)
  const docNome = mapa(docsRes.data)
  const userNome = mapa(usersRes.data)

  const result = pendentes.map(d => ({
    id: d.id as string,
    empresa: d.empresa as string,
    data_verificacao: d.data_verificacao as string,
    aguardando_ciencia: true,
    setores: ((d.setores as string[] | null) ?? []).map(id => setorNome.get(id) ?? '—'),
    documentos: ((d.documentos as string[] | null) ?? []).map(id => docNome.get(id) ?? '—'),
    motivo: (d.motivo as string | null) ?? '',
    ligacao_em: (d.ligacao_em as string | null) ?? null,
    ligacao_por_nome: d.ligacao_por ? (userNome.get(d.ligacao_por as string)?.trim() || 'Usuário') : null,
  }))

  return Response.json(result)
}
