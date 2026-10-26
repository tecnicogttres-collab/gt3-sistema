-- Observações: subcategoria criada como coluna dentro de outra guia.
-- guia NULL = guia própria (comportamento antigo); preenchida = coluna dentro dessa guia.

ALTER TABLE public.observacoes_subtabs ADD COLUMN IF NOT EXISTS guia TEXT;

-- Empresas: CRF deixa de ser guia própria e vira coluna dentro de Certidões.
UPDATE public.observacoes_subtabs
   SET guia = 'Certidões'
 WHERE categoria = 'Empresas' AND subtab = 'CRF';

-- Observações já cadastradas em CRF passam para a guia Certidões (a coluna continua "CRF").
UPDATE public.observacoes
   SET subtab = 'Certidões'
 WHERE categoria = 'Empresas' AND subtab = 'CRF';

-- Ordem manual dos cards da coluna CRF acompanha a mudança.
UPDATE public.observacoes_card_ordem o
   SET subtab = 'Certidões'
 WHERE o.categoria = 'Empresas' AND o.subtab = 'CRF'
   AND NOT EXISTS (
     SELECT 1 FROM public.observacoes_card_ordem x
      WHERE x.categoria = o.categoria AND x.subtab = 'Certidões'
        AND x.coluna = o.coluna AND x.motivo = o.motivo
   );
DELETE FROM public.observacoes_card_ordem WHERE categoria = 'Empresas' AND subtab = 'CRF';

-- Cor/largura da coluna CRF acompanham; a posição de "CRF" na ordem das guias é descartada.
UPDATE public.observacoes_layout l
   SET subtab = 'Certidões'
 WHERE l.categoria = 'Empresas' AND l.subtab = 'CRF' AND l.tipo = 'coluna'
   AND NOT EXISTS (
     SELECT 1 FROM public.observacoes_layout x
      WHERE x.categoria = l.categoria AND x.subtab = 'Certidões'
        AND x.tipo = 'coluna' AND x.chave = l.chave
   );
DELETE FROM public.observacoes_layout
 WHERE categoria = 'Empresas'
   AND ((subtab = 'CRF') OR (tipo = 'guia' AND chave = 'CRF'));
