-- ============================================================
-- Frases Diárias — Frase do Dia Manual + Playlist
-- GT3 Sistema — colar no SQL Editor do Supabase
-- ============================================================
-- A tabela frases_rotacao já suporta as operações necessárias
-- (data unique, frase_id FK). O que precisamos garantir:
--   1. Índice para consultas de datas futuras (playlist)
--   2. Permissão de DELETE para admin (se RLS estiver habilitada)
-- ============================================================

-- 1. Índice — melhora consultas de SELECT + DELETE por data
CREATE INDEX IF NOT EXISTS idx_frases_rotacao_data
  ON public.frases_rotacao (data ASC);

-- 2. Permissão de DELETE para admin em frases_rotacao
--    A UI usa DELETE para remover itens da playlist.
--    Executar APENAS se o DELETE estiver falhando por RLS.
--
--    Verificar se RLS está habilitada:
--      SELECT relrowsecurity FROM pg_class WHERE relname = 'frases_rotacao';
--
--    Se retornar 't', executar as linhas abaixo:

-- ALTER TABLE public.frases_rotacao ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS frases_rotacao_admin_all ON public.frases_rotacao;
-- CREATE POLICY frases_rotacao_admin_all ON public.frases_rotacao
--   FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid()
--         AND papel = 'admin'
--     )
--   )
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid()
--         AND papel = 'admin'
--     )
--   );

-- 3. Opcional — garantir que FK tem ON DELETE CASCADE
--    (para que ao excluir uma frase, suas entradas na playlist
--     sejam removidas automaticamente pelo banco)
--    Verificar FK atual:
--      SELECT conname, confdeltype FROM pg_constraint
--      WHERE conrelid = 'frases_rotacao'::regclass
--        AND contype = 'f';
--
--    Se confdeltype != 'c' (CASCADE), recriar a FK:
--
-- ALTER TABLE public.frases_rotacao
--   DROP CONSTRAINT IF EXISTS frases_rotacao_frase_id_fkey;
--
-- ALTER TABLE public.frases_rotacao
--   ADD CONSTRAINT frases_rotacao_frase_id_fkey
--   FOREIGN KEY (frase_id)
--   REFERENCES public.frases (id)
--   ON DELETE CASCADE;
