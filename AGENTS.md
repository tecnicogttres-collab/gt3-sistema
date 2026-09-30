<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# E-mails gerados pelo sistema

Todo .eml ou "Abrir no Outlook" (atual ou futuro, em qualquer módulo) deve usar `app/lib/email-envio.ts` no cliente, ou `getAssinaturaEmail` de `app/lib/email-assinatura.ts` no servidor. Eles anexam a assinatura do usuário logado (Usuários → Assinatura de e-mail, coluna `profiles.assinatura_email`). Não montar .eml/mailto na mão.
