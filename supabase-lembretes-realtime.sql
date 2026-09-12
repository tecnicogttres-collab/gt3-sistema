-- GT3 Sistema - Habilita Realtime para o modulo Lembretes
-- Sem isso, a assinatura realtime do Dashboard (lembretes proprios + aba Equipe) nunca
-- recebe INSERT/UPDATE/DELETE dessas tabelas, entao o item nao some do Dashboard quando
-- confirmado (OK) ou excluido no modulo Lembretes.
-- Execute uma vez no SQL Editor do Supabase.

ALTER TABLE public.lembretes REPLICA IDENTITY FULL;
ALTER TABLE public.lembretes_historico REPLICA IDENTITY FULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lembretes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lembretes_historico; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
