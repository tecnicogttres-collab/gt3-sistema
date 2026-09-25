-- GT3 Sistema - Modulo Questionarios
-- Questionarios para contratantes/prestadores: perguntas (nota 1-5, multipla escolha, texto),
-- convites com link unico por destinatario e painel de respostas.
-- O respondente abre /questionario/<token> SEM login; a leitura/gravacao publica passa pela
-- API do sistema (service role), por isso as tabelas nao tem policy para anon.
-- Execute uma vez no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.questionarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text NOT NULL,
  publico       text NOT NULL DEFAULT 'Contratante' CHECK (publico IN ('Contratante','Prestador')),
  status        text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','ativo','encerrado')),
  perguntas     jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{id, type:'escala'|'multipla'|'texto', label, min?, max?, options?}]
  painel_config jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {statTiles:{...}, order:[...], visible:{...}}
  criado_por    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.questionario_convites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionario_id uuid NOT NULL REFERENCES public.questionarios(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  email           text NOT NULL DEFAULT '',
  empresa         text NOT NULL,
  tipo            text NOT NULL DEFAULT 'Contratante' CHECK (tipo IN ('Contratante','Prestador')),
  vinculo         text,                                -- contratante vinculado (quando tipo = Prestador)
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','respondido')),
  token           text UNIQUE,
  respostas       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {pergunta_id: valor}
  respondido_em   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questionario_convites_qn ON public.questionario_convites(questionario_id);

ALTER TABLE public.questionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionario_convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questionarios_gestor" ON public.questionarios;
DROP POLICY IF EXISTS "questionario_convites_gestor" ON public.questionario_convites;

CREATE POLICY "questionarios_gestor" ON public.questionarios
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

CREATE POLICY "questionario_convites_gestor" ON public.questionario_convites
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionarios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionario_convites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionario_convites TO service_role;
