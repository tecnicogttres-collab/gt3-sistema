-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Designação de Reprovados: como a empresa retornou (ligação ou WhatsApp / e-mail / outro),
-- texto livre do retorno e quem registrou. Guardado em colunas próprias para dar pra mensurar depois
-- (ex.: quantos retornos por e-mail x ligação, por colaborador, por período).

ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS retorno_tipo TEXT;
ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS retorno_obs  TEXT;
ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS retorno_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.designacoes DROP CONSTRAINT IF EXISTS designacoes_retorno_tipo_check;
ALTER TABLE public.designacoes ADD CONSTRAINT designacoes_retorno_tipo_check
  CHECK (retorno_tipo IS NULL OR retorno_tipo IN ('ligacao', 'email', 'outro'));
