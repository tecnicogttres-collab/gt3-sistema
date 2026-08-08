-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Dashboard Prefs: ordenação dos cards de módulo no Dashboard, por usuário

CREATE TABLE IF NOT EXISTS public.dashboard_prefs (
  user_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  modo        TEXT NOT NULL DEFAULT 'padrao' CHECK (modo IN ('padrao', 'az', 'za', 'personalizado')),
  ordem       TEXT[] NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Cada usuário só enxerga e altera a própria preferência.

ALTER TABLE public.dashboard_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_prefs_select" ON public.dashboard_prefs;
DROP POLICY IF EXISTS "dashboard_prefs_insert" ON public.dashboard_prefs;
DROP POLICY IF EXISTS "dashboard_prefs_update" ON public.dashboard_prefs;

CREATE POLICY "dashboard_prefs_select"
  ON public.dashboard_prefs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "dashboard_prefs_insert"
  ON public.dashboard_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "dashboard_prefs_update"
  ON public.dashboard_prefs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── GRANTs ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_prefs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_prefs TO service_role;
