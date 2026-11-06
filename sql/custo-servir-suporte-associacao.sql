-- GT3 Sistema - Custo de Servir: cronometragem de atividade associada a contratante/grupo + Faturamento
-- Execute uma vez no SQL Editor do Supabase (depois de custo-servir-suporte.sql). Idempotente.
--
-- contratante_cod: a medicao foi feita para esse contratante (opcional).
-- grupo = true: vale para o contratante principal e todas as unidades dele.
-- Com o minimo de medicoes, a camada 2 usa o tempo desse contratante/grupo; senao, o tempo geral.

BEGIN;

ALTER TABLE public.cs_atividade_medicoes ADD COLUMN IF NOT EXISTS contratante_cod text;
ALTER TABLE public.cs_atividade_medicoes ADD COLUMN IF NOT EXISTS grupo boolean NOT NULL DEFAULT false;
ALTER TABLE public.cs_atividade_medicoes DROP CONSTRAINT IF EXISTS cs_atividade_medicoes_ctt_fkey;
ALTER TABLE public.cs_atividade_medicoes
  ADD CONSTRAINT cs_atividade_medicoes_ctt_fkey FOREIGN KEY (contratante_cod)
  REFERENCES public.cs_contratantes_fin(contratante_cod) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cs_atividade_medicoes_ctt ON public.cs_atividade_medicoes (contratante_cod);

INSERT INTO public.cs_atividades (chave, nome, unidade, fonte, liga_por, ordem) VALUES
  ('faturamento', 'Faturamento', 'quantidade', 'Faturamentos emitidos no mês', 'Contratante faturado', 8)
ON CONFLICT (chave) DO NOTHING;

COMMIT;
