-- GT3 Sistema - Custo de Servir: contratante ativo/inativo + opcoes da camada 2 do pop-up editaveis
-- Execute uma vez no SQL Editor do Supabase (depois de custo-servir-camada3-atividades.sql). Idempotente.
--
-- 1) cs_contratantes_fin.ativo: contratante que nao atende mais fica inativo (some das listas de escolha,
--    mas o historico de relatorios, medicoes e turnos continua valendo).
-- 2) cs_camada3_atividades.camada: a mesma tabela passa a guardar as opcoes do pop-up das camadas 2 e 3.
--    Antes, Cadastro, E-mail, Ligacao e Faturamento (camada 2) eram fixas no codigo; agora gestor/admin
--    incluem, editam e removem na aba Suporte, como ja acontecia com a camada 3 no Extra portal.

BEGIN;

ALTER TABLE public.cs_contratantes_fin ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

ALTER TABLE public.cs_camada3_atividades ADD COLUMN IF NOT EXISTS camada smallint NOT NULL DEFAULT 3;
ALTER TABLE public.cs_camada3_atividades DROP CONSTRAINT IF EXISTS cs_camada3_atividades_camada_check;
ALTER TABLE public.cs_camada3_atividades ADD CONSTRAINT cs_camada3_atividades_camada_check CHECK (camada IN (2, 3));

INSERT INTO public.cs_camada3_atividades (chave, label, inclui, ordem, camada) VALUES
  ('cadastro',    'Cadastro',    'Empresa, pessoa, turno, vinculação',      1, 2),
  ('email',       'E-mail',      'Ler, responder, cobrar por e-mail',       2, 2),
  ('ligacao',     'Ligação',     'Atender ou fazer ligação',                3, 2),
  ('faturamento', 'Faturamento', 'Emitir, conferir ou cobrar faturamento',  4, 2)
ON CONFLICT (chave) DO NOTHING;

COMMIT;
