import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'
import { CONVITE_SELECT } from '../../../../questionarios/types'

type Params = { params: Promise<{ id: string }> }

/** Adiciona um destinatário (sem link ainda — status "pendente"). */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { nome?: string; email?: string; empresa?: string; tipo?: string; vinculo?: string }
  const nome = String(body.nome ?? '').trim()
  const empresa = String(body.empresa ?? '').trim()
  const email = String(body.email ?? '').trim()
  if (!nome || !empresa) return Response.json({ error: 'Preencha nome e empresa' }, { status: 400 })
  if (email && !email.includes('@')) return Response.json({ error: 'O e-mail parece incompleto' }, { status: 400 })
  const tipo = body.tipo === 'Prestador' ? 'Prestador' : 'Contratante'

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('questionario_convites')
    .insert({
      questionario_id: id,
      nome, email, empresa, tipo,
      vinculo: tipo === 'Prestador' ? (String(body.vinculo ?? '').trim() || null) : null,
    })
    .select(CONVITE_SELECT)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
