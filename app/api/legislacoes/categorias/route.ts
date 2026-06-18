import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller, getAuthUser } from '../../../lib/api-helpers'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Nao autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('legislacoes_categorias')
    .select('id, label, color, bg, ordem')
    .order('ordem', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Nao autenticado' }, { status: 401 })
  if (!['gestor', 'admin'].includes(caller.role)) {
    return Response.json({ error: 'Sem permissao' }, { status: 403 })
  }

  const { label, color, bg } = await req.json()
  if (!label?.trim()) return Response.json({ error: 'Label obrigatorio' }, { status: 400 })

  // Gera slug: mantém apenas letras ASCII e números, substitui o resto por _
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'cat'

  const admin = createAdminClient()

  // Verifica conflito e adiciona sufixo numérico se necessário
  const { data: existing } = await admin
    .from('legislacoes_categorias')
    .select('id')
    .like('id', `${slug}%`)

  const ids = new Set((existing ?? []).map((r: { id: string }) => r.id))
  let finalId = slug
  let i = 2
  while (ids.has(finalId)) { finalId = `${slug}_${i++}` }

  const { data: maxOrdem } = await admin
    .from('legislacoes_categorias')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ordem = ((maxOrdem as { ordem?: number } | null)?.ordem ?? 0) + 1

  const { data, error } = await admin
    .from('legislacoes_categorias')
    .insert({
      id: finalId,
      label: label.trim(),
      color: color ?? '#4A5568',
      bg: bg ?? '#EDF2F7',
      ordem,
    })
    .select('id, label, color, bg, ordem')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
