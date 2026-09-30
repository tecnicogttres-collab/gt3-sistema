-- ============================================================
-- Usuários — assinatura de e-mail por usuário
-- GT3 Sistema — colar no SQL Editor do Supabase
--
-- Guarda a assinatura (HTML) de cada usuário. O sistema anexa essa
-- assinatura, automaticamente, ao fim de todo .eml e de todo
-- "Abrir no Outlook" gerado por aquele usuário (módulos atuais e futuros).
-- Preenchida em Usuários (Logins) → editar usuário → Assinatura de e-mail.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assinatura_email TEXT;
