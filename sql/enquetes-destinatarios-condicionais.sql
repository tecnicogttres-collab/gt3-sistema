-- Execute uma vez no SQL Editor do Supabase
-- Enquetes: envio para usuários escolhidos + pergunta que depende da resposta de outra.

-- Usuários escolhidos (NULL = vale o público-alvo, como antes)
ALTER TABLE public.enquetes
  ADD COLUMN IF NOT EXISTS destinatarios UUID[];

-- Pergunta condicional: só aparece se condicao_pergunta_id for respondida
-- com uma das opções em condicao_opcao_ids
ALTER TABLE public.enquete_perguntas
  ADD COLUMN IF NOT EXISTS condicao_pergunta_id UUID REFERENCES public.enquete_perguntas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condicao_opcao_ids UUID[];
