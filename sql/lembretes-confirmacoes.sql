-- ============================================================
-- Lembretes — tabela de confirmações por usuário/mês
-- GT3 Sistema — colar no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lembretes_confirmacoes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lembrete_id    UUID        NOT NULL REFERENCES public.lembretes(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  mes_referencia DATE        NOT NULL,               -- 1º dia do mês (ex: 2025-06-01)
  confirmado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lembrete_id, user_id, mes_referencia)      -- impede dupla confirmação
);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.lembretes_confirmacoes ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
CREATE POLICY lc_select ON public.lembretes_confirmacoes
  FOR SELECT TO authenticated USING (true);

-- Inserção: cada usuário insere apenas suas próprias confirmações
CREATE POLICY lc_insert ON public.lembretes_confirmacoes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Exclusão: somente gestor/admin
CREATE POLICY lc_delete ON public.lembretes_confirmacoes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND papel IN ('gestor', 'admin')
    )
  );

-- ── Índices de consulta frequente ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_lc_user_mes
  ON public.lembretes_confirmacoes (user_id, mes_referencia);

CREATE INDEX IF NOT EXISTS idx_lc_lembrete
  ON public.lembretes_confirmacoes (lembrete_id);
