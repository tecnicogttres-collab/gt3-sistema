-- ═══════════════════════════════════════════════════════════════
-- GT3 — PDI Ciclos: adição de data_inicio / data_fim
-- Rodar no SQL Editor do Supabase (uma única vez)
-- ═══════════════════════════════════════════════════════════════

-- 1. Adiciona colunas (nullable primeiro para permitir backfill)
ALTER TABLE public.pdi_ciclos
  ADD COLUMN IF NOT EXISTS data_inicio DATE,
  ADD COLUMN IF NOT EXISTS data_fim    DATE;

-- 2. Backfill: todos os ciclos existentes = período Dez/25–Mai/26, arquivados
UPDATE public.pdi_ciclos
SET
  data_inicio = '2025-12-01',
  data_fim    = '2026-05-31',
  status      = 'arquivado',
  arquivado_em = COALESCE(arquivado_em, NOW())
WHERE data_inicio IS NULL;

-- 3. Torna data_inicio obrigatório após backfill
ALTER TABLE public.pdi_ciclos
  ALTER COLUMN data_inicio SET NOT NULL;

-- 4. Índice para consultas por período
CREATE INDEX IF NOT EXISTS pdi_ciclos_data_inicio_idx ON public.pdi_ciclos(data_inicio);
