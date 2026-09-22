-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Designação de Reprovados: marcador "empresa retornou" (independente
-- da tratativa) + prazo configurável do histórico da Minha Caixa/Visão geral

ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS retorno_recebido BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS retorno_em TIMESTAMPTZ;

ALTER TABLE public.desig_config ADD COLUMN IF NOT EXISTS historico_dias INTEGER NOT NULL DEFAULT 15;
