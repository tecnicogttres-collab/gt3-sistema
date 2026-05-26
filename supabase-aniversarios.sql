-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Aniversários: calendário de aniversários dos colaboradores

CREATE TABLE IF NOT EXISTS public.aniversarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  dia        INTEGER     NOT NULL CHECK (dia >= 1 AND dia <= 31),
  mes        INTEGER     NOT NULL CHECK (mes >= 1 AND mes <= 12),
  observacao TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aniv_mes_dia ON public.aniversarios(mes, dia);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aniversarios_updated_at ON public.aniversarios;
CREATE TRIGGER aniversarios_updated_at
  BEFORE UPDATE ON public.aniversarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.aniversarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aniv_select"        ON public.aniversarios;
DROP POLICY IF EXISTS "aniv_insert_gestor" ON public.aniversarios;
DROP POLICY IF EXISTS "aniv_update_gestor" ON public.aniversarios;
DROP POLICY IF EXISTS "aniv_delete_gestor" ON public.aniversarios;

CREATE POLICY "aniv_select"
  ON public.aniversarios FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "aniv_insert_gestor"
  ON public.aniversarios FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "aniv_update_gestor"
  ON public.aniversarios FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

CREATE POLICY "aniv_delete_gestor"
  ON public.aniversarios FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE public.aniversarios REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.aniversarios;
