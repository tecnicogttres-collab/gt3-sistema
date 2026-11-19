-- GT3 Sistema - renomeia o modulo Custo de Servir para Custo de Operacao
-- Execute uma vez no SQL Editor do Supabase. Idempotente.
--
-- O titulo grande do modulo vem de cs_config.nome_modulo e o nome no menu lateral, de modulos_config
-- (quando alguem ja personalizou). O codigo ja usa "Custo de Operação" como padrao.

BEGIN;

UPDATE public.cs_config
   SET nome_modulo = 'Custo de Operação'
 WHERE nome_modulo ILIKE 'custo de servir';

ALTER TABLE public.cs_config ALTER COLUMN nome_modulo SET DEFAULT 'Custo de Operação';

UPDATE public.modulos_config
   SET label = 'Custo de Operação', updated_at = now()
 WHERE id = 'custo-servir' AND label ILIKE 'custo de servir';

COMMIT;
