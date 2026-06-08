-- Adiciona tipo ao registro de férias (férias ou folga)
ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'ferias'
  CHECK (tipo IN ('ferias', 'folga'));
