-- GT3 Sistema - Custo de Servir: validade do documento, bases prontas (conjuntos de documentos) e
-- Faturamento como opcao do aviso da amostragem. Execute uma vez no SQL Editor do Supabase. Idempotente.

BEGIN;

-- 1) Validade do documento, em dias. NULL = nao definida; 0 = unico (nao vence: so na entrada).
--    Ex.: mensal 30, semestral 180, anual 365, bienal 730. Base da frequencia nas bases prontas.
ALTER TABLE public.cs_documentos ADD COLUMN IF NOT EXISTS validade_dias int;
ALTER TABLE public.cs_documentos DROP CONSTRAINT IF EXISTS cs_documentos_validade_check;
ALTER TABLE public.cs_documentos ADD CONSTRAINT cs_documentos_validade_check CHECK (validade_dias IS NULL OR validade_dias >= 0);

-- 2) Bases prontas: conjuntos de documentos reutilizaveis ("starter pack"), importados e exportados
--    entre contratantes. O conjunto e uma lista editavel; aplicar a um contratante cria os vinculos dele.
CREATE TABLE IF NOT EXISTS public.cs_conjuntos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  descricao  text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cs_conjunto_documentos (
  conjunto_id  uuid NOT NULL REFERENCES public.cs_conjuntos(id) ON DELETE CASCADE,
  documento_id uuid NOT NULL REFERENCES public.cs_documentos(id) ON DELETE CASCADE,
  PRIMARY KEY (conjunto_id, documento_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cs_conjuntos','cs_conjunto_documentos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_autenticados', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_autenticados', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_conjuntos, public.cs_conjunto_documentos TO authenticated, service_role;

-- 3) Amostragem (camada 3): Faturamento passa a ser uma opcao do aviso
ALTER TABLE public.cs_amostras DROP CONSTRAINT IF EXISTS cs_amostras_atividade_check;
ALTER TABLE public.cs_amostras ADD CONSTRAINT cs_amostras_atividade_check
  CHECK (atividade IN ('avaliacao','cadastro','email','ligacao','faturamento','whatsapp','orientacao','interno','sem_demanda'));

COMMIT;
