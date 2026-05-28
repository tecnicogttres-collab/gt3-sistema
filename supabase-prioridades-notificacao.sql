-- Execute uma vez no SQL Editor do Supabase
-- Tabela de broadcast para notificações de novas prioridades

CREATE TABLE IF NOT EXISTS prioridades_avisos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: qualquer usuário autenticado pode ler e inserir
ALTER TABLE prioridades_avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prioridades_avisos_select" ON prioridades_avisos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "prioridades_avisos_insert" ON prioridades_avisos
  FOR INSERT TO authenticated WITH CHECK (true);

-- Habilitar Realtime para esta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE prioridades_avisos;

-- ── GRANTs ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades_avisos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades_avisos TO service_role;
