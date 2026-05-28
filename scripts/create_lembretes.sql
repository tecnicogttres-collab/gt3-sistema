-- Tabela de lembretes globais da equipe GT3
CREATE TABLE IF NOT EXISTS lembretes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT        NOT NULL,
  descricao   TEXT,
  periodo     TEXT        NOT NULL DEFAULT 'unico'
                          CHECK (periodo IN ('unico','diario','semanal','mensal','trimestral','semestral','anual')),
  data_inicio DATE        NOT NULL,
  concluido   BOOLEAN     NOT NULL DEFAULT false,
  criado_por  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: todos os usuários autenticados podem ler e escrever (tabela global de equipe)
ALTER TABLE lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lembretes_select" ON lembretes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lembretes_insert" ON lembretes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "lembretes_update" ON lembretes
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "lembretes_delete" ON lembretes
  FOR DELETE TO authenticated USING (true);

-- ── GRANTs ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes TO service_role;
