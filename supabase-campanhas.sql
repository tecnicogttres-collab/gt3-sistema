-- Módulo Campanhas — execute uma vez no SQL Editor do Supabase.

-- 1. Categorias (cor da etiqueta; a cor da barra de aviso é por campanha)
CREATE TABLE IF NOT EXISTS campanhas_categorias (
  id     TEXT PRIMARY KEY,
  label  TEXT NOT NULL,
  color  TEXT NOT NULL DEFAULT '#4A5568',
  bg     TEXT NOT NULL DEFAULT '#EDF2F7',
  ordem  INT  NOT NULL DEFAULT 0
);

INSERT INTO campanhas_categorias (id, label, color, bg, ordem) VALUES
  ('saude',       'Saúde',       '#B83280', '#FFF0F6', 1),
  ('seguranca',   'Segurança',   '#B7410E', '#FFF7ED', 2),
  ('comunicado',  'Comunicado',  '#2A4F96', '#E5EEFB', 3),
  ('evento',      'Evento',      '#6B46C1', '#F1E9FB', 4)
ON CONFLICT (id) DO NOTHING;

-- 2. Campanhas
CREATE TABLE IF NOT EXISTS campanhas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT NOT NULL,
  descricao     TEXT,
  link          TEXT NOT NULL,
  categoria     TEXT NOT NULL,
  cor           TEXT NOT NULL DEFAULT '#B45309',  -- cor da barra de aviso no topo da tela
  autor_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  autor_nome    TEXT,
  data          DATE NOT NULL DEFAULT CURRENT_DATE,
  destinatarios TEXT[] NOT NULL DEFAULT '{todos}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. Quem abriu o link (= leu). Só entra aqui quando a pessoa abre a divulgação.
CREATE TABLE IF NOT EXISTS campanhas_lidas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lido_em     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campanha_id, user_id)
);

ALTER TABLE campanhas_lidas REPLICA IDENTITY FULL;

-- 4. RLS (gravações passam pelas APIs com service_role)
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campanhas_select" ON campanhas FOR SELECT TO authenticated USING (true);

ALTER TABLE campanhas_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campanhas_categorias_select" ON campanhas_categorias FOR SELECT TO authenticated USING (true);

ALTER TABLE campanhas_lidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campanhas_lidas_select" ON campanhas_lidas FOR SELECT TO authenticated USING (true);

-- 5. Realtime (aviso aparece na hora para quem está com o sistema aberto)
ALTER PUBLICATION supabase_realtime ADD TABLE campanhas;
ALTER PUBLICATION supabase_realtime ADD TABLE campanhas_lidas;

-- ── GRANTs ───────────────────────────────────────────────────────
GRANT SELECT ON public.campanhas, public.campanhas_categorias, public.campanhas_lidas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas_categorias TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas_lidas TO service_role;
