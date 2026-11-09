-- GT3 Sistema - Custo de Servir: aba "Extra portal" (amostragem do trabalho, antiga camada 3)
-- Execute uma vez no SQL Editor do Supabase. Idempotente.
--
-- cs_amostragens.opcoes        : o que conta nesta amostragem (ex.: {whatsapp,ligacao}). NULL = todas as opcoes.
-- cs_amostragens.aberta_todos  : true = qualquer usuario pode registrar por conta propria (sem pop-up).
-- cs_amostras.espontanea       : true = registro feito por conta propria (nao veio de um pop-up sorteado).

ALTER TABLE public.cs_amostragens ADD COLUMN IF NOT EXISTS opcoes text[];
ALTER TABLE public.cs_amostragens ADD COLUMN IF NOT EXISTS aberta_todos boolean NOT NULL DEFAULT false;
ALTER TABLE public.cs_amostras    ADD COLUMN IF NOT EXISTS espontanea boolean NOT NULL DEFAULT false;
