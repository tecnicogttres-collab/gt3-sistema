-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Calendário de Férias: registro de períodos de férias por colaborador

CREATE TABLE IF NOT EXISTS public.ferias (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa     TEXT        NOT NULL,
  inicio     DATE        NOT NULL,
  fim        DATE        NOT NULL,
  observacao TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ferias_pessoa ON public.ferias(pessoa);
CREATE INDEX IF NOT EXISTS idx_ferias_inicio ON public.ferias(inicio);

-- Trigger updated_at (reutiliza a função set_updated_at se já existir)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ferias_updated_at ON public.ferias;
CREATE TRIGGER ferias_updated_at
  BEFORE UPDATE ON public.ferias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.ferias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferias_select"        ON public.ferias;
DROP POLICY IF EXISTS "ferias_insert_gestor" ON public.ferias;
DROP POLICY IF EXISTS "ferias_update_gestor" ON public.ferias;
DROP POLICY IF EXISTS "ferias_delete_gestor" ON public.ferias;

CREATE POLICY "ferias_select"
  ON public.ferias FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ferias_insert_gestor"
  ON public.ferias FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "ferias_update_gestor"
  ON public.ferias FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "ferias_delete_gestor"
  ON public.ferias FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE public.ferias REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ferias;

-- ── GRANTs ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias TO service_role;
