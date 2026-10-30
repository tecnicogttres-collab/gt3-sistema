import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'
import { dataConfirmada } from '../../../lib/lembretes'
import { carregarConfirmacoes } from '../../../lib/lembretes-server'

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
  const hoje = `${mesRef.slice(0, 8)}${String(now.getDate()).padStart(2, '0')}`

  const [{ data: all }, { data: histData }] = await Promise.all([
    admin
      .from('lembretes')
      .select('id, titulo, descricao, periodo, data_inicio, hora_inicio, dia_semana, semana_ordinal, concluido, criado_por, created_at, visibilidade, destinatarios')
      .order('data_inicio', { ascending: true }),
    admin
      .from('lembretes_historico')
      .select('lembrete_id, created_at, usuario_nome, usuario_login')
      .eq('usuario_id', targetId)
      .eq('mes_referencia', mesRef)
      .order('created_at', { ascending: false }),
  ])

  const visiveis = (all ?? [])
    .filter(r => {
      const vis = r.visibilidade ?? 'todos'
      if (vis === 'todos') return true
      if (vis === 'proprio') return r.criado_por === targetId
      if (vis === 'selecionados') return r.criado_por === targetId || (r.destinatarios ?? []).includes(targetId)
      return false
    })

  const confirmacoes = (await carregarConfirmacoes(admin, visiveis, hoje)).filter(c => c.usuario_id === targetId)
  const lembretes = visiveis.map(r => ({
    ...r,
    confirmadas: confirmacoes.filter(c => c.lembrete_id === r.id).map(c => dataConfirmada(r, c)).filter(Boolean),
  }))

  return Response.json({ lembretes, historico: histData ?? [] })
}
