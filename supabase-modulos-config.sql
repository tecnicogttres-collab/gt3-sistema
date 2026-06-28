-- GT3 Sistema - Nomenclatura dos Modulos (nome e cor por modulo)
-- Execute uma vez no SQL Editor do Supabase.
-- A lista de modulos continua em app/lib/modules.ts; esta tabela guarda so os overrides.

CREATE TABLE IF NOT EXISTS public.modulos_config (
  id text PRIMARY KEY,
  label text,
  color text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.modulos_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modulos_config_select" ON public.modulos_config;
DROP POLICY IF EXISTS "modulos_config_insert_gestor" ON public.modulos_config;
DROP POLICY IF EXISTS "modulos_config_update_gestor" ON public.modulos_config;
DROP POLICY IF EXISTS "modulos_config_delete_gestor" ON public.modulos_config;

CREATE POLICY "modulos_config_select" ON public.modulos_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "modulos_config_insert_gestor" ON public.modulos_config
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

CREATE POLICY "modulos_config_update_gestor" ON public.modulos_config
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

CREATE POLICY "modulos_config_delete_gestor" ON public.modulos_config
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

ALTER TABLE public.modulos_config REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.modulos_config;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos_config TO service_role;
