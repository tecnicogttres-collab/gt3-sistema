-- GT3 Sistema - Custo de Servir: "como está o ritmo agora?" no pop-up do Extra portal (camada 3)
-- Execute uma vez no SQL Editor do Supabase. Idempotente.
--
-- cs_amostras.ritmo : tranquilo | normal | pesado. NULL = a pessoa não informou (respostas antigas ou pulou a pergunta).

ALTER TABLE public.cs_amostras ADD COLUMN IF NOT EXISTS ritmo text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cs_amostras_ritmo_chk') THEN
    ALTER TABLE public.cs_amostras
      ADD CONSTRAINT cs_amostras_ritmo_chk CHECK (ritmo IS NULL OR ritmo IN ('tranquilo', 'normal', 'pesado'));
  END IF;
END $$;
