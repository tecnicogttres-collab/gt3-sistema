import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser, requireGestorAdmin } from '../../../lib/api-helpers'

const CONFIG_ID = 1

export type EmailConfigDados = {
  diretorio: { nome: string; empresa: string; email: string }[]
  assunto: string
  corpo: string
  ccGt3: string
}

export const ASSUNTO_PADRAO = '{{nome_arquivo}}'
export const CC_GT3_PADRAO = 'cadastro@gttres.com.br'
export const CORPO_PADRAO = [
  'Olá,',
  '',
  'Segue em anexo a ata da reunião "{{titulo}}", realizada em {{data}} com {{contratante}}.',
  '',
  'Qualquer dúvida, estamos à disposição.',
  '',
  'Atenciosamente,',
  'Equipe GT3',
].join('\n')

/** Diretório pessoa → e-mail e modelos de assunto/corpo do "Gerar e-mail" das Atas
 *  Contratantes — qualquer autenticado lê (a geração do e-mail precisa disso), só
 *  gestor/admin edita. */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('atas_contratantes_email_config')
    .select('dados')
    .eq('id', CONFIG_ID)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  const dados = (data?.dados ?? {}) as Partial<EmailConfigDados>
  const out: EmailConfigDados = {
    diretorio: Array.isArray(dados.diretorio)
      ? dados.diretorio.map(p => ({ nome: p.nome ?? '', empresa: p.empresa ?? '', email: p.email ?? '' }))
      : [],
    assunto: dados.assunto?.trim() || ASSUNTO_PADRAO,
    corpo: dados.corpo?.trim() || CORPO_PADRAO,
    ccGt3: dados.ccGt3?.trim() || CC_GT3_PADRAO,
  }
  return Response.json(out)
}

export async function PUT(req: NextRequest) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const diretorio = Array.isArray(body.diretorio)
    ? body.diretorio
      .map((p: { nome?: string; empresa?: string; email?: string }) => ({
        nome: String(p.nome ?? '').trim(), empresa: String(p.empresa ?? '').trim(), email: String(p.email ?? '').trim(),
      }))
      .filter((p: { nome: string; email: string }) => p.nome && p.email)
    : []
  const dados: EmailConfigDados = {
    diretorio,
    assunto: String(body.assunto ?? '').trim() || ASSUNTO_PADRAO,
    corpo: String(body.corpo ?? '').trim() || CORPO_PADRAO,
    ccGt3: String(body.ccGt3 ?? '').trim() || CC_GT3_PADRAO,
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('atas_contratantes_email_config')
    .upsert({ id: CONFIG_ID, dados, updated_at: new Date().toISOString() })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(dados)
}
