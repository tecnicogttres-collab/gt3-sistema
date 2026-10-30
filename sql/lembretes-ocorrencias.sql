-- ============================================================
-- Lembretes — OK por ocorrência (em vez de um OK por mês)
-- GT3 Sistema — colar no SQL Editor do Supabase
--
-- Guarda qual ocorrência cada OK finalizou, para a recorrência
-- voltar só na próxima. Linhas antigas ficam com data_ocorrencia
-- nula e continuam valendo para a ocorrência do mês delas.
-- Rodar ANTES de publicar o código novo.
-- ============================================================

ALTER TABLE public.lembretes_historico
  ADD COLUMN IF NOT EXISTS data_ocorrencia DATE;

-- Remove o UNIQUE (lembrete_id, usuario_id, mes_referencia), que só permitia um OK por mês.
DO $$
DECLARE c TEXT;
BEGIN
  SELECT con.conname INTO c
  FROM pg_constraint con
  WHERE con.conrelid = 'public.lembretes_historico'::regclass
    AND con.contype = 'u'
    AND (
      SELECT array_agg(a.attname::text ORDER BY a.attname)
      FROM pg_attribute a
      WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
    ) = ARRAY['lembrete_id', 'mes_referencia', 'usuario_id'];

  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.lembretes_historico DROP CONSTRAINT %I', c);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lh_ocorrencia
  ON public.lembretes_historico (lembrete_id, usuario_id, data_ocorrencia);

CREATE INDEX IF NOT EXISTS idx_lh_data_ocorrencia
  ON public.lembretes_historico (data_ocorrencia);
