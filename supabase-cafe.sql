-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Café: escala semanal (manhã/tarde), RLS e Realtime
-- Cada linha representa uma planilha mensal (is_current = true = mês vigente).
-- Cada planilha tem várias semanas (segunda a sexta); semanas quebradas (o mês
-- termina no meio da semana) carregam a mesma pessoa automaticamente para o
-- mês seguinte ao finalizar.

CREATE TABLE IF NOT EXISTS public.cafe_sheets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INTEGER     NOT NULL,
  month_idx   INTEGER     NOT NULL CHECK (month_idx >= 0 AND month_idx <= 11),
  is_current  BOOLEAN     NOT NULL DEFAULT FALSE,
  weeks       JSONB       NOT NULL DEFAULT '[]',
  people      JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month_idx)
);

CREATE INDEX IF NOT EXISTS idx_cafe_sheets_current ON public.cafe_sheets(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_cafe_sheets_year    ON public.cafe_sheets(year, month_idx);

-- Reaproveita a função set_updated_at já criada por outros módulos (ex: home office)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cafe_sheets_updated_at ON public.cafe_sheets;
CREATE TRIGGER cafe_sheets_updated_at
  BEFORE UPDATE ON public.cafe_sheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Qualquer colaborador autenticado pode ver e editar (auto-atribuir/trocar a
-- escala). Só gestor/admin pode excluir planilhas do histórico.

ALTER TABLE public.cafe_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cafe_select"        ON public.cafe_sheets;
DROP POLICY IF EXISTS "cafe_insert_all"    ON public.cafe_sheets;
DROP POLICY IF EXISTS "cafe_update_all"    ON public.cafe_sheets;
DROP POLICY IF EXISTS "cafe_delete_gestor" ON public.cafe_sheets;

CREATE POLICY "cafe_select"
  ON public.cafe_sheets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cafe_insert_all"
  ON public.cafe_sheets FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "cafe_update_all"
  ON public.cafe_sheets FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "cafe_delete_gestor"
  ON public.cafe_sheets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE public.cafe_sheets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_sheets;

-- ── GRANTs ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_sheets TO service_role;
