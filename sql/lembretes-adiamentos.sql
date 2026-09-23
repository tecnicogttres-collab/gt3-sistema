-- ============================================================
-- Lembretes — adiar/descartar do widget do Dashboard (por usuário)
-- GT3 Sistema — colar no SQL Editor do Supabase
--
-- Guarda, por usuário, a partir de que data um lembrete volta a
-- aparecer no bloco "Lembretes" do Dashboard. Usado tanto por
-- "Descartar" (esconde só até essa ocorrência passar) quanto por
-- "Adiar" (esconde até a data escolhida). Não afeta a confirmação
-- (OK) nem a lista "Lembretes ativos" da página /lembretes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lembretes_adiamentos (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lembrete_id         UUID        NOT NULL REFERENCES public.lembretes(id) ON DELETE CASCADE,
  usuario_id          UUID        NOT NULL,
  mostrar_a_partir_de DATE        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lembrete_id, usuario_id)
);

ALTER TABLE public.lembretes_adiamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY la_select ON public.lembretes_adiamentos
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);

CREATE POLICY la_insert ON public.lembretes_adiamentos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY la_update ON public.lembretes_adiamentos
  FOR UPDATE TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY la_delete ON public.lembretes_adiamentos
  FOR DELETE TO authenticated USING (auth.uid() = usuario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes_adiamentos TO authenticated;
GRANT ALL ON public.lembretes_adiamentos TO service_role;

CREATE INDEX IF NOT EXISTS idx_la_lembrete ON public.lembretes_adiamentos (lembrete_id);
CREATE INDEX IF NOT EXISTS idx_la_usuario  ON public.lembretes_adiamentos (usuario_id);
