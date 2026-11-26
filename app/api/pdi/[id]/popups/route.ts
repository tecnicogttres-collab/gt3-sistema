import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getPdiAcesso, logPdi } from '../../../../lib/pdi-acesso'
import { normalizar, ocorrenciaAtual, proximasAberturas, type Popup } from '../../../../lib/pdi-popup'

// Pop-ups de acompanhamento do PDI (só gestão). GET traz, de cada um, a abertura
// em vigor (e se já foi respondida), as próximas aberturas e o total de respostas.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const [{ data: pops, error }, { data: resp }] = await Promise.all([
    admin.from('pdi_popups').select('*').eq('pdi_id', id).order('created_at'),
    admin.from('pdi_popup_respostas').select('popup_id, ocorrencia').eq('pdi_id', id),
  ])
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const now = new Date()
  return Response.json((pops ?? []).map((p: Popup) => {
    const atual = p.ativo ? ocorrenciaAtual(p, now) : null
    const minhas = (resp ?? []).filter(r => r.popup_id === p.id)
    return {
      ...p,
      atual: atual ? { abre: atual.abre.toISOString(), fecha: atual.fecha.toISOString(), respondida: minhas.some(r => new Date(r.ocorrencia).getTime() === atual.abre.getTime()) } : null,
      proximas: proximasAberturas(p, 3, now).map(d => d.toISOString()),
      total_respostas: minhas.length,
    }
  }))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const cfg = normalizar(await req.json() as Partial<Popup>)
  const admin = createAdminClient()
  const { data, error } = await admin.from('pdi_popups').insert({ ...cfg, pdi_id: id, criado_por: ac.userId }).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await logPdi(admin, { pdiId: id, evento: 'Pop-up criado', detalhe: `${cfg.icone} ${cfg.titulo}${cfg.ativo ? ' (ligado)' : ''}`, userId: ac.userId, nome: ac.nome })
  return Response.json(data, { status: 201 })
}
