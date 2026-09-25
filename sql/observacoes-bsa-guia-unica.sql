-- GT3 Sistema - Observacoes - BSA, PGR & PCMSO & LTCAT, GPF - Alimentar e Orientacoes Gerais em guia unica
-- As antigas guias dessas abas (e as criadas pelo gestor) viraram colunas de uma guia so,
-- com o mesmo nome da aba. A tela ja funciona sem este script; ele so padroniza os dados
-- e preserva cor/largura das colunas definidas no modo Layout.
-- Execute uma vez no SQL Editor do Supabase (pode rodar de novo sem problema).

DROP TABLE IF EXISTS _guia_unica;
CREATE TEMP TABLE _guia_unica (categoria text, chave text, ordem int);
INSERT INTO _guia_unica VALUES
  ('BSA', 'ASO', 1), ('BSA', 'Geral', 2), ('BSA', 'PGR', 3), ('BSA', 'PCMSO', 4),
  ('PGR & PCMSO & LTCAT', 'PGR', 1), ('PGR & PCMSO & LTCAT', 'PCMSO', 2), ('PGR & PCMSO & LTCAT', 'LTCAT', 3),
  ('PGR & PCMSO & LTCAT', 'PGR — Específicos', 4), ('PGR & PCMSO & LTCAT', 'PCMSO — Específicos', 5),
  ('GPF - Alimentar', 'Comum a Todos', 1), ('GPF - Alimentar', 'Efetivo', 2),
  ('GPF - Alimentar', 'Rescisórios', 3), ('GPF - Alimentar', 'Sistema - Geral', 4),
  ('Orientações Gerais', 'Sistema - Geral', 1), ('Orientações Gerais', 'ASO Sócio', 2), ('Orientações Gerais', 'Inserção/Remoção', 3);

-- 1) Observacoes: passam a apontar para a guia unica (a coluna nao muda)
UPDATE public.observacoes
SET subtab = categoria
WHERE categoria IN ('BSA', 'PGR & PCMSO & LTCAT', 'GPF - Alimentar', 'Orientações Gerais')
  AND subtab <> categoria;

-- 2) Layout das colunas (cor/largura): move para a guia unica, na ordem original das guias
UPDATE public.observacoes_layout l
SET subtab = l.categoria,
    ordem = COALESCE((SELECT g.ordem FROM _guia_unica g WHERE g.categoria = l.categoria AND g.chave = l.chave), 100)
WHERE l.categoria IN ('BSA', 'PGR & PCMSO & LTCAT', 'GPF - Alimentar', 'Orientações Gerais')
  AND l.tipo = 'coluna'
  AND l.subtab <> l.categoria
  AND NOT EXISTS (
    SELECT 1 FROM public.observacoes_layout x
    WHERE x.categoria = l.categoria AND x.subtab = l.categoria AND x.tipo = 'coluna' AND x.chave = l.chave
  );

-- 3) Ordem das antigas guias nao tem mais uso
DELETE FROM public.observacoes_layout
WHERE categoria IN ('BSA', 'PGR & PCMSO & LTCAT', 'GPF - Alimentar', 'Orientações Gerais')
  AND tipo = 'guia';

DROP TABLE IF EXISTS _guia_unica;
