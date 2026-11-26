import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getPdiAcesso, logPdi } from '../../../../lib/pdi-acesso'

// Ligações de respostas de pesquisa a competências do PDI.
// O colaborador vê as ligações, mas não a "leitura" da gestão.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!ac.podeVer) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdi_pesquisa_vinculos')
    .select('id, convite_id, pergunta_id, competencia, leitura, autor_nome, created_at')
    .eq('pdi_id', id)
    .order('created_at')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json((data ?? []).map(v => (ac.gestao ? v : { ...v, leitura: '' })))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const b = await req.json() as { convite_id?: string; pergunta_id?: string; competencia?: string; leitura?: string; titulo?: string }
  if (!b.convite_id || !b.competencia?.trim()) return Response.json({ error: 'Informe a competência' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdi_pesquisa_vinculos')
    .upsert({
      pdi_id: id,
      convite_id: b.convite_id,
      pergunta_id: b.pergunta_id ?? '',
      competencia: b.competencia.trim(),
      leitura: b.leitura?.trim() ?? '',
      autor_id: ac.userId,
      autor_nome: ac.nome,
    }, { onConflict: 'convite_id,pergunta_id,competencia' })
    .select('id, convite_id, pergunta_id, competencia, leitura, autor_nome, created_at')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await logPdi(admin, { pdiId: id, evento: 'Pesquisa ligada', detalhe: `${b.titulo ?? 'Pesquisa'} → ${data.competencia}`, userId: ac.userId, nome: ac.nome })
  return Response.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })
  const vid = req.nextUrl.searchParams.get('v')
  if (!vid) return Response.json({ error: 'Informe a ligação' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('pdi_pesquisa_vinculos').delete().eq('id', vid).eq('pdi_id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
