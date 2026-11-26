-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — PDI de acompanhamento (Fase 1)
-- Etapas das ações, Diário (anotações + pontos a investigar) e histórico.
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Para desfazer (voltar ao PDI como era):
--   DROP TABLE IF EXISTS public.pdi_historico, public.pdi_anotacoes, public.pdi_etapas;
--   ALTER TABLE public.pdi_acoes DROP COLUMN IF EXISTS resultado_alcancado,
--                                DROP COLUMN IF EXISTS evidencia;
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Ações: resultado alcançado e evidência (trava para concluir) ──
ALTER TABLE public.pdi_acoes
  ADD COLUMN IF NOT EXISTS resultado_alcancado TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidencia           TEXT NOT NULL DEFAULT '';

-- ── 2. Etapas de cada ação (checklist) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.pdi_etapas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id        TEXT        NOT NULL,
  acao_id       UUID        NOT NULL REFERENCES public.pdi_acoes(id) ON DELETE CASCADE,
  titulo        TEXT        NOT NULL DEFAULT '',
  -- '' = não marcada · ok = feita · parcial = em andamento · travada · na = não se aplica
  status        TEXT        NOT NULL DEFAULT ''
                  CHECK (status IN ('', 'ok', 'parcial', 'travada', 'na')),
  responsavel   TEXT        NOT NULL DEFAULT '',
  prazo         DATE,
  obs           TEXT        NOT NULL DEFAULT '',
  ordem         INT         NOT NULL DEFAULT 0,
  concluido_em  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pdi_etapas_pdi_idx  ON public.pdi_etapas(pdi_id);
CREATE INDEX IF NOT EXISTS pdi_etapas_acao_idx ON public.pdi_etapas(acao_id, ordem);

-- ── 3. Diário: anotações datadas e pontos a investigar ───────────────
CREATE TABLE IF NOT EXISTS public.pdi_anotacoes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id        TEXT        NOT NULL,
  -- conversa · feedback · conquista · atencao · observacao · investigar
  tipo          TEXT        NOT NULL DEFAULT 'observacao',
  data          DATE        NOT NULL DEFAULT CURRENT_DATE,
  texto         TEXT        NOT NULL DEFAULT '',
  visivel       BOOLEAN     NOT NULL DEFAULT FALSE,   -- false = só gestão
  acao_id       UUID        REFERENCES public.pdi_acoes(id) ON DELETE SET NULL,
  competencia   TEXT        NOT NULL DEFAULT '',
  -- só para tipo 'investigar'
  resolvido     BOOLEAN     NOT NULL DEFAULT FALSE,
  resposta      TEXT        NOT NULL DEFAULT '',
  resolvido_em  TIMESTAMPTZ,
  autor_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  autor_nome    TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pdi_anotacoes_pdi_idx ON public.pdi_anotacoes(pdi_id, data DESC);

-- ── 4. Histórico: quem fez o quê e quando ────────────────────────────
CREATE TABLE IF NOT EXISTS public.pdi_historico (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id        TEXT        NOT NULL,
  acao_id       UUID        REFERENCES public.pdi_acoes(id) ON DELETE CASCADE,
  evento        TEXT        NOT NULL,
  detalhe       TEXT        NOT NULL DEFAULT '',
  usuario_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  usuario_nome  TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pdi_historico_pdi_idx ON public.pdi_historico(pdi_id, created_at DESC);

-- ── 5. RLS (o app acessa pelas rotas /api com a chave de serviço; isto é defesa extra) ──
ALTER TABLE public.pdi_etapas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_anotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdi_etapas_gestor ON public.pdi_etapas;
CREATE POLICY pdi_etapas_gestor ON public.pdi_etapas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));
DROP POLICY IF EXISTS pdi_etapas_colab ON public.pdi_etapas;
CREATE POLICY pdi_etapas_colab ON public.pdi_etapas FOR SELECT
  USING (pdi_id = (SELECT pdi_slug FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS pdi_anotacoes_gestor ON public.pdi_anotacoes;
CREATE POLICY pdi_anotacoes_gestor ON public.pdi_anotacoes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));
DROP POLICY IF EXISTS pdi_anotacoes_colab ON public.pdi_anotacoes;
CREATE POLICY pdi_anotacoes_colab ON public.pdi_anotacoes FOR SELECT
  USING (visivel AND pdi_id = (SELECT pdi_slug FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS pdi_historico_gestor ON public.pdi_historico;
CREATE POLICY pdi_historico_gestor ON public.pdi_historico FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_etapas, public.pdi_anotacoes, public.pdi_historico TO authenticated, service_role;
