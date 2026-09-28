-- GT3 Sistema - Modulo Cronogramas de Implantacao
-- Um cronograma por contratante/projeto. A arvore de etapas e subetapas (datas, status,
-- responsaveis, dependencias e historico) fica em `itens` (jsonb) - o mesmo formato do
-- HTML de referencia gt3-cronograma-implantacao.
-- A mesma tabela guarda os MODELOS de cronograma (modelo = true): `cliente` vira o nome do modelo
-- e `projeto` o nome de projeto sugerido ao criar um cronograma a partir dele.
-- Acesso so pela API do sistema (service role) e por gestor/admin (RLS).
-- Execute uma vez no SQL Editor do Supabase. Pode ser reexecutado sem duplicar os exemplos.

CREATE TABLE IF NOT EXISTS public.cronogramas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente     text NOT NULL,
  projeto     text NOT NULL DEFAULT 'Implantação Portal de Terceiros',
  modelo      boolean NOT NULL DEFAULT false,
  itens       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{id, parent, t, det?, resp:['C'|'GT3'], ini?, fim?, st?, obs, deps:[], hist:[{d,u,t}]}]
  criado_por  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- Para quem ja criou a tabela na versao anterior (sem modelos):
ALTER TABLE public.cronogramas ADD COLUMN IF NOT EXISTS modelo boolean NOT NULL DEFAULT false;
DROP INDEX IF EXISTS public.uq_cronogramas_cliente_projeto;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cronogramas_modelo_cliente_projeto
  ON public.cronogramas (modelo, lower(cliente), lower(projeto));

ALTER TABLE public.cronogramas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cronogramas_gestor" ON public.cronogramas;
CREATE POLICY "cronogramas_gestor" ON public.cronogramas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor','admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronogramas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronogramas TO service_role;

-- Cronogramas do HTML de referencia (Soprano e CSG)
INSERT INTO public.cronogramas (cliente, projeto, itens) VALUES
('Soprano', 'Implantação Portal de Terceiros', $soprano$[
  {"id":"1","parent":null,"t":"Contrato de Prestação de Serviços","resp":["C","GT3"],"ini":"2026-09-21","fim":"2026-10-02","st":"aguardando","obs":"Necessário definir a modalidade: COM ou SEM COPARTICIPAÇÃO.","deps":[],"hist":[{"d":"2026-09-22T09:10","u":"GT3.MARCIO","t":"Proposta de contrato enviada à Soprano"},{"d":"2026-09-25T15:40","u":"GT3.RODRIGO","t":"Status: Em andamento → Aguardando cliente"}]},
  {"id":"2","parent":null,"t":"Alinhamento / Aprovação do cronograma","resp":["C","GT3"],"ini":"2026-09-28","fim":"2026-10-02","st":"pendente","obs":"Pendente de alinhamento.","deps":[],"hist":[]},
  {"id":"3","parent":null,"t":"Definições do Portal de Terceiros","resp":["C","GT3"],"obs":"","deps":[],"hist":[]},
  {"id":"3.1","parent":"3","t":"Definição de requisitos – Anexo 1","resp":["C"],"ini":"2026-10-01","fim":"2026-10-09","st":"pendente","obs":"Necessário agendar reunião para esta definição.","deps":[],"hist":[]},
  {"id":"3.2","parent":"3","t":"Relação de empresas terceiras","resp":["C"],"ini":"2026-09-21","fim":"2026-10-02","st":"andamento","obs":"Relação enviada. Falta confirmar se todas as empresas já existentes devem ou não ser ativadas para a Soprano.","deps":[],"hist":[{"d":"2026-09-24T11:05","u":"GT3.RODRIGO","t":"Relação de empresas recebida da Soprano"}]},
  {"id":"3.3","parent":"3","t":"Configuração do sistema / Portal","resp":["GT3"],"ini":"2026-10-12","fim":"2026-10-23","st":"pendente","obs":"Aguardar item 3.1.","deps":["3.1"],"hist":[]},
  {"id":"3.4","parent":"3","t":"Treinamento de terceiros – definir formato","resp":["C","GT3"],"ini":"2026-10-05","fim":"2026-10-16","st":"pendente","obs":"Definir modalidade do treinamento de terceiros: EAD ou presencial.","deps":[],"hist":[]},
  {"id":"3.5","parent":"3","t":"Relação de usuários","det":"Enviar relação com NOME e E-MAIL.\nTOTAL – consulta o conteúdo do documento\nPARCIAL – consulta status, sem acesso ao conteúdo\nRESTRITO – consulta status (Vigilância Patrimonial)","resp":["C"],"ini":"2026-10-05","fim":"2026-10-16","st":"pendente","obs":"Para os usuários internos, definir quem e qual perfil de acesso.","deps":[],"hist":[]},
  {"id":"3.6","parent":"3","t":"Integração GERACESSO","resp":["GT3","C"],"ini":"2026-11-09","fim":"2026-11-27","st":"pendente","obs":"Disponibilização da API Web Service para integrar o sistema de acesso ao portal. Execução alinhada com a data final da avaliação das empresas terceiras (item 5).","deps":[],"hist":[]},
  {"id":"4","parent":null,"t":"Comunicação / Divulgação","resp":["C","GT3"],"obs":"","deps":[],"hist":[]},
  {"id":"4.1","parent":"4","t":"Material de comunicação a ser enviado aos PS","resp":["C"],"ini":"2026-10-05","fim":"2026-10-16","st":"pendente","obs":"Aguardar item 1 – modalidade.","deps":["1"],"hist":[]},
  {"id":"4.2","parent":"4","t":"Reunião de divulgação","resp":["C","GT3"],"obs":"Definir datas em conjunto para divulgação da existência do portal.","deps":[],"hist":[]},
  {"id":"4.2.1","parent":"4.2","t":"Reunião interna","resp":["C","GT3"],"ini":"2026-10-19","fim":"2026-10-23","st":"pendente","obs":"","deps":["4.1"],"hist":[]},
  {"id":"4.2.2","parent":"4.2","t":"Reunião com empresas terceiras","resp":["C","GT3"],"ini":"2026-10-26","fim":"2026-10-30","st":"pendente","obs":"","deps":["4.2.1"],"hist":[]},
  {"id":"5","parent":null,"t":"Avaliação das empresas terceiras","resp":["GT3"],"ini":"2026-10-26","fim":"2026-11-27","st":"pendente","obs":"Prazo final a ser definido em conjunto.","deps":["3.3"],"hist":[]},
  {"id":"6","parent":null,"t":"Avaliação do processo / melhorias / ajustes","resp":["C","GT3"],"ini":"2026-11-30","fim":"2026-12-11","st":"pendente","obs":"A definir.","deps":["5"],"hist":[]}
]$soprano$::jsonb),
('CSG', 'Implantação Portal de Terceiros', $csg$[
  {"id":"1","parent":null,"t":"Assinatura do Contrato de Prestação de Serviços","resp":["C","GT3"],"ini":"2024-11-18","fim":"2024-11-29","st":"concluido","obs":"","deps":[],"hist":[]},
  {"id":"2","parent":null,"t":"Alinhamento CSG – GT3","resp":["C","GT3"],"ini":"2024-11-25","fim":"2024-12-06","st":"concluido","obs":"","deps":[],"hist":[]},
  {"id":"3","parent":null,"t":"Aprovação do cronograma","resp":["C","GT3"],"ini":"2024-12-02","fim":"2024-12-06","st":"concluido","obs":"Aprovado.","deps":[],"hist":[]},
  {"id":"4","parent":null,"t":"Definições do Portal de Terceiros","resp":["C","GT3"],"obs":"","deps":[],"hist":[]},
  {"id":"4.1","parent":"4","t":"Definição de requisitos a serem atendidos – Anexo 1","resp":["C","GT3"],"ini":"2024-12-02","fim":"2024-12-13","st":"concluido","obs":"","deps":[],"hist":[]},
  {"id":"4.2","parent":"4","t":"Relação de empresas terceiras","resp":["C"],"ini":"2024-12-02","fim":"2024-12-13","st":"concluido","obs":"","deps":[],"hist":[]},
  {"id":"4.3","parent":"4","t":"Configuração do sistema / Portal","resp":["GT3"],"ini":"2024-12-16","fim":"2025-01-10","st":"andamento","obs":"","deps":["4.1"],"hist":[]},
  {"id":"4.4","parent":"4","t":"Reunião com SESMT para alinhamento","resp":["C","GT3"],"ini":"2025-01-23","fim":"2025-01-23","st":"andamento","obs":"Reunião agendada com Diego, Cleverson, Pamela, Sergio / GT3 Marcio e Valmir.","deps":[],"hist":[]},
  {"id":"4.5","parent":"4","t":"Treinamento de terceiros – Integração","resp":["C","GT3"],"ini":"2025-01-06","fim":"2025-01-10","st":"aguardando","obs":"Aguardando definição de dia/horário/local para configuração.","deps":[],"hist":[]},
  {"id":"5","parent":null,"t":"Comunicação / Divulgação","resp":["C","GT3"],"obs":"","deps":[],"hist":[]},
  {"id":"5.1","parent":"5","t":"Material de divulgação do Portal e reuniões internas","resp":["GT3"],"ini":"2024-12-09","fim":"2024-12-20","st":"concluido","obs":"Aprovado.","deps":[],"hist":[]},
  {"id":"5.2","parent":"5","t":"Aprovação do material de comunicação","resp":["C"],"ini":"2024-12-23","fim":"2025-01-03","st":"concluido","obs":"Aprovado.","deps":["5.1"],"hist":[]},
  {"id":"5.3","parent":"5","t":"Convite para reunião com público interno e PS","resp":["C"],"ini":"2025-01-13","fim":"2025-01-17","st":"andamento","obs":"Convite será enviado às empresas prestadoras para reunião ON-LINE.","deps":[],"hist":[]},
  {"id":"5.4","parent":"5","t":"Reunião com terceiros","resp":["C","GT3"],"ini":"2025-01-21","fim":"2025-01-22","st":"pendente","obs":"Reuniões ON-LINE durante a semana de 21 e 22/01/25.","deps":["5.3"],"hist":[]},
  {"id":"6","parent":null,"t":"Avaliação / migração das empresas terceiras para o Portal","resp":["GT3"],"ini":"2025-01-27","fim":"2025-02-28","st":"pendente","obs":"Data final prevista de finalização do projeto.","deps":[],"hist":[]},
  {"id":"7","parent":null,"t":"Avaliação do processo / melhorias / ajustes","resp":["C","GT3"],"ini":"2025-03-03","fim":"2025-03-14","st":"pendente","obs":"A ser definida.","deps":["6"],"hist":[]}
]$csg$::jsonb)
ON CONFLICT DO NOTHING;

-- Modelos prontos, derivados dos dois cronogramas acima: mesma estrutura, prazos e dependencias,
-- status todos pendentes, sem historico, sem observacoes especificas de cada cliente e SEM datas
-- (so o item 1 do Modelo Soprano leva data, como ancora do inicio do projeto).
-- {cliente} nos textos vira o nome da contratante ao criar um cronograma a partir do modelo.
INSERT INTO public.cronogramas (cliente, projeto, modelo, itens) VALUES
('Modelo Soprano', 'Implantação Portal de Terceiros', true, $msoprano$[
  {"id":"1","parent":null,"t":"Contrato de Prestação de Serviços","resp":["C","GT3"],"ini":"2026-09-21","fim":"2026-10-02","st":"pendente","obs":"Necessário definir a modalidade: COM ou SEM COPARTICIPAÇÃO.","deps":[],"hist":[]},
  {"id":"2","parent":null,"t":"Alinhamento / Aprovação do cronograma","resp":["C","GT3"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"3","parent":null,"t":"Definições do Portal de Terceiros","resp":["C","GT3"],"obs":"","deps":[],"hist":[]},
  {"id":"3.1","parent":"3","t":"Definição de requisitos – Anexo 1","resp":["C"],"st":"pendente","obs":"Necessário agendar reunião para esta definição.","deps":[],"hist":[]},
  {"id":"3.2","parent":"3","t":"Relação de empresas terceiras","resp":["C"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"3.3","parent":"3","t":"Configuração do sistema / Portal","resp":["GT3"],"st":"pendente","obs":"Aguardar item 3.1.","deps":["3.1"],"hist":[]},
  {"id":"3.4","parent":"3","t":"Treinamento de terceiros – definir formato","resp":["C","GT3"],"st":"pendente","obs":"Definir modalidade do treinamento de terceiros: EAD ou presencial.","deps":[],"hist":[]},
  {"id":"3.5","parent":"3","t":"Relação de usuários","det":"Enviar relação com NOME e E-MAIL.\nTOTAL – consulta o conteúdo do documento\nPARCIAL – consulta status, sem acesso ao conteúdo\nRESTRITO – consulta status (Vigilância Patrimonial)","resp":["C"],"st":"pendente","obs":"Para os usuários internos, definir quem e qual perfil de acesso.","deps":[],"hist":[]},
  {"id":"3.6","parent":"3","t":"Integração GERACESSO","resp":["GT3","C"],"st":"pendente","obs":"Disponibilização da API Web Service para integrar o sistema de acesso ao portal. Execução alinhada com a data final da avaliação das empresas terceiras (item 5).","deps":[],"hist":[]},
  {"id":"4","parent":null,"t":"Comunicação / Divulgação","resp":["C","GT3"],"obs":"","deps":[],"hist":[]},
  {"id":"4.1","parent":"4","t":"Material de comunicação a ser enviado aos PS","resp":["C"],"st":"pendente","obs":"Aguardar item 1 – modalidade.","deps":["1"],"hist":[]},
  {"id":"4.2","parent":"4","t":"Reunião de divulgação","resp":["C","GT3"],"obs":"Definir datas em conjunto para divulgação da existência do portal.","deps":[],"hist":[]},
  {"id":"4.2.1","parent":"4.2","t":"Reunião interna","resp":["C","GT3"],"st":"pendente","obs":"","deps":["4.1"],"hist":[]},
  {"id":"4.2.2","parent":"4.2","t":"Reunião com empresas terceiras","resp":["C","GT3"],"st":"pendente","obs":"","deps":["4.2.1"],"hist":[]},
  {"id":"5","parent":null,"t":"Avaliação das empresas terceiras","resp":["GT3"],"st":"pendente","obs":"Prazo final a ser definido em conjunto.","deps":["3.3"],"hist":[]},
  {"id":"6","parent":null,"t":"Avaliação do processo / melhorias / ajustes","resp":["C","GT3"],"st":"pendente","obs":"A definir.","deps":["5"],"hist":[]}
]$msoprano$::jsonb),
('Modelo CSG', 'Implantação Portal de Terceiros', true, $mcsg$[
  {"id":"1","parent":null,"t":"Assinatura do Contrato de Prestação de Serviços","resp":["C","GT3"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"2","parent":null,"t":"Alinhamento {cliente} – GT3","resp":["C","GT3"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"3","parent":null,"t":"Aprovação do cronograma","resp":["C","GT3"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"4","parent":null,"t":"Definições do Portal de Terceiros","resp":["C","GT3"],"obs":"","deps":[],"hist":[]},
  {"id":"4.1","parent":"4","t":"Definição de requisitos a serem atendidos – Anexo 1","resp":["C","GT3"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"4.2","parent":"4","t":"Relação de empresas terceiras","resp":["C"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"4.3","parent":"4","t":"Configuração do sistema / Portal","resp":["GT3"],"st":"pendente","obs":"","deps":["4.1"],"hist":[]},
  {"id":"4.4","parent":"4","t":"Reunião com SESMT para alinhamento","resp":["C","GT3"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"4.5","parent":"4","t":"Treinamento de terceiros – Integração","resp":["C","GT3"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"5","parent":null,"t":"Comunicação / Divulgação","resp":["C","GT3"],"obs":"","deps":[],"hist":[]},
  {"id":"5.1","parent":"5","t":"Material de divulgação do Portal e reuniões internas","resp":["GT3"],"st":"pendente","obs":"","deps":[],"hist":[]},
  {"id":"5.2","parent":"5","t":"Aprovação do material de comunicação","resp":["C"],"st":"pendente","obs":"","deps":["5.1"],"hist":[]},
  {"id":"5.3","parent":"5","t":"Convite para reunião com público interno e PS","resp":["C"],"st":"pendente","obs":"Convite será enviado às empresas prestadoras para reunião ON-LINE.","deps":[],"hist":[]},
  {"id":"5.4","parent":"5","t":"Reunião com terceiros","resp":["C","GT3"],"st":"pendente","obs":"","deps":["5.3"],"hist":[]},
  {"id":"6","parent":null,"t":"Avaliação / migração das empresas terceiras para o Portal","resp":["GT3"],"st":"pendente","obs":"Data final prevista de finalização do projeto.","deps":[],"hist":[]},
  {"id":"7","parent":null,"t":"Avaliação do processo / melhorias / ajustes","resp":["C","GT3"],"st":"pendente","obs":"A ser definida.","deps":["6"],"hist":[]}
]$mcsg$::jsonb)
ON CONFLICT DO NOTHING;
