-- GT3 Sistema - Repositorio de Modelos - Abas configuraveis
-- Antes o repositorio tinha so duas abas fixas (Empresas / Funcionarios), gravadas na
-- coluna repositorio_modelos.tipo. Agora as abas ficam nesta tabela e sao gerenciadas
-- por gestor/admin em Configuracoes; repositorio_modelos.tipo guarda o id da aba.
-- Execute uma vez no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.repositorio_abas (
  id text PRIMARY KEY,
  label text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.repositorio_abas (id, label, ordem) VALUES
  ('empresas',     'Empresas',     1),
  ('funcionarios', 'Funcionários', 2),
  ('gt3',          'GT3',          3)
ON CONFLICT (id) DO NOTHING;

-- Remove qualquer CHECK antigo que limite tipo a empresas/funcionarios
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.repositorio_modelos'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.repositorio_modelos DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.repositorio_abas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repositorio_abas_select" ON public.repositorio_abas;
DROP POLICY IF EXISTS "repositorio_abas_write_gestor" ON public.repositorio_abas;

CREATE POLICY "repositorio_abas_select" ON public.repositorio_abas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "repositorio_abas_write_gestor" ON public.repositorio_abas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositorio_abas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositorio_abas TO service_role;
