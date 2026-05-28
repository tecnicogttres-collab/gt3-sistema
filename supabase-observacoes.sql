-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — Observações: tabela e políticas RLS
-- Rodar no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.observacoes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria   TEXT        NOT NULL,
  subtab      TEXT        NOT NULL,
  coluna      TEXT        NOT NULL,
  motivo      TEXT        NOT NULL DEFAULT '',
  parecer     TEXT        NOT NULL DEFAULT '',
  group_name  TEXT,
  criado_por  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  editado_por UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS observacoes_categoria_idx ON public.observacoes(categoria);
CREATE INDEX IF NOT EXISTS observacoes_subtab_idx    ON public.observacoes(categoria, subtab);

-- Trigger updated_at (reutiliza função criada pelo módulo PDI; cria se não existir)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS observacoes_updated_at ON public.observacoes;
CREATE TRIGGER observacoes_updated_at
  BEFORE UPDATE ON public.observacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.observacoes ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado lê
CREATE POLICY "authenticated_read_observacoes"
  ON public.observacoes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Qualquer usuário autenticado insere (colaborador cria "Favor rever:", gestor/admin criam livremente)
CREATE POLICY "authenticated_insert_observacoes"
  ON public.observacoes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Apenas gestor e admin atualizam
CREATE POLICY "gestor_admin_update_observacoes"
  ON public.observacoes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- Apenas gestor e admin deletam
CREATE POLICY "gestor_admin_delete_observacoes"
  ON public.observacoes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── GRANTs ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observacoes TO service_role;
