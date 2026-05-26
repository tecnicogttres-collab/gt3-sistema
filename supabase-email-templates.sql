-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Templates de E-mail: biblioteca de modelos .msg por categoria

CREATE TABLE IF NOT EXISTS public.email_templates (
  id          TEXT        PRIMARY KEY,
  title       TEXT        NOT NULL,
  client      TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'Outros',
  subject     TEXT        NOT NULL DEFAULT '',
  tags        JSONB       NOT NULL DEFAULT '[]',
  notes       TEXT        NOT NULL DEFAULT '',
  file        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_client   ON public.email_templates(client);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON public.email_templates(category);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_templates_updated_at ON public.email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "et_select"        ON public.email_templates;
DROP POLICY IF EXISTS "et_insert_gestor" ON public.email_templates;
DROP POLICY IF EXISTS "et_update_gestor" ON public.email_templates;
DROP POLICY IF EXISTS "et_delete_gestor" ON public.email_templates;

CREATE POLICY "et_select"
  ON public.email_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "et_insert_gestor"
  ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "et_update_gestor"
  ON public.email_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "et_delete_gestor"
  ON public.email_templates FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE public.email_templates REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_templates;
