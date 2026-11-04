-- ============================================================
-- Questionários — RESTRITO, LINK ANÔNIMO e PESQUISA INTERNA
-- GT3 Sistema — colar no SQL Editor do Supabase
--
-- 1) restrito: só gestor e admin veem o questionário, os convites e
--    as respostas. Para os demais perfis a API filtra e responde 404.
-- 2) link_anonimo: um link só para todos, sem nome. Cada envio vira
--    uma resposta "Anônimo" (sem e-mail, só a data, sem horário).
-- 3) Público 'Colaborador' (além de Contratante e Prestador).
-- 4) Cria as duas pesquisas do PESQUISA INTERNA.docx, restritas e em
--    rascunho:
--    - Anônima: 39 perguntas, já com link anônimo gerado;
--    - PDI (identificada): 22 perguntas, com convite por pessoa.
--    Perguntas "Anônima ou identificada" entram nas duas.
--
-- Rodar ANTES de publicar o código novo. Pode rodar mais de uma vez.
-- ============================================================

ALTER TABLE public.questionarios
  ADD COLUMN IF NOT EXISTS restrito boolean NOT NULL DEFAULT false;

ALTER TABLE public.questionarios
  ADD COLUMN IF NOT EXISTS link_anonimo text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questionarios_link_anonimo
  ON public.questionarios (link_anonimo) WHERE link_anonimo IS NOT NULL;

ALTER TABLE public.questionarios DROP CONSTRAINT IF EXISTS questionarios_publico_check;
ALTER TABLE public.questionarios ADD CONSTRAINT questionarios_publico_check
  CHECK (publico IN ('Contratante','Prestador','Colaborador'));

ALTER TABLE public.questionario_convites DROP CONSTRAINT IF EXISTS questionario_convites_tipo_check;
ALTER TABLE public.questionario_convites ADD CONSTRAINT questionario_convites_tipo_check
  CHECK (tipo IN ('Contratante','Prestador','Colaborador'));

-- ---------- Pesquisa anônima (39 perguntas) ----------
INSERT INTO public.questionarios (titulo, publico, status, restrito, link_anonimo, perguntas, painel_config)
SELECT
  'PESQUISA INTERNA — Anônima',
  'Colaborador',
  'rascunho',
  true,
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  $json$[
    {"id":"q01","type":"escala","label":"De modo geral, qual é o seu nível de satisfação em trabalhar na GT3?","min":"Muito insatisfeito","max":"Muito satisfeito"},
    {"id":"q02","type":"escala","label":"Quanto você recomendaria a GT3 como lugar para trabalhar a um amigo?","min":"Não recomendaria","max":"Recomendaria com certeza"},
    {"id":"q03","type":"escala","label":"Como você avalia o clima entre os colegas no dia a dia?","min":"Muito ruim","max":"Excelente"},
    {"id":"q04","type":"escala","label":"Você se sente à vontade para dar sua opinião, mesmo quando discorda?","min":"Nunca","max":"Sempre"},
    {"id":"q05","type":"multipla","label":"Como está o seu ânimo com o trabalho nos últimos três meses?","options":["Mais motivado(a) do que antes","Igual","Menos motivado(a) do que antes"]},
    {"id":"q06","type":"escala","label":"Você se sente respeitado(a) no ambiente de trabalho?","min":"Nunca","max":"Sempre"},
    {"id":"q07","type":"texto","label":"O que mais te deixa satisfeito(a) em trabalhar na GT3?"},
    {"id":"q08","type":"escala","label":"Como você avalia o apoio que recebe da sua liderança?","min":"Muito ruim","max":"Excelente"},
    {"id":"q09","type":"escala","label":"Sua liderança dá feedbacks claros sobre o seu trabalho?","min":"Nunca","max":"Sempre"},
    {"id":"q10","type":"multipla","label":"Com que frequência você recebe feedback sobre o seu desempenho?","options":["Toda semana","Todo mês","A cada poucos meses","Quase nunca"]},
    {"id":"q11","type":"escala","label":"As decisões da gestão são explicadas para a equipe?","min":"Nunca","max":"Sempre"},
    {"id":"q12","type":"escala","label":"Você confia que pode levar um problema à liderança sem sofrer consequências negativas?","min":"Não confio","max":"Confio totalmente"},
    {"id":"q13","type":"escala","label":"As prioridades do seu trabalho estão claras para você?","min":"Nada claras","max":"Muito claras"},
    {"id":"q14","type":"texto","label":"O que a sua liderança poderia fazer diferente para te ajudar mais?"},
    {"id":"q15","type":"escala","label":"Como você avalia a colaboração entre as pessoas da equipe?","min":"Muito ruim","max":"Excelente"},
    {"id":"q16","type":"escala","label":"As informações importantes chegam até você a tempo?","min":"Nunca","max":"Sempre"},
    {"id":"q17","type":"multipla","label":"Por onde você prefere receber os comunicados internos?","options":["GT3 Sistema","E-mail","WhatsApp","Reunião"]},
    {"id":"q18","type":"escala","label":"As reuniões de equipe são produtivas?","min":"Nada produtivas","max":"Muito produtivas"},
    {"id":"q19","type":"escala","label":"Os colegas se ajudam quando alguém está sobrecarregado?","min":"Nunca","max":"Sempre"},
    {"id":"q20","type":"texto","label":"Que mudança tornaria a comunicação interna melhor?"},
    {"id":"q24","type":"escala","label":"Você sente que tem oportunidade de crescer na GT3?","min":"Nenhuma","max":"Muitas"},
    {"id":"q25","type":"escala","label":"A GT3 oferece o treinamento de que você precisa para fazer bem o seu trabalho?","min":"Não oferece","max":"Oferece totalmente"},
    {"id":"q29","type":"multipla","label":"Como você avalia o volume de trabalho que recebe?","options":["Tranquilo","Adequado","Pesado às vezes","Pesado com frequência"]},
    {"id":"q30","type":"escala","label":"As ferramentas e sistemas que você usa ajudam no seu trabalho?","min":"Atrapalham","max":"Ajudam muito"},
    {"id":"q31","type":"escala","label":"Como você avalia o GT3 Sistema no seu dia a dia?","min":"Muito ruim","max":"Excelente"},
    {"id":"q32","type":"escala","label":"Você consegue equilibrar trabalho e vida pessoal?","min":"Nunca","max":"Sempre"},
    {"id":"q33","type":"texto","label":"Qual tarefa da sua rotina mais toma tempo e poderia ser simplificada?"},
    {"id":"q34","type":"escala","label":"Você se sente reconhecido(a) pelo trabalho que entrega?","min":"Nada reconhecido(a)","max":"Muito reconhecido(a)"},
    {"id":"q35","type":"multipla","label":"Que tipo de reconhecimento é mais importante para você?","options":["Elogio direto da liderança","Reconhecimento na frente da equipe","Oportunidade de crescimento","Benefício ou bonificação"]},
    {"id":"q36","type":"escala","label":"Como você avalia a sua remuneração em relação às suas responsabilidades?","min":"Muito abaixo","max":"Totalmente adequada"},
    {"id":"q37","type":"escala","label":"Como você avalia o pacote de benefícios da GT3?","min":"Muito ruim","max":"Excelente"},
    {"id":"q38","type":"multipla","label":"Qual benefício faria mais diferença para você?","options":["Auxílio para cursos e formação","Mais dias de home office","Horário flexível","Plano de saúde ou odontológico","Vale-alimentação maior"]},
    {"id":"q39","type":"escala","label":"O esforço extra da equipe é percebido pela empresa?","min":"Nunca","max":"Sempre"},
    {"id":"q40","type":"multipla","label":"Você se vê trabalhando na GT3 daqui a dois anos?","options":["Com certeza","Provavelmente","Talvez","Provavelmente não"]},
    {"id":"q41","type":"multipla","label":"Se um dia pensasse em sair, qual seria o principal motivo?","options":["Remuneração","Falta de crescimento","Carga de trabalho","Relação com a liderança","Clima da equipe","Não penso em sair"]},
    {"id":"q42","type":"texto","label":"O que faria você ficar mais tempo na GT3?"},
    {"id":"q43","type":"texto","label":"Que ideia você tem para melhorar a GT3 como empresa?"},
    {"id":"q44","type":"texto","label":"Existe alguma situação que te incomoda e que você nunca teve espaço para falar?"},
    {"id":"q45","type":"texto","label":"Espaço livre para comentários, críticas ou elogios."}
  ]$json$::jsonb,
  '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.questionarios WHERE titulo = 'PESQUISA INTERNA — Anônima');

-- ---------- Pesquisa de PDI, identificada (22 perguntas) ----------
INSERT INTO public.questionarios (titulo, publico, status, restrito, link_anonimo, perguntas, painel_config)
SELECT
  'PESQUISA INTERNA — PDI (identificada)',
  'Colaborador',
  'rascunho',
  true,
  NULL,
  $json$[
    {"id":"q01","type":"escala","label":"De modo geral, qual é o seu nível de satisfação em trabalhar na GT3?","min":"Muito insatisfeito","max":"Muito satisfeito"},
    {"id":"q02","type":"escala","label":"Quanto você recomendaria a GT3 como lugar para trabalhar a um amigo?","min":"Não recomendaria","max":"Recomendaria com certeza"},
    {"id":"q05","type":"multipla","label":"Como está o seu ânimo com o trabalho nos últimos três meses?","options":["Mais motivado(a) do que antes","Igual","Menos motivado(a) do que antes"]},
    {"id":"q13","type":"escala","label":"As prioridades do seu trabalho estão claras para você?","min":"Nada claras","max":"Muito claras"},
    {"id":"q15","type":"escala","label":"Como você avalia a colaboração entre as pessoas da equipe?","min":"Muito ruim","max":"Excelente"},
    {"id":"q16","type":"escala","label":"As informações importantes chegam até você a tempo?","min":"Nunca","max":"Sempre"},
    {"id":"q17","type":"multipla","label":"Por onde você prefere receber os comunicados internos?","options":["GT3 Sistema","E-mail","WhatsApp","Reunião"]},
    {"id":"q18","type":"escala","label":"As reuniões de equipe são produtivas?","min":"Nada produtivas","max":"Muito produtivas"},
    {"id":"q20","type":"texto","label":"Que mudança tornaria a comunicação interna melhor?"},
    {"id":"q21","type":"escala","label":"Você conhece as metas do seu PDI para este ano?","min":"Não conheço","max":"Conheço bem"},
    {"id":"q22","type":"escala","label":"Quanto você avançou nas ações do seu PDI nos últimos seis meses?","min":"Nada","max":"Muito"},
    {"id":"q23","type":"multipla","label":"Qual formato de aprendizado funciona melhor para você?","options":["Curso online","Treinamento interno","Acompanhar um colega mais experiente","Leitura e material escrito"]},
    {"id":"q24","type":"escala","label":"Você sente que tem oportunidade de crescer na GT3?","min":"Nenhuma","max":"Muitas"},
    {"id":"q25","type":"escala","label":"A GT3 oferece o treinamento de que você precisa para fazer bem o seu trabalho?","min":"Não oferece","max":"Oferece totalmente"},
    {"id":"q26","type":"multipla","label":"Onde você se vê profissionalmente daqui a dois anos?","options":["Na mesma função, com mais experiência","Assumindo mais responsabilidades","Em outra área da GT3","Ainda não sei"]},
    {"id":"q27","type":"escala","label":"As conversas de acompanhamento do PDI são úteis para você?","min":"Nada úteis","max":"Muito úteis"},
    {"id":"q28","type":"texto","label":"Que apoio da GT3 ajudaria você a atingir seus objetivos de desenvolvimento?"},
    {"id":"q30","type":"escala","label":"As ferramentas e sistemas que você usa ajudam no seu trabalho?","min":"Atrapalham","max":"Ajudam muito"},
    {"id":"q31","type":"escala","label":"Como você avalia o GT3 Sistema no seu dia a dia?","min":"Muito ruim","max":"Excelente"},
    {"id":"q33","type":"texto","label":"Qual tarefa da sua rotina mais toma tempo e poderia ser simplificada?"},
    {"id":"q43","type":"texto","label":"Que ideia você tem para melhorar a GT3 como empresa?"},
    {"id":"q45","type":"texto","label":"Espaço livre para comentários, críticas ou elogios."}
  ]$json$::jsonb,
  '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.questionarios WHERE titulo = 'PESQUISA INTERNA — PDI (identificada)');

-- Garante que as duas ficam restritas mesmo se já existiam com esse nome.
UPDATE public.questionarios SET restrito = true
WHERE titulo IN ('PESQUISA INTERNA — Anônima', 'PESQUISA INTERNA — PDI (identificada)');
