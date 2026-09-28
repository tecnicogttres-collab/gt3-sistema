-- GT3 Sistema - Cronogramas: ajustes pontuais (rodar uma vez no SQL Editor do Supabase)
--
-- 1) Devolve o item 3.1 ("Definição de requisitos – Anexo 1") ao cronograma da Soprano,
--    com os dados originais, logo depois da etapa 3, e refaz a dependencia do 3.3 (aguarda 3.1).
--    So age se o cronograma da Soprano existir e nao tiver mais o item 3.1.
--
-- 2) Tira as datas dos modelos "Modelo Soprano" e "Modelo CSG". Fica so a data do item 1
--    do Modelo Soprano. Os cronogramas (Soprano, CSG etc.) nao sao alterados por este passo.

-- 1) Restaurar 3.1 na Soprano
UPDATE public.cronogramas c
SET itens = (
  SELECT jsonb_agg(x ORDER BY ord)
  FROM (
    SELECT t.ord::numeric AS ord,
           CASE WHEN t.e->>'id' = '3.3' THEN jsonb_set(t.e, '{deps}', '["3.1"]'::jsonb) ELSE t.e END AS x
    FROM jsonb_array_elements(c.itens) WITH ORDINALITY AS t(e, ord)
    UNION ALL
    SELECT (SELECT t2.ord FROM jsonb_array_elements(c.itens) WITH ORDINALITY AS t2(e, ord) WHERE t2.e->>'id' = '3') + 0.5,
           '{"id":"3.1","parent":"3","t":"Definição de requisitos – Anexo 1","resp":["C"],"ini":"2026-10-01","fim":"2026-10-09","st":"pendente","obs":"Necessário agendar reunião para esta definição.","deps":[],"hist":[]}'::jsonb
  ) s
),
updated_at = now()
WHERE c.modelo = false
  AND lower(c.cliente) = 'soprano'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.itens) e WHERE e->>'id' = '3')
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.itens) e WHERE e->>'id' = '3.1');

-- 2) Modelos sem datas (exceto o item 1 do Modelo Soprano)
UPDATE public.cronogramas c
SET itens = (
  SELECT jsonb_agg(
    CASE WHEN c.cliente = 'Modelo Soprano' AND t.e->>'id' = '1' THEN t.e ELSE (t.e - 'ini' - 'fim') END
    ORDER BY t.ord)
  FROM jsonb_array_elements(c.itens) WITH ORDINALITY AS t(e, ord)
),
updated_at = now()
WHERE c.modelo = true
  AND c.cliente IN ('Modelo Soprano', 'Modelo CSG');

-- Conferencia (opcional): deve listar o 3.1 dentro da Soprano e so o item 1 com data no Modelo Soprano
-- SELECT cliente, modelo, e->>'id' AS item, e->>'ini' AS ini, e->'deps' AS deps
-- FROM public.cronogramas, jsonb_array_elements(itens) e
-- WHERE (lower(cliente) = 'soprano' AND e->>'id' IN ('3','3.1','3.3')) OR (cliente = 'Modelo Soprano' AND e->>'ini' IS NOT NULL);
