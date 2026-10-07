-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Lembretes: data original da ocorrência adiada, para o dashboard mostrar
-- "vem sendo adiado há X dias" quando o lembrete volta a aparecer (3 dias antes da nova data).

ALTER TABLE public.lembretes_adiamentos ADD COLUMN IF NOT EXISTS data_original DATE;
