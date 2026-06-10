import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCaller } from '../../../lib/api-helpers'

export async function GET(req: NextRequest) {
  const categoria = new URL(req.url).searchParams.get('categoria')
  if (!categoria) return Response.json({ columns: [], guias: [] })

  const admin = createAdminClient()
  const { data } = await admin
    .from('observacoes_layout')
    .select('categoria, subtab, tipo, chave, cor, ordem')
    .eq('categoria', categoria)

  const rows = data ?? []
  return Response.json({
    columns: rows.filter(r => r.tipo === 'coluna'),
    guias: rows.filter(r => r.tipo === 'guia'),
  })
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['admin', 'gestor'].includes(caller.role)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json() as {
    records: Array<{
      categoria: string
      subtab: string
      tipo: 'coluna' | 'guia'
      chave: string
      cor: string | null
      ordem: number
    }>
  }

  if (!Array.isArray(body.records) || body.records.length === 0) {
    return Response.json({ ok: true })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('observacoes_layout').upsert(
    body.records.map(r => ({
      ...r,
      criado_por: caller.user.id,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'categoria,subtab,tipo,chave' }
  )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
