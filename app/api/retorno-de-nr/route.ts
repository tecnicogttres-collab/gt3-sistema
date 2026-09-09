import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getAuthUser } from '../../lib/api-helpers'

const CONFIG_ID = 'default'

/** Estado completo do módulo: treinamentos, combinações e configuração. */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [treinos, combos, config] = await Promise.all([
    admin.from('rnr_treinamentos').select('*').order('ordem', { ascending: true }).order('created_at', { ascending: true }),
    admin.from('rnr_combos').select('*').order('ordem', { ascending: true }).order('created_at', { ascending: true }),
    admin.from('rnr_config').select('*').eq('id', CONFIG_ID).maybeSingle(),
  ])

  const err = treinos.error ?? combos.error ?? config.error
  if (err) return Response.json({ error: err.message }, { status: 500 })

  return Response.json({
    treinamentos: treinos.data ?? [],
    combos: combos.data ?? [],
    config: config.data ?? null,
  })
}

/** Atualiza a configuração (e-mail padrão, modelos de registro, ações, rótulos, formas de contato). */
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.email !== undefined) updates.email = body.email
  if (body.modelos !== undefined) updates.modelos = body.modelos
  if (body.acoes !== undefined) updates.acoes = body.acoes
  if (body.rotulos !== undefined) updates.rotulos = body.rotulos
  if (body.formas_contato !== undefined) {
    if (!Array.isArray(body.formas_contato)) return Response.json({ error: 'formas_contato inválido' }, { status: 400 })
    updates.formas_contato = body.formas_contato.map((f: unknown) => String(f).trim()).filter(Boolean)
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }
  updates.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('rnr_config')
    .upsert({ id: CONFIG_ID, ...updates })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
