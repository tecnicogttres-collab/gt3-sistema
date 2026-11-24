import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser, requireGestorAdmin } from '../../../lib/api-helpers'

const CONFIG_ID = 1

export type EmailConfigDados = {
  diretorio: { nome: string; empresa: string; email: string }[]
  assunto: string
  corpo: string
  ccGt3: string
  /** Modelo do nome da ata por contratante (chave = cliente da ata). Ver app/atas-contratantes/ata-nome.ts */
  titulos: Record<string, string>
}

function lerTitulos(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => [k.trim(), String(v ?? '').trim()])
      .filter(([k, v]) => k && v),
  )
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
    titulos: lerTitulos(dados.titulos),
  }
  return Response.json(out)
}

export async function PUT(req: NextRequest) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()

  // Só os campos enviados mudam: a tela do "Gerar e-mail" não manda `titulos`, e a do
  // "Nome da ata" manda só `titulos` — um não pode apagar o outro.
  const { data: atual } = await admin
    .from('atas_contratantes_email_config').select('dados').eq('id', CONFIG_ID).maybeSingle()
  const antes = (atual?.dados ?? {}) as Partial<EmailConfigDados>
  if (!('diretorio' in body)) {
    const dados: EmailConfigDados = {
      diretorio: antes.diretorio ?? [],
      assunto: antes.assunto?.trim() || ASSUNTO_PADRAO,
      corpo: antes.corpo?.trim() || CORPO_PADRAO,
      ccGt3: antes.ccGt3?.trim() || CC_GT3_PADRAO,
      titulos: 'titulos' in body ? lerTitulos(body.titulos) : lerTitulos(antes.titulos),
    }
    const { error } = await admin
      .from('atas_contratantes_email_config')
      .upsert({ id: CONFIG_ID, dados, updated_at: new Date().toISOString() })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(dados)
  }

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
    titulos: 'titulos' in body ? lerTitulos(body.titulos) : lerTitulos(antes.titulos),
  }

  const { error } = await admin
    .from('atas_contratantes_email_config')
    .upsert({ id: CONFIG_ID, dados, updated_at: new Date().toISOString() })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(dados)
}

/** Cadastro rápido de UM contato no diretório, feito pelo editor da ata quando alguém digita um
 *  participante que não existe lá. Qualquer autenticado pode (quem escreve a ata nem sempre é
 *  gestor); só acrescenta — editar/remover continua no PUT, só gestor/admin. */
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { nome?: string; empresa?: string; email?: string }
  const nome = String(body.nome ?? '').trim().replace(/\s+/g, ' ')
  const empresa = String(body.empresa ?? '').trim()
  const email = String(body.email ?? '').trim()
  if (!nome || !empresa || !email) return Response.json({ error: 'Informe nome, empresa e e-mail' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'E-mail inválido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: atual, error: errLer } = await admin
    .from('atas_contratantes_email_config').select('dados').eq('id', CONFIG_ID).maybeSingle()
  if (errLer) return Response.json({ error: errLer.message }, { status: 500 })
  const antes = (atual?.dados ?? {}) as Partial<EmailConfigDados>
  const diretorio = Array.isArray(antes.diretorio) ? [...antes.diretorio] : []

  // Mesmo nome já cadastrado: só atualiza empresa/e-mail (não duplica)
  const chave = nome.toLowerCase()
  const i = diretorio.findIndex(p => (p.nome ?? '').trim().replace(/\s+/g, ' ').toLowerCase() === chave)
  const contato = { nome, empresa, email }
  if (i >= 0) diretorio[i] = contato
  else diretorio.push(contato)

  const dados = { ...antes, diretorio }
  const { error } = await admin
    .from('atas_contratantes_email_config')
    .upsert({ id: CONFIG_ID, dados, updated_at: new Date().toISOString() })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ diretorio })
}
