-- ============================================================
-- Workflow Programas — concessões de prazo extra (psicossociais)
-- GT3 Sistema — colar no SQL Editor do Supabase
--
-- Prazo adicional, autorizado pela contratante, para a empresa
-- terceira inserir os fatores de risco psicossociais no PGR/PCMSO,
-- além do prazo geral (26/10 Marcopolo/Volare, 29/10 Jungheinrich).
--
-- A concessão é encerrada automaticamente (encerrada_motivo =
-- 'checklist_aprovado') quando a empresa tem uma nova análise
-- finalizada, posterior à autorização, com o psicossocial aprovado
-- para a mesma contratante. Acesso só pelas rotas /api (service role).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workflow_programas_concessoes_psico (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa               TEXT        NOT NULL,
  cnpj                  TEXT        NOT NULL DEFAULT '',
  -- id da contratante no catálogo do módulo (workflow_programas_config.dados.contratantes)
  contratante_id        TEXT        NOT NULL,
  contratante_nome      TEXT        NOT NULL DEFAULT '',
  -- pessoa da contratante que autorizou (opcional)
  autorizado_por        TEXT        NOT NULL DEFAULT '',
  data_autorizacao      DATE        NOT NULL,
  prazo_original        DATE        NOT NULL,
  prazo_concedido       DATE        NOT NULL,
  obs                   TEXT        NOT NULL DEFAULT '',
  encerrada_em          TIMESTAMPTZ,
  encerrada_motivo      TEXT        CHECK (encerrada_motivo IN ('checklist_aprovado', 'manual')),
  encerrada_analise_id  UUID        REFERENCES public.workflow_programas_analises(id) ON DELETE SET NULL,
  criado_por            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por_nome       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (prazo_concedido >= prazo_original)
);

ALTER TABLE public.workflow_programas_concessoes_psico ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.workflow_programas_concessoes_psico TO service_role;

CREATE INDEX IF NOT EXISTS idx_wpcp_contratante ON public.workflow_programas_concessoes_psico (contratante_id);
CREATE INDEX IF NOT EXISTS idx_wpcp_ativas ON public.workflow_programas_concessoes_psico (encerrada_em) WHERE encerrada_em IS NULL;
