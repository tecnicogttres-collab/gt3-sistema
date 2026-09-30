-- ============================================================
-- Lembretes — "Adiar" também move o lembrete no calendário
-- GT3 Sistema — colar no SQL Editor do Supabase
--
-- Distingue "Adiar" (adiado = true: o lembrete passa a aparecer na
-- data escolhida no módulo Lembretes) de "Descartar" (adiado = false:
-- só some do Dashboard). Rodar depois de lembretes-adiamentos.sql.
-- ============================================================

ALTER TABLE public.lembretes_adiamentos
  ADD COLUMN IF NOT EXISTS adiado BOOLEAN NOT NULL DEFAULT false;
