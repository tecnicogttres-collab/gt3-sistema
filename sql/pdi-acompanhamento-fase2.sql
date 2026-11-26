-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — PDI de acompanhamento (Fase 2)
-- Liga respostas de pesquisas (Questionários) a competências do PDI,
-- com uma leitura da gestão. Rodar no SQL Editor do Supabase. Idempotente.
--
-- Para desfazer:  DROP TABLE IF EXISTS public.pdi_pesquisa_vinculos;
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pdi_pesquisa_vinculos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id        TEXT        NOT NULL,
  convite_id    UUID        NOT NULL REFERENCES public.questionario_convites(id) ON DELETE CASCADE,
  pergunta_id   TEXT        NOT NULL DEFAULT '',   -- '' = a pesquisa inteira
  competencia   TEXT        NOT NULL,
  leitura       TEXT        NOT NULL DEFAULT '',   -- interpretação da gestão (só gestão vê)
  autor_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  autor_nome    TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (convite_id, pergunta_id, competencia)
);
CREATE INDEX IF NOT EXISTS pdi_pesquisa_vinculos_pdi_idx ON public.pdi_pesquisa_vinculos(pdi_id);

ALTER TABLE public.pdi_pesquisa_vinculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pdi_pesquisa_vinculos_gestor ON public.pdi_pesquisa_vinculos;
CREATE POLICY pdi_pesquisa_vinculos_gestor ON public.pdi_pesquisa_vinculos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_pesquisa_vinculos TO authenticated, service_role;
