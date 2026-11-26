import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getPdiAcesso } from '../../../../lib/pdi-acesso'

const TIPOS = ['pauta', 'conversa', 'feedback', 'conquista', 'atencao', 'observacao', 'investigar']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!ac.podeVer) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  let q = admin.from('pdi_anotacoes').select('*').eq('pdi_id', id)
  if (!ac.gestao) q = q.eq('visivel', true) // colaborador só vê o que foi marcado como visível
  const { data, error } = await q.order('data', { ascending: false }).order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const b = await req.json() as Record<string, unknown>
  const texto = String(b.texto ?? '').trim()
  if (!texto) return Response.json({ error: 'Escreva a anotação' }, { status: 400 })
  const tipo = TIPOS.includes(String(b.tipo)) ? String(b.tipo) : 'observacao'

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdi_anotacoes')
    .insert({
      pdi_id: id,
      tipo,
      texto,
      data: b.data || new Date().toISOString().slice(0, 10),
      visivel: Boolean(b.visivel),
      acao_id: b.acao_id || null,
      ...(b.ciclo_id ? { ciclo_id: b.ciclo_id } : {}),
      competencia: String(b.competencia ?? ''),
      autor_id: ac.userId,
      autor_nome: ac.nome,
    })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
