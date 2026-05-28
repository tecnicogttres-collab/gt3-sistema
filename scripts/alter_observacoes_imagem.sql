-- GT3 Sistema — Observações: adiciona coluna de imagem e força reload do schema cache
-- Rodar no SQL Editor do Supabase

ALTER TABLE public.observacoes
  ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Força o PostgREST a recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
