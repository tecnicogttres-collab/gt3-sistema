-- GT3 Sistema - Calendario de Ferias - Dias sem expediente
-- Feriados nacionais ja sao calculados no sistema. Esta tabela guarda os dias extras sem
-- expediente definidos por gestor/admin em Configuracoes (ex.: 31/12, Carnaval, feriado
-- municipal). Entram no calculo de dia util (retorno de ferias) e aparecem no calendario.
-- Execute uma vez no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.ferias_feriados (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data       date NOT NULL,
  descricao  text NOT NULL DEFAULT '',
  anual      boolean NOT NULL DEFAULT false,   -- true = repete todo ano no mesmo dia/mes
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 31/12 sem expediente, todo ano
INSERT INTO public.ferias_feriados (data, descricao, anual)
SELECT DATE '2026-12-31', 'Véspera de Ano Novo — sem expediente', true
WHERE NOT EXISTS (SELECT 1 FROM public.ferias_feriados WHERE anual AND to_char(data, 'MM-DD') = '12-31');

ALTER TABLE public.ferias_feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferias_feriados_select" ON public.ferias_feriados;
DROP POLICY IF EXISTS "ferias_feriados_write_gestor" ON public.ferias_feriados;

CREATE POLICY "ferias_feriados_select" ON public.ferias_feriados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ferias_feriados_write_gestor" ON public.ferias_feriados
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_feriados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_feriados TO service_role;
