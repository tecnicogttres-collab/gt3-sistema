-- GT3 Sistema - Designacao de Reprovados - novo status "Sem definicao"
-- Finaliza o item (igual a Resolvido / Doc(s) excluido) e o manda pro Historico.
-- Execute uma vez no SQL Editor do Supabase.

-- Remove o CHECK antigo da coluna tratativa (qualquer nome) e recria aceitando 'sem_definicao'
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.designacoes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tratativa%'
  LOOP
    EXECUTE format('ALTER TABLE public.designacoes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.designacoes
  ADD CONSTRAINT designacoes_tratativa_check
  CHECK (tratativa IN ('aguardando','ciente','andamento','resolvido','excluido','sem_definicao'));
