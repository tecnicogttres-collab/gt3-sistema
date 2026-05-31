-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — Migração: adiciona coluna usuario em profiles
-- Rodar no SQL Editor do Supabase (uma única vez)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Adiciona coluna usuario (texto, padrão vazio)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS usuario TEXT NOT NULL DEFAULT '';

-- 2. Migra: o que era nome vira usuario
UPDATE public.profiles
  SET usuario = COALESCE(nome, '')
  WHERE usuario = '';

-- 3. Zera nome (será preenchido manualmente depois)
UPDATE public.profiles
  SET nome = '';
