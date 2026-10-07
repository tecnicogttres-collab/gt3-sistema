-- Execute uma vez no SQL Editor do Supabase (ANTES de publicar o código novo)
-- GT3 Sistema — Designação de Reprovados: registro "Empresa contatada sobre a reprovação"
-- Cada clique em "Baixe o e-mail pronto" / "Abrir no Outlook" acrescenta { em, por } nesta lista.

ALTER TABLE public.designacoes
  ADD COLUMN IF NOT EXISTS contatos_email JSONB NOT NULL DEFAULT '[]'::jsonb;
