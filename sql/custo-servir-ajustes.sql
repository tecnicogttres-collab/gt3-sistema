-- GT3 Sistema - Custo de Servir: ajustes apos a migracao inicial
-- Execute uma vez no SQL Editor do Supabase (depois de custo-servir.sql e custo-servir-seed.sql).

BEGIN;

-- 1) Excluir um grupo NAO apaga as medicoes dele: elas ficam no historico com grupo vazio
--    (comportamento do prototipo: "Grupo excluido. As medicoes continuam no historico.").
ALTER TABLE public.cs_medicoes ALTER COLUMN grupo_id DROP NOT NULL;
ALTER TABLE public.cs_medicoes DROP CONSTRAINT IF EXISTS cs_medicoes_grupo_id_fkey;
ALTER TABLE public.cs_medicoes
  ADD CONSTRAINT cs_medicoes_grupo_id_fkey
  FOREIGN KEY (grupo_id) REFERENCES public.cs_grupos(id) ON DELETE SET NULL;

-- 2) Sidebar: libera o modulo para quem tem lista propria de modulos permitidos
--    (quem tem lista NULL ja ve pelo perfil; admin ve tudo).
UPDATE public.profiles
   SET modulos_permitidos = modulos_permitidos || '["custo-servir"]'::jsonb
 WHERE modulos_permitidos IS NOT NULL
   AND NOT (modulos_permitidos ? 'custo-servir');

COMMIT;
