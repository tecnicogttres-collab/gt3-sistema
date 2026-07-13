-- Permite arquivar uma "pasta" de contratante (agrupamento de atas por cliente)
-- no módulo Atas Contratantes, sem apagar as atas.
CREATE TABLE IF NOT EXISTS atas_contratantes_clientes_arquivados (cliente TEXT PRIMARY KEY, arquivado_por UUID REFERENCES profiles(id), arquivado_em TIMESTAMPTZ NOT NULL DEFAULT now());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atas_contratantes_clientes_arquivados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atas_contratantes_clientes_arquivados TO service_role;
