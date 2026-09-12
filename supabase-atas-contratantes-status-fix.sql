-- GT3 Sistema - Corrige constraint de status em atas_contratantes
-- Hoje a constraint nao aceita 'Aguardando Validacao', entao mudar pra esse status
-- (dropdown no modulo Atas Contratantes) gera erro 23514 (check constraint violation).
-- Execute uma vez no SQL Editor do Supabase.

ALTER TABLE public.atas_contratantes DROP CONSTRAINT IF EXISTS atas_contratantes_status_check;
ALTER TABLE public.atas_contratantes ADD CONSTRAINT atas_contratantes_status_check CHECK (status IN ('Rascunho', 'Aguardando Validação', 'Validada'));
