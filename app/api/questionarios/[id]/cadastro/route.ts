import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'
import { CONVITE_SELECT } from '../../../../questionarios/types'
import { extrairEmailsCadastro } from '../../../../lib/contratantes-emails'

type Params = { params: Promise<{ id: string }> }

/* "Incluir do Cadastro de Contratantes" — SÓ LÊ public.contratantes (nunca altera o cadastro) e
   SÓ INSERE convites. A leitura dos e-mails fica em app/lib/contratantes-emails.ts (a mesma da
   exportação para planilha do Cadastro de Contratantes). */

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Só admin e gestor podem incluir destinatários' }, { status: 403 })

  const admin = createAdminClient()
  const [{ data: cad, error }, { data: existentes }] = await Promise.all([
    admin.from('contratantes').select('id, name, fields').order('name'),
    admin.from('questionario_convites').select('email').eq('questionario_id', id),
  ])
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const ja = new Set((existentes ?? []).map(e => String(e.email).trim().toLowerCase()).filter(Boolean))

  const { linhas: emails, semEmail } = extrairEmailsCadastro(cad ?? [])
  const linhas = emails.map(l => ({ contratanteId: l.contratanteId, empresa: l.empresa, email: l.email, origem: l.origens[0], nome: l.nome, jaIncluido: ja.has(l.email) }))

  return Response.json({ linhas, semEmail })
}

/** Cria os convites escolhidos (status_envio = nao_enviado pelo padrão da coluna) — usado pelo
 *  "Incluir do Cadastro de Contratantes" e pelo "Importar planilha". Não duplica:
 *  e-mail que já é destinatário deste questionário é ignorado. Sem e-mail não entra. */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Só admin e gestor podem incluir destinatários' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { itens?: { empresa?: unknown; email?: unknown; nome?: unknown }[] }
  const itens = Array.isArray(body.itens) ? body.itens : []

  const admin = createAdminClient()
  const { data: qn } = await admin.from('questionarios').select('publico').eq('id', id).single()
  if (!qn) return Response.json({ error: 'Questionário não encontrado' }, { status: 404 })
  const { data: existentes } = await admin.from('questionario_convites').select('email').eq('questionario_id', id)
  const ja = new Set((existentes ?? []).map(e => String(e.email).trim().toLowerCase()).filter(Boolean))

  const novos: { questionario_id: string; nome: string; email: string; empresa: string; tipo: string; vinculo: null }[] = []
  let duplicados = 0, invalidos = 0
  for (const it of itens) {
    const email = String(it.email ?? '').trim().toLowerCase()
    const empresa = String(it.empresa ?? '').trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !empresa) { invalidos++; continue }
    if (ja.has(email)) { duplicados++; continue }
    ja.add(email)
    novos.push({ questionario_id: id, nome: String(it.nome ?? '').trim().slice(0, 200), email, empresa, tipo: qn.publico, vinculo: null })
  }

  if (novos.length) {
    const { error } = await admin.from('questionario_convites').insert(novos)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  const { data: todos } = await admin.from('questionario_convites').select(CONVITE_SELECT).eq('questionario_id', id).order('created_at')
  return Response.json({ incluidos: novos.length, duplicados, invalidos, convites: todos ?? [] })
}
