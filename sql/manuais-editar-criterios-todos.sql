-- Manuais: qualquer login pode incluir/excluir critérios de documentos já existentes (UPDATE).
-- Criar, excluir documento e categorias continuam só para gestor/admin.
DROP POLICY IF EXISTS "md_update_gestor" ON public.manuais_documentos;
DROP POLICY IF EXISTS "md_update_todos"  ON public.manuais_documentos;

CREATE POLICY "md_update_todos" ON public.manuais_documentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
