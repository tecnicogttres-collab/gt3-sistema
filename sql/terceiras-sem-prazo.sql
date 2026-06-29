-- Workflow Cadastro (terceiras): marca empresas que NAO controlam prazo.
-- Essas ficam em lilas/roxo e nao entram na regra de cor por dias (5=amarelo, 10=laranja, 15=vermelho).
ALTER TABLE terceiras ADD COLUMN IF NOT EXISTS sem_prazo BOOLEAN NOT NULL DEFAULT false;
