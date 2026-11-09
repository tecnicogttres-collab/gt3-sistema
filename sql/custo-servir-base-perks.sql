-- GT3 Sistema - Custo de Servir: "Base" como nivel de venda (perk) e Extra portal com varios contratantes.
-- Execute uma vez no SQL Editor do Supabase. Idempotente.
--
-- 1) cs_conjuntos.perk  : true = nivel de venda (Base hoje; Essencial/Completo no futuro). Os demais
--                         conjuntos sao "grupos de contratantes": so o que difere da Base.
--    cs_conjuntos.ordem : ordem dos niveis de venda.
-- 2) A Base passa a ser exatamente a dos prints (Prints/Base.PNG e Prints/Base funcionarios.PNG):
--    13 documentos de empresa + 3 de funcionario. Os documentos que ja estavam no conjunto "Base" sao trocados.
-- 3) cs_amostras.contratantes: Extra portal com varios contratantes na mesma resposta (divide igual).

BEGIN;

ALTER TABLE public.cs_conjuntos ADD COLUMN IF NOT EXISTS perk  boolean NOT NULL DEFAULT false;
ALTER TABLE public.cs_conjuntos ADD COLUMN IF NOT EXISTS ordem int     NOT NULL DEFAULT 0;

-- Base: usa o conjunto "Base" existente ou cria
INSERT INTO public.cs_conjuntos (nome, descricao, perk, ordem)
SELECT 'Base', 'Pacote base: documentos da empresa e dos funcionários', true, 1
 WHERE NOT EXISTS (SELECT 1 FROM public.cs_conjuntos WHERE nome = 'Base');
UPDATE public.cs_conjuntos
   SET perk = true, ordem = 1, descricao = COALESCE(descricao, 'Pacote base: documentos da empresa e dos funcionários')
 WHERE nome = 'Base';

DELETE FROM public.cs_conjunto_documentos
 WHERE conjunto_id IN (SELECT id FROM public.cs_conjuntos WHERE nome = 'Base');

INSERT INTO public.cs_conjunto_documentos (conjunto_id, documento_id)
SELECT c.id, d.id
  FROM public.cs_conjuntos c
  JOIN public.cs_documentos d ON d.nome IN (
    -- Empresa
    'ALVARÁ DE LOCALIZAÇÃO E FUNCIONAMENTO - PERIODICO',
    'CARTÃO CNPJ',
    'CERTIDÃO DE DEBITOS RELATIVOS TRIBUTOS FEDERAIS - SEMESTRAL',
    'CERTIDÃO DE TRIBUTOS ESTADUAIS - INFORMADA',
    'CERTIDÃO DE TRIBUTOS MUNICIPAIS',
    'CERTIDÃO TRABALHISTA CNDT (TST - TRIB SUP TRAB) - SEMESTRAL',
    'CONTRATO SOCIAL EMPRESA / MEI CCMEI',
    'DETALHE DA GUIA EMITIDA - RELATÓRIO DO FGTS MENSAL',
    'FGTS MENSAL - GUIA MAIS COMPROVANTE DE PAGTO',
    'INSS + IRRF MENSAL - GUIA MAIS COMPROVANTE DE PAGTO',
    'PCMSO - PROGRAMA CONTROLE MÉDICO SAÚDE OCUPACIONAL',
    'PGR - PROGRAMA DE GERENCIAMENTO DE RISCO - BIENAL',
    'RECIBO DCTFWEB - MENSAL',
    -- Funcionarios
    'ASO - ATESTADO DE SAÚDE OCUPACIONAL - ANUAL',
    'EPI - FICHA ENTREGA DE EQUIP PROTEÇÃO INDIVIDUAL - ANUAL',
    'FICHA REGISTRO DO EMPREGADO - UNICO'
  )
 WHERE c.nome = 'Base'
ON CONFLICT DO NOTHING;

-- Ajustes do catalogo conforme os prints: contrato social e de empresa; PCMSO e bienal
UPDATE public.cs_documentos SET tipo = 'empresa' WHERE nome = 'CONTRATO SOCIAL EMPRESA / MEI CCMEI';
UPDATE public.cs_documentos SET validade_dias = 730
 WHERE nome = 'PCMSO - PROGRAMA CONTROLE MÉDICO SAÚDE OCUPACIONAL' AND validade_dias IS NULL;

-- Extra portal: varios contratantes por resposta
ALTER TABLE public.cs_amostras ADD COLUMN IF NOT EXISTS contratantes text[];
UPDATE public.cs_amostras SET contratantes = ARRAY[contratante_cod]
 WHERE contratante_cod IS NOT NULL AND contratantes IS NULL;

COMMIT;

-- Conferencia: deve dar 13 de empresa e 3 de pessoa
SELECT d.tipo, count(*) AS documentos
  FROM public.cs_conjunto_documentos cd
  JOIN public.cs_conjuntos c ON c.id = cd.conjunto_id AND c.nome = 'Base'
  JOIN public.cs_documentos d ON d.id = cd.documento_id
 GROUP BY d.tipo;
