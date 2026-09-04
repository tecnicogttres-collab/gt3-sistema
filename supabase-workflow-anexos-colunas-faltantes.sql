ALTER TABLE workflow_programas_anexos ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE workflow_programas_anexos ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE workflow_programas_anexos ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
