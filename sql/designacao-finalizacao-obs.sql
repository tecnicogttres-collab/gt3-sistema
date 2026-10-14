-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Designação de Reprovados: observação livre ao finalizar o item
-- ("Resolvido" → como foi resolvido; "Doc(s) excluído" → obs adicional). Pode ser
-- preenchida/editada depois, inclusive em itens finalizados antes desta coluna existir.

ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS finalizacao_obs     TEXT;
ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS finalizacao_obs_em  TIMESTAMPTZ;
ALTER TABLE public.designacoes ADD COLUMN IF NOT EXISTS finalizacao_obs_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
