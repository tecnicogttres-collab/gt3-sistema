-- GT3 Sistema - Designacao de Reprovados - novo status "Doc(s) excluido"
-- Depois de dar ciencia, o responsavel pode marcar o item como "Doc(s) excluido",
-- que finaliza o item (igual a Resolvido) e o manda pro Historico.
-- Execute uma vez no SQL Editor do Supabase.

-- Remove o CHECK antigo da coluna tratativa (qualquer nome) e recria aceitando 'excluido'
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
  CHECK (tratativa IN ('aguardando','ciente','andamento','resolvido','excluido'));
