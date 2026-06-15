import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getCaller } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const BUCKET = 'repositorio-modelos'

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('repositorio_modelos')
    .select('storage_path, filename')
    .eq('id', id)
    .single()

  if (!row) return Response.json({ error: 'Não encontrado' }, { status: 404 })

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 3600, { download: row.filename })

  if (error || !data) return Response.json({ error: 'Erro ao gerar URL' }, { status: 500 })

  return Response.json({ url: data.signedUrl })
}
