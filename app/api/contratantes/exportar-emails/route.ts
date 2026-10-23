import { createAdminClient } from '../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../lib/api-helpers'
import { planilhaEmailsContratantes } from '../../../lib/contratantes-emails-planilha'

/** "Exportar e-mails para planilha" (Cadastro de Contratantes) — SÓ LÊ public.contratantes e devolve
 *  o .xlsx para download; nada é gravado no banco nem no servidor. */
export async function GET() {
  if (!await requireGestorAdmin()) return Response.json({ error: 'Só admin e gestor podem exportar os e-mails' }, { status: 403 })

  const admin = createAdminClient()
  const { data: cad, error } = await admin.from('contratantes').select('id, name, fields').order('name')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { buffer } = await planilhaEmailsContratantes(cad ?? [])
  const nome = `Emails_contratantes_${new Date().toISOString().slice(0, 10)}.xlsx`
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  })
}
