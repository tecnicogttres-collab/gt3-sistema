import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'
import { resolverDestinatarios, variaveisEmailAta, aplicaVariaveisEmail } from '../../../../lib/ata-email'
import { ASSUNTO_PADRAO, CORPO_PADRAO, type EmailConfigDados } from '../../email-config/route'
import type { Participante } from '../../../../atas/AtasEditor'

type Params = { params: Promise<{ id: string }> }

function parseParticipantes(val: string | null): Participante[] {
  if (!val?.trim()) return []
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p } catch {}
  return []
}

/** Prévia do "Gerar e-mail": quem já tem e-mail cadastrado, quem falta cadastrar, e o
 *  assunto já com as variáveis preenchidas — sem gerar o PDF (pesado) ainda. */
export async function GET(_req: NextRequest, { params }: Params) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const [{ data: ata, error: ataErr }, { data: configRow }] = await Promise.all([
    admin.from('atas_contratantes').select('titulo, data, cliente, local_reuniao, numero_ata, status, participantes').eq('id', id).single(),
    admin.from('atas_contratantes_email_config').select('dados').eq('id', 1).maybeSingle(),
  ])
  if (ataErr || !ata) return Response.json({ error: 'Ata não encontrada' }, { status: 404 })

  const dados = (configRow?.dados ?? {}) as Partial<EmailConfigDados>
  const diretorio = Array.isArray(dados.diretorio) ? dados.diretorio : []
  const assuntoTemplate = dados.assunto?.trim() || ASSUNTO_PADRAO
  const corpoTemplate = dados.corpo?.trim() || CORPO_PADRAO

  const participantes = parseParticipantes(ata.participantes)
  const { resolvidos, semEmail } = resolverDestinatarios(participantes, diretorio)
  const ctx = variaveisEmailAta(ata)

  return Response.json({
    resolvidos,
    semEmail,
    assunto: aplicaVariaveisEmail(assuntoTemplate, ctx),
    corpoPreview: aplicaVariaveisEmail(corpoTemplate, ctx),
  })
}
