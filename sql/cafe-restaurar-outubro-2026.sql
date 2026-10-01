-- Café: devolve OUTUBRO/2026 como mês vigente (foi finalizado por engano).
-- O mês vigente atual (novembro/2026, gerado automaticamente) vai para o histórico — nada é apagado.
-- Só age se a planilha de outubro/2026 existir. Execute uma vez no SQL Editor do Supabase.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.cafe_sheets WHERE year = 2026 AND month_idx = 9) THEN
    UPDATE public.cafe_sheets SET is_current = FALSE WHERE is_current = TRUE AND NOT (year = 2026 AND month_idx = 9);
    UPDATE public.cafe_sheets SET is_current = TRUE  WHERE year = 2026 AND month_idx = 9;
  END IF;
END $$;

-- Conferência: deve listar outubro/2026 com is_current = true
SELECT year, month_idx, is_current FROM public.cafe_sheets ORDER BY year DESC, month_idx DESC LIMIT 4;
