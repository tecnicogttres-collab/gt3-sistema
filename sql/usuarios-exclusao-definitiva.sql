-- GT3 Sistema - Exclusao definitiva de usuario (modulo Usuarios -> Excluir)
-- Execute uma vez no SQL Editor do Supabase. Idempotente.
--
-- Ao excluir o login (auth.users), o perfil cai junto (profiles.id ON DELETE CASCADE). Esta migracao
-- define o que acontece com o resto:
--   * Historico e acoes (quem criou, avaliou, votou, revisou...): o registro FICA e o vinculo com a
--     pessoa vira NULL ("usuario excluido"). Antes, varias dessas colunas travavam a exclusao
--     (NO ACTION / NOT NULL) ou apagavam o historico junto (rnr_historico em CASCADE).
--   * Dados pessoais (leituras, preferencias, notificacoes...): APAGADOS junto (CASCADE).
--   * Onde o nome ja e gravado como texto no registro (lembretes_historico, rnr_historico.user_nome,
--     terceiras_historico.who, caf, frases...), o nome continua.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.fk_ao_excluir(p_tabela regclass, p_coluna text, p_acao text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  SELECT c.conname, c.confrelid::regclass AS ref, ra.attname AS ref_col
    INTO r
    FROM pg_constraint c
    JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
   WHERE c.contype = 'f' AND c.conrelid = p_tabela AND a.attname = p_coluna
     AND c.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE NOTICE 'Sem FK de usuario em %.% (ignorado)', p_tabela, p_coluna;
    RETURN;
  END IF;
  IF p_acao = 'SET NULL' THEN
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', p_tabela, p_coluna);
  END IF;
  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', p_tabela, r.conname);
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE %s',
                 p_tabela, r.conname, p_coluna, r.ref, r.ref_col, p_acao);
END $$;

-- ── Historico e acoes: o registro fica, o autor vira NULL ─────────────
SELECT pg_temp.fk_ao_excluir('public.anotacoes_cic', 'atualizado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.anotacoes_cic', 'criado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.atas_contratantes', 'autor_id', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.atas_contratantes_clientes_arquivados', 'arquivado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.cs_amostras', 'usuario_id', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.cs_atividade_medicoes', 'avaliador_id', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.cs_medicoes', 'avaliador_id', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.cs_medicoes_hist', 'usuario_id', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.designacoes', 'criado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.designacoes_historico', 'por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.enquete_respostas', 'usuario_id', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.enquetes', 'criado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.legislacoes', 'autor_id', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.observacoes_card_ordem', 'atualizado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.observacoes_layout', 'criado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.revisao_nr_registros', 'created_by', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.revisoes_datas', 'finalizado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.revisoes_trainee', 'criado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.revisoes_trainee', 'revisado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.rnr_historico', 'user_id', 'SET NULL');          -- era CASCADE: apagava o historico
SELECT pg_temp.fk_ao_excluir('public.terceiras', 'created_by', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.terceiras_historico', 'user_id', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.workflow_programas_analises', 'criado_por', 'SET NULL');
SELECT pg_temp.fk_ao_excluir('public.workflow_programas_config', 'updated_por', 'SET NULL');

-- ── Dados pessoais: apagados junto ────────────────────────────────────
SELECT pg_temp.fk_ao_excluir('public.legislacoes_lidas', 'user_id', 'CASCADE');
-- (ja eram CASCADE: atas_leituras, atas_contratantes_leituras, atas_contratantes_notificacoes,
--  campanhas_lidas, contratantes_favs, dashboard_prefs, desig_pertinencia, ferias_cores_usuarios,
--  notificacoes_usuario, pdi_conversa_avisos, pdi_notificacoes, pdi_rascunhos, prioridades_vistas)

-- ── Arquivos enviados (Storage): o arquivo fica, o dono vira NULL ─────
-- Em projetos antigos storage.objects.owner tem FK para auth.users sem regra, o que trava a exclusao.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname FROM pg_constraint c
     WHERE c.contype = 'f' AND c.conrelid = 'storage.objects'::regclass AND c.confrelid = 'auth.users'::regclass
       AND c.confdeltype <> 'n'
  LOOP
    EXECUTE format('ALTER TABLE storage.objects DROP CONSTRAINT %I', r.conname);
    EXECUTE format('ALTER TABLE storage.objects ADD CONSTRAINT %I FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE SET NULL', r.conname);
  END LOOP;
EXCEPTION WHEN insufficient_privilege OR undefined_column THEN
  RAISE NOTICE 'storage.objects nao alterado (%)', SQLERRM;
END $$;

COMMIT;

-- Conferencia (opcional): nenhuma FK de usuario deve sobrar como NO ACTION/RESTRICT
-- SELECT conrelid::regclass, conname FROM pg_constraint
--  WHERE contype = 'f' AND confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass) AND confdeltype IN ('a', 'r');
