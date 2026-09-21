-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Lembretes: periodicidade "N-ésimo dia da semana do mês"
-- (ex.: toda 3ª segunda-feira do mês). "Toda segunda-feira" (semanal) já funciona hoje
-- escolhendo uma segunda como data de início — não precisa de coluna nova pra isso.

ALTER TABLE public.lembretes DROP CONSTRAINT IF EXISTS lembretes_periodo_check;
ALTER TABLE public.lembretes ADD CONSTRAINT lembretes_periodo_check
  CHECK (periodo IN ('unico','diario','semanal','mensal','trimestral','semestral','anual','mensal_dia_semana'));

ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS dia_semana SMALLINT
  CHECK (dia_semana IS NULL OR dia_semana BETWEEN 0 AND 6); -- 0=Domingo ... 6=Sábado
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS semana_ordinal SMALLINT
  CHECK (semana_ordinal IS NULL OR semana_ordinal IN (1,2,3,4,-1)); -- -1 = última ocorrência do mês
