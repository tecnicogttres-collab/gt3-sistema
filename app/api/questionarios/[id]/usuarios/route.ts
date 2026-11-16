import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { getActiveProfileIds, requireGestorAdmin } from '../../../../lib/api-helpers'
import { CONVITE_SELECT } from '../../../../questionarios/types'

type Params = { params: Promise<{ id: string }> }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAPEL_LABEL: Record<string, string> = { admin: 'Admin', gestor: 'Gestor', colaborador: 'Colaborador', trainee: 'Trainee' }

/* "Incluir usuários do sistema" (pesquisa interna identificada). O convite fica ligado ao usuário
   (questionario_convites.profile_id) e é por essa ligação que a resposta aparece no PDI dele.
   O e-mail é o PESSOAL (profiles.email_pessoal), nunca o de login. Só gestor/admin. */

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Só admin e gestor podem incluir destinatários' }, { status: 403 })

  const admin = createAdminClient()
  const [{ data: perfis, error }, { data: convites }, ativos] = await Promise.all([
    admin.from('profiles').select('id, nome, usuario, papel, email_pessoal, pdi_slug').order('nome'),
    admin.from('questionario_convites').select('profile_id').eq('questionario_id', id).not('profile_id', 'is', null),
    getActiveProfileIds(admin),
  ])
  if (error) {
    const falta = /email_pessoal|profile_id/.test(error.message)
    return Response.json({ error: falta ? 'Rode a migração sql/questionarios-pdi-vinculo.sql no Supabase.' : error.message }, { status: 500 })
  }
  const ja = new Set((convites ?? []).map(c => c.profile_id as string))

  const usuarios = (perfis ?? [])
    .filter(p => ativos.has(p.id as string))
    .map(p => ({
      id: p.id as string,
      nome: ((p.nome as string | null)?.trim() || (p.usuario as string | null)?.trim() || 'Usuário'),
      papel: PAPEL_LABEL[(p.papel as string) ?? ''] ?? '—',
      email: (p.email_pessoal as string | null) ?? '',
      temPdi: !!p.pdi_slug,
      jaIncluido: ja.has(p.id as string),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return Response.json({ usuarios })
}

/** Cria os convites dos usuários escolhidos (nome vem do cadastro, empresa = GT3) e guarda o
 *  e-mail pessoal no perfil para a próxima pesquisa. Não duplica pessoa nem e-mail. */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Só admin e gestor podem incluir destinatários' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { itens?: { profile_id?: unknown; email?: unknown }[] }
  const itens = Array.isArray(body.itens) ? body.itens : []

  const admin = createAdminClient()
  const { data: qn } = await admin.from('questionarios').select('publico').eq('id', id).single()
  if (!qn) return Response.json({ error: 'Questionário não encontrado' }, { status: 404 })

  const ids = itens.map(i => String(i.profile_id ?? '')).filter(Boolean)
  const [{ data: perfis }, { data: existentes }] = await Promise.all([
    admin.from('profiles').select('id, nome, usuario').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
    admin.from('questionario_convites').select('email, profile_id').eq('questionario_id', id),
  ])
  const nomes = new Map((perfis ?? []).map(p => [p.id as string, ((p.nome as string | null)?.trim() || (p.usuario as string | null)?.trim() || '')]))
  const jaEmail = new Set((existentes ?? []).map(e => String(e.email).trim().toLowerCase()).filter(Boolean))
  const jaPessoa = new Set((existentes ?? []).map(e => e.profile_id as string | null).filter(Boolean))

  const novos: { questionario_id: string; nome: string; email: string; empresa: string; tipo: string; vinculo: null; profile_id: string }[] = []
  const emailsPerfil: { id: string; email: string }[] = []
  let duplicados = 0, invalidos = 0
  for (const it of itens) {
    const pid = String(it.profile_id ?? '')
    const email = String(it.email ?? '').trim().toLowerCase()
    if (!nomes.has(pid) || !EMAIL_RE.test(email)) { invalidos++; continue }
    if (jaPessoa.has(pid) || jaEmail.has(email)) { duplicados++; continue }
    jaPessoa.add(pid); jaEmail.add(email)
    novos.push({ questionario_id: id, nome: nomes.get(pid)!.slice(0, 200), email, empresa: 'GT3', tipo: qn.publico, vinculo: null, profile_id: pid })
    emailsPerfil.push({ id: pid, email })
  }

  if (novos.length) {
    const { error } = await admin.from('questionario_convites').insert(novos)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    // Guarda o e-mail pessoal para vir preenchido na próxima pesquisa (falha aqui não desfaz o convite)
    await Promise.all(emailsPerfil.map(e => admin.from('profiles').update({ email_pessoal: e.email }).eq('id', e.id))).catch(() => {})
  }

  const { data: todos } = await admin.from('questionario_convites').select(CONVITE_SELECT).eq('questionario_id', id).order('created_at')
  return Response.json({ incluidos: novos.length, duplicados, invalidos, convites: todos ?? [] })
}
