-- GT3 Sistema - Custo de Operacao: cada atividade cronometrada da camada 2 pertence a um botao do pop-up
-- Execute uma vez no SQL Editor do Supabase (depois de custo-servir-ativos-camada2.sql). Idempotente.
--
-- O pop-up da amostragem tem botoes amplos (Cadastro, E-mail, Ligacao...) e o cronometro tem atividades
-- detalhadas (Cadastro de empresa, Cadastro de pessoa...). A aba Suporte passa a mostrar uma lista so:
-- cada botao do pop-up com as atividades cronometradas dele. O vinculo fica em cs_atividades.botao_popup
-- (chave de cs_camada3_atividades; nulo = sem botao no pop-up).

BEGIN;

ALTER TABLE public.cs_atividades ADD COLUMN IF NOT EXISTS botao_popup text;

-- Vinculo inicial das atividades padrao (so onde ainda nao foi definido)
UPDATE public.cs_atividades SET botao_popup = 'cadastro'
 WHERE botao_popup IS NULL AND chave IN ('cadastro_empresa', 'cadastro_pessoa', 'troca_funcao', 'inclusao_turno');
UPDATE public.cs_atividades SET botao_popup = 'email'
 WHERE botao_popup IS NULL AND chave IN ('email_simples', 'email_analise');
UPDATE public.cs_atividades SET botao_popup = 'ligacao'
 WHERE botao_popup IS NULL AND chave = 'ligacao';

COMMIT;
