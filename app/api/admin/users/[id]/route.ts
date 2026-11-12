import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'
import { sanitizarAssinatura } from '../../../../lib/email-assinatura'

async function getCaller(): Promise<{ role: string | null; id: string | null }> {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { role: null, id: null }
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  return { role: (data?.papel as string) ?? null, id: user.id }
}

type RouteContext = { params: Promise<{ id: string }> }

/** Listas que guardam ids de usuário sem FK: ao excluir, a pessoa sai delas.
 *  Se ela era a única da lista, a lista fica como está: esvaziar mudaria o sentido
 *  (em enquetes, lista vazia = vale o público-alvo, ou seja, "todos"). */
const LISTAS_DE_USUARIOS: { tabela: string; coluna: string; json?: boolean }[] = [
  { tabela: 'enquetes', coluna: 'destinatarios' },        // uuid[]
  { tabela: 'lembretes', coluna: 'destinatarios' },       // uuid[]
  { tabela: 'campanhas', coluna: 'destinatarios' },       // text[] (ids ou "todos")
  { tabela: 'legislacoes', coluna: 'destinatarios', json: true },
  { tabela: 'designacoes', coluna: 'responsaveis', json: true },
  { tabela: 'cs_amostragens', coluna: 'participantes' },  // uuid[]
]

async function removerDasListas(admin: ReturnType<typeof createAdminClient>, id: string): Promise<string | null> {
  for (const { tabela, coluna, json } of LISTAS_DE_USUARIOS) {
    const { data, error } = await admin.from(tabela).select(`id, ${coluna}`).contains(coluna, json ? JSON.stringify([id]) : [id])
    if (error) return `${tabela}: ${error.message}`
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const lista = Array.isArray(row[coluna]) ? (row[coluna] as unknown[]) : []
      const resto = lista.filter(x => x !== id)
      if (resto.length === 0 || resto.length === lista.length) continue
      const { error: upErr } = await admin.from(tabela).update({ [coluna]: resto }).eq('id', row.id as string)
      if (upErr) return `${tabela}: ${upErr.message}`
    }
  }
  return null
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const caller = await getCaller()
  if (!caller.role || !['gestor', 'admin'].includes(caller.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const admin = createAdminClient()

  // Admin rows can only be edited by that same admin
  const { data: targetProfile } = await admin.from('profiles').select('papel').eq('id', id).single()
  if (targetProfile?.papel === 'admin' && caller.id !== id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as Record<string, unknown>

  const profileUpdates: Record<string, unknown> = {}
  if ('nome' in body) profileUpdates.nome = body.nome
  if ('usuario' in body) profileUpdates.usuario = body.usuario
  if ('papel' in body) profileUpdates.papel = body.papel
  if ('pdi_slug' in body) profileUpdates.pdi_slug = body.pdi_slug ?? null
  if ('modulos_permitidos' in body) profileUpdates.modulos_permitidos = body.modulos_permitidos ?? null
  if ('modulos_dashboard' in body) profileUpdates.modulos_dashboard = body.modulos_dashboard ?? null
  if ('aniversario_dia' in body) profileUpdates.aniversario_dia = body.aniversario_dia ?? null
  if ('aniversario_mes' in body) profileUpdates.aniversario_mes = body.aniversario_mes ?? null
  // Assinatura de e-mail (HTML) — vai automaticamente em todo .eml / "abrir no Outlook" deste usuário.
  if ('assinatura_email' in body) profileUpdates.assinatura_email = sanitizarAssinatura(String(body.assinatura_email ?? '')) || null
  if (Object.keys(profileUpdates).length > 0) {
    const { error: updateErr } = await admin.from('profiles').update(profileUpdates).eq('id', id)
    if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })
  }

  if ('password' in body) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: body.password as string,
    })
    if (error) return Response.json({ error: error.message }, { status: 400 })
  }

  if ('banned' in body) {
    await admin.auth.admin.updateUserById(id, {
      ban_duration: body.banned ? '876600h' : 'none',
    })
  }

  return Response.json({ success: true })
}

/** Exclusão definitiva do login — apaga o usuário do Supabase Auth, o que derruba
 *  junto (ON DELETE CASCADE) a linha em profiles e os dados pessoais (leituras,
 *  preferências, notificações…). Histórico e ações ficam com o autor NULL
 *  ("usuário excluído"), conforme sql/usuarios-exclusao-definitiva.sql. O PDI
 *  também fica (colaborador_id SET NULL). */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const caller = await getCaller()
  if (!caller.role || !['gestor', 'admin'].includes(caller.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const admin = createAdminClient()

  const { data: targetProfile } = await admin.from('profiles').select('papel').eq('id', id).single()
  if (targetProfile?.papel === 'admin' && caller.id !== id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (caller.id === id) {
    return Response.json({ error: 'Você não pode excluir sua própria conta' }, { status: 400 })
  }

  // Adiamentos de lembrete são pessoais e não têm FK (não cairiam sozinhos)
  await admin.from('lembretes_adiamentos').delete().eq('usuario_id', id)

  // Tira o usuário das listas de destinatários/responsáveis/participantes (guardam só o id, sem FK)
  const erroListas = await removerDasListas(admin, id)
  if (erroListas) return Response.json({ error: `Não foi possível tirar o usuário das listas (${erroListas}). O login não foi excluído; tente de novo.` }, { status: 500 })

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) {
    const msg = /database error/i.test(error.message)
      ? 'O banco recusou a exclusão: algum registro ainda depende deste usuário. Rode sql/usuarios-exclusao-definitiva.sql no Supabase e tente de novo.'
      : error.message
    return Response.json({ error: msg }, { status: 500 })
  }

  return Response.json({ success: true })
}
