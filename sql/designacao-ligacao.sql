-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Designação de Reprovados: marcador "ligação feita" (data/hora + usuário)

ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS ligacao_em  TIMESTAMPTZ;
ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS ligacao_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
