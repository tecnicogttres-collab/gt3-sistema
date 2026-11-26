import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase-admin'
import { getPdiAcesso, logPdi } from '../../../../../lib/pdi-acesso'
import { normalizar, resumoAgenda, type Popup } from '../../../../../lib/pdi-popup'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; popupId: string }> }) {
  const { id, popupId } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data: atual } = await admin.from('pdi_popups').select('*').eq('id', popupId).eq('pdi_id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'Pop-up não encontrado' }, { status: 404 })

  const b = await req.json() as Partial<Popup>
  const cfg = normalizar({ ...atual, ...b })
  const { data, error } = await admin.from('pdi_popups').update({ ...cfg, updated_at: new Date().toISOString() }).eq('id', popupId).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const soAtivo = Object.keys(b).length === 1 && 'ativo' in b
  await logPdi(admin, {
    pdiId: id,
    evento: soAtivo ? (cfg.ativo ? 'Pop-up ligado' : 'Pop-up pausado') : 'Pop-up ajustado',
    detalhe: `${cfg.icone} ${cfg.titulo} · ${resumoAgenda(cfg.agenda)}`,
    userId: ac.userId, nome: ac.nome,
  })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; popupId: string }> }) {
  const { id, popupId } = await params
  const ac = await getPdiAcesso(id)
  if (!ac?.gestao) return Response.json({ error: 'Sem permissão' }, { status: 403 })
  const admin = createAdminClient()
  const { data: atual } = await admin.from('pdi_popups').select('titulo, icone').eq('id', popupId).eq('pdi_id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'Pop-up não encontrado' }, { status: 404 })
  const { error } = await admin.from('pdi_popups').delete().eq('id', popupId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await logPdi(admin, { pdiId: id, evento: 'Pop-up excluído', detalhe: `${atual.icone} ${atual.titulo}`, userId: ac.userId, nome: ac.nome })
  return new Response(null, { status: 204 })
}
