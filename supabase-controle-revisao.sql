-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Controle Revisão BSA: planilhas mensais, RLS e Realtime
-- Cada linha representa uma planilha mensal (is_current = true = mês vigente).
-- revisions: inconsistências registradas; schedule: escala diária de revisores.

CREATE TABLE IF NOT EXISTS public.controle_revisao_sheets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INTEGER     NOT NULL,
  month_idx   INTEGER     NOT NULL CHECK (month_idx >= 0 AND month_idx <= 11),
  is_current  BOOLEAN     NOT NULL DEFAULT FALSE,
  revisions   JSONB       NOT NULL DEFAULT '[]',
  schedule    JSONB       NOT NULL DEFAULT '[]',
  people      JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month_idx)
);

CREATE INDEX IF NOT EXISTS idx_cr_sheets_current ON public.controle_revisao_sheets(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_cr_sheets_year    ON public.controle_revisao_sheets(year, month_idx);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cr_sheets_updated_at ON public.controle_revisao_sheets;
CREATE TRIGGER cr_sheets_updated_at
  BEFORE UPDATE ON public.controle_revisao_sheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.controle_revisao_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cr_select"        ON public.controle_revisao_sheets;
DROP POLICY IF EXISTS "cr_insert_gestor" ON public.controle_revisao_sheets;
DROP POLICY IF EXISTS "cr_update_gestor" ON public.controle_revisao_sheets;
DROP POLICY IF EXISTS "cr_delete_gestor" ON public.controle_revisao_sheets;

CREATE POLICY "cr_select"
  ON public.controle_revisao_sheets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cr_insert_gestor"
  ON public.controle_revisao_sheets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "cr_update_gestor"
  ON public.controle_revisao_sheets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "cr_delete_gestor"
  ON public.controle_revisao_sheets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE public.controle_revisao_sheets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.controle_revisao_sheets;
