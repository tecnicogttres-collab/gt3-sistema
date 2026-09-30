import { getAuthUser } from '../../../lib/api-helpers'
import { getAssinaturaEmail } from '../../../lib/email-assinatura'

/** Assinatura de e-mail do usuário logado — lida na hora de gerar um .eml / abrir no Outlook. */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ assinatura: '' }, { status: 401 })
  return Response.json({ assinatura: await getAssinaturaEmail(user.id) })
}
