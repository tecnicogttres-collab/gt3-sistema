-- Ordem e seção das observações dentro de cada coluna (módulo Observações).
-- Vale tanto para cards originais (JSON) quanto para os criados no banco:
-- o card é identificado pelo motivo dentro de (categoria, subtab, coluna).
-- group_name = seção em que o card aparece (NULL = sem seção).

CREATE TABLE IF NOT EXISTS public.observacoes_card_ordem (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria       TEXT        NOT NULL,
  subtab          TEXT        NOT NULL,
  coluna          TEXT        NOT NULL,
  motivo          TEXT        NOT NULL,
  group_name      TEXT,
  ordem           INTEGER     NOT NULL DEFAULT 0,
  atualizado_por  UUID        REFERENCES public.profiles(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT observacoes_card_ordem_unique UNIQUE (categoria, subtab, coluna, motivo)
);

ALTER TABLE public.observacoes_card_ordem ENABLE ROW LEVEL SECURITY;

-- Leitura liberada para autenticados; escrita só pela API (service role, gestor/admin)
DROP POLICY IF EXISTS "obs_card_ordem_select_all" ON public.observacoes_card_ordem;
CREATE POLICY "obs_card_ordem_select_all"
  ON public.observacoes_card_ordem FOR SELECT
  USING (true);
