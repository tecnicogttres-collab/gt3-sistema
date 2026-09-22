-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Designação de Reprovados: e-mail cadastrado por empresa +
-- estrutura do e-mail (saudação/fechamento/assunto) editável pela tela

ALTER TABLE public.desig_empresas ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.desig_config (
  id                   TEXT        PRIMARY KEY DEFAULT 'default',
  assunto_template     TEXT        NOT NULL DEFAULT 'Portal GT3 - Acompanhamento de documentação - {{empresa}}',
  saudacao_template    TEXT        NOT NULL DEFAULT 'Olá! Identificamos que você possui documentos de {{setores}} reprovados no Portal GT3.',
  fechamento_template  TEXT        NOT NULL DEFAULT 'Você precisa de alguma ajuda com este(s) documento(s)?',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.desig_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.desig_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "desig_config_all" ON public.desig_config;
CREATE POLICY "desig_config_all" ON public.desig_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
