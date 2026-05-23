-- ═══════════════════════════════════════════════════════════════
-- GT3 — PDI Ciclos de Avaliação
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE pdi_ciclos (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id                TEXT        NOT NULL,
  colaborador_id        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  numero_ciclo          INT         NOT NULL DEFAULT 1,
  status                TEXT        NOT NULL DEFAULT 'ativo'
                          CHECK (status IN ('ativo', 'arquivado')),
  -- Scores como arrays de números (índice = posição na lista de competências)
  avaliacao_diretiva    JSONB       NOT NULL DEFAULT '[]',
  autoavaliacao         JSONB       NOT NULL DEFAULT '[]',
  ambicao               JSONB       NOT NULL DEFAULT '[]',
  autoavaliacao_salva   BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Agendamento de conversa
  data_conversa         TIMESTAMPTZ,
  conversa_confirmada_em TIMESTAMPTZ,
  -- Metadados
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por            UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  arquivado_em          TIMESTAMPTZ,
  UNIQUE (pdi_id, numero_ciclo)
);

ALTER TABLE pdi_ciclos REPLICA IDENTITY FULL;

CREATE INDEX pdi_ciclos_pdi_id_idx ON pdi_ciclos(pdi_id);
CREATE INDEX pdi_ciclos_colaborador_idx ON pdi_ciclos(colaborador_id);

-- Tabela para broadcast Realtime de agendamento de conversa
CREATE TABLE pdi_conversa_avisos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id        UUID        NOT NULL REFERENCES pdi_ciclos(id) ON DELETE CASCADE,
  colaborador_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data_conversa   TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE pdi_ciclos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdi_ciclos_select_colab" ON pdi_ciclos FOR SELECT
  USING (colaborador_id = auth.uid());

CREATE POLICY "pdi_ciclos_select_gestor" ON pdi_ciclos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')
  ));

CREATE POLICY "pdi_ciclos_insert_gestor" ON pdi_ciclos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')
  ));

CREATE POLICY "pdi_ciclos_update_all" ON pdi_ciclos FOR UPDATE
  USING (
    colaborador_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND papel IN ('gestor','admin'))
  );

CREATE POLICY "pdi_ciclos_delete_gestor" ON pdi_ciclos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')
  ));

ALTER TABLE pdi_conversa_avisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdi_conversa_avisos_select" ON pdi_conversa_avisos FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "pdi_conversa_avisos_insert" ON pdi_conversa_avisos FOR INSERT
  TO authenticated WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pdi_ciclos;
ALTER PUBLICATION supabase_realtime ADD TABLE pdi_conversa_avisos;
