-- Execute uma vez no SQL Editor do Supabase
-- GT3 Sistema — Frases Diárias: banco de frases com rotação diária

-- ── Tabelas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.frases (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  texto      TEXT        NOT NULL,
  autor      TEXT        NOT NULL DEFAULT '',
  fonte      TEXT        NOT NULL DEFAULT '',
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uma frase por dia; cascades se a frase for excluída
CREATE TABLE IF NOT EXISTS public.frases_rotacao (
  data      DATE        PRIMARY KEY,
  frase_id  UUID        NOT NULL REFERENCES public.frases(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frases_ativo ON public.frases(ativo);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS frases_updated_at ON public.frases;
CREATE TRIGGER frases_updated_at
  BEFORE UPDATE ON public.frases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.frases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frases_rotacao ENABLE ROW LEVEL SECURITY;

-- frases
DROP POLICY IF EXISTS "frases_select"        ON public.frases;
DROP POLICY IF EXISTS "frases_insert_gestor" ON public.frases;
DROP POLICY IF EXISTS "frases_update_gestor" ON public.frases;
DROP POLICY IF EXISTS "frases_delete_gestor" ON public.frases;

CREATE POLICY "frases_select"
  ON public.frases FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "frases_insert_gestor"
  ON public.frases FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor', 'admin'))
  );

CREATE POLICY "frases_update_gestor"
  ON public.frases FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor', 'admin'))
  );

CREATE POLICY "frases_delete_gestor"
  ON public.frases FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor', 'admin'))
  );

-- frases_rotacao: todos autenticados podem ler e inserir (banner usa INSERT para criar a entrada do dia);
-- apenas gestor/admin podem alterar ou excluir (shuffle admin)
DROP POLICY IF EXISTS "frases_rotacao_select"        ON public.frases_rotacao;
DROP POLICY IF EXISTS "frases_rotacao_insert"        ON public.frases_rotacao;
DROP POLICY IF EXISTS "frases_rotacao_update_gestor" ON public.frases_rotacao;
DROP POLICY IF EXISTS "frases_rotacao_delete_gestor" ON public.frases_rotacao;

CREATE POLICY "frases_rotacao_select"
  ON public.frases_rotacao FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "frases_rotacao_insert"
  ON public.frases_rotacao FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "frases_rotacao_update_gestor"
  ON public.frases_rotacao FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor', 'admin'))
  );

CREATE POLICY "frases_rotacao_delete_gestor"
  ON public.frases_rotacao FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND papel IN ('gestor', 'admin'))
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE public.frases         REPLICA IDENTITY FULL;
ALTER TABLE public.frases_rotacao REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.frases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.frases_rotacao;

-- ── Seed (idempotente — ignora textos já existentes) ─────────────────────────

INSERT INTO public.frases (texto, autor, fonte, ativo)
SELECT v.texto, v.autor, v.fonte, true
FROM (VALUES
  ('O que pode ser medido pode ser melhorado.', 'Peter Drucker', ''),
  ('Cultura come estratégia no café da manhã.', 'Peter Drucker', ''),
  ('A qualidade nunca é um acidente; é sempre o resultado de esforço inteligente.', 'John Ruskin', ''),
  ('Não basta fazer o seu melhor: você deve saber o que fazer, e então fazer o seu melhor.', 'W. Edwards Deming', ''),
  ('O trabalho é amor tornado visível.', 'Khalil Gibran', 'O Profeta'),
  ('A jornada de mil milhas começa com um único passo.', 'Lao-Tsé', 'Tao Te Ching'),
  ('Conhecer os outros é inteligência. Conhecer a si mesmo é sabedoria.', 'Lao-Tsé', 'Tao Te Ching'),
  ('A vida é simples, mas insistimos em torná-la complicada.', 'Confúcio', 'Analetos'),
  ('Aprenda como se fosse viver para sempre. Viva como se fosse morrer amanhã.', 'Mahatma Gandhi', ''),
  ('Não são as coisas que nos perturbam, mas a opinião que temos delas.', 'Epicteto', 'Enquiridião'),
  ('Faça o melhor uso do que está em seu poder e tome o resto como ele acontece.', 'Epicteto', 'Enquiridião'),
  ('A liberdade não é conquistada satisfazendo desejos, mas eliminando-os.', 'Epicteto', 'Enquiridião'),
  ('Não busque que os eventos aconteçam como você quer. Deseje que aconteçam como acontecem.', 'Epicteto', 'Enquiridião'),
  ('Não há vento favorável para quem não sabe para onde vai.', 'Sêneca', 'Cartas a Lucílio'),
  ('Não temos pouco tempo. Desperdiçamos muito.', 'Sêneca', 'Sobre a Brevidade da Vida'),
  ('Enquanto adiamos, a vida passa.', 'Sêneca', 'Cartas a Lucílio'),
  ('Há mais coisas que nos assustam do que nos machucam de verdade.', 'Sêneca', 'Cartas a Lucílio'),
  ('A sorte é o que acontece quando a preparação encontra a oportunidade.', 'Sêneca', 'Cartas a Lucílio'),
  ('Suporte pacientemente o que não pode evitar.', 'Sêneca', 'Cartas a Lucílio'),
  ('A qualidade de sua vida é determinada pela qualidade de seus pensamentos.', 'Marco Aurélio', 'Meditações'),
  ('O obstáculo no caminho se torna o caminho.', 'Marco Aurélio', 'Meditações'),
  ('Faça cada ato como se fosse o último da sua vida.', 'Marco Aurélio', 'Meditações'),
  ('Se não é certo, não faça. Se não é verdade, não diga.', 'Marco Aurélio', 'Meditações'),
  ('Receba sem orgulho. Libere sem luta.', 'Marco Aurélio', 'Meditações'),
  ('A melhor vingança é não ser como seu inimigo.', 'Marco Aurélio', 'Meditações'),
  ('Quando você acorda de manhã, pense no precioso privilégio de estar vivo.', 'Marco Aurélio', 'Meditações'),
  ('O que prejudica a colmeia prejudica a abelha.', 'Marco Aurélio', 'Meditações'),
  ('Somos o que repetidamente fazemos. A excelência, portanto, não é um ato, mas um hábito.', 'Aristóteles', ''),
  ('Educar a mente sem educar o coração não é educação.', 'Aristóteles', ''),
  ('O contentamento é a riqueza natural.', 'Sócrates', ''),
  ('Quanto mais sei, mais sei que nada sei.', 'Sócrates', ''),
  ('Uma vida não examinada não vale a pena ser vivida.', 'Sócrates', 'Apologia'),
  ('Tudo que nos irrita nos outros pode nos levar a um entendimento sobre nós mesmos.', 'Carl Jung', ''),
  ('Quem olha para fora, sonha. Quem olha para dentro, desperta.', 'Carl Jung', ''),
  ('Até que o inconsciente se torne consciente, ele dirigirá sua vida e você o chamará de destino.', 'Carl Jung', 'Psicologia e Alquimia'),
  ('Não podemos mudar nada sem antes aceitá-lo.', 'Carl Jung', 'Psicologia e Religião'),
  ('O encontro de duas personalidades é como o contato de duas substâncias químicas: se há alguma reação, ambas se transformam.', 'Carl Jung', ''),
  ('Solidão não vem de não ter pessoas ao redor, mas de não conseguir comunicar o que parece importante.', 'Carl Jung', 'Memórias, Sonhos e Reflexões'),
  ('Entre o estímulo e a resposta há um espaço. Nesse espaço está o nosso poder de escolha.', 'Viktor Frankl', 'Em Busca de Sentido'),
  ('O ser humano pode suportar quase qualquer como se tiver um porquê.', 'Viktor Frankl', 'Em Busca de Sentido'),
  ('O sentido da vida é dar sentido à vida.', 'Viktor Frankl', 'Em Busca de Sentido'),
  ('Cada pessoa carrega uma luz própria. O trabalho da vida é não apagá-la.', 'Viktor Frankl', ''),
  ('Vulnerabilidade não é fraqueza. É a medida exata da coragem.', 'Brené Brown', 'A Coragem de Ser Imperfeito'),
  ('A conexão é o porquê estamos aqui.', 'Brené Brown', 'Os Dons da Imperfeição'),
  ('Confiança é construída em momentos pequenos e consistentes.', 'Brené Brown', 'Dare to Lead'),
  ('Não podemos praticar compaixão com os outros se não formos gentis conosco.', 'Brené Brown', ''),
  ('Cada ação que você toma é um voto para o tipo de pessoa que você quer se tornar.', 'James Clear', 'Hábitos Atômicos'),
  ('Você não sobe ao nível das suas metas. Você cai ao nível dos seus sistemas.', 'James Clear', 'Hábitos Atômicos'),
  ('Pequenas melhorias diárias levam a resultados extraordinários.', 'James Clear', 'Hábitos Atômicos'),
  ('A diferença entre quem você é e quem quer ser está no que você faz hoje.', 'James Clear', 'Hábitos Atômicos'),
  ('Você pode fazer mais amigos em dois meses se interessando pelos outros do que em dois anos tentando fazer os outros se interessarem por você.', 'Dale Carnegie', 'Como Fazer Amigos e Influenciar Pessoas'),
  ('A única forma de vencer uma discussão é evitá-la.', 'Dale Carnegie', 'Como Fazer Amigos e Influenciar Pessoas'),
  ('Critique o comportamento, nunca a pessoa.', 'Dale Carnegie', 'Como Fazer Amigos e Influenciar Pessoas'),
  ('Mostre apreciação honesta e sincera.', 'Dale Carnegie', 'Como Fazer Amigos e Influenciar Pessoas'),
  ('Primeiro procure entender, depois ser entendido.', 'Stephen Covey', 'Os 7 Hábitos das Pessoas Altamente Eficazes'),
  ('Comece com o fim em mente.', 'Stephen Covey', 'Os 7 Hábitos das Pessoas Altamente Eficazes'),
  ('O que você faz tem muito mais impacto do que o que você diz.', 'Stephen Covey', 'Os 7 Hábitos das Pessoas Altamente Eficazes'),
  ('Urgente e importante não são a mesma coisa.', 'Stephen Covey', 'Os 7 Hábitos das Pessoas Altamente Eficazes'),
  ('Dor mais reflexão igual a progresso.', 'Ray Dalio', 'Princípios'),
  ('A maior ameaça a uma boa decisão é o ego.', 'Ray Dalio', 'Princípios'),
  ('Fracasse, aprenda, adapte-se.', 'Ray Dalio', 'Princípios'),
  ('Bom é o inimigo do ótimo.', 'Jim Collins', 'Good to Great'),
  ('Confronte os fatos brutais. Mas nunca perca a fé.', 'Jim Collins', 'Good to Great'),
  ('As pessoas certas no ônibus valem mais do que a melhor estratégia.', 'Jim Collins', 'Good to Great'),
  ('Sistemas frágeis quebram sob pressão. Sistemas antifrágeis crescem com ela.', 'Nassim Taleb', 'Antifrágil'),
  ('O que te mata não é o risco que você vê. É o que você não vê.', 'Nassim Taleb', 'O Cisne Negro'),
  ('A imaginação é mais importante do que o conhecimento.', 'Albert Einstein', ''),
  ('A mente que se abre a uma nova ideia jamais volta ao seu tamanho original.', 'Oliver Wendell Holmes', ''),
  ('Não é o mais forte que sobrevive, mas o mais adaptável.', 'Charles Darwin', 'A Origem das Espécies'),
  ('Toda nossa ciência comparada com a realidade é primitiva e infantil — e ainda assim é a coisa mais preciosa que temos.', 'Albert Einstein', ''),
  ('Invista em conhecimento. Ele sempre rende os melhores juros.', 'Benjamin Franklin', ''),
  ('O analfabeto do século XXI não é quem não sabe ler. É quem não sabe aprender, desaprender e reaprender.', 'Alvin Toffler', ''),
  ('A maior descoberta é que um ser humano pode mudar sua vida mudando sua atitude.', 'William James', ''),
  ('O momento presente é o único onde você pode agir.', 'Eckhart Tolle', 'A Força do Agora'),
  ('O primeiro passo para mudar é a consciência. O segundo é a aceitação.', 'Eckhart Tolle', 'A Força do Agora'),
  ('Conheça todas as teorias. Domine todas as técnicas. Mas ao tocar uma alma humana, seja apenas outra alma humana.', 'Carl Jung', ''),
  ('Em meio ao caos, há também oportunidade.', 'Sun Tzu', 'A Arte da Guerra'),
  ('Conheça seu inimigo e a si mesmo e você não precisará temer o resultado de cem batalhas.', 'Sun Tzu', 'A Arte da Guerra'),
  ('Simplicidade é a sofisticação máxima.', 'Leonardo da Vinci', ''),
  ('Todo sistema é perfeitamente desenhado para obter os resultados que obtém.', 'W. Edwards Deming', ''),
  ('Se você quer ir rápido, vá sozinho. Se quer ir longe, vá acompanhado.', 'Provérbio Africano', ''),
  ('Até que o leão aprenda a escrever, toda história glorificará o caçador.', 'Provérbio Africano', ''),
  ('Caia sete vezes, levante-se oito.', 'Provérbio Japonês', ''),
  ('A coragem não é a ausência do medo. É agir apesar dele.', 'Nelson Mandela', ''),
  ('O sucesso não é final. O fracasso não é fatal. O que conta é a coragem de continuar.', 'Winston Churchill', ''),
  ('Comece onde você está. Use o que você tem. Faça o que você pode.', 'Arthur Ashe', ''),
  ('Não me diga o que você valoriza. Me mostre onde você aloca seu tempo.', 'Peter Drucker', ''),
  ('A melhor forma de prever o futuro é criá-lo.', 'Peter Drucker', ''),
  ('Treine as pessoas bem o suficiente para que possam ir embora. Trate-as bem o suficiente para que não queiram.', 'Richard Branson', ''),
  ('Ninguém se ilumina imaginando figuras de luz. A iluminação vem de tornar a escuridão consciente.', 'Carl Jung', ''),
  ('Originalidade não é um talento. É uma escolha.', 'Adam Grant', 'Originals'),
  ('As melhores ideias vêm de quem questiona o óbvio.', 'Adam Grant', 'Originals'),
  ('Feito é melhor do que perfeito.', 'Sheryl Sandberg', 'Lean In'),
  ('O barco seguro no porto não foi feito para o porto.', 'John A. Shedd', 'Salt from My Attic'),
  ('Plante árvores cuja sombra você sabe que não vai sentar.', 'Provérbio Grego', ''),
  ('No fim, não são os anos em sua vida que contam. É a vida em seus anos.', 'Abraham Lincoln', ''),
  ('Segurança psicológica é a base de equipes de alta performance.', 'Amy Edmondson', 'A Organização sem Medo'),
  ('O aprendizado ocorre na margem do que já sabemos.', 'Carol Dweck', 'Mindset'),
  ('A mentalidade de crescimento acredita que habilidades podem ser desenvolvidas com dedicação.', 'Carol Dweck', 'Mindset'),
  ('As pessoas não saem de empresas. Saem de líderes.', 'Marcus Buckingham', 'Primeiro, Quebre todas as Regras'),
  ('Feedback é o café da manhã dos campeões.', 'Ken Blanchard', ''),
  ('Uma equipe sem confiança não é uma equipe. É um grupo de pessoas ocupando o mesmo espaço.', 'Patrick Lencioni', 'As 5 Disfunções de uma Equipe'),
  ('Quando você começa a caminhar pelo caminho, o caminho aparece.', 'Rumi', ''),
  ('A satisfação está no esforço, não apenas no resultado.', 'Mahatma Gandhi', '')
) AS v(texto, autor, fonte)
WHERE NOT EXISTS (SELECT 1 FROM public.frases WHERE texto = v.texto);

-- ── GRANTs ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frases_rotacao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frases_rotacao TO service_role;
