import { NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { createAdminClient } from '../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  const role = (profile?.papel as string) ?? 'colaborador'
  const isGestorAdmin = ['admin', 'gestor'].includes(role)

  const { data: enquete } = await admin
    .from('enquetes')
    .select('status, mostrar_resultados_parciais, anonima')
    .eq('id', id)
    .single()

  if (!enquete) return Response.json({ error: 'Não encontrada' }, { status: 404 })

  if (!isGestorAdmin) {
    const { data: minhas } = await admin.from('enquete_respostas').select('id').eq('enquete_id', id).eq('usuario_id', user.id).limit(1)
    const voted = (minhas ?? []).length > 0
    if (!voted || (!enquete.mostrar_resultados_parciais && enquete.status !== 'closed')) {
      return Response.json({ error: 'Resultados não disponíveis' }, { status: 403 })
    }
  }

  const { data: perguntas } = await admin
    .from('enquete_perguntas')
    .select('id, ordem, texto, tipo')
    .eq('enquete_id', id)
    .order('ordem')

  const pergIds = (perguntas ?? []).map((p: { id: string }) => p.id)
  let opcoes: Array<{ id: string; pergunta_id: string; texto: string; ordem: number }> = []
  if (pergIds.length > 0) {
    const { data: opts } = await admin.from('enquete_opcoes').select('id, pergunta_id, texto, ordem').in('pergunta_id', pergIds).order('ordem')
    opcoes = opts ?? []
  }

  const { data: respostas } = await admin
    .from('enquete_respostas')
    .select('pergunta_id, opcao_id, texto_livre')
    .eq('enquete_id', id)

  const { data: voters } = await admin.from('enquete_respostas').select('usuario_id').eq('enquete_id', id)
  const totalVoters = new Set((voters ?? []).map((v: { usuario_id: string }) => v.usuario_id)).size

  const results = (perguntas ?? []).map((p: { id: string; texto: string; tipo: string }) => {
    const pergResps = (respostas ?? []).filter((r: { pergunta_id: string }) => r.pergunta_id === p.id)
    const pergOpcoes = opcoes.filter(o => o.pergunta_id === p.id)

    if (p.tipo === 'text') {
      return {
        pergunta_id: p.id,
        texto: p.texto,
        tipo: p.tipo,
        respostas_texto: pergResps.map((r: { texto_livre: string | null }) => r.texto_livre).filter(Boolean),
      }
    }

    const opCountMap: Record<string, number> = {}
    pergOpcoes.forEach(o => { opCountMap[o.id] = 0 })
    pergResps.forEach((r: { opcao_id: string | null }) => {
      if (r.opcao_id) opCountMap[r.opcao_id] = (opCountMap[r.opcao_id] ?? 0) + 1
    })

    return {
      pergunta_id: p.id,
      texto: p.texto,
      tipo: p.tipo,
      total_respostas: pergResps.length,
      opcoes: pergOpcoes.map(o => ({ id: o.id, texto: o.texto, votos: opCountMap[o.id] ?? 0 })),
    }
  })

  return Response.json({ total_voters: totalVoters, results })
}
