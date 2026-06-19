import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller } from '../../lib/api-helpers'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: legs, error }, { data: lidas }] = await Promise.all([
    admin
      .from('legislacoes')
      .select('id, titulo, descricao, link, categoria, autor_id, autor_nome, data, destinatarios, created_at')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false }),
    admin
      .from('legislacoes_lidas')
      .select('legislacao_id')
      .eq('user_id', caller.user.id),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: callerProfile } = await admin.from('profiles').select('papel').eq('id', caller.user.id).single()
  const papel = (callerProfile as { papel?: string } | null)?.papel ?? 'colaborador'

  const lidaSet = new Set((lidas ?? []).map(l => l.legislacao_id))
  return Response.json((legs ?? []).map(l => ({
    ...l,
    lida: lidaSet.has(l.id),
    para_mim: (l.destinatarios ?? []).includes('todos')
      || (l.destinatarios ?? []).includes(papel)
      || (l.destinatarios ?? []).includes(caller.user.id),
  })))
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json()
  const { titulo, descricao, link, categoria, destinatarios } = body

  if (!titulo?.trim()) return Response.json({ error: 'Título obrigatório' }, { status: 400 })
  if (!link?.trim()) return Response.json({ error: 'Link obrigatório' }, { status: 400 })

  if (!categoria?.trim()) return Response.json({ error: 'Categoria obrigatória' }, { status: 400 })
  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return Response.json({ error: 'Selecione ao menos um destinatário' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('nome').eq('id', caller.user.id).single()

  const { data, error } = await admin
    .from('legislacoes')
    .insert({
      titulo: titulo.trim(),
      descricao: descricao?.trim() || null,
      link: link.trim(),
      categoria,
      autor_id: caller.user.id,
      autor_nome: (prof as { nome?: string } | null)?.nome ?? null,
      data: new Date().toISOString().slice(0, 10),
      destinatarios,
    })
    .select('id, titulo, descricao, link, categoria, autor_id, autor_nome, data, destinatarios, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Notifica destinatários via sidebar badge (notificacoes_usuario)
  try {
    const dest: string[] = destinatarios
    let targetIds: string[] = []

    if (dest.includes('todos')) {
      const { data: allProfiles } = await admin
        .from('profiles')
        .select('id')
        .neq('id', caller.user.id)
      targetIds = (allProfiles ?? []).map((p: { id: string }) => p.id)
    } else {
      const papeis = dest.filter(d => ['admin', 'gestor', 'colaborador', 'trainee'].includes(d))
      const userIds = dest.filter(d => !['admin', 'gestor', 'colaborador', 'trainee'].includes(d) && d !== caller.user.id)

      if (papeis.length > 0) {
        const { data: byPapel } = await admin
          .from('profiles')
          .select('id')
          .in('papel', papeis)
          .neq('id', caller.user.id)
        targetIds.push(...(byPapel ?? []).map((p: { id: string }) => p.id))
      }
      targetIds.push(...userIds)
      targetIds = [...new Set(targetIds)]
    }

    if (targetIds.length > 0) {
      await admin.from('notificacoes_usuario').insert(
        targetIds.map(uid => ({ usuario_id: uid, modulo: 'legislacoes', visto: false }))
      )
    }
  } catch { /* não bloqueia a resposta */ }

  return Response.json({ ...data, lida: false })
}
