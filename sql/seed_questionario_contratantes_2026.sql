-- GT3 Sistema — Seed do "Questionário Contratantes 2026" (módulo Questionários)
-- Idempotente: se já existir um questionário com esse título e público, não faz nada.
-- Não cria tabelas (usa public.questionarios de sql/questionarios.sql, que já tem GRANT/RLS).
-- Formatos: escala = nota 1-5 (min/max = rótulos do 1 e do 5), multipla = uma opção, texto = resposta escrita (opcional).
-- Nasce como 'rascunho': ative em Questionários → Configurar antes de gerar/enviar os links.
-- Execute uma vez no SQL Editor do Supabase.

INSERT INTO public.questionarios (titulo, publico, status, perguntas, painel_config)
SELECT
  'Questionário Contratantes 2026',
  'Contratante',
  'rascunho',
  $json$[
    {"id":"q01","type":"escala","label":"De modo geral, como você avalia o atendimento da equipe GT3?","min":"Muito ruim","max":"Excelente"},
    {"id":"q02","type":"escala","label":"Como você avalia a clareza das respostas da equipe GT3 às suas dúvidas?","min":"Nada claras","max":"Muito claras"},
    {"id":"q03","type":"escala","label":"Como você avalia a clareza dos avisos e comunicados que a GT3 envia por e-mail?","min":"Nada claros","max":"Muito claros"},
    {"id":"q04","type":"multipla","label":"Quando você precisa falar com a GT3, consegue contato na primeira tentativa?","options":["Sempre","Na maioria das vezes","Raramente","Nunca","Não precisei entrar em contato"]},
    {"id":"q05","type":"multipla","label":"Em caso de problema urgente, você sabe a quem recorrer na GT3?","options":["Sim, sei a quem recorrer","Tenho uma ideia, mas não tenho certeza","Não sei"]},
    {"id":"q06","type":"multipla","label":"Qual canal você prefere para falar com a GT3?","options":["E-mail","WhatsApp","Telefone"]},
    {"id":"q07","type":"escala","label":"Como você avalia a agilidade da GT3 na liberação dos prestadores para acesso à sua empresa?","min":"Muito lenta","max":"Muito rápida"},
    {"id":"q08","type":"escala","label":"Qual o impacto do trabalho da GT3 na carga administrativa da sua equipe?","min":"Aumenta muito","max":"Reduz muito"},
    {"id":"q09","type":"multipla","label":"Qual serviço da GT3 é mais importante para sua empresa?","options":["Controle de liberação de acesso dos terceiros","Conferência de PGR, PCMSO e LTCAT","Conformidade com o eSocial","Controle de treinamentos de NR","Análise fiscal e trabalhista"]},
    {"id":"q10","type":"escala","label":"Qual a probabilidade de você recomendar a GT3 a outra empresa?","min":"Nada provável","max":"Muito provável"},
    {"id":"q11","type":"texto","label":"Que informações sobre seus prestadores você gostaria de receber da GT3?"},
    {"id":"q12","type":"texto","label":"Deixe aqui seus comentários, críticas ou elogios."}
  ]$json$::jsonb,
  '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.questionarios
  WHERE titulo = 'Questionário Contratantes 2026' AND publico = 'Contratante'
);
