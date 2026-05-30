import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'
import * as allPdis from '../../../../data/pdis/index'
import type { PdiColaborador } from '../../../../data/pdis/types'

const pdisMap = Object.values(allPdis).reduce<Record<string, PdiColaborador>>((acc, pdi) => {
  acc[(pdi as PdiColaborador).id] = pdi as PdiColaborador
  return acc
}, {})

export async function POST(req: NextRequest) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (!['gestor', 'admin'].includes(profile?.papel ?? ''))
    return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { staticId, nome, funcao } = await req.json() as { staticId: string; nome: string; funcao: string }
  if (!staticId || !nome?.trim())
    return Response.json({ error: 'staticId e nome obrigatórios' }, { status: 400 })

  // Idempotente: se já foi migrado, só garante que pdi_slug aponta pro UUID e retorna
  const { data: existing } = await admin
    .from('pdis')
    .select('id')
    .contains('conclusoes', { _original_slug: staticId })
    .maybeSingle()

  if (existing) {
    // Já migrado — aplica as edições de nome/funcao e garante pdi_slug correto
    await Promise.all([
      admin.from('pdis').update({ nome: nome.trim(), funcao: (funcao ?? '').trim() }).eq('id', existing.id),
      admin.from('profiles').update({ pdi_slug: existing.id }).eq('pdi_slug', staticId),
    ])
    return Response.json({ id: existing.id })
  }

  // Dados do arquivo estático — copia tudo para o novo registro
  const staticPdi = pdisMap[staticId]

  const { data: newPdi, error: insertErr } = await admin
    .from('pdis')
    .insert({
      nome: nome.trim(),
      funcao: (funcao ?? '').trim(),
      eneagrama:    staticPdi?.perfilComportamental.eneagrama ?? null,
      animais:      staticPdi?.perfilComportamental.animais ?? null,
      competencias: staticPdi?.matrizAvaliacao.competencias ?? [],
      conclusoes: {
        ...(staticPdi?.conclusoes ?? {}),
        _original_slug: staticId,
        ...(staticPdi?.perfilComportamental.mbti?.tipo
          ? { _mbti_tipo: staticPdi.perfilComportamental.mbti.tipo }
          : {}),
      },
    })
    .select('id')
    .single()

  if (insertErr || !newPdi)
    return Response.json({ error: insertErr?.message ?? 'Erro ao criar PDI' }, { status: 500 })

  const newId = newPdi.id as string

  // Migra referências (text vs uuid — pode falhar silenciosamente para uuid, tudo bem)
  await Promise.all([
    admin.from('profiles').update({ pdi_slug: newId }).eq('pdi_slug', staticId),
    admin.from('pdi_ciclos').update({ pdi_id: newId }).eq('pdi_id', staticId),
    admin.from('pdi_acoes').update({ pdi_id: newId }).eq('pdi_id', staticId),
    admin.from('pdi_notificacoes').update({ pdi_id: newId }).eq('pdi_id', staticId),
  ])

  // Verifica se ciclos existem para o novo UUID (update pode ter falhado por tipo uuid)
  const { data: ciclosExistentes } = await admin
    .from('pdi_ciclos')
    .select('id')
    .eq('pdi_id', newId)
    .limit(1)

  if (!ciclosExistentes?.length && staticPdi) {
    // Recria o ciclo 1 com os dados de avaliação do arquivo estático
    const { data: colab } = await admin
      .from('profiles')
      .select('id')
      .eq('pdi_slug', newId)
      .maybeSingle()

    await admin.from('pdi_ciclos').insert({
      pdi_id: newId,
      colaborador_id: colab?.id ?? null,
      numero_ciclo: 1,
      status: 'ativo',
      avaliacao_diretiva: staticPdi.matrizAvaliacao.diretiva,
      autoavaliacao:      staticPdi.matrizAvaliacao.auto,
      ambicao:            staticPdi.matrizAvaliacao.ambicao,
      autoavaliacao_salva: staticPdi.matrizAvaliacao.diretiva.length > 0,
    })
  }

  return Response.json({ id: newId })
}
