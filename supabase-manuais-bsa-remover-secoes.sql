-- Manuais / BSA: remove as seções
--   • Status para operação do portal na BSA
--   • Critérios de aprovação no portal GT3 (planilha)
--   • Requisito solicitado pela BSA
-- de todos os documentos da categoria BSA. As demais seções ficam como estão.
-- Faz backup antes (tabela manuais_documentos_bkp_bsa_20261117).

CREATE TABLE IF NOT EXISTS public.manuais_documentos_bkp_bsa_20261117 AS
SELECT d.*
FROM public.manuais_documentos d
JOIN public.manuais_categorias c ON c.id = d.categoria_id
WHERE c.slug = 'bsa';

UPDATE public.manuais_documentos d
SET secoes = COALESCE((
      SELECT jsonb_agg(t.s ORDER BY t.ord)
      FROM jsonb_array_elements(d.secoes) WITH ORDINALITY AS t(s, ord)
      WHERE t.s->>'label' NOT IN (
        'Status para operação do portal na BSA',
        'Critérios de aprovação no portal GT3 (planilha)',
        'Requisito solicitado pela BSA'
      )
    ), '[]'::jsonb)
FROM public.manuais_categorias c
WHERE c.id = d.categoria_id
  AND c.slug = 'bsa'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(d.secoes) s
    WHERE s->>'label' IN (
      'Status para operação do portal na BSA',
      'Critérios de aprovação no portal GT3 (planilha)',
      'Requisito solicitado pela BSA'
    )
  );

-- Conferência: deve voltar 0
SELECT count(*) AS secoes_restantes
FROM public.manuais_documentos d
JOIN public.manuais_categorias c ON c.id = d.categoria_id,
     jsonb_array_elements(d.secoes) s
WHERE c.slug = 'bsa'
  AND s->>'label' IN (
    'Status para operação do portal na BSA',
    'Critérios de aprovação no portal GT3 (planilha)',
    'Requisito solicitado pela BSA'
  );
