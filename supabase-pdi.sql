-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — PDI: tabelas e políticas RLS
-- Rodar no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tabela pdi_acoes ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pdi_acoes (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id               TEXT         NOT NULL,
  competencia          TEXT         NOT NULL DEFAULT '',
  desenvolver          TEXT         NOT NULL DEFAULT '',
  acoes                TEXT         NOT NULL DEFAULT '',
  resultados_esperados TEXT         NOT NULL DEFAULT '',
  inicio               TEXT         NOT NULL DEFAULT '',
  termino              TEXT         NOT NULL DEFAULT '',
  status               TEXT         NOT NULL DEFAULT '',
  concluido_em         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pdi_acoes_pdi_id_idx ON public.pdi_acoes(pdi_id);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pdi_acoes_updated_at ON public.pdi_acoes;
CREATE TRIGGER pdi_acoes_updated_at
  BEFORE UPDATE ON public.pdi_acoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.pdi_acoes ENABLE ROW LEVEL SECURITY;

-- Colaborador lê apenas ações do próprio PDI
CREATE POLICY "colaborador_read_own_pdi_acoes"
  ON public.pdi_acoes FOR SELECT
  USING (
    pdi_id = (
      SELECT pdi_slug FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Gestor e admin leem tudo
CREATE POLICY "gestor_admin_read_pdi_acoes"
  ON public.pdi_acoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- Gestor e admin podem inserir
CREATE POLICY "gestor_admin_insert_pdi_acoes"
  ON public.pdi_acoes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- Gestor e admin podem atualizar
CREATE POLICY "gestor_admin_update_pdi_acoes"
  ON public.pdi_acoes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- Gestor e admin podem deletar
CREATE POLICY "gestor_admin_delete_pdi_acoes"
  ON public.pdi_acoes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );


-- ── 2. Tabela pdi_notificacoes ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pdi_notificacoes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id           TEXT        NOT NULL,
  colaborador_id   UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  visto            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pdi_notificacoes_colaborador_idx
  ON public.pdi_notificacoes(colaborador_id, visto);

-- RLS
ALTER TABLE public.pdi_notificacoes ENABLE ROW LEVEL SECURITY;

-- Colaborador lê e atualiza suas próprias notificações
CREATE POLICY "colaborador_read_own_notificacoes"
  ON public.pdi_notificacoes FOR SELECT
  USING (colaborador_id = auth.uid());

CREATE POLICY "colaborador_update_own_notificacoes"
  ON public.pdi_notificacoes FOR UPDATE
  USING (colaborador_id = auth.uid());

-- Gestor e admin inserem notificações
CREATE POLICY "gestor_admin_insert_notificacoes"
  ON public.pdi_notificacoes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- Gestor e admin leem todas (auditoria)
CREATE POLICY "gestor_admin_read_notificacoes"
  ON public.pdi_notificacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── GRANTs ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_acoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_acoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_notificacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_notificacoes TO service_role;
