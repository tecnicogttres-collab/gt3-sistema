-- GT3 Sistema - Modulo Custo de Servir (nome provisorio, editavel em cs_config.nome_modulo)
-- Cronometragem de documentos -> tempo-padrao por grupo -> contagem por contratante -> resultado.
-- Estrutura apenas (sem dados). Os dados reais iniciais estao em sql/custo-servir-seed.sql.
-- Execute uma vez no SQL Editor do Supabase. E idempotente (pode rodar de novo sem duplicar).
--
-- Adaptacoes em relacao ao SQL original:
--  * schema public explicito, IF NOT EXISTS / DROP POLICY IF EXISTS (padrao do projeto);
--  * usuarios referenciam public.profiles(id) (= auth.uid()), como nos demais modulos,
--    o que tambem permite o embed do nome do avaliador pelo PostgREST;
--  * NOT NULL em chaves que nao podem faltar; indices nas colunas de filtro;
--  * cs_grupos.nome unico e no maximo um grupo padrao;
--  * cs_contratantes_fin ganhou "nome" (aba Configuracoes > Contratantes: codigo, nome, faturamento);
--  * cs_config ganhou dias_mes (dias do mes para projecao; vazio = usa dias_uteis)
--    e abas_perfis (mapa aba -> perfis; hoje todos os perfis veem todas as abas);
--  * cs_medicoes_hist ganhou "detalhe" (ex.: motivo do descarte);
--  * GRANT tambem para service_role (padrao do projeto).

-- ── Grupos de criterio ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cs_grupos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  padrao     boolean NOT NULL DEFAULT false,
  ordem      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No maximo um grupo padrao
CREATE UNIQUE INDEX IF NOT EXISTS cs_grupos_um_padrao ON public.cs_grupos (padrao) WHERE padrao;

CREATE TABLE IF NOT EXISTS public.cs_grupo_contratantes (
  grupo_id        uuid NOT NULL REFERENCES public.cs_grupos(id) ON DELETE CASCADE,
  contratante_cod text NOT NULL,
  PRIMARY KEY (grupo_id, contratante_cod)
);
-- Um contratante pertence a no maximo um grupo (senao o tempo-padrao dele fica ambiguo)
CREATE UNIQUE INDEX IF NOT EXISTS cs_grupo_contratantes_cod ON public.cs_grupo_contratantes (contratante_cod);

-- ── Catalogo de documentos e presenca em cada grupo ────────────────
CREATE TABLE IF NOT EXISTS public.cs_documentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL UNIQUE,
  codigo         text,
  volume_ref     int NOT NULL DEFAULT 0,
  reprovados_ref int NOT NULL DEFAULT 0,
  nao_conta      boolean NOT NULL DEFAULT false,
  ativo          boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS cs_documentos_codigo ON public.cs_documentos (codigo) WHERE codigo IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cs_grupo_documentos (
  grupo_id     uuid NOT NULL REFERENCES public.cs_grupos(id) ON DELETE CASCADE,
  documento_id uuid NOT NULL REFERENCES public.cs_documentos(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (grupo_id, documento_id)
);
CREATE INDEX IF NOT EXISTS cs_grupo_documentos_doc ON public.cs_grupo_documentos (documento_id);

-- ── Medicoes (rastreaveis) e historico de cada mudanca ─────────────
CREATE TABLE IF NOT EXISTS public.cs_medicoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id     uuid REFERENCES public.cs_grupos(id) ON DELETE SET NULL,  -- grupo excluido: medicao fica no historico
  documento_id uuid NOT NULL REFERENCES public.cs_documentos(id),
  duracao_ms   int  NOT NULL CHECK (duracao_ms >= 1000),   -- medicao < 1 s nao e registrada
  resultado    text NOT NULL CHECK (resultado IN ('aprovado','reprovado')),
  situacao     text NOT NULL CHECK (situacao IN ('validada','descartada')),
  motivo       text,
  avaliador_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cs_medicoes_grupo_doc ON public.cs_medicoes (grupo_id, documento_id);
CREATE INDEX IF NOT EXISTS cs_medicoes_avaliador ON public.cs_medicoes (avaliador_id);

CREATE TABLE IF NOT EXISTS public.cs_medicoes_hist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id uuid NOT NULL REFERENCES public.cs_medicoes(id) ON DELETE CASCADE,
  acao       text NOT NULL,   -- registrou_validou | registrou_descartou | descartou | restaurou | moveu
  detalhe    text,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cs_medicoes_hist_medicao ON public.cs_medicoes_hist (medicao_id);

-- ── Turnos e financeiro ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cs_turnos (
  turno_cod       text PRIMARY KEY,
  contratante_cod text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cs_contratantes_fin (
  contratante_cod    text PRIMARY KEY,
  nome               text NOT NULL DEFAULT '',
  faturamento_mensal numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.cs_config (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base            text NOT NULL DEFAULT 'mediana' CHECK (base IN ('mediana','media')),
  minimo          int  NOT NULL DEFAULT 5 CHECK (minimo > 0),
  custo_mensal    numeric,          -- parametros da equipe: nascem vazios
  pessoas         int,
  dias_uteis      int,
  horas_dia       numeric,
  dias_mes        int,              -- dias do mes para projecao (vazio = usa dias_uteis)
  pct_capacidade  numeric NOT NULL DEFAULT 80,
  margem_desejada numeric NOT NULL DEFAULT 30,
  nome_modulo     text NOT NULL DEFAULT 'Custo de Servir',
  -- aba -> perfis que a enxergam. Hoje: todas para todos.
  -- Ex. futuro: "medicoes": ["gestor","admin"]
  abas_perfis     jsonb NOT NULL DEFAULT '{
    "cronometrar":   ["admin","gestor","colaborador"],
    "tempos":        ["admin","gestor","colaborador"],
    "medicoes":      ["admin","gestor","colaborador"],
    "contagem":      ["admin","gestor","colaborador"],
    "resultado":     ["admin","gestor","colaborador"],
    "configuracoes": ["admin","gestor","colaborador"]
  }'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Relatorios importados ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cs_relatorios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text,
  dias_uteis int,                   -- dias uteis cobertos pelo relatorio
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cs_relatorio_linhas (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  relatorio_id   uuid NOT NULL REFERENCES public.cs_relatorios(id) ON DELETE CASCADE,
  data           date,
  cod_documento  text,
  documento      text,
  status         text,
  empresa_pessoa text,
  cod_cadastro   text,
  razao_social   text,
  cnpj           text,
  vinculacao     text[] NOT NULL DEFAULT '{}',
  ignorados      text[] NOT NULL DEFAULT '{}',
  gt0010         text[] NOT NULL DEFAULT '{}',
  turnos         text[] NOT NULL DEFAULT '{}',
  usuario        text
);
CREATE INDEX IF NOT EXISTS cs_relatorio_linhas_rel ON public.cs_relatorio_linhas (relatorio_id);

-- ── Visao: tempo-padrao por grupo, documento e resultado (so validadas) ──
CREATE OR REPLACE VIEW public.cs_tempos WITH (security_invoker = true) AS
SELECT grupo_id,
       documento_id,
       resultado,
       count(*)                                                       AS n,
       avg(duracao_ms) / 60000.0                                      AS media_min,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY duracao_ms) / 60000.0 AS mediana_min,
       min(duracao_ms) / 60000.0                                      AS min_min,
       max(duracao_ms) / 60000.0                                      AS max_min,
       count(DISTINCT avaliador_id)                                   AS avaliadores
  FROM public.cs_medicoes
 WHERE situacao = 'validada'
 GROUP BY grupo_id, documento_id, resultado;

-- ── RLS: por enquanto qualquer usuario autenticado le e grava ──────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cs_grupos','cs_grupo_contratantes','cs_documentos','cs_grupo_documentos',
                           'cs_medicoes','cs_medicoes_hist','cs_turnos','cs_contratantes_fin',
                           'cs_config','cs_relatorios','cs_relatorio_linhas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_autenticados', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
                   t || '_autenticados', t);
  END LOOP;
END $$;

-- Medicao e historico sempre gravados em nome de quem esta logado
DROP POLICY IF EXISTS cs_medicoes_autor ON public.cs_medicoes;
CREATE POLICY cs_medicoes_autor ON public.cs_medicoes AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (avaliador_id = auth.uid());

DROP POLICY IF EXISTS cs_medicoes_hist_autor ON public.cs_medicoes_hist;
CREATE POLICY cs_medicoes_hist_autor ON public.cs_medicoes_hist AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

-- Historico e imutavel: ninguem edita nem apaga linha de historico pelo app
DROP POLICY IF EXISTS cs_medicoes_hist_sem_update ON public.cs_medicoes_hist;
CREATE POLICY cs_medicoes_hist_sem_update ON public.cs_medicoes_hist AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS cs_medicoes_hist_sem_delete ON public.cs_medicoes_hist;
CREATE POLICY cs_medicoes_hist_sem_delete ON public.cs_medicoes_hist AS RESTRICTIVE
  FOR DELETE TO authenticated USING (false);

-- ── GRANT explicito, so nas tabelas do modulo ──────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.cs_grupos, public.cs_grupo_contratantes, public.cs_documentos, public.cs_grupo_documentos,
  public.cs_medicoes, public.cs_medicoes_hist, public.cs_turnos, public.cs_contratantes_fin,
  public.cs_config, public.cs_relatorios, public.cs_relatorio_linhas
  TO authenticated, service_role;
GRANT SELECT ON public.cs_tempos TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cs_relatorio_linhas_id_seq TO authenticated, service_role;
