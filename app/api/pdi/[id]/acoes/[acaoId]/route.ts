import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../../lib/api-helpers'
import { papelEfetivo } from '../../../../../lib/ver-como'
import { getPdiAcesso, logPdi, notificarPdi, PDI_NOTIFICACOES_LIGADAS } from '../../../../../lib/pdi-acesso'

async function requireGestorAdmin() {
  const user = await getAuthUser()
  if (!user) return { user: null, ok: false as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (profile) profile.papel = await papelEfetivo(profile.papel) // "Ver como" do admin
  const papel = profile?.papel as string | null
  if (!papel || !['gestor', 'admin'].includes(papel)) return { user, ok: false as const }
  return { user, ok: true as const }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; acaoId: string }> }
) {
  const { id, acaoId } = await params
  const { ok } = await requireGestorAdmin()
  if (!ok) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>
  const admin = createAdminClient()

  const { data: current } = await admin.from('pdi_acoes').select('*').eq('id', acaoId).eq('pdi_id', id).maybeSingle()
  if (!current) return Response.json({ error: 'Ação não encontrada' }, { status: 404 })

  // Atualização parcial: só os campos enviados
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['competencia', 'desenvolver', 'acoes', 'resultados_esperados', 'inicio', 'termino', 'status', 'resultado_alcancado', 'evidencia'] as const) {
    if (k in body) updates[k] = body[k] ?? ''
  }

  const status = ('status' in body ? body.status : current.status) as string
  const resultado = String(('resultado_alcancado' in body ? body.resultado_alcancado : current.resultado_alcancado) ?? '').trim()
  if (status === 'Concluído') {
    // Trava: só conclui com o resultado alcançado registrado
    if (!resultado) return Response.json({ error: 'Para concluir, registre o resultado alcançado.' }, { status: 400 })
    if (!current.concluido_em) updates.concluido_em = new Date().toISOString()
  } else {
    updates.concluido_em = null
  }

  const { data, error } = await admin
    .from('pdi_acoes')
    .update(updates)
    .eq('id', acaoId)
    .eq('pdi_id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const ac = await getPdiAcesso(id)
  if (ac) {
    const log = (evento: string, detalhe: string) =>
      logPdi(admin, { pdiId: id, acaoId, evento, detalhe, userId: ac.userId, nome: ac.nome })
    if (status !== current.status) {
      await log(status === 'Concluído' ? 'Ação concluída' : 'Status da ação', status === 'Concluído' ? resultado.slice(0, 160) : `${current.status || '—'} → ${status}`)
    }
    const editados = ['competencia', 'desenvolver', 'acoes', 'resultados_esperados', 'inicio', 'termino']
      .filter(k => k in body && (body[k] ?? '') !== (current[k] ?? ''))
    if (editados.length) await log('Ação editada', editados.map(k => ({ competencia: 'competência', desenvolver: 'o que desenvolver', acoes: 'ações', resultados_esperados: 'resultados esperados', inicio: 'início', termino: 'término' } as Record<string, string>)[k]).join(', '))
    if ('resultado_alcancado' in body && status !== 'Concluído' && resultado !== (current.resultado_alcancado ?? '').trim() && resultado) await log('Resultado registrado', resultado.slice(0, 160))
  }

  // Notificação ao colaborador: passa pelo interruptor geral (desligado por enquanto)
  if (PDI_NOTIFICACOES_LIGADAS) {
    const { data: colaborador } = await admin.from('profiles').select('id').eq('pdi_slug', id).maybeSingle()
    await notificarPdi(admin, { pdiId: id, colaboradorId: colaborador?.id })
  }

  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; acaoId: string }> }
) {
  const { id, acaoId } = await params
  const { ok } = await requireGestorAdmin()
  if (!ok) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data: atual } = await admin.from('pdi_acoes').select('competencia').eq('id', acaoId).eq('pdi_id', id).maybeSingle()
  const { error } = await admin
    .from('pdi_acoes')
    .delete()
    .eq('id', acaoId)
    .eq('pdi_id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Sem acao_id: o histórico da ação cai junto com ela (CASCADE), este registro fica no PDI
  const ac = await getPdiAcesso(id)
  if (ac && atual) await logPdi(admin, { pdiId: id, evento: 'Ação excluída', detalhe: atual.competencia, userId: ac.userId, nome: ac.nome })
  return new Response(null, { status: 204 })
}
