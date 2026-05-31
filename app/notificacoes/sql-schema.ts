export const SQL_SCHEMA = `-- Execute no SQL Editor do Supabase (uma única vez)

-- 1. Configuração de notificações por módulo
CREATE TABLE IF NOT EXISTS notificacoes_config (
  modulo           TEXT PRIMARY KEY,
  perfis_notificados TEXT[] NOT NULL DEFAULT '{}',
  ativo            BOOLEAN NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 2. Notificações pendentes por usuário
CREATE TABLE IF NOT EXISTS notificacoes_usuario (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo      TEXT NOT NULL,
  visto       BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notificacoes_usuario_idx
  ON notificacoes_usuario(usuario_id, modulo, visto);

-- 3. Sugestões anônimas
CREATE TABLE IF NOT EXISTS sugestoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto      TEXT NOT NULL,
  autor_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: usar service role nas APIs (admin client), sem policies necessárias
-- Se preferir RLS explícita, adicione abaixo:
-- ALTER TABLE sugestoes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "insert_own" ON sugestoes FOR INSERT TO authenticated
--   WITH CHECK (autor_id = auth.uid());`

export const SQL_TRIGGER = `-- Exemplo de trigger para gerar notificações automaticamente
-- quando um módulo for atualizado. Adapte para cada tabela.

CREATE OR REPLACE FUNCTION fn_notificar_modulo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cfg   RECORD;
  uid   UUID;
BEGIN
  SELECT * INTO cfg
    FROM notificacoes_config
   WHERE modulo = TG_ARGV[0] AND ativo = true;
  IF NOT FOUND THEN RETURN NEW; END IF;

  FOR uid IN
    SELECT p.id FROM profiles p
     WHERE p.papel = ANY(cfg.perfis_notificados)
       AND p.id != auth.uid()   -- não notifica quem gerou
  LOOP
    INSERT INTO notificacoes_usuario(usuario_id, modulo, visto)
    VALUES (uid, TG_ARGV[0], false);
  END LOOP;
  RETURN NEW;
END;
$$;

-- Exemplo: notificar quando PDI for atualizado
-- CREATE TRIGGER trg_notif_pdi
--   AFTER INSERT OR UPDATE ON pdi_acoes
--   FOR EACH ROW EXECUTE FUNCTION fn_notificar_modulo('pdi');`
