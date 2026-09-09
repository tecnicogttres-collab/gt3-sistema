-- GT3 Sistema - Modulo Retorno de NR
-- Execute uma vez no SQL Editor do Supabase.

-- ============================================================
-- Tabelas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rnr_treinamentos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL, descricao text NOT NULL DEFAULT '', ativo boolean NOT NULL DEFAULT true, ordem integer NOT NULL DEFAULT 0, itens jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.rnr_combos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL, treinamento_ids uuid[] NOT NULL DEFAULT '{}', ordem integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.rnr_config (id text PRIMARY KEY DEFAULT 'default', email jsonb NOT NULL DEFAULT '{}'::jsonb, modelos jsonb NOT NULL DEFAULT '{}'::jsonb, acoes jsonb NOT NULL DEFAULT '{}'::jsonb, rotulos jsonb NOT NULL DEFAULT '{}'::jsonb, formas_contato text[] NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.rnr_historico (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, user_nome text NOT NULL DEFAULT '', data date, alvo text NOT NULL DEFAULT '', acao text NOT NULL DEFAULT '', origem text NOT NULL DEFAULT '', contratante text NOT NULL DEFAULT '', contato text NOT NULL DEFAULT '', texto text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS rnr_historico_user_idx ON public.rnr_historico (user_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.rnr_treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rnr_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rnr_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rnr_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rnr_treinamentos_all" ON public.rnr_treinamentos;
DROP POLICY IF EXISTS "rnr_combos_all" ON public.rnr_combos;
DROP POLICY IF EXISTS "rnr_config_all" ON public.rnr_config;
DROP POLICY IF EXISTS "rnr_historico_own" ON public.rnr_historico;

CREATE POLICY "rnr_treinamentos_all" ON public.rnr_treinamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rnr_combos_all" ON public.rnr_combos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rnr_config_all" ON public.rnr_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rnr_historico_own" ON public.rnr_historico FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rnr_treinamentos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rnr_combos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rnr_config TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rnr_historico TO authenticated, service_role;

-- ============================================================
-- Realtime
-- ============================================================

ALTER TABLE public.rnr_treinamentos REPLICA IDENTITY FULL;
ALTER TABLE public.rnr_combos REPLICA IDENTITY FULL;
ALTER TABLE public.rnr_config REPLICA IDENTITY FULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rnr_treinamentos; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rnr_combos; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rnr_config; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Seed - configuracao padrao
-- ============================================================

INSERT INTO public.rnr_config (id, email, modelos, acoes, rotulos, formas_contato) VALUES ('default', '{"tituloComuns":"Padrão a todos:","cabecalho":"Olá!\n\nOK, inseridos o(s) treinamento(s) solicitado(s).\n\nConsiderações:","rodape":""}'::jsonb, '{"contratante":"{{data}}: {{acao}} {{treinamentos}}, conforme solicitação da {{contratante}} via {{contato}}. {{usuario}}","empresa":"{{data}}: {{acao}} {{treinamentos}}, conforme solicitação da própria empresa via {{contato}}. {{usuario}}","atividade":"{{data}}: {{acao}} {{treinamentos}}, conforme atividade da empresa. {{usuario}}"}'::jsonb, '{"inclusao":"inserido","remocao":"removido"}'::jsonb, '{"inclusao":"Aprovação (inclusão)","remocao":"Remoção"}'::jsonb, ARRAY['E-mail','Portal','WhatsApp','Outros']) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed - treinamentos
-- ============================================================

INSERT INTO public.rnr_treinamentos (id, nome, descricao, ordem, itens) VALUES
('b7e10000-0000-4000-8000-000000000001', 'NR 10', 'Segurança em instalações e serviços em eletricidade', 1, '[{"id":"i1","chave":"envio","texto":"Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;"},{"id":"i2","chave":"ead","texto":"Não é possível aceitar treinamentos 100% EAD."},{"id":"i3","chave":"","texto":"No caso da NR 10, anexar o certificado de formação de 40h + reciclagem, em um único arquivo, em PDF."}]'::jsonb),
('b7e10000-0000-4000-8000-000000000002', 'NR 12', 'Segurança em máquinas e equipamentos', 2, '[{"id":"i1","chave":"envio","texto":"Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;"},{"id":"i2","chave":"ead","texto":"Não é possível aceitar treinamentos 100% EAD."}]'::jsonb),
('b7e10000-0000-4000-8000-000000000003', 'NR 11 Guincho', 'Operação de guincho / guindaste', 3, '[{"id":"i1","chave":"envio","texto":"Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;"},{"id":"i2","chave":"ead","texto":"Não é possível aceitar treinamentos 100% EAD."}]'::jsonb),
('b7e10000-0000-4000-8000-000000000004', 'NR 11 Empilhadeira', 'Operação de empilhadeira', 4, '[{"id":"i1","chave":"envio","texto":"Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;"},{"id":"i2","chave":"ead","texto":"Não é possível aceitar treinamentos 100% EAD."}]'::jsonb),
('b7e10000-0000-4000-8000-000000000005', 'NR 11 Ponte Rolante', 'Operação de ponte rolante / talha', 5, '[{"id":"i1","chave":"envio","texto":"Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;"},{"id":"i2","chave":"ead","texto":"Não é possível aceitar treinamentos 100% EAD."}]'::jsonb),
('b7e10000-0000-4000-8000-000000000006', 'NR 18 PEMT', 'Plataforma elevatória móvel de trabalho', 6, '[{"id":"i1","chave":"envio","texto":"Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;"},{"id":"i2","chave":"ead","texto":"Não é possível aceitar treinamentos 100% EAD."}]'::jsonb),
('b7e10000-0000-4000-8000-000000000007', 'NR 20', 'Inflamáveis e combustíveis', 7, '[{"id":"i1","chave":"envio","texto":"Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;"},{"id":"i2","chave":"ead","texto":"Não é possível aceitar treinamentos 100% EAD."}]'::jsonb),
('b7e10000-0000-4000-8000-000000000008', 'NR 33', 'Espaços confinados', 8, '[{"id":"i1","chave":"envio","texto":"Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;"},{"id":"i2","chave":"ead","texto":"Não é possível aceitar treinamentos 100% EAD."},{"id":"i3","chave":"","texto":"No caso da NR 33, anexar o certificado de formação de 40h + reciclagem, em um único arquivo, em PDF."}]'::jsonb),
('b7e10000-0000-4000-8000-000000000009', 'NR 35', 'Trabalho em altura', 9, '[{"id":"i1","chave":"envio","texto":"Devem ser enviados frente e verso, no campo específico de cada um deles, em um único arquivo, assinados, em PDF;"},{"id":"i2","chave":"ead","texto":"Não é possível aceitar treinamentos 100% EAD."}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed - combinacoes
-- ============================================================

INSERT INTO public.rnr_combos (id, nome, treinamento_ids, ordem) VALUES
('b7e1c000-0000-4000-8000-000000000001', 'NR 10 + NR 35', ARRAY['b7e10000-0000-4000-8000-000000000001','b7e10000-0000-4000-8000-000000000009']::uuid[], 1),
('b7e1c000-0000-4000-8000-000000000002', 'NR 11 Empilhadeira + NR 35', ARRAY['b7e10000-0000-4000-8000-000000000004','b7e10000-0000-4000-8000-000000000009']::uuid[], 2),
('b7e1c000-0000-4000-8000-000000000003', 'NR 18 PEMT + NR 35', ARRAY['b7e10000-0000-4000-8000-000000000006','b7e10000-0000-4000-8000-000000000009']::uuid[], 3),
('b7e1c000-0000-4000-8000-000000000004', 'NR 33 + NR 35', ARRAY['b7e10000-0000-4000-8000-000000000008','b7e10000-0000-4000-8000-000000000009']::uuid[], 4)
ON CONFLICT (id) DO NOTHING;
