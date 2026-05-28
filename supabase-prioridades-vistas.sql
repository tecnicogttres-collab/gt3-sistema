-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Prioridades Vistas: registra quais avisos cada usuário já visualizou

CREATE TABLE IF NOT EXISTS public.prioridades_vistas (
  aviso_id  UUID        NOT NULL REFERENCES public.prioridades_avisos(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visto_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (aviso_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prioridades_vistas_user ON public.prioridades_vistas(user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.prioridades_vistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prioridades_vistas_select" ON public.prioridades_vistas;
DROP POLICY IF EXISTS "prioridades_vistas_insert" ON public.prioridades_vistas;

CREATE POLICY "prioridades_vistas_select"
  ON public.prioridades_vistas FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "prioridades_vistas_insert"
  ON public.prioridades_vistas FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── GRANTs ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades_vistas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades_vistas TO service_role;
