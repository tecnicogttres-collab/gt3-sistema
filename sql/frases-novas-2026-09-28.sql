-- ============================================================
-- Frases Diárias — lote de 50 novas frases (2026-09-28)
-- GT3 Sistema — colar no SQL Editor do Supabase
-- Idempotente: ignora textos que já existem na tabela.
-- ============================================================

INSERT INTO public.frases (texto, autor, fonte, ativo)
SELECT v.texto, v.autor, '', true
FROM (VALUES
  ('O homem que move montanhas começa carregando pequenas pedras.', 'Confúcio'),
  ('Não é a resposta que ilumina, mas a pergunta.', 'Eugène Ionesco'),
  ('Pensar é o trabalho mais difícil que existe. Talvez por isso tão poucos o façam.', 'Henry Ford'),
  ('A dúvida é o princípio da sabedoria.', 'Aristóteles'),
  ('Nada é tão perigoso quanto uma ideia quando é a única que você tem.', 'Émile Chartier'),
  ('Uma mente que se fecha é uma porta que se tranca por dentro.', 'Provérbio popular'),
  ('O silêncio é a linguagem de quem sabe mais do que precisa provar.', 'Provérbio popular'),
  ('Toda escolha é uma renúncia. Escolha bem o que vai renunciar.', 'William James'),
  ('Não existe falta de tempo. Existe excesso de prioridades.', 'Provérbio popular'),
  ('O presente é o único tempo que você possui de verdade.', 'Marco Aurélio'),
  ('Amanhã é a terra mais habitada do mundo.', 'Provérbio popular'),
  ('O que você não faz define você tanto quanto o que você faz.', 'Albert Camus'),
  ('Você é o produto das conversas que escolhe ter.', 'Provérbio popular'),
  ('Trate cada pessoa como se ela soubesse algo que você não sabe. Porque ela sabe.', 'Bill Nye'),
  ('Ninguém esquece quem o fez sentir importante.', 'Maya Angelou'),
  ('As pessoas não lembram do que você disse. Lembram de como você as fez sentir.', 'Maya Angelou'),
  ('Um ato de gentileza inesperado vale mais do que mil cortesias obrigatórias.', 'Provérbio popular'),
  ('Respeito não se exige. Se inspira.', 'Provérbio popular'),
  ('O orgulho pelo próprio trabalho é o salário que nenhuma empresa pode pagar.', 'Provérbio popular'),
  ('Não existe trabalho pequeno. Existe atenção pequena.', 'Provérbio popular'),
  ('Faça cada tarefa como se seu nome estivesse assinado embaixo.', 'Provérbio popular'),
  ('A diferença entre profissional e amador não é talento. É consistência.', 'Provérbio popular'),
  ('Você não cresce quando está confortável. Você se preserva.', 'Provérbio popular'),
  ('A versão de você de daqui a um ano agradece o que você faz hoje.', 'Provérbio popular'),
  ('O que você alimenta cresce. O que você ignora murcha.', 'Provérbio popular'),
  ('Crescer dói. Estagnar também. Escolha a dor que tem direção.', 'Provérbio popular'),
  ('Mude sua perspectiva e o problema muda com ela.', 'Wayne Dyer'),
  ('Perfeição é o inimigo do feito.', 'Voltaire'),
  ('O momento certo raramente chega. O momento atual sempre está aqui.', 'Provérbio popular'),
  ('Arrependimento de ter tentado dura dias. Arrependimento de não ter tentado dura a vida toda.', 'Provérbio popular'),
  ('A iniciativa é o privilégio de quem não espera permissão.', 'Provérbio popular'),
  ('Aprenda as regras como um profissional para quebrá-las como um artista.', 'Pablo Picasso'),
  ('Antes de diagnosticar o problema, verifique se você não é parte dele.', 'Provérbio popular'),
  ('O problema raramente é o problema. A forma como vemos o problema é o problema.', 'Stephen Covey'),
  ('Quem ouve apenas o que quer ouvir logo só escuta a si mesmo.', 'Provérbio popular'),
  ('Opinião forte, fraca convicção. Esteja disposto a mudar quando os fatos mudarem.', 'John Maynard Keynes'),
  ('A vida é a arte do encontro, embora haja tanto desencontro pela vida.', 'Vinícius de Moraes'),
  ('Feliz aquele que transfere o que sabe e aprende o que ensina.', 'Cora Coralina'),
  ('Muda a forma de ver e muda tudo ao redor.', 'Fernando Pessoa'),
  ('Não sou nada. Nunca serei nada. Não posso querer ser nada. À parte isso, tenho em mim todos os sonhos do mundo.', 'Fernando Pessoa'),
  ('O mapa não é o território. Confundi-los é a fonte de quase todo sofrimento desnecessário.', 'Alfred Korzybski'),
  ('Sistemas complexos que funcionam invariavelmente evoluíram de sistemas simples que funcionavam.', 'John Gall'),
  ('O que parece caos por fora muitas vezes é ordem que ainda não entendemos.', 'Ilya Prigogine'),
  ('Não tente ser interessante. Seja interessado. O resto vem sozinho.', 'Dale Carnegie'),
  ('O tempo que você passa fazendo algo que não importa é tempo que você rouba de algo que importa.', 'Henry David Thoreau'),
  ('Quem não questiona o óbvio nunca descobre o extraordinário.', 'Bertrand Russell'),
  ('A coragem começa antes da ação. É a decisão de tentar.', 'C.S. Lewis'),
  ('Artesanato é quando você coloca mais do que o necessário no que faz.', 'Robert Pirsig'),
  ('Ninguém é autossuficiente. A vida é tecida de encontros.', 'Guimarães Rosa'),
  ('Você não pode nadar em direção a novos horizontes sem ter a coragem de perder a costa de vista.', 'William Faulkner')
) AS v(texto, autor)
WHERE NOT EXISTS (SELECT 1 FROM public.frases WHERE texto = v.texto);

-- Conferência: quantas frases existem agora
SELECT COUNT(*) AS total_frases, COUNT(*) FILTER (WHERE ativo) AS ativas FROM public.frases;
