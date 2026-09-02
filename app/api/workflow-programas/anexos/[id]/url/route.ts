import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase-admin'
import { getAuthUser } from '../../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const BUCKET = 'workflow-programas-anexos'

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('workflow_programas_anexos')
    .select('storage_path, filename')
    .eq('id', id)
    .single()
  if (!row) return Response.json({ error: 'Arquivo não encontrado' }, { status: 404 })

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 120, { download: row.filename })

  if (error || !data) return Response.json({ error: 'Erro ao gerar URL' }, { status: 500 })
  return Response.json({ url: data.signedUrl })
}
