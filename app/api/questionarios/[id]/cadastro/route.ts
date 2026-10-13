import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'
import { CONVITE_SELECT } from '../../../../questionarios/types'

type Params = { params: Promise<{ id: string }> }

/* "Incluir do Cadastro de Contratantes" — SÓ LÊ public.contratantes (nunca altera o cadastro) e
   SÓ INSERE convites. O cadastro guarda tudo em `fields` (texto livre), sem um campo "responsável
   + e-mail": por isso cada e-mail encontrado vira uma linha, com o nome do campo de onde veio. */

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

type CampoCadastro = { type: 'text'; label: string; value: string } | { type: 'table'; label: string; headers: string[]; rows: string[][] }

/** Partes de e-mail que são setor/caixa genérica, não nome de pessoa (não sugerem Nome). */
const GENERICOS = new Set([
  'seguranca', 'segurancadotrabalho', 'sesmt', 'sst', 'tst', 'seg', 'rh', 'dp', 'contato', 'compras', 'portaria', 'adm',
  'administrativo', 'administracao', 'financeiro', 'fiscal', 'documentos', 'documentacao', 'docs', 'doc', 'terceiros',
  'terceirizados', 'cadastro', 'cadastros', 'sac', 'comercial', 'recepcao', 'engenharia', 'qualidade', 'ti', 'suporte',
  'cracha', 'crachas', 'integracao', 'medicina', 'saude', 'juridico', 'ambiental', 'manutencao', 'logistica', 'faturamento',
  'nfe', 'nf', 'atendimento', 'info', 'geral', 'noreply', 'naoresponda', 'empresa', 'fabrica', 'unidade', 'trabalho',
  'concessoes', 'login', 'acesso', 'controle', 'patrimonial', 'seguranca.trabalho', 'servicos', 'obras', 'projetos',
])

/** "joao.silva@" → "Joao Silva"; "fernanda@" → "Fernanda"; caixa genérica ou com números → "". */
function nomeSugerido(email: string): string {
  const local = email.split('@')[0].toLowerCase()
  if (GENERICOS.has(local.replace(/[._-]/g, ''))) return ''
  const partes = local.split(/[._-]+/).filter(Boolean)
  if (!partes.length || partes.length > 4) return ''
  if (partes.some(p => !/^[a-z]{2,}$/.test(p) || GENERICOS.has(p))) return ''
  return partes.map(p => p[0].toUpperCase() + p.slice(1)).join(' ')
}

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

  const linhas: { contratanteId: string; empresa: string; email: string; origem: string; nome: string; jaIncluido: boolean }[] = []
  const semEmail: { contratanteId: string; empresa: string }[] = []

  for (const c of cad ?? []) {
    const vistos = new Set<string>()
    const campos = (Array.isArray(c.fields) ? c.fields : []) as CampoCadastro[]
    for (const f of campos) {
      const texto = f.type === 'text' ? (f.value ?? '') : JSON.stringify(f.rows ?? [])
      for (const m of texto.match(EMAIL_RE) ?? []) {
        const email = m.toLowerCase()
        if (vistos.has(email)) continue
        vistos.add(email)
        linhas.push({ contratanteId: c.id, empresa: c.name, email, origem: f.label.trim(), nome: nomeSugerido(email), jaIncluido: ja.has(email) })
      }
    }
    if (!vistos.size) semEmail.push({ contratanteId: c.id, empresa: c.name })
  }

  return Response.json({ linhas, semEmail })
}

/** Cria os convites escolhidos (status_envio = nao_enviado pelo padrão da coluna). Não duplica:
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
