-- ── Coisas a Fazer ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_modulos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  criado_por TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caf_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id      UUID NOT NULL REFERENCES caf_modulos(id) ON DELETE CASCADE,
  texto          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'finalizado')),
  origem         TEXT NOT NULL DEFAULT 'interna' CHECK (origem IN ('interna', 'sugestao')),
  autor          TEXT NOT NULL,
  criado_em      TIMESTAMPTZ DEFAULT now(),
  finalizado_por TEXT,
  finalizado_em  TIMESTAMPTZ
);

-- RLS
ALTER TABLE caf_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE caf_itens   ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ler
CREATE POLICY "caf_modulos_select" ON caf_modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY "caf_itens_select"   ON caf_itens   FOR SELECT TO authenticated USING (true);

-- Admin e gestor podem inserir/atualizar módulos
CREATE POLICY "caf_modulos_insert" ON caf_modulos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND papel IN ('admin', 'gestor'))
  );

-- Qualquer autenticado pode inserir itens (sugestões também)
CREATE POLICY "caf_itens_insert" ON caf_itens FOR INSERT TO authenticated WITH CHECK (true);

-- Só admin/gestor podem atualizar status dos itens
CREATE POLICY "caf_itens_update" ON caf_itens FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND papel IN ('admin', 'gestor'))
  );

-- Seed inicial com módulos do sistema
INSERT INTO caf_modulos (nome, criado_por) VALUES
  ('Observações',          'Rodrigo'),
  ('PDI',                  'Rodrigo'),
  ('Cadastro Contratantes','Rodrigo'),
  ('E-mails Padrão',       'Rodrigo'),
  ('Atas Contratantes',    'Rodrigo'),
  ('Revisões Documentos',  'Rodrigo')
ON CONFLICT DO NOTHING;
