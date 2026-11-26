-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — PDI de acompanhamento (Fase 3): registro rápido por pop-up
-- Configuração por PDI (começa DESLIGADA) e respostas do colaborador por ação.
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Para desfazer:
--   DROP TABLE IF EXISTS public.pdi_checkins, public.pdi_checkin_config;
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pdi_checkin_config (
  pdi_id        TEXT        PRIMARY KEY,
  ativo         BOOLEAN     NOT NULL DEFAULT FALSE,
  frequencia    TEXT        NOT NULL DEFAULT 'semanal' CHECK (frequencia IN ('semanal', 'quinzenal')),
  dia_semana    SMALLINT    NOT NULL DEFAULT 5 CHECK (dia_semana BETWEEN 1 AND 5),  -- 1 = segunda … 5 = sexta
  hora          SMALLINT    NOT NULL DEFAULT 10 CHECK (hora BETWEEN 7 AND 18),      -- a partir de (horário de Brasília)
  inicio        DATE        NOT NULL DEFAULT CURRENT_DATE,                          -- âncora da quinzena
  acoes         UUID[],                                                             -- NULL = todas as ações ativas
  updated_por   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pdi_checkins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id        TEXT        NOT NULL,
  acao_id       UUID        NOT NULL REFERENCES public.pdi_acoes(id) ON DELETE CASCADE,
  periodo_ref   DATE        NOT NULL,
  situacao      TEXT        NOT NULL CHECK (situacao IN ('avancei', 'travei', 'nao_mexi')),
  nota          TEXT        NOT NULL DEFAULT '',
  usuario_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  usuario_nome  TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (acao_id, periodo_ref)
);
CREATE INDEX IF NOT EXISTS pdi_checkins_pdi_idx ON public.pdi_checkins(pdi_id, periodo_ref DESC);

ALTER TABLE public.pdi_checkin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_checkins       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdi_checkin_config_gestor ON public.pdi_checkin_config;
CREATE POLICY pdi_checkin_config_gestor ON public.pdi_checkin_config FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

DROP POLICY IF EXISTS pdi_checkins_gestor ON public.pdi_checkins;
CREATE POLICY pdi_checkins_gestor ON public.pdi_checkins FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));
DROP POLICY IF EXISTS pdi_checkins_colab ON public.pdi_checkins;
CREATE POLICY pdi_checkins_colab ON public.pdi_checkins FOR SELECT
  USING (pdi_id = (SELECT pdi_slug FROM public.profiles WHERE id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_checkin_config, public.pdi_checkins TO authenticated, service_role;
