import { createClient } from '../../../../../lib/supabase-server'
import { createAdminClient } from '../../../../../lib/supabase-admin'

type Params = { params: Promise<{ id: string }> }

// Lista os modelos de e-mail vinculados a uma contratante das Terceiras.
// Vínculo principal: email_templates.contratante_id. Fallback: client = nome da contratante.
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: contratante } = await admin
    .from('terceiras_contratantes')
    .select('id, nome')
    .eq('id', id)
    .single()
  if (!contratante) return Response.json({ error: 'Contratante não encontrada' }, { status: 404 })

  // Escapa caracteres do filtro .or() (vírgula/parênteses quebrariam a expressão)
  const nome = (contratante.nome ?? '').replace(/[(),]/g, ' ').trim()
  const orParts = [`contratante_id.eq.${id}`]
  if (nome) orParts.push(`client.ilike.${nome}`)

  const { data, error } = await admin
    .from('email_templates')
    .select('id, title, client, category, subject, file_name, contratante_id')
    .or(orParts.join(','))
    .order('category')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Dedupe por id (um template pode bater por id e por nome ao mesmo tempo)
  const seen = new Set<string>()
  const templates = (data ?? []).filter(t => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })

  return Response.json({ contratante: { id: contratante.id, nome: contratante.nome }, templates })
}
