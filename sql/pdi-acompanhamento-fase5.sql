-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — PDI (Fase 5): pop-ups de acompanhamento configuráveis
-- Vários pop-ups por PDI, cada um com perguntas próprias (status das ações,
-- humor, escala, escolha, sim/não, texto) e agenda própria (semanal, quinzenal,
-- mensal, diária, datas, aleatória dentro de uma janela). Substitui a
-- configuração única da Fase 3 (pdi_checkin_config, que estava vazia).
-- As respostas de "status das ações" continuam indo também para pdi_checkins.
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Para desfazer:
--   DROP TABLE IF EXISTS public.pdi_popup_respostas, public.pdi_popups;
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pdi_popups (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id        TEXT        NOT NULL,
  titulo        TEXT        NOT NULL DEFAULT '',
  intro         TEXT        NOT NULL DEFAULT '',
  icone         TEXT        NOT NULL DEFAULT '⚡',
  cor           TEXT        NOT NULL DEFAULT '#2A4F96',
  ativo         BOOLEAN     NOT NULL DEFAULT FALSE,
  perguntas     JSONB       NOT NULL DEFAULT '[]',
  agenda        JSONB       NOT NULL DEFAULT '{}',
  comportamento JSONB       NOT NULL DEFAULT '{}',
  criado_por    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pdi_popups_pdi_idx ON public.pdi_popups(pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_popup_respostas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id      UUID        NOT NULL REFERENCES public.pdi_popups(id) ON DELETE CASCADE,
  pdi_id        TEXT        NOT NULL,
  ocorrencia    TIMESTAMPTZ NOT NULL,          -- abertura a que a resposta se refere
  respostas     JSONB       NOT NULL DEFAULT '{}',
  usuario_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  usuario_nome  TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (popup_id, ocorrencia)
);
CREATE INDEX IF NOT EXISTS pdi_popup_respostas_pdi_idx ON public.pdi_popup_respostas(pdi_id, created_at DESC);

ALTER TABLE public.pdi_popups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_popup_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdi_popups_gestor ON public.pdi_popups;
CREATE POLICY pdi_popups_gestor ON public.pdi_popups FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

DROP POLICY IF EXISTS pdi_popup_respostas_gestor ON public.pdi_popup_respostas;
CREATE POLICY pdi_popup_respostas_gestor ON public.pdi_popup_respostas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));
DROP POLICY IF EXISTS pdi_popup_respostas_colab ON public.pdi_popup_respostas;
CREATE POLICY pdi_popup_respostas_colab ON public.pdi_popup_respostas FOR SELECT
  USING (pdi_id = (SELECT pdi_slug FROM public.profiles WHERE id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_popups, public.pdi_popup_respostas TO authenticated, service_role;
