-- ================================================================
-- GT3 Sistema — Migração: Revisões Trainee
-- Rodar no Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================

-- 1. Atualizar constraint de papel em profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_papel_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_papel_check
  CHECK (papel IN ('colaborador', 'gestor', 'admin', 'trainee'));

-- ================================================================
-- 2. Tabela revisoes_datas
-- ================================================================
CREATE TABLE IF NOT EXISTS revisoes_datas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data           DATE        NOT NULL UNIQUE,
  finalizado     BOOLEAN     NOT NULL DEFAULT FALSE,
  finalizado_por UUID        REFERENCES profiles(id),
  finalizado_em  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE revisoes_datas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE revisoes_datas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revisoes_datas_select"      ON revisoes_datas;
DROP POLICY IF EXISTS "revisoes_datas_service_all" ON revisoes_datas;

CREATE POLICY "revisoes_datas_select"
  ON revisoes_datas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "revisoes_datas_service_all"
  ON revisoes_datas FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ================================================================
-- 3. Tabela revisoes_trainee
-- ================================================================
CREATE TABLE IF NOT EXISTS revisoes_trainee (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data           DATE        NOT NULL,
  empresa        TEXT        NOT NULL DEFAULT '',
  colaborador    TEXT        NOT NULL DEFAULT '',
  documento      TEXT        NOT NULL DEFAULT '',
  criado_por     UUID        NOT NULL REFERENCES profiles(id),
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'red', 'yellow', 'green')),
  nota_revisor   TEXT,
  revisado_por   UUID        REFERENCES profiles(id),
  revisado_em    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rev_trainee_data       ON revisoes_trainee(data);
CREATE INDEX IF NOT EXISTS idx_rev_trainee_criado_por ON revisoes_trainee(criado_por);

ALTER TABLE revisoes_trainee ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 4. Políticas RLS — revisoes_trainee
-- ================================================================
DROP POLICY IF EXISTS "rev_trainee_select"      ON revisoes_trainee;
DROP POLICY IF EXISTS "rev_trainee_insert"      ON revisoes_trainee;
DROP POLICY IF EXISTS "rev_trainee_update"      ON revisoes_trainee;
DROP POLICY IF EXISTS "rev_trainee_service_all" ON revisoes_trainee;

-- Trainee vê apenas os próprios; colaborador/gestor/admin vê todos
CREATE POLICY "rev_trainee_select"
  ON revisoes_trainee FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.papel IN ('colaborador', 'gestor', 'admin')
    )
    OR criado_por = auth.uid()
  );

-- Qualquer autenticado insere, mas criado_por deve ser o próprio uid
CREATE POLICY "rev_trainee_insert"
  ON revisoes_trainee FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

-- Apenas revisor/gestor/admin podem preencher nota e status
CREATE POLICY "rev_trainee_update"
  ON revisoes_trainee FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.papel IN ('colaborador', 'gestor', 'admin')
    )
  );

-- Acesso total via rotas de API server-side
CREATE POLICY "rev_trainee_service_all"
  ON revisoes_trainee FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── GRANTs ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisoes_datas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisoes_datas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisoes_trainee TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisoes_trainee TO service_role;
