-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Designação de Reprovados: subdivisão dos documentos em pastas dentro
-- de cada setor (ex.: Empresas → Mensais / Certidões / Iniciais / Outros)

CREATE TABLE IF NOT EXISTS public.desig_pastas_documento (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id    UUID        NOT NULL REFERENCES public.desig_setores(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL,
  ordem       INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_desig_pastas_setor ON public.desig_pastas_documento(setor_id);

ALTER TABLE public.desig_documentos
  ADD COLUMN IF NOT EXISTS pasta_id UUID REFERENCES public.desig_pastas_documento(id) ON DELETE SET NULL;

ALTER TABLE public.desig_pastas_documento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "desig_pastas_documento_all" ON public.desig_pastas_documento;
CREATE POLICY "desig_pastas_documento_all" ON public.desig_pastas_documento FOR ALL TO authenticated USING (true) WITH CHECK (true);
