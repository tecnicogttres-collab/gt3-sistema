-- GT3 Sistema - Repositorio de Modelos - Categorias configuraveis
-- Antes as categorias (SST, Fiscal, Juridico, RH, Outros) eram fixas no codigo. Agora ficam
-- nesta tabela e sao gerenciadas por gestor/admin em Configuracoes. repositorio_modelos.categoria
-- continua guardando o NOME da categoria (renomear aqui atualiza os arquivos junto).
-- Execute uma vez no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.repositorio_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  cor text NOT NULL DEFAULT 'cinza',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.repositorio_categorias (nome, cor, ordem) VALUES
  ('SST',      'verde',   1),
  ('Fiscal',   'azul',    2),
  ('Jurídico', 'roxo',    3),
  ('RH',       'laranja', 4),
  ('Outros',   'cinza',   5)
ON CONFLICT (nome) DO NOTHING;

-- Categorias ja usadas em arquivos que nao estao na lista acima entram no fim
INSERT INTO public.repositorio_categorias (nome, cor, ordem)
SELECT DISTINCT m.categoria, 'cinza', 100
FROM public.repositorio_modelos m
WHERE m.categoria IS NOT NULL AND m.categoria <> ''
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.repositorio_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repositorio_categorias_select" ON public.repositorio_categorias;
DROP POLICY IF EXISTS "repositorio_categorias_write_gestor" ON public.repositorio_categorias;

CREATE POLICY "repositorio_categorias_select" ON public.repositorio_categorias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "repositorio_categorias_write_gestor" ON public.repositorio_categorias
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositorio_categorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositorio_categorias TO service_role;
