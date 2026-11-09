-- GT3 Sistema - Custo de Servir: exclusao de medicoes e "tempo padrao" transportado entre grupos
-- Execute uma vez no SQL Editor do Supabase. Idempotente.
--
-- 1) origem_id: a medicao e uma copia ("tempo padrao") de outra medicao, feita em outro grupo para o
--    mesmo documento. Excluir a medicao original exclui tambem as copias (ON DELETE CASCADE).
--    Uma medicao so pode ser transportada uma vez para cada grupo.
-- 2) A copia mantem o avaliador da medicao original: a politica de INSERT passa a aceitar
--    avaliador diferente do usuario logado somente quando a origem e desse mesmo avaliador.
-- 3) Excluir medicao: o historico dela some junto (FK ON DELETE CASCADE ja existente).

BEGIN;

ALTER TABLE public.cs_medicoes ADD COLUMN IF NOT EXISTS origem_id uuid;
ALTER TABLE public.cs_medicoes DROP CONSTRAINT IF EXISTS cs_medicoes_origem_id_fkey;
ALTER TABLE public.cs_medicoes
  ADD CONSTRAINT cs_medicoes_origem_id_fkey
  FOREIGN KEY (origem_id) REFERENCES public.cs_medicoes(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS cs_medicoes_origem_grupo
  ON public.cs_medicoes (origem_id, grupo_id) WHERE origem_id IS NOT NULL;

DROP POLICY IF EXISTS cs_medicoes_autor ON public.cs_medicoes;
CREATE POLICY cs_medicoes_autor ON public.cs_medicoes AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (
    avaliador_id = auth.uid()
    OR (origem_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cs_medicoes o
       WHERE o.id = cs_medicoes.origem_id AND o.avaliador_id = cs_medicoes.avaliador_id))
  );

COMMIT;
