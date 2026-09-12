-- GT3 Sistema - Config do "Gerar e-mail" em Atas Contratantes
-- Guarda, num unico registro (singleton), o diretorio pessoa -> e-mail e os modelos
-- de assunto/corpo usados para montar o e-mail (com PDF da ata anexado).
-- So e acessado via API com service role (nenhuma policy = bloqueado para
-- anon/authenticated direto, igual ao padrao ja usado em workflow_programas_config).
-- Execute uma vez no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.atas_contratantes_email_config (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  dados      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT atas_contratantes_email_config_singleton CHECK (id = 1)
);

ALTER TABLE public.atas_contratantes_email_config ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.atas_contratantes_email_config TO service_role;
