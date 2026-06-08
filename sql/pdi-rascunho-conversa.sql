-- Adiciona campo de rascunho/notas do gestor à conversa do ciclo PDI
ALTER TABLE pdi_ciclos
  ADD COLUMN IF NOT EXISTS rascunho_conversa TEXT DEFAULT NULL;
