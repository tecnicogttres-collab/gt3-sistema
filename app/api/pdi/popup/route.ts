import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getCallerWithNome } from '../../../lib/api-helpers'
import { logPdi } from '../../../lib/pdi-acesso'
import { hojeSP, ocorrenciaAtual, type Popup, type Pergunta } from '../../../lib/pdi-popup'
import { SITUACOES } from '../../../lib/pdi-checkin'

// Pop-ups do PDI para o usuário logado (montados no AppShell).
// GET  → pop-ups com abertura em vigor e ainda não respondidos
// POST → grava a resposta de uma abertura

type Admin = ReturnType<typeof createAdminClient>
type AcaoPend = { id: string; competencia: string; proximas: string[] }

async function contexto() {
  const caller = await getCallerWithNome()
  if (!caller) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('pdi_slug').eq('id', caller.user.id).maybeSingle()
  return { caller, admin, pdiId: (p?.pdi_slug as string | null) ?? null }
}

async function acoesAtivas(admin: Admin, pdiId: string): Promise<AcaoPend[]> {
  const { data: acoes } = await admin.from('pdi_acoes').select('id, competencia, status').eq('pdi_id', pdiId).neq('status', 'Concluído').order('created_at')
  if (!acoes?.length) return []
  const { data: etapas } = await admin.from('pdi_etapas').select('acao_id, titulo, status, ordem').in('acao_id', acoes.map(a => a.id)).order('ordem')
  return acoes.map(a => ({
    id: a.id, competencia: a.competencia,
    proximas: (etapas ?? []).filter(e => e.acao_id === a.id && e.status !== 'ok' && e.status !== 'na').slice(0, 2).map(e => e.titulo),
  }))
}

/** Pop-ups pendentes agora, com as ações já resolvidas para cada pergunta de "status das ações". */
async function pendentes(admin: Admin, pdiId: string) {
  const { data: pops } = await admin.from('pdi_popups').select('*').eq('pdi_id', pdiId).eq('ativo', true).order('created_at')
  if (!pops?.length) return []
  const now = new Date()
  const abertos = (pops as Popup[]).map(p => ({ p, oc: ocorrenciaAtual(p, now) })).filter(x => x.oc)
  if (!abertos.length) return []
  const { data: resp } = await admin.from('pdi_popup_respostas').select('popup_id, ocorrencia').in('popup_id', abertos.map(x => x.p.id))
  const feitos = new Set((resp ?? []).map(r => `${r.popup_id}|${new Date(r.ocorrencia).toISOString()}`))
  const ativas = abertos.some(x => x.p.perguntas.some(q => q.tipo === 'acoes')) ? await acoesAtivas(admin, pdiId) : []

  return abertos.filter(x => !feitos.has(`${x.p.id}|${x.oc!.chave}`)).map(({ p, oc }) => {
    const perguntas = p.perguntas.map(q => q.tipo !== 'acoes' ? q : { ...q, itens: ativas.filter(a => !q.acoes || q.acoes.includes(a.id)) })
      // pergunta de ações sem nenhuma ação ativa some
      .filter(q => !('itens' in q) || (q as { itens: AcaoPend[] }).itens.length > 0)
    return { id: p.id, titulo: p.titulo, intro: p.intro, icone: p.icone, cor: p.cor, comportamento: p.comportamento, ocorrencia: oc!.chave, fecha: oc!.fecha.toISOString(), perguntas }
  }).filter(x => x.perguntas.length > 0)
}

export async function GET() {
  const ctx = await contexto()
  if (!ctx?.pdiId) return Response.json({ pendentes: [] })
  try {
    return Response.json({ pendentes: await pendentes(ctx.admin, ctx.pdiId) })
  } catch {
    return Response.json({ pendentes: [] }) // tabela ainda não criada etc.: o pop-up nunca atrapalha o uso
  }
}

const respondida = (q: Pergunta, v: unknown) => {
  if (v === undefined || v === null || v === '') return false
  if (q.tipo === 'multipla') return Array.isArray(v) && v.length > 0
  if (q.tipo === 'acoes') return !!v && typeof v === 'object' && Object.keys(v as object).length > 0
  if (q.tipo === 'humor' || q.tipo === 'escala') return typeof v === 'object' ? !!(v as { valor?: number }).valor : !!v
  return true
}

export async function POST(req: NextRequest) {
  const ctx = await contexto()
  if (!ctx) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  const { caller, admin, pdiId } = ctx
  if (!pdiId) return Response.json({ error: 'Sem PDI vinculado.' }, { status: 400 })

  const b = await req.json() as { popup_id?: string; ocorrencia?: string; respostas?: Record<string, unknown> }
  const lista = await pendentes(admin, pdiId)
  const alvo = lista.find(x => x.id === b.popup_id && x.ocorrencia === b.ocorrencia)
  if (!alvo) return Response.json({ error: 'Este pop-up já não está mais aberto.' }, { status: 409 })

  const r = b.respostas ?? {}
  const faltando = alvo.perguntas.filter(q => q.obrigatoria && !respondida(q, r[q.id]))
  if (faltando.length) return Response.json({ error: `Responda: ${faltando.map(q => q.texto).join(' · ')}` }, { status: 400 })

  // Só guarda respostas de perguntas que existem neste pop-up
  const limpas: Record<string, unknown> = {}
  for (const q of alvo.perguntas) if (r[q.id] !== undefined) limpas[q.id] = r[q.id]

  const { error } = await admin.from('pdi_popup_respostas').insert({
    popup_id: alvo.id, pdi_id: pdiId, ocorrencia: alvo.ocorrencia, respostas: limpas, usuario_id: caller.user.id, usuario_nome: caller.nome,
  })
  if (error && error.code !== '23505') return Response.json({ error: error.message }, { status: 500 })

  // "Status das ações" também alimenta os registros por ação (faixa da ação, alertas, Linha do tempo)
  const dia = hojeSP(new Date(alvo.ocorrencia))
  const checkins = alvo.perguntas.filter(q => q.tipo === 'acoes').flatMap(q => {
    const v = (limpas[q.id] ?? {}) as Record<string, { situacao?: string; nota?: string }>
    return Object.entries(v).filter(([, x]) => x?.situacao && x.situacao in SITUACOES).map(([acao_id, x]) => ({
      pdi_id: pdiId, acao_id, periodo_ref: dia, situacao: x.situacao, nota: String(x.nota ?? '').slice(0, 1000), usuario_id: caller.user.id, usuario_nome: caller.nome,
    }))
  })
  if (checkins.length) await admin.from('pdi_checkins').upsert(checkins, { onConflict: 'acao_id,periodo_ref' })

  await logPdi(admin, { pdiId, evento: 'Pop-up respondido', detalhe: `${alvo.icone} ${alvo.titulo}`, userId: caller.user.id, nome: caller.nome })
  return Response.json({ ok: true })
}
