// Assinatura de e-mail por usuário (profiles.assinatura_email, em HTML) — lado servidor.
// Preenchida manualmente em Usuários (Logins). Qualquer .eml / "abrir no Outlook" gerado no
// sistema deve anexá-la ao fim do corpo: no cliente via app/lib/email-envio.ts, no servidor
// via getAssinaturaEmail(userId) abaixo.

import { createAdminClient } from './supabase-admin'

/** Assinatura (HTML) do usuário, ou '' se não tiver — nunca lança: se a coluna ainda não
 *  existir ou a consulta falhar, o e-mail sai normalmente, só sem assinatura. */
export async function getAssinaturaEmail(userId: string): Promise<string> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('profiles').select('assinatura_email').eq('id', userId).single()
    if (error) return ''
    return ((data as { assinatura_email?: string | null } | null)?.assinatura_email ?? '').trim()
  } catch {
    return ''
  }
}

/** Limpeza básica do HTML colado no campo de assinatura: tira scripts, iframes, formulários,
 *  handlers on*="…" e links javascript:. Mantém formatação, links e imagens. */
export function sanitizarAssinatura(html: string): string {
  return (html ?? '')
    .replace(/<\s*(script|iframe|object|embed|form|meta|link|base)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*(script|iframe|object|embed|form|meta|link|base)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2')
    .trim()
}
