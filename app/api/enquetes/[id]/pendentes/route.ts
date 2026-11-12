import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../lib/api-helpers'
import { carregarPerfisAtivos, enqueteParaMim } from '../../../../lib/enquetes-destinatarios'

type Params = { params: Promise<{ id: string }> }

/** Quem ainda não respondeu a enquete — só admin. Inclui o autor quando ele também é destinatário. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin.from('profiles').select('papel').eq('id', user.id).single()
  if (me?.papel !== 'admin') return Response.json({ error: 'Apenas admin' }, { status: 403 })

  const { data: enquete } = await admin
    .from('enquetes')
    .select('publico_alvo, destinatarios, criado_por')
    .eq('id', id)
    .single()
  if (!enquete) return Response.json({ error: 'Não encontrada' }, { status: 404 })

  const [perfis, { data: resps }] = await Promise.all([
    carregarPerfisAtivos(admin),
    admin.from('enquete_respostas').select('usuario_id').eq('enquete_id', id),
  ])
  const respondentes = new Set((resps ?? []).map((r: { usuario_id: string }) => r.usuario_id))

  // Autor só conta se foi escolhido nominalmente (no público-alvo genérico ele nunca responde)
  const participantes = perfis
    .filter(p => p.id === enquete.criado_por
      ? !!enquete.destinatarios?.includes(p.id)
      : enqueteParaMim(enquete, p.id, p.papel))
    .map(p => p.id)
  const faltamIds = participantes.filter(pid => !respondentes.has(pid))

  let faltam: Array<{ id: string; nome: string | null; usuario: string | null }> = []
  if (faltamIds.length > 0) {
    const { data } = await admin.from('profiles').select('id, nome, usuario').in('id', faltamIds)
    faltam = (data ?? []).sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))
  }

  return Response.json({
    total: participantes.length,
    responderam: participantes.length - faltamIds.length,
    faltam,
  })
}
