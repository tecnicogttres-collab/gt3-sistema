import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()

  const callerPapel = callerProfile?.papel ?? ''
  if (callerPapel !== 'admin' && callerPapel !== 'gestor') {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const targetId = req.nextUrl.searchParams.get('userId')
  if (!targetId) return Response.json({ error: 'userId obrigatório' }, { status: 400 })

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', targetId)
    .single()

  const targetPapel = targetProfile?.papel ?? ''

  // Gestor só vê colaboradores e trainees
  if (callerPapel === 'gestor' && !['colaborador', 'trainee'].includes(targetPapel)) {
    return Response.json({ error: 'Sem permissão para ver este usuário' }, { status: 403 })
  }

  const now = new Date()
  const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: all }, { data: histData }] = await Promise.all([
    admin
      .from('lembretes')
      .select('id, titulo, descricao, periodo, data_inicio, concluido, criado_por, created_at, visibilidade, destinatarios')
      .order('data_inicio', { ascending: true }),
    admin
      .from('lembretes_historico')
      .select('lembrete_id, created_at, usuario_nome, usuario_login')
      .eq('usuario_id', targetId)
      .eq('mes_referencia', mesRef)
      .order('created_at', { ascending: false }),
  ])

  const confirmedIds = new Set((histData ?? []).map(h => h.lembrete_id))

  const lembretes = (all ?? [])
    .filter(r => {
      const vis = r.visibilidade ?? 'todos'
      if (vis === 'todos') return true
      if (vis === 'proprio') return r.criado_por === targetId
      if (vis === 'selecionados') return r.criado_por === targetId || (r.destinatarios ?? []).includes(targetId)
      return false
    })
    .map(r => ({ ...r, confirmado: confirmedIds.has(r.id) }))

  return Response.json({ lembretes, historico: histData ?? [] })
}
