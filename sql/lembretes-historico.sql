-- ============================================================
-- Lembretes — histórico de confirmações (OK) por usuário/mês
-- GT3 Sistema — colar no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lembretes_historico (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lembrete_id     UUID        NOT NULL REFERENCES public.lembretes(id) ON DELETE CASCADE,
  lembrete_titulo TEXT        NOT NULL DEFAULT '',
  usuario_id      UUID        NOT NULL,
  usuario_nome    TEXT        NOT NULL DEFAULT '',
  usuario_login   TEXT        NOT NULL DEFAULT '',
  mes_referencia  DATE        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lembrete_id, usuario_id, mes_referencia)
);

ALTER TABLE public.lembretes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY lh_select ON public.lembretes_historico
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lh_insert ON public.lembretes_historico
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY lh_delete ON public.lembretes_historico
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

GRANT SELECT, INSERT ON public.lembretes_historico TO authenticated;
GRANT ALL ON public.lembretes_historico TO service_role;

CREATE INDEX IF NOT EXISTS idx_lh_mes      ON public.lembretes_historico (mes_referencia);
CREATE INDEX IF NOT EXISTS idx_lh_lembrete ON public.lembretes_historico (lembrete_id);
CREATE INDEX IF NOT EXISTS idx_lh_usuario  ON public.lembretes_historico (usuario_id);
