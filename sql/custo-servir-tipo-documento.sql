-- GT3 Sistema - Custo de Servir: tipo do documento (empresa ou pessoa)
-- Mapa da Atribuicao: no requisito comum, documento de EMPRESA conta para a vinculacao ativa (GT0120)
-- e documento de PESSOA so conta para os contratantes dos turnos ativos (GT0130). Sem turno, nao conta.
-- O tipo nasce vazio (sem chute): classifique em Configuracoes > Catalogo, ou use o botao
-- "Classificar pelo relatorio" (documento que aparece com turno no relatorio e de pessoa).
-- Execute uma vez no SQL Editor do Supabase. Idempotente.

ALTER TABLE public.cs_documentos ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.cs_documentos DROP CONSTRAINT IF EXISTS cs_documentos_tipo_check;
ALTER TABLE public.cs_documentos ADD CONSTRAINT cs_documentos_tipo_check CHECK (tipo IS NULL OR tipo IN ('empresa', 'pessoa'));
