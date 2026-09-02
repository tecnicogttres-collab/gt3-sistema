import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const BUCKET = 'workflow-programas-anexos'

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('workflow_programas_anexos')
    .select('storage_path')
    .eq('id', id)
    .single()

  const { error } = await admin.from('workflow_programas_anexos').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (row?.storage_path) {
    await admin.storage.from(BUCKET).remove([row.storage_path])
  }
  return Response.json({ ok: true })
}
