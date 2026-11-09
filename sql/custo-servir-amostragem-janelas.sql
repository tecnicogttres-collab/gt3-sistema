-- GT3 Sistema - Custo de Servir: faixas de horario da amostragem do trabalho (camada 3)
-- Execute uma vez no SQL Editor do Supabase. Idempotente.
--
-- janelas: faixas do dia em que os avisos podem sair, ex.: [{"ini":"08:00","fim":"12:00"},{"ini":"13:30","fim":"18:00"}]
-- (tira almoco, reunioes fixas etc.). NULL = faixa unica hora_ini..hora_fim (amostragens antigas).
-- hora_ini/hora_fim continuam gravados com o inicio da primeira e o fim da ultima faixa.

ALTER TABLE public.cs_amostragens ADD COLUMN IF NOT EXISTS janelas jsonb;
