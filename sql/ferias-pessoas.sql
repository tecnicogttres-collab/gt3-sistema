-- Colaboradores extras adicionados via UI no calendário de férias
CREATE TABLE IF NOT EXISTS public.ferias_pessoas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL UNIQUE,
  cor        TEXT        NOT NULL DEFAULT '#607D8B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ferias_pessoas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ferias_pessoas_select" ON ferias_pessoas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ferias_pessoas_insert" ON ferias_pessoas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ferias_pessoas_delete" ON ferias_pessoas
  FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, DELETE ON public.ferias_pessoas TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ferias_pessoas TO service_role;
