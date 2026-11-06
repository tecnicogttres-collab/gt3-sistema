-- GT3 Sistema - Custo de Servir: um grupo de criterio por contratante com documento atribuido no GT0010
-- Execute uma vez no SQL Editor do Supabase (depois de custo-servir-documentos-gt0010.sql). Idempotente.
--
-- Para cada contratante com vinculo ATIVO em cs_documento_contratantes:
--   * se ja esta num grupo especifico (ex.: 81 no Grupo BSA), usa esse grupo;
--   * 69 (JUNGHEINRICH LIFT TRUCK) entra no "Grupo Jungheinrich", que ja existia sem contratante;
--   * senao, cria "Grupo <nome do contratante>" com ele dentro.
-- Os documentos que ele exige entram no grupo (sem medicoes: ate cronometrar, vale o tempo do grupo padrao).

BEGIN;

-- Jungheinrich: o grupo ja existia sem contratante
INSERT INTO public.cs_grupo_contratantes (grupo_id, contratante_cod)
SELECT g.id, '69' FROM public.cs_grupos g
 WHERE g.nome = 'Grupo Jungheinrich'
   AND NOT EXISTS (SELECT 1 FROM public.cs_grupo_contratantes WHERE contratante_cod = '69')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  c record;
  gid uuid;
  ord int;
BEGIN
  SELECT COALESCE(max(ordem), 0) INTO ord FROM public.cs_grupos;
  FOR c IN
    SELECT DISTINCT f.contratante_cod AS cod, f.nome
      FROM public.cs_documento_contratantes v
      JOIN public.cs_contratantes_fin f ON f.contratante_cod = v.contratante_cod
     WHERE v.ativo
     ORDER BY f.nome
  LOOP
    SELECT grupo_id INTO gid FROM public.cs_grupo_contratantes WHERE contratante_cod = c.cod LIMIT 1;
    IF gid IS NULL THEN
      ord := ord + 1;
      INSERT INTO public.cs_grupos (nome, padrao, ordem)
      VALUES ('Grupo ' || c.nome, false, ord)
      ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id INTO gid;
      INSERT INTO public.cs_grupo_contratantes (grupo_id, contratante_cod) VALUES (gid, c.cod) ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO public.cs_grupo_documentos (grupo_id, documento_id)
    SELECT gid, v.documento_id FROM public.cs_documento_contratantes v
     WHERE v.contratante_cod = c.cod AND v.ativo
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

COMMIT;

-- Conferencia: grupos especificos, contratantes em grupo e documentos nos grupos especificos
SELECT (SELECT count(*) FROM public.cs_grupos WHERE NOT padrao) AS grupos_especificos,
       (SELECT count(*) FROM public.cs_grupo_contratantes) AS contratantes_em_grupo,
       (SELECT count(*) FROM public.cs_grupo_documentos gd JOIN public.cs_grupos g ON g.id = gd.grupo_id WHERE NOT g.padrao) AS docs_em_grupos;
