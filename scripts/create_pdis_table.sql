-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — PDI: tabela de PDIs dinâmicos + coluna tipo em notificações
-- Rodar no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tabela pdis ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pdis (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           TEXT         NOT NULL,
  funcao         TEXT         NOT NULL DEFAULT '',
  data_inicio    DATE,
  observacao     TEXT                     DEFAULT '',
  colaborador_id UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_por     UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL    DEFAULT NOW()
);

ALTER TABLE public.pdis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdis_select_colab" ON public.pdis FOR SELECT
  USING (colaborador_id = auth.uid());

CREATE POLICY "pdis_select_gestor" ON public.pdis FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')
  ));

CREATE POLICY "pdis_insert_gestor" ON public.pdis FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')
  ));

CREATE POLICY "pdis_update_gestor" ON public.pdis FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')
  ));

CREATE POLICY "pdis_delete_gestor" ON public.pdis FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')
  ));

-- ── 2. Adiciona coluna tipo em pdi_notificacoes ─────────────────────

ALTER TABLE public.pdi_notificacoes
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'atualizado'
    CHECK (tipo IN ('criado', 'atualizado'));

-- ── GRANTs ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdis TO service_role;
