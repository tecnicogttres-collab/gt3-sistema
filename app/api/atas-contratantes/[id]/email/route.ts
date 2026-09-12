import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'
import { variaveisEmailAta, aplicaVariaveisEmail, corpoParaHtml } from '../../../../lib/ata-email'
import { nomeArquivoAta, type AtaHtmlData } from '../../../../lib/ata-html'
import { gerarAtaPdfBuffer } from '../../../../lib/ata-pdf'
import { ASSUNTO_PADRAO, CORPO_PADRAO, type EmailConfigDados } from '../../email-config/route'
import type { Participante, Topico } from '../../../../atas/AtasEditor'

type Params = { params: Promise<{ id: string }> }

function parseParticipantes(val: string | null): Participante[] {
  if (!val?.trim()) return []
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p } catch {}
  return []
}

function parseTopicos(val: string | null): Topico[] {
  if (!val?.trim()) return []
  try { const t = JSON.parse(val); if (Array.isArray(t)) return t } catch {}
  return []
}

/** Monta um .eml multipart (corpo em HTML + PDF anexado em base64) — ao abrir no
 *  cliente de e-mail padrão (Outlook etc.), chega como rascunho pronto: destinatários,
 *  assunto, corpo e o PDF da ata já anexado, só faltando revisar e enviar. */
function montarEml(opts: { to: string; subject: string; htmlBody: string; pdfBuffer: Buffer; pdfFilename: string }): string {
  const boundary = 'gt3_ata_' + Math.random().toString(36).slice(2)
  const subjectB64 = Buffer.from(opts.subject, 'utf-8').toString('base64')
  const pdfB64 = opts.pdfBuffer.toString('base64').replace(/.{76}/g, '$&\r\n')
  const filenameSafe = opts.pdfFilename.replace(/["\\]/g, '')

  return [
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    'X-Unsent: 1',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    opts.htmlBody,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filenameSafe}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filenameSafe}"`,
    '',
    pdfB64,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

export async function POST(req: NextRequest, { params }: Params) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const destinatarios: string[] = Array.isArray(body.destinatarios)
    ? body.destinatarios.map((e: string) => String(e).trim()).filter(Boolean)
    : []

  const admin = createAdminClient()
  const [{ data: ata, error: ataErr }, { data: configRow }] = await Promise.all([
    admin.from('atas_contratantes')
      .select('titulo, data, cliente, local_reuniao, numero_ata, status, participantes, conteudo')
      .eq('id', id).single(),
    admin.from('atas_contratantes_email_config').select('dados').eq('id', 1).maybeSingle(),
  ])
  if (ataErr || !ata) return Response.json({ error: 'Ata não encontrada' }, { status: 404 })

  const dados = (configRow?.dados ?? {}) as Partial<EmailConfigDados>
  const assuntoTemplate = dados.assunto?.trim() || ASSUNTO_PADRAO
  const corpoTemplate = dados.corpo?.trim() || CORPO_PADRAO

  const ataHtmlData: AtaHtmlData = ata
  const ctx = variaveisEmailAta(ataHtmlData)
  const assunto = aplicaVariaveisEmail(assuntoTemplate, ctx)
  const corpoHtml = corpoParaHtml(aplicaVariaveisEmail(corpoTemplate, ctx))

  const topicos = parseTopicos(ata.conteudo)
  const partes = parseParticipantes(ata.participantes)
  const pdfBuffer = await gerarAtaPdfBuffer(ataHtmlData, topicos, partes)
  const pdfFilename = `${nomeArquivoAta(ataHtmlData)}.pdf`

  const eml = montarEml({
    to: destinatarios.join(', '),
    subject: assunto,
    htmlBody: `<html><head><meta charset="utf-8"></head><body>${corpoHtml}</body></html>`,
    pdfBuffer,
    pdfFilename,
  })

  const emlFilename = `${nomeArquivoAta(ataHtmlData)}.eml`.replace(/["\\]/g, '')
  return new Response(eml, {
    headers: {
      'Content-Type': 'message/rfc822; charset=utf-8',
      'Content-Disposition': `attachment; filename="${emlFilename}"`,
    },
  })
}
