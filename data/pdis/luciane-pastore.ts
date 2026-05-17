import type { PdiColaborador } from './types'

const lucianePastore: PdiColaborador = {
  id: "luciane-pastore",
  nome: "Luciane Pastore",
  funcao: "Tecnica em segurança do trabalho JR",
  periodo: "de Desenvolvimento: 06/01/25 - 30/11/25",
  matrizAvaliacao: {
    competencias: [
      "Relacionamento Interpessoal",
      "Inteligência Emocional no Trabalho",
      "E-mail",
      "WhatsApp",
      "Comprometimento",
      "Doc funcionário",
      "Doc empresa",
      "PGR/PCMSO/LTCAT",
      "Cadastro e itens relacionados",
      "Doc veículo",
      "Atendimento ao cliente"
    ],
    diretiva: [
      3,
      3,
      3,
      1,
      5,
      2,
      1,
      1,
      1,
      1,
      3
    ],
    auto: [
      5,
      5,
      4,
      4,
      5,
      4,
      3,
      3,
      2,
      1,
      4
    ],
    ambicao: [
      5,
      5,
      4,
      4,
      5,
      4,
      3,
      3,
      2,
      1,
      4
    ],
    totais: {
      diretiva: 24,
      auto: 40,
      ambicao: 40,
      max: 55
    }
  },
  planoDeAcao: [
    {
      competencia: "Proatividade",
      desenvolver: "Ampliar conhecimentos do sistema (visão sistêmica), identificar quais processos existem, quais o afetam e quais são afetados. Iniciativa de perguntar/questionar diferentes pessoas e situações",
      acoes: "Ampliar foco no processo geral da empresa. Através de situações diversas que surgirem, e-mail/ligação, conversar com demais integrantes sobre o tema",
      resultadosEsperados: "Amplo conhecimento das atividades da empresa. Aumento do entrosamento com a equipe,  para aumentar a gama de conhecimento sobre demais áreas, melhorando relacionando interpessoal e profissional",
      inicio: "08/12/2025",
      termino: "28/02/2025",
      status: ""
    },
    {
      competencia: "Documentação",
      desenvolver: "Navegar em docs de veículos",
      acoes: "Passar a considerar estes documentos como parte da gama de docs a serem avaliados",
      resultadosEsperados: "Entender o conceito da solitação destes itens, assim facilitando o aprendizado e consequentemente realizando avaliações com segurança",
      inicio: "08/12/2025",
      termino: "28/02/2025",
      status: ""
    },
    {
      competencia: "Documentação",
      desenvolver: "Entendimento conceitual da solicitação dos docs da empresa",
      acoes: "Questionar, pesquisar, buscar conhecer a gama de documentos da empresa",
      resultadosEsperados: "Atingir um conhecimento satisfatório sobre o motivo da solicitação de documentos da empresa e o que eles representam, centrando-se nos docs bases",
      inicio: "08/12/2025",
      termino: "28/02/2025",
      status: ""
    },
    {
      competencia: "Comportamental",
      desenvolver: "Verificação de itens na segunda-feira pela manhã",
      acoes: "Conferir através do filtro do GT0210 os itens que ficaram pendentes na última semana",
      resultadosEsperados: "Evitar deixar itens parados da última semana no dashboard",
      inicio: "08/12/2025",
      termino: "28/02/2025",
      status: ""
    },
    {
      competencia: "Comportamental",
      desenvolver: "Aprimorar a definição de prioridade",
      acoes: "Principalmente com itens da BSA, definir melhores horários de iniciá-los, como evitar itens dessa contratante às 8:00 de sgunda-feira ou quando o restante do dashboard está cheio. Já há uma boa noção sobre isso, porém cabem melhorias pontuais.",
      resultadosEsperados: "Não deixar contratantes prioritárias (catracas) sem avaliação por conta de empresas não prioritárias",
      inicio: "08/12/2025",
      termino: "28/02/2025",
      status: ""
    },
    {
      competencia: "Comportamental",
      desenvolver: "Diminuir ações defensivas",
      acoes: "Ter maior domínio das atividades realizadas",
      resultadosEsperados: "Diminuir vícios de linguagem ao ser questionada, como \"é que...''; ampliando o conhecimento técnico, diminuirá a insegurança",
      inicio: "08/12/2025",
      termino: "28/02/2025",
      status: ""
    },
    {
      competencia: "WhatsApp",
      desenvolver: "Começar a utilizar o WhatsApp",
      acoes: "Passar a ter a responsabilidade de responder o WhatsApp no que tange a documentação de pessoas e sistema",
      resultadosEsperados: "Aumentar a gama de situações que domina, acrescentando conhecimento, bem como, melhorando resposta para dúvidas pontuais",
      inicio: "08/12/2025",
      termino: "28/02/2025",
      status: ""
    },
    {
      competencia: "Conflito",
      desenvolver: "Entendimento que situações de convívio irão ocorrer",
      acoes: "Buscar ao máximo não deixar afetar o dia a dia, não criando restrições",
      resultadosEsperados: "Entender que o como reagimos a algo é uma questão nossa, não deixar se afetar com comentários e fofocas, pois não determinam o que é fato ou não",
      inicio: "08/12/2025",
      termino: "28/02/2025",
      status: ""
    }
  ],
  perfilComportamental: {
    eneagrama: {
      ranking: [
        {
          rank: 1,
          tipo: "Tipo 2 — Ajudante",
          pontuacao: "18/25"
        },
        {
          rank: 2,
          tipo: "Tipo 7 — Otimista",
          pontuacao: "16/25"
        },
        {
          rank: 3,
          tipo: "Tipo 9 — Mediadora",
          pontuacao: "16/25"
        }
      ],
      pontosFortes: [
        "Promove harmonia e estabilidade no ambiente.",
        "Segue rotinas com disciplina (perfil conservador facilita padronização).",
        "Execução consistente: entrega o que é solicitado sem resistência.",
        "Cumpre horários, prazos e instruções com fidelidade."
      ],
      pontosAtencao: [
        'Pode entrar na defensiva quando questionada ("É que…"), interpretando perguntas como cobrança.',
        "Baixa iniciativa em buscar informações por conta própria; depende de orientação.",
        "Risco de sobrecarga emocional se sentir que precisa agradar a todos."
      ],
      comoDesenvolver: [
        "Estimular gradualmente a autonomia: delegar pequenas tarefas de pesquisa com orientações objetivas.",
        "Fornecer checklists, fluxos e roteiros — ela trabalha melhor com processos estruturados.",
        "Funções de execução estruturada e acompanhamento de rotinas (controle documental, rotinas administrativas, conferências).",
        "Ideal em times que precisam de alguém que mantenha ritmo e continuidade sem gerar conflitos."
      ]
    },
    animais: [
      {
        animal: "Lobo",
        emoji: "🐺",
        pontoForte: "Lealdade e trabalho em equipe",
        tendencia: "Valoriza o grupo, segue o líder",
        percentual: 36
      },
      {
        animal: "Gato",
        emoji: "🐱",
        pontoForte: "Reservado no início, mas muito leal quando confia",
        tendencia: "Autonomia quando se sente seguro",
        percentual: 36
      },
      {
        animal: "Águia",
        emoji: "🦅",
        pontoForte: "Boa para tarefas estratégicas quando motivada",
        tendencia: "Tem visão estratégica quando se sente segura e envolvida no objetivo",
        percentual: 20
      },
      {
        animal: "Tubarão",
        emoji: "🦈",
        pontoForte: "",
        tendencia: 'Não gera conflitos desnecessários (mas também não "empurra" metas)',
        percentual: 8
      }
    ]
  },
  conclusoes: {
    forcas: [
      "Organizada e pouco caótica: prefere rotina, padrão e previsibilidade.",
      "Bom relacionamento interno: fácil convivência, transmite segurança.",
      "Humor equilibrado: mantém clima positivo na equipe."
    ],
    pontosAtencao: [
      'Defensividade imediata quando questionada ("É que…", "Eu fiz porque…"). → Indica medo de errar e receio de desapontar, não malícia.',
      "Pode evitar tarefas pouco claras por insegurança em tomar decisões."
    ],
    ondeAgrega: [
      "Atividades operacionais repetitivas que exigem precisão e rotina.",
      "Tarefas que exigem zelo e confiabilidade.",
      "Ambientes com clima positivo — ela ajuda a estabilizar a equipe.",
      "Atividades de controle de qualidade sob supervisão.",
      "Execução de fluxos que já estão prontos e desenhados.",
      "Comunicação com clientes quando a conversa é objetiva e sem conflito."
    ],
    comoPodeApoiar: [],
    riscos: [],
    comoLiderar: []
  }
}

export default lucianePastore
