-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — Storage bucket para imagens de Observações / Informações NR
-- Rodar no SQL Editor do Supabase (uma única vez)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Criar bucket público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'observacoes-imagens',
  'observacoes-imagens',
  true,
  8388608,  -- 8 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Leitura pública (qualquer um pode ver as imagens via URL pública)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'observacoes_imagens_public_read'
  ) THEN
    CREATE POLICY "observacoes_imagens_public_read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'observacoes-imagens');
  END IF;
END $$;

-- 3. Upload por usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'observacoes_imagens_auth_insert'
  ) THEN
    CREATE POLICY "observacoes_imagens_auth_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'observacoes-imagens');
  END IF;
END $$;

-- 4. Exclusão apenas por gestor/admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'observacoes_imagens_admin_delete'
  ) THEN
    CREATE POLICY "observacoes_imagens_admin_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'observacoes-imagens'
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND papel IN ('gestor', 'admin')
        )
      );
  END IF;
END $$;
