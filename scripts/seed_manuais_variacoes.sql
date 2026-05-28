-- Categoria "variações" + 2 documentos de contratantes
-- Execute no SQL Editor do Supabase

INSERT INTO public.manuais_categorias (nome, slug, ordem)
VALUES ('Variações', 'variacoes', 9);

INSERT INTO public.manuais_documentos (id, categoria_id, titulo, secoes, periodicidade, ativo)
VALUES (
  'cartao_ponto_holerite_contratantes',
  (SELECT id FROM public.manuais_categorias WHERE slug = 'variacoes'),
  'Cartão Ponto e Holerite por Contratante',
  $json$[
    {"label":"Verificação comum (todos)","items":["Nome do colaborador","Mês/ano competência"]},
    {"label":"Holerite — Assinatura + Data obrigatória","items":["Minuano","CSG","Sulbrás","Brinox","Obs.: também aceitam com ambos (assinatura+data OU comprovante de pagamento)"]},
    {"label":"Holerite — Somente Comprovante de Pagamento","items":["Jungheinrich","Mebrafe","Bertolini","RSC","Woodbridge"]},
    {"label":"Holerite — BSA","items":["Somente comprovante de pagamento","Recibo adicional RSC obrigatório"]},
    {"label":"Cartão Ponto — Com Assinatura (padrão)","items":["Minuano","Jungheinrich","Brinox","Sulbrás","RSC Roni"]},
    {"label":"Cartão Ponto — Sem Assinatura","items":["GPF aceita sem assinatura"]}
  ]$json$::jsonb,
  'Referência',
  true
);

INSERT INTO public.manuais_documentos (id, categoria_id, titulo, secoes, periodicidade, ativo)
VALUES (
  'ordem_servico_contratantes',
  (SELECT id FROM public.manuais_categorias WHERE slug = 'variacoes'),
  'Ordem de Serviço por Contratante',
  $json$[
    {"label":"Verificação comum (todos)","items":["Nome do colaborador","Nome da empresa","Função conforme ASO","Riscos"]},
    {"label":"Assinatura do colaborador — obrigatória","items":["BSA","Jungheinrich","PLS","Mebrafe","IMEC","CSG","MASER","Salton","Bertolini","Obs.: GPF não exige assinatura do colaborador"]},
    {"label":"Riscos x PGR","items":["BSA","Jungheinrich","GPF"]},
    {"label":"EPIs x PGR","items":["BSA"]},
    {"label":"Assinatura do elaborador — área de SSO","items":["PLS"]}
  ]$json$::jsonb,
  'Referência',
  true
);
