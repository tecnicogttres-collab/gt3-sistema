-- Melhorias (coisas-a-fazer): vincula a lista de modulos ao catalogo do sistema.
-- Cada modulo do sistema (app/lib/modules.ts) passa a ter uma linha em caf_modulos,
-- identificada por modulo_sistema (o id do modulo). A rota GET /api/coisas-a-fazer
-- sincroniza automaticamente (cria os que faltam e segue os nomes da nomenclatura).
-- Modulos custom (sugestoes de novo modulo) ficam com modulo_sistema = NULL.

ALTER TABLE caf_modulos ADD COLUMN IF NOT EXISTS modulo_sistema TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS caf_modulos_sistema_uidx ON caf_modulos (modulo_sistema);
