import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { title, client, category, subject, tags, notes, corpo, file, file_name, file_size } = body

  if (!title?.trim() || !client?.trim())
    return Response.json({ error: 'Título e cliente são obrigatórios' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_templates')
    .insert({
      title: title.trim(),
      client: client.trim(),
      category: category ?? 'Orientação Inicial',
      subject: (subject ?? '').trim(),
      tags: Array.isArray(tags) ? tags : [],
      notes: (notes ?? '').trim(),
      corpo: (corpo ?? '').trim() || null,
      file: file ?? null,
      file_name: file_name ?? (file as { name?: string } | null)?.name ?? null,
      file_size: file_size ?? (file as { size?: number } | null)?.size ?? null,
    })
    .select('id, title, client, category, subject, tags, notes, corpo, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
