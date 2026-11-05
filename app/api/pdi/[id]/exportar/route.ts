import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../lib/api-helpers'

// Dados completos de um PDI para exportação — somente gestor/admin.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (!['gestor', 'admin'].includes((profile?.papel as string) ?? ''))
    return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const [{ data: pdi }, { data: acoes }, { data: ciclos }] = await Promise.all([
    admin.from('pdis').select('id, nome, funcao, data_inicio, eneagrama, animais, conclusoes, competencias').eq('id', id).maybeSingle(),
    admin.from('pdi_acoes')
      .select('competencia, desenvolver, acoes, resultados_esperados, inicio, termino, status, concluido_em')
      .eq('pdi_id', id).order('created_at'),
    admin.from('pdi_ciclos')
      .select('id, numero_ciclo, status, avaliacao_diretiva, autoavaliacao, ambicao, data_conversa, conversa_confirmada_em, data_inicio, data_fim')
      .eq('pdi_id', id).order('numero_ciclo', { ascending: true }),
  ])

  const cicloIds = (ciclos ?? []).map(c => c.id as string)
  const { data: rascunhos } = cicloIds.length
    ? await admin.from('pdi_rascunhos').select('ciclo_id, user_nome, texto, updated_at').in('ciclo_id', cicloIds)
    : { data: [] }

  return Response.json({
    pdi: pdi ?? null,
    acoes: acoes ?? [],
    ciclos: (ciclos ?? []).map(c => ({
      ...c,
      rascunhos: (rascunhos ?? [])
        .filter(r => r.ciclo_id === c.id && (r.texto as string | null)?.trim())
        .map(r => ({ user_nome: r.user_nome, texto: r.texto, updated_at: r.updated_at })),
    })),
  })
}
