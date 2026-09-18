-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Designação de Reprovados: setores, documentos, situações,
-- matriz de pertinência, empresas e designações (com histórico de tratativa)

CREATE TABLE IF NOT EXISTS public.desig_setores (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.desig_documentos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id    UUID        NOT NULL REFERENCES public.desig_setores(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL,
  ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_desig_documentos_setor ON public.desig_documentos(setor_id);

CREATE TABLE IF NOT EXISTS public.desig_situacoes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  cor         TEXT        NOT NULL DEFAULT '#64748B',
  ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matriz de pertinência: quem é liberado como responsável ao flegar cada setor
CREATE TABLE IF NOT EXISTS public.desig_pertinencia (
  setor_id    UUID NOT NULL REFERENCES public.desig_setores(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (setor_id, usuario_id)
);

-- Empresas/prestadoras — lista própria deste módulo (não espelha Cadastro Terceiras)
CREATE TABLE IF NOT EXISTS public.desig_empresas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT        NOT NULL,
  contratante  TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.designacoes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa           TEXT        NOT NULL,
  contratante       TEXT        NOT NULL DEFAULT '',
  setores           JSONB       NOT NULL DEFAULT '[]',  -- [setor_id, ...]
  documentos        JSONB       NOT NULL DEFAULT '[]',  -- [documento_id, ...]
  situacao_id       UUID        REFERENCES public.desig_situacoes(id),
  responsaveis      JSONB       NOT NULL DEFAULT '[]',  -- [usuario_id, ...]
  motivo            TEXT        NOT NULL DEFAULT '',
  data_verificacao  DATE        NOT NULL DEFAULT CURRENT_DATE,
  tratativa         TEXT        NOT NULL DEFAULT 'aguardando'
                     CHECK (tratativa IN ('aguardando','ciente','andamento','resolvido')),
  ciencia_por       JSONB       NOT NULL DEFAULT '[]',  -- [usuario_id, ...]
  criado_por        UUID        NOT NULL REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_designacoes_tratativa ON public.designacoes(tratativa);
CREATE INDEX IF NOT EXISTS idx_designacoes_data      ON public.designacoes(data_verificacao);

CREATE TABLE IF NOT EXISTS public.designacoes_historico (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  designacao_id  UUID        NOT NULL REFERENCES public.designacoes(id) ON DELETE CASCADE,
  por            UUID        NOT NULL REFERENCES public.profiles(id),
  acao           TEXT        NOT NULL,
  em             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_desig_historico_designacao ON public.designacoes_historico(designacao_id);

-- Trigger updated_at (mesma função já usada em outros módulos; CREATE OR REPLACE
-- deixa este arquivo autocontido mesmo que a função já exista)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS designacoes_updated_at ON public.designacoes;
CREATE TRIGGER designacoes_updated_at
  BEFORE UPDATE ON public.designacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Padrão do sistema: RLS permissiva (USING (true)); autorização real é feita nas
-- rotas de API via getCaller()/requireGestorAdmin() com o client admin (service role).

ALTER TABLE public.desig_setores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desig_documentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desig_situacoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desig_pertinencia     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desig_empresas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designacoes_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desig_setores_all"         ON public.desig_setores;
DROP POLICY IF EXISTS "desig_documentos_all"      ON public.desig_documentos;
DROP POLICY IF EXISTS "desig_situacoes_all"       ON public.desig_situacoes;
DROP POLICY IF EXISTS "desig_pertinencia_all"     ON public.desig_pertinencia;
DROP POLICY IF EXISTS "desig_empresas_all"        ON public.desig_empresas;
DROP POLICY IF EXISTS "designacoes_all"           ON public.designacoes;
DROP POLICY IF EXISTS "designacoes_historico_all" ON public.designacoes_historico;

CREATE POLICY "desig_setores_all"         ON public.desig_setores         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "desig_documentos_all"      ON public.desig_documentos      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "desig_situacoes_all"       ON public.desig_situacoes       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "desig_pertinencia_all"     ON public.desig_pertinencia     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "desig_empresas_all"        ON public.desig_empresas        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "designacoes_all"           ON public.designacoes           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "designacoes_historico_all" ON public.designacoes_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);
