-- Adiciona segmentação de visibilidade aos lembretes
ALTER TABLE lembretes
  ADD COLUMN IF NOT EXISTS visibilidade TEXT NOT NULL DEFAULT 'todos'
  CHECK (visibilidade IN ('todos', 'proprio', 'selecionados'));

ALTER TABLE lembretes
  ADD COLUMN IF NOT EXISTS destinatarios UUID[] DEFAULT NULL;
