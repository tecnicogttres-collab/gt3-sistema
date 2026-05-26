-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Prioridades: dados principais, RLS e Realtime
-- Nota: updated_at é gerenciado manualmente pelo cliente (não via trigger)
-- para evitar que reordenações por drag-drop atualizem o timestamp de conteúdo.

CREATE TABLE IF NOT EXISTS public.prioridades (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa     TEXT        NOT NULL DEFAULT '',
  contratante TEXT        NOT NULL DEFAULT '',
  responsavel TEXT        NOT NULL DEFAULT '',
  posicao     INTEGER     NOT NULL DEFAULT 0,
  status_feed JSONB       NOT NULL DEFAULT '[]',
  historico   JSONB       NOT NULL DEFAULT '[]',
  criado_por  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prioridades_posicao ON public.prioridades(posicao);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.prioridades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prioridades_select"        ON public.prioridades;
DROP POLICY IF EXISTS "prioridades_insert_gestor" ON public.prioridades;
DROP POLICY IF EXISTS "prioridades_update_gestor" ON public.prioridades;
DROP POLICY IF EXISTS "prioridades_delete_gestor" ON public.prioridades;

CREATE POLICY "prioridades_select"
  ON public.prioridades FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "prioridades_insert_gestor"
  ON public.prioridades FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "prioridades_update_gestor"
  ON public.prioridades FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "prioridades_delete_gestor"
  ON public.prioridades FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE public.prioridades REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prioridades;
