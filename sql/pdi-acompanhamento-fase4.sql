-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — PDI (Fase 4): pauta da conversa unificada com o Diário
-- 1) Anotação pode ser ligada a um ciclo (pauta/anotações da conversa daquele ciclo)
-- 2) Copia as pautas atuais (pdi_rascunhos) para o Diário como tipo "pauta",
--    mantendo autor e data/hora. A tabela pdi_rascunhos NÃO é apagada.
-- Rodar no SQL Editor do Supabase. Pode rodar de novo: não duplica.
--
-- Para desfazer:
--   DELETE FROM public.pdi_anotacoes WHERE tipo = 'pauta' AND ciclo_id IS NOT NULL;
--   ALTER TABLE public.pdi_anotacoes DROP COLUMN IF EXISTS ciclo_id;
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.pdi_anotacoes
  ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES public.pdi_ciclos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pdi_anotacoes_ciclo_idx ON public.pdi_anotacoes(ciclo_id);

INSERT INTO public.pdi_anotacoes (pdi_id, tipo, data, texto, visivel, ciclo_id, autor_id, autor_nome, created_at, updated_at)
SELECT c.pdi_id, 'pauta', (r.updated_at AT TIME ZONE 'America/Sao_Paulo')::date, r.texto, FALSE, r.ciclo_id,
       r.user_id, COALESCE(r.user_nome, ''), r.updated_at, r.updated_at
FROM public.pdi_rascunhos r
JOIN public.pdi_ciclos c ON c.id = r.ciclo_id
WHERE COALESCE(TRIM(r.texto), '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.pdi_anotacoes a
    WHERE a.ciclo_id = r.ciclo_id AND a.tipo = 'pauta'
      AND a.autor_id IS NOT DISTINCT FROM r.user_id AND a.texto = r.texto
  );
