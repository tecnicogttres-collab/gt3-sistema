-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — Observações: colunas de edição e validação
-- Rodar no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.observacoes
  ADD COLUMN IF NOT EXISTS atualizado_por  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atualizado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_edicao   TEXT        NOT NULL DEFAULT 'original'
    CHECK (status_edicao IN ('original', 'pendente_validacao', 'validado'));

-- RLS: qualquer authenticated pode atualizar observações próprias
CREATE POLICY "authenticated_update_own_observacoes"
  ON public.observacoes FOR UPDATE
  USING (criado_por = auth.uid())
  WITH CHECK (criado_por = auth.uid());
