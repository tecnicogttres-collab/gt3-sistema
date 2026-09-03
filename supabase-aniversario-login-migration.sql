ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aniversario_dia SMALLINT CHECK (aniversario_dia BETWEEN 1 AND 31);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aniversario_mes SMALLINT CHECK (aniversario_mes BETWEEN 1 AND 12);
