import { NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase-server'
import { createAdminClient } from '../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

async function getCaller() {
  const server = await createClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('nome, papel').eq('id', user.id).single()
  const rawPapel = (profile?.papel as string | null) ?? 'colaborador'
  return { user, nome: (profile?.nome as string | null) ?? 'Usuário', papel: rawPapel === 'trainee' ? 'colaborador' : rawPapel }
}

const CAMPO_LABELS: Record<string, string> = {
  contratante_id: 'Contratante',
  razao_social: 'Razão social',
  contato: 'Contato',
  data: 'Data',
  tem_sub: 'É subcontratada',
  subcontratante: 'Empresa subcontratante',
  observacao: 'Observação',
  sem_prazo: 'Controle de prazo',
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  const camposAlterados: string[] = []

  const CAMPOS = ['contratante_id', 'razao_social', 'contato', 'data', 'tem_sub', 'subcontratante', 'observacao', 'sem_prazo']
  for (const campo of CAMPOS) {
    if (body[campo] !== undefined) {
      if (campo === 'razao_social' && typeof body[campo] === 'string') {
        update[campo] = body[campo].trim().toUpperCase()
      } else if (campo === 'contato' || campo === 'subcontratante' || campo === 'observacao') {
        update[campo] = body[campo]?.trim() || null
      } else {
        update[campo] = body[campo]
      }
      camposAlterados.push(CAMPO_LABELS[campo] ?? campo)
    }
  }

  // Quando muda contratante, precisa ajustar cc_notif nas etapas
  const admin = createAdminClient()
  if (body.contratante_id) {
    const { data: t } = await admin.from('terceiras').select('etapas').eq('id', id).single()
    const { data: ct } = await admin.from('terceiras_contratantes').select('requer_cc').eq('id', body.contratante_id).single()
    if (t && ct) {
      const etapas = { ...(t.etapas as Record<string, string>) }
      if (ct.requer_cc && !etapas.cc_notif) etapas.cc_notif = 'pendente'
      if (!ct.requer_cc && etapas.cc_notif !== undefined) delete etapas.cc_notif
      update.etapas = etapas
    }
  }

  if (Object.keys(update).length === 0) return Response.json({ ok: true })

  const { error } = await admin.from('terceiras').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (camposAlterados.length > 0) {
    await admin.from('terceiras_historico').insert({
      terceira_id: id,
      who: caller.nome,
      user_id: caller.user.id,
      what: `${camposAlterados.join(', ')} alterado`,
    })
  }

  const { data: atualizada } = await admin
    .from('terceiras')
    .select(`
      id, contratante_id, razao_social, contato, data, tem_sub, subcontratante,
      observacao, sem_prazo, status, arquivado_em, etapas, created_at,
      contratante:terceiras_contratantes(id, nome, requer_cc),
      historico:terceiras_historico(id, ts, who, what)
    `)
    .eq('id', id)
    .single()

  return Response.json(atualizada)
}
