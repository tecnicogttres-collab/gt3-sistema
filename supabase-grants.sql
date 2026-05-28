-- ═══════════════════════════════════════════════════════════════════
-- GT3 Sistema — GRANTs explícitos para todas as tabelas públicas
-- Execute no SQL Editor do Supabase
-- Necessário conforme mudança Supabase a partir de outubro/2026
-- ═══════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- ── Perfis ────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- ── Revisões Trainee ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisoes_datas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisoes_datas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisoes_trainee TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisoes_trainee TO service_role;

-- ── PDI ───────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdis TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_acoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_acoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_notificacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_notificacoes TO service_role;

-- ── PDI Ciclos ────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_ciclos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_ciclos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_conversa_avisos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_conversa_avisos TO service_role;

-- ── Observações ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observacoes_subtabs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observacoes_subtabs TO service_role;

-- ── Prioridades ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades_avisos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades_avisos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades_vistas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridades_vistas TO service_role;

-- ── Atas ──────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atas_leituras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atas_leituras TO service_role;

-- ── Home Office ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_office_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_office_sheets TO service_role;

-- ── Controle Revisão BSA ──────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_revisao_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_revisao_sheets TO service_role;

-- ── Cadastro Contratantes ─────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratantes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratantes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratantes_favs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratantes_favs TO service_role;

-- ── E-mail Templates ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO service_role;

-- ── Ramais ────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ramais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ramais TO service_role;

-- ── Manuais ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manuais_categorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manuais_categorias TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manuais_documentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manuais_documentos TO service_role;

-- ── Aniversários ──────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aniversarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aniversarios TO service_role;

-- ── Frases Diárias ────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frases_rotacao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frases_rotacao TO service_role;

-- ── Lembretes ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes_historico TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes_historico TO service_role;

-- ── Enquetes ──────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquetes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquetes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquete_perguntas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquete_perguntas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquete_opcoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquete_opcoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquete_respostas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquete_respostas TO service_role;

-- ── Sugestões ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sugestoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sugestoes TO service_role;

-- ── Notificações ──────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_usuario TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_usuario TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_config TO service_role;
