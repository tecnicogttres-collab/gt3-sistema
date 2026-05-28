-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Home Office: planilhas mensais, RLS e Realtime
-- Cada linha representa uma planilha mensal (is_current = true = mês vigente).
-- Ao "finalizar e arquivar", is_current vira false e a linha permanece no histórico.

CREATE TABLE IF NOT EXISTS public.home_office_sheets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INTEGER     NOT NULL,
  month_idx   INTEGER     NOT NULL CHECK (month_idx >= 0 AND month_idx <= 11),
  is_current  BOOLEAN     NOT NULL DEFAULT FALSE,
  rows        JSONB       NOT NULL DEFAULT '[]',
  people      JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month_idx)
);

CREATE INDEX IF NOT EXISTS idx_ho_sheets_current ON public.home_office_sheets(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_ho_sheets_year    ON public.home_office_sheets(year, month_idx);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ho_sheets_updated_at ON public.home_office_sheets;
CREATE TRIGGER ho_sheets_updated_at
  BEFORE UPDATE ON public.home_office_sheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.home_office_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ho_select"        ON public.home_office_sheets;
DROP POLICY IF EXISTS "ho_insert_gestor" ON public.home_office_sheets;
DROP POLICY IF EXISTS "ho_update_gestor" ON public.home_office_sheets;
DROP POLICY IF EXISTS "ho_delete_gestor" ON public.home_office_sheets;

CREATE POLICY "ho_select"
  ON public.home_office_sheets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ho_insert_gestor"
  ON public.home_office_sheets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "ho_update_gestor"
  ON public.home_office_sheets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "ho_delete_gestor"
  ON public.home_office_sheets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE public.home_office_sheets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_office_sheets;

-- ── GRANTs ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_office_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_office_sheets TO service_role;
