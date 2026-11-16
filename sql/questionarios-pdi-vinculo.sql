-- ============================================================
-- Questionários × PDI — pesquisa interna identificada ligada ao usuário
-- GT3 Sistema — colar no SQL Editor do Supabase
--
-- 1) questionario_convites.profile_id: o destinatário é um usuário do
--    sistema. É por aqui que as respostas aparecem no PDI dele (aba
--    "Pesquisas"). Convites de contratantes/prestadores e respostas do
--    link anônimo ficam com profile_id NULL — nunca são ligados a ninguém.
-- 2) profiles.email_pessoal: e-mail pessoal usado nas pesquisas internas
--    (não é o e-mail de login). Fica guardado para vir preenchido na
--    próxima pesquisa.
--
-- Só ADD COLUMN / índice: não altera nem apaga dados. Pode rodar mais de uma vez.
-- Rodar ANTES de publicar o código novo.
-- ============================================================

ALTER TABLE public.questionario_convites
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questionario_convites_profile
  ON public.questionario_convites (profile_id) WHERE profile_id IS NOT NULL;

-- A mesma pessoa não entra duas vezes no mesmo questionário
CREATE UNIQUE INDEX IF NOT EXISTS uq_questionario_convites_qn_profile
  ON public.questionario_convites (questionario_id, profile_id) WHERE profile_id IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_pessoal text;
