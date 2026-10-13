-- GT3 Sistema - Modulo Questionarios: controle de envio manual (mala direta)
-- Os convites saem por mala direta no Word/Outlook, fora do sistema. Estas colunas so registram
-- que o envio (e os lembretes) foram feitos a mao. "Respondido" continua vindo da coluna status
-- (gravada pela resposta no link unico) e tem prioridade sobre o status de envio.
-- Somente ADD COLUMN: nao altera nem apaga nenhum dado existente. Idempotente.
-- Execute uma vez no SQL Editor do Supabase, DEPOIS de sql/questionarios.sql.

ALTER TABLE public.questionario_convites
  ADD COLUMN IF NOT EXISTS status_envio text NOT NULL DEFAULT 'nao_enviado'
    CHECK (status_envio IN ('nao_enviado','enviado'));

ALTER TABLE public.questionario_convites
  ADD COLUMN IF NOT EXISTS canal_envio text
    CHECK (canal_envio IN ('manual','sistema'));

ALTER TABLE public.questionario_convites
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz;

ALTER TABLE public.questionario_convites
  ADD COLUMN IF NOT EXISTS lembretes_enviados integer NOT NULL DEFAULT 0;

ALTER TABLE public.questionario_convites
  ADD COLUMN IF NOT EXISTS ultimo_lembrete_em timestamptz;

-- Mesmo padrao de GRANT explicito de sql/questionarios.sql (as colunas novas herdam o GRANT da tabela;
-- repetido aqui para deixar o arquivo autossuficiente).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionario_convites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionario_convites TO service_role;
