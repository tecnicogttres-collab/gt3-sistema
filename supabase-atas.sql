-- Execute uma vez no SQL Editor do Supabase

-- 1. Tabela de atas
CREATE TABLE IF NOT EXISTS atas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo     TEXT,
  conteudo   TEXT NOT NULL DEFAULT '',
  data       DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'Rascunho'
               CHECK (status IN ('Rascunho', 'Aguardando Validação', 'Validada')),
  autor_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- REPLICA IDENTITY FULL necessário para filtrar UPDATEs por coluna no Realtime
ALTER TABLE atas REPLICA IDENTITY FULL;

-- 2. Tabela de leituras (quem leu qual ata)
CREATE TABLE IF NOT EXISTS atas_leituras (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id  UUID NOT NULL REFERENCES atas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lido_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE (ata_id, user_id)
);

ALTER TABLE atas_leituras REPLICA IDENTITY FULL;

-- 3. RLS
ALTER TABLE atas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atas_select"  ON atas FOR SELECT TO authenticated USING (true);
CREATE POLICY "atas_insert"  ON atas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "atas_update"  ON atas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "atas_delete"  ON atas FOR DELETE TO authenticated USING (true);

ALTER TABLE atas_leituras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atas_leituras_select" ON atas_leituras FOR SELECT TO authenticated USING (true);
CREATE POLICY "atas_leituras_insert" ON atas_leituras FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE atas;
ALTER PUBLICATION supabase_realtime ADD TABLE atas_leituras;
