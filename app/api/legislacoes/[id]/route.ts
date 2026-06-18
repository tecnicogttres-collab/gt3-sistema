import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['gestor', 'admin'].includes(caller.role)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const admin = createAdminClient()

  if (caller.role === 'gestor') {
    const { data: leg } = await admin
      .from('legislacoes')
      .select('autor_id')
      .eq('id', id)
      .single()
    if ((leg as { autor_id?: string } | null)?.autor_id !== caller.user.id) {
      return Response.json({ error: 'Sem permissão para excluir' }, { status: 403 })
    }
  }

  const { error } = await admin.from('legislacoes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
