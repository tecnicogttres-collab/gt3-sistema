import { NextRequest } from 'next/server'
import { createClient } from '../../lib/supabase-server'
import { createAdminClient } from '../../lib/supabase-admin'

export async function POST(req: NextRequest) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()
  if (!['gestor', 'admin'].includes(callerProfile?.papel ?? '')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const { colaborador_id, nome, funcao, data_inicio, observacao } = body as {
    colaborador_id: string
    nome: string
    funcao?: string
    data_inicio?: string
    observacao?: string
  }

  if (!colaborador_id || !nome?.trim()) {
    return Response.json({ error: 'colaborador_id e nome são obrigatórios' }, { status: 400 })
  }

  // 1. Create PDI record
  const { data: pdi, error: pdiError } = await admin
    .from('pdis')
    .insert({
      nome: nome.trim(),
      funcao: funcao?.trim() ?? '',
      data_inicio: data_inicio || null,
      observacao: observacao?.trim() ?? '',
      colaborador_id,
      criado_por: user.id,
    })
    .select()
    .single()

  if (pdiError) return Response.json({ error: pdiError.message }, { status: 500 })

  const pdiId = pdi.id as string

  // 2. Update collaborator's pdi_slug
  await admin.from('profiles').update({ pdi_slug: pdiId }).eq('id', colaborador_id)

  // 3. Create ciclo 1
  await admin.from('pdi_ciclos').insert({
    pdi_id: pdiId,
    colaborador_id,
    numero_ciclo: 1,
    status: 'ativo',
    avaliacao_diretiva: [],
    autoavaliacao: [],
    ambicao: [],
    autoavaliacao_salva: false,
    criado_por: user.id,
  })

  // 4. Create notification for collaborator
  await admin.from('pdi_notificacoes').insert({
    pdi_id: pdiId,
    colaborador_id,
    visto: false,
    tipo: 'criado',
  })

  return Response.json(pdi, { status: 201 })
}
