-- ============================================================
-- Calendário de Férias — cor estável por colaborador (login ativo)
-- GT3 Sistema — colar no SQL Editor do Supabase
--
-- A cor de cada colaborador com login ativo passa a ser atribuída uma
-- única vez e guardada aqui, em vez de calculada pela posição na lista
-- (que mudava toda vez que alguém entrava/saía da lista de logins ativos).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ferias_cores_usuarios (
  usuario_id UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  cor        TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ferias_cores_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ferias_cores_usuarios_select" ON public.ferias_cores_usuarios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ferias_cores_usuarios_insert" ON public.ferias_cores_usuarios
  FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON public.ferias_cores_usuarios TO authenticated;
GRANT ALL ON public.ferias_cores_usuarios TO service_role;
