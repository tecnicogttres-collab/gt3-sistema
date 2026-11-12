-- GT3 Sistema - Custo de Servir: atividades da camada 3 (Extra portal) editaveis
-- Execute uma vez no SQL Editor do Supabase. Idempotente.
--
-- Antes, as opcoes de camada 3 do pop-up (WhatsApp e Orientacao) eram fixas no codigo.
-- Agora ficam em cs_camada3_atividades e gestor/admin incluem, editam e removem na aba Extra portal.
-- Atividade removida que ja tem respostas fica inativa (some do pop-up, mas o historico continua contando);
-- sem respostas, e excluida de vez.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cs_camada3_atividades (
  chave       text PRIMARY KEY,                 -- gravada em cs_amostras.atividade
  label       text NOT NULL,
  inclui      text,                             -- explicacao curta que aparece no botao do pop-up
  ordem       int  NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cs_camada3_atividades (chave, label, inclui, ordem) VALUES
  ('whatsapp',   'WhatsApp',   'Conversas com prestador ou contratante',          1),
  ('orientacao', 'Orientação', 'Explicar requisito, ajudar a montar documento',   2)
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE public.cs_camada3_atividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cs_camada3_atividades_autenticados ON public.cs_camada3_atividades;
CREATE POLICY cs_camada3_atividades_autenticados ON public.cs_camada3_atividades
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_camada3_atividades TO authenticated, service_role;

-- As respostas passam a aceitar as novas chaves da camada 3 (a lista fixa saiu do CHECK)
ALTER TABLE public.cs_amostras DROP CONSTRAINT IF EXISTS cs_amostras_atividade_check;

COMMIT;
