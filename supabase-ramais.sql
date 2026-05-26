-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Ramais: lista de ramais internos

CREATE TABLE IF NOT EXISTS public.ramais (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  numero      TEXT        NOT NULL,
  setor       TEXT        NOT NULL DEFAULT '',
  observacao  TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ramais_nome ON public.ramais(nome);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ramais_updated_at ON public.ramais;
CREATE TRIGGER ramais_updated_at
  BEFORE UPDATE ON public.ramais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.ramais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rm_select"        ON public.ramais;
DROP POLICY IF EXISTS "rm_insert_gestor" ON public.ramais;
DROP POLICY IF EXISTS "rm_update_gestor" ON public.ramais;
DROP POLICY IF EXISTS "rm_delete_gestor" ON public.ramais;

CREATE POLICY "rm_select"
  ON public.ramais FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rm_insert_gestor"
  ON public.ramais FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "rm_update_gestor"
  ON public.ramais FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "rm_delete_gestor"
  ON public.ramais FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE public.ramais REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ramais;

-- ── Seed data ─────────────────────────────────────────────────────────────────

INSERT INTO public.ramais (nome, numero) VALUES
  ('Ana Paula Souza', '1001'),
  ('Carlos Menezes',  '1002'),
  ('Fernanda Lima',   '1003')
ON CONFLICT DO NOTHING;
