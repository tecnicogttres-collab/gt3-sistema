-- GT3 Sistema - Modulo Retorno de NR - Atalhos prontos para o Registro no GT0100
-- Execute uma vez no SQL Editor do Supabase.

ALTER TABLE public.rnr_config ADD COLUMN IF NOT EXISTS atalhos jsonb NOT NULL DEFAULT '[]'::jsonb;
