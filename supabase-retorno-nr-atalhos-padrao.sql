-- GT3 Sistema - Modulo Retorno de NR - Garante os 14 atalhos padrao (inclusao/remocao x empresa/contratante/atividade x forma de contato)
-- Execute uma vez no SQL Editor do Supabase, DEPOIS de supabase-retorno-nr-atalhos.sql.
-- E um merge: mantem qualquer atalho que voce ja tenha criado manualmente (ids diferentes dos 14 abaixo)
-- e garante que os 14 padrao existam, atualizando o nome deles se ja existirem. Pode rodar mais de uma vez.

ALTER TABLE public.rnr_config ADD COLUMN IF NOT EXISTS atalhos jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.rnr_config
SET atalhos = COALESCE(
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(atalhos) elem
    WHERE elem->>'id' NOT IN (
      'inc-emp-whatsapp','inc-emp-email','inc-emp-portal',
      'rem-emp-whatsapp','rem-emp-email','rem-emp-portal',
      'inc-ctt-whatsapp','inc-ctt-email','inc-ctt-portal',
      'rem-ctt-whatsapp','rem-ctt-email','rem-ctt-portal',
      'inc-atividade','rem-atividade'
    )
  ),
  '[]'::jsonb
) || '[
  {"id":"inc-emp-whatsapp","nome":"Inclusão · Empresa · WhatsApp","acao":"inclusao","origem":"empresa","contato":"WhatsApp"},
  {"id":"inc-emp-email","nome":"Inclusão · Empresa · E-mail","acao":"inclusao","origem":"empresa","contato":"E-mail"},
  {"id":"inc-emp-portal","nome":"Inclusão · Empresa · Portal","acao":"inclusao","origem":"empresa","contato":"Portal"},
  {"id":"rem-emp-whatsapp","nome":"Remoção · Empresa · WhatsApp","acao":"remocao","origem":"empresa","contato":"WhatsApp"},
  {"id":"rem-emp-email","nome":"Remoção · Empresa · E-mail","acao":"remocao","origem":"empresa","contato":"E-mail"},
  {"id":"rem-emp-portal","nome":"Remoção · Empresa · Portal","acao":"remocao","origem":"empresa","contato":"Portal"},
  {"id":"inc-ctt-whatsapp","nome":"Inclusão · Contratante · WhatsApp","acao":"inclusao","origem":"contratante","contato":"WhatsApp"},
  {"id":"inc-ctt-email","nome":"Inclusão · Contratante · E-mail","acao":"inclusao","origem":"contratante","contato":"E-mail"},
  {"id":"inc-ctt-portal","nome":"Inclusão · Contratante · Portal","acao":"inclusao","origem":"contratante","contato":"Portal"},
  {"id":"rem-ctt-whatsapp","nome":"Remoção · Contratante · WhatsApp","acao":"remocao","origem":"contratante","contato":"WhatsApp"},
  {"id":"rem-ctt-email","nome":"Remoção · Contratante · E-mail","acao":"remocao","origem":"contratante","contato":"E-mail"},
  {"id":"rem-ctt-portal","nome":"Remoção · Contratante · Portal","acao":"remocao","origem":"contratante","contato":"Portal"},
  {"id":"inc-atividade","nome":"Inclusão · Atividade da empresa","acao":"inclusao","origem":"atividade","contato":null},
  {"id":"rem-atividade","nome":"Remoção · Atividade da empresa","acao":"remocao","origem":"atividade","contato":null}
]'::jsonb
WHERE id = 'default';
