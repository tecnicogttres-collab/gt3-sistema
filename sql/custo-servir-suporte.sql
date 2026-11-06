-- GT3 Sistema - Custo de Servir: camadas 2 e 3 do suporte (material "Medindo o Suporte GT3")
--   Camada 2 (com rastro): cadastro, e-mail e ligacao. Volume (relatorio/contagem) x tempo-padrao.
--   Camada 3 (suporte difuso): amostragem do trabalho. Avisos sorteados no GT3 Sistema,
--   respondidos em 2 cliques (atividade + contratante).
-- Nasce sem medicoes, sem volumes e sem campanhas. Execute uma vez no SQL Editor do Supabase.

BEGIN;

-- ── Camada 2: atividades com rastro ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cs_atividades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       text NOT NULL UNIQUE,
  nome        text NOT NULL,
  unidade     text NOT NULL DEFAULT 'quantidade' CHECK (unidade IN ('quantidade', 'minutos')),  -- minutos: ligacao (a central ja da a duracao)
  fonte       text,            -- de onde vem o volume
  liga_por    text,            -- como liga ao contratante
  ordem       int NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true
);

-- Cronometragem das atividades (tempo-padrao = mediana/media das validadas, como nos documentos)
CREATE TABLE IF NOT EXISTS public.cs_atividade_medicoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.cs_atividades(id) ON DELETE CASCADE,
  duracao_ms   int  NOT NULL CHECK (duracao_ms >= 1000),
  situacao     text NOT NULL DEFAULT 'validada' CHECK (situacao IN ('validada', 'descartada')),
  motivo       text,
  avaliador_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cs_atividade_medicoes_ativ ON public.cs_atividade_medicoes (atividade_id);

-- Volumes importados (um lote = um arquivo/periodo, como os relatorios)
CREATE TABLE IF NOT EXISTS public.cs_volume_lotes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text,
  dias_uteis int,              -- dias uteis cobertos, para projetar o mes
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cs_volume_linhas (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_id      uuid NOT NULL REFERENCES public.cs_volume_lotes(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL REFERENCES public.cs_atividades(id) ON DELETE CASCADE,
  contratantes text[] NOT NULL DEFAULT '{}',   -- validos; varios = divide igual
  quantidade   numeric NOT NULL CHECK (quantidade >= 0),
  prestador    text,
  referencia   text            -- livre: cod. cadastro, remetente, ramal...
);
CREATE INDEX IF NOT EXISTS cs_volume_linhas_lote ON public.cs_volume_linhas (lote_id);

-- ── Camada 3: amostragem do trabalho ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cs_amostragens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  inicio         date NOT NULL,
  fim            date NOT NULL CHECK (fim >= inicio),
  avisos_dia     int  NOT NULL DEFAULT 6 CHECK (avisos_dia BETWEEN 1 AND 20),
  hora_ini       time NOT NULL DEFAULT '08:00',
  hora_fim       time NOT NULL DEFAULT '18:00' CHECK (hora_fim > hora_ini),
  participantes  uuid[],       -- NULL = todos os usuarios ativos
  ativa          boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cs_amostras (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amostragem_id    uuid NOT NULL REFERENCES public.cs_amostragens(id) ON DELETE CASCADE,
  usuario_id       uuid NOT NULL REFERENCES public.profiles(id),
  previsto_em      timestamptz NOT NULL,       -- horario sorteado do aviso
  respondido_em    timestamptz NOT NULL DEFAULT now(),
  atividade        text NOT NULL CHECK (atividade IN ('avaliacao','cadastro','email','ligacao','whatsapp','orientacao','interno','sem_demanda')),
  contratante_cod  text,                       -- NULL = nao e de um contratante
  UNIQUE (amostragem_id, usuario_id, previsto_em)
);
CREATE INDEX IF NOT EXISTS cs_amostras_amostragem ON public.cs_amostras (amostragem_id);

-- ── RLS e GRANT (mesmo padrao do modulo) ────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cs_atividades','cs_atividade_medicoes','cs_volume_lotes','cs_volume_linhas','cs_amostragens','cs_amostras'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_autenticados', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_autenticados', t);
  END LOOP;
END $$;

-- Medicao e resposta sempre em nome de quem esta logado
DROP POLICY IF EXISTS cs_atividade_medicoes_autor ON public.cs_atividade_medicoes;
CREATE POLICY cs_atividade_medicoes_autor ON public.cs_atividade_medicoes AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (avaliador_id = auth.uid());
DROP POLICY IF EXISTS cs_amostras_autor ON public.cs_amostras;
CREATE POLICY cs_amostras_autor ON public.cs_amostras AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.cs_atividades, public.cs_atividade_medicoes, public.cs_volume_lotes, public.cs_volume_linhas,
  public.cs_amostragens, public.cs_amostras
  TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cs_volume_linhas_id_seq TO authenticated, service_role;

-- ── Atividades da camada 2 (lista do material; tempos nascem vazios ate cronometrar) ──
INSERT INTO public.cs_atividades (chave, nome, unidade, fonte, liga_por, ordem) VALUES
  ('cadastro_empresa',  'Cadastro de empresa',                    'quantidade', 'Relatório de inclusões do sistema',             'Vinculação no GT0120',                   1),
  ('cadastro_pessoa',   'Cadastro de pessoa nova',                'quantidade', 'Relatório de inclusões e alterações',           'Turno no GT0130 / vinculação no GT0120', 2),
  ('troca_funcao',      'Troca de função',                        'quantidade', 'Relatório de inclusões e alterações',           'Turno no GT0130 / vinculação no GT0120', 3),
  ('inclusao_turno',    'Inclusão de turno ou vinculação',        'quantidade', 'Relatório de inclusões e alterações',           'Turno no GT0130 / vinculação no GT0120', 4),
  ('email_simples',     'E-mail simples',                         'quantidade', 'Contagem na caixa de entrada por remetente',    'Domínio do prestador → cadastro → contratante', 5),
  ('email_analise',     'E-mail que exige análise',               'quantidade', 'Contagem na caixa de entrada por remetente',    'Domínio do prestador → cadastro → contratante', 6),
  ('ligacao',           'Ligação (minutos da central)',           'minutos',    'Registro dos ramais (duração da central)',      'Número de telefone → prestador',         7)
ON CONFLICT (chave) DO NOTHING;

-- Aba nova no mapa de permissoes (todos veem, como as demais)
UPDATE public.cs_config
   SET abas_perfis = abas_perfis || '{"suporte": ["admin","gestor","colaborador"]}'::jsonb
 WHERE NOT (abas_perfis ? 'suporte');

COMMIT;
