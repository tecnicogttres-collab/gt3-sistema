import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller } from '../../lib/api-helpers'
import { resolverDestinatarios } from '../../lib/campanhas-destinatarios'

const COLS = 'id, titulo, descricao, link, categoria, cor, autor_id, autor_nome, data, destinatarios, created_at'
const COR_RE = /^#[0-9a-fA-F]{6}$/

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: camps, error }, { data: lidas }] = await Promise.all([
    admin.from('campanhas').select(COLS).order('data', { ascending: false }).order('created_at', { ascending: false }),
    admin.from('campanhas_lidas').select('campanha_id').eq('user_id', caller.user.id),
  ])
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: callerProfile } = await admin.from('profiles').select('papel').eq('id', caller.user.id).single()
  const papel = (callerProfile as { papel?: string } | null)?.papel ?? 'colaborador'

  const lidaSet = new Set((lidas ?? []).map(l => l.campanha_id))
  return Response.json((camps ?? []).map(c => ({
    ...c,
    lida: lidaSet.has(c.id),
    // O autor não precisa abrir a própria divulgação — não é cobrado.
    para_mim: c.autor_id !== caller.user.id && (
      (c.destinatarios ?? []).includes('todos')
      || (c.destinatarios ?? []).includes(papel)
      || (c.destinatarios ?? []).includes(caller.user.id)),
  })))
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { titulo, descricao, link, categoria, destinatarios, cor } = await req.json()
  if (!titulo?.trim()) return Response.json({ error: 'Título obrigatório' }, { status: 400 })
  if (!link?.trim()) return Response.json({ error: 'Link obrigatório' }, { status: 400 })
  if (!categoria?.trim()) return Response.json({ error: 'Categoria obrigatória' }, { status: 400 })
  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return Response.json({ error: 'Selecione ao menos um destinatário' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('nome').eq('id', caller.user.id).single()

  const { data, error } = await admin
    .from('campanhas')
    .insert({
      titulo: titulo.trim(),
      descricao: descricao?.trim() || null,
      link: link.trim(),
      categoria,
      cor: COR_RE.test(cor ?? '') ? cor : '#B45309',
      autor_id: caller.user.id,
      autor_nome: (prof as { nome?: string } | null)?.nome ?? null,
      data: new Date().toISOString().slice(0, 10),
      destinatarios,
    })
    .select(COLS)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Badge na sidebar (notificacoes_usuario) — não bloqueia a resposta
  try {
    const alvo = await resolverDestinatarios(admin, destinatarios, caller.user.id)
    if (alvo.length > 0) {
      await admin.from('notificacoes_usuario').insert(alvo.map(u => ({ usuario_id: u.id, modulo: 'campanhas', visto: false })))
    }
  } catch { /* noop */ }

  return Response.json({ ...data, lida: false, para_mim: false })
}
