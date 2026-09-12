-- GT3 Sistema - Modulo Observacoes - modelo de texto ao copiar
-- Guarda o template usado para montar o texto copiado dos cards (data + observacao + nome
-- de quem copiou). Editavel por gestor/admin em Configuracoes > Modelo de copia.
-- Execute uma vez no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.observacoes_copy_config (id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), template text NOT NULL DEFAULT '{{data}} - {{observacao}} - {{nome}}', updated_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE public.observacoes_copy_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "observacoes_copy_config_select" ON public.observacoes_copy_config;
DROP POLICY IF EXISTS "observacoes_copy_config_upsert" ON public.observacoes_copy_config;

CREATE POLICY "observacoes_copy_config_select" ON public.observacoes_copy_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "observacoes_copy_config_upsert" ON public.observacoes_copy_config FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

INSERT INTO public.observacoes_copy_config (id, template) VALUES (1, '{{data}} - {{observacao}} - {{nome}}') ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.observacoes_copy_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.observacoes_copy_config TO service_role;

ALTER TABLE public.observacoes_copy_config REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.observacoes_copy_config; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
