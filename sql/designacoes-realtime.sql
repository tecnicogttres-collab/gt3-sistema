-- Designação de Reprovados: liga o realtime na tabela designacoes.
-- Sem isso o dashboard e a tela do módulo nunca recebem o evento e só atualizam no recarregamento.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'designacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.designacoes;
  END IF;
END $$;
