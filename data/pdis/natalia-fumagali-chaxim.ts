import type { PdiColaborador } from './types'

const nataliaFumagaliChaxim: PdiColaborador = {
  id: 'natalia-fumagali-chaxim',
  nome: 'Natália Fumagali Chaxim',
  funcao: 'Auxiliar Administrativo',
  periodo: '12/08/2024 — 14/11/2025',
  matrizAvaliacao: {
    competencias: [
      'Relacionamento Interpessoal',
      'Inteligência Emocional',
      'E-mail',
      'WhatsApp',
      'Comprometimento',
      'Doc funcionário',
      'Doc empresa',
      'PGR/PCMSO/LTCAT',
      'Cadastro',
      'Doc veículo',
      'Atendimento ao cliente',
    ],
    diretiva: [2, 2, 3, 1, 3, 2, 1, 1, 4, 1, 2],
    auto: [3, 4, 3, 2, 5, 3, 2, 1, 4, 1, 3],
    ambicao: [5, 5, 5, 5, 5, 4, 5, 4, 4, 3, 4],
    totais: { diretiva: 22, auto: 31, ambicao: 49, max: 55 },
  },
  planoDeAcao: [
    { competencia: 'Proatividade', desenvolver: 'Desempenhar tarefas cotidianas sem solicitação prévia', acoes: 'Dominar as tarefas do dia a dia, não deixando atividades pertinentes sem ação ou no aguardo de que seja solicitado.', resultadosEsperados: 'Segurança técnica e emocional para realização dos itens.', status: 'Em andamento', inicio: '17/11/2025', termino: '28/02/2026' },
    { competencia: 'Proatividade', desenvolver: 'Iniciativa de perguntar/questionar', acoes: 'Através de situações diversas (e-mail/ligação), conversar com demais integrantes.', resultadosEsperados: 'Aumentar entrosamento e gama de conhecimento sobre demais áreas.', status: 'Não iniciado', inicio: '17/11/2025', termino: '28/02/2026' },
    { competencia: 'Documentação', desenvolver: 'Realizar aprovação de ASO e ficha registro', acoes: 'Passar a considerar estes documentos como parte da gama de docs a serem avaliados.', resultadosEsperados: 'Entender o conceito da solicitação destes itens, realizando avaliações com segurança.', status: 'Em andamento', inicio: '17/11/2025', termino: '28/02/2026' },
    { competencia: 'Documentação', desenvolver: 'Entendimento conceitual dos docs da empresa', acoes: 'Questionar, pesquisar, buscar conhecer a gama de documentos.', resultadosEsperados: 'Conhecimento satisfatório sobre o motivo da solicitação.', status: 'Não iniciado', inicio: '17/11/2025', termino: '28/02/2026' },
    { competencia: 'Comportamental', desenvolver: 'Uso do fone de ouvido', acoes: 'Cessar o uso do fone durante horário de expediente.', resultadosEsperados: 'Aumentar atenção e facilitar troca de informações.', status: 'Concluído', inicio: '17/11/2025', termino: '28/02/2026' },
    { competencia: 'Comportamental', desenvolver: 'Desenvolver senso de urgência', acoes: 'Identificar itens próximos a vencimento e tratar contratantes com prazos curtos.', resultadosEsperados: 'Entender momentos que precisam priorização.', status: 'Em andamento', inicio: '17/11/2025', termino: '28/02/2026' },
    { competencia: 'WhatsApp', desenvolver: 'Começar a utilizar o WhatsApp', acoes: 'Passar a responder o WhatsApp no que tange documentação.', resultadosEsperados: 'Ampliar domínio de canais com timing e qualidade.', status: 'Não iniciado', inicio: '17/11/2025', termino: '28/02/2026' },
    { competencia: 'Telefone', desenvolver: 'Começar a atender ligações', acoes: 'Passar a atender ligações e resolver assuntos de documentação.', resultadosEsperados: 'Ampliar domínio de canais com timing e qualidade.', status: 'Não iniciado', inicio: '17/11/2025', termino: '28/02/2026' },
  ],
  perfilComportamental: {
    eneagrama: {
      ranking: [
        { rank: 1, tipo: 'Tipo 2 — Ajudante', pontuacao: '20/25' },
        { rank: 2, tipo: 'Tipo 7 — Otimista', pontuacao: '18/25' },
        { rank: 3, tipo: 'Tipo 9 — Mediadora', pontuacao: '18/25' },
      ],
      pontosFortes: [
        'Gosta de ajudar e ser útil',
        'Afetiva, empática e colaborativa',
        'Constrói relações de confiança',
      ],
      pontosAtencao: [
        'Dificuldade em dizer não',
        'Pode se sobrecarregar',
      ],
      comoDesenvolver: [],
    },
    animais: [
      { animal: 'Lobo', emoji: '🐺', pontoForte: 'Relacional / Seguradora', tendencia: '' },
      { animal: 'Gato', emoji: '🐱', pontoForte: 'Analítica / Cuidadosa', tendencia: '' },
      { animal: 'Águia', emoji: '🦅', pontoForte: 'Estratégica / Visão', tendencia: '' },
      { animal: 'Tubarão', emoji: '🦈', pontoForte: 'Executor / Ação', tendencia: '' },
    ],
  },
  conclusoes: {
    forcas: [
      'Cumpre rotinas com consistência',
      'Atua bem com controles e conferências',
      'Mantém ambiente harmonioso',
      'Gera clima de confiança interna',
    ],
    pontosAtencao: [
      'Cobrança agressiva pode gerar retração',
      'Falta de clareza causa lentidão',
      'Desmotiva sem reconhecimento',
    ],
    ondeAgrega: [
      'Rotinas administrativas e documentais',
      'Conferência e padronização',
      'Apoio na gestão de prestadores',
      'Comunicação entre áreas',
    ],
    comoPodeApoiar: [],
    riscos: [],
    comoLiderar: [
      'Dar metas claras com prazos',
      'Feedback positivo público',
      'Nunca cobrar em público',
      'Acompanhar de perto no início',
    ],
  },
}

export default nataliaFumagaliChaxim
