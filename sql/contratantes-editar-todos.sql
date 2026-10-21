-- Informações Contratantes: qualquer login pode editar as informações das contratantes (UPDATE),
-- incluindo férias coletivas. Criar e excluir contratante continuam só para gestor/admin.
DROP POLICY IF EXISTS "ct_update_gestor" ON public.contratantes;
DROP POLICY IF EXISTS "ct_update_todos"  ON public.contratantes;

CREATE POLICY "ct_update_todos" ON public.contratantes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
