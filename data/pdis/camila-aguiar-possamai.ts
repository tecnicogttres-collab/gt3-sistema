import type { PdiColaborador } from './types'

const camilaAguiarPossamai: PdiColaborador = {
  id: "camila-aguiar-possamai",
  nome: "Camila Aguiar Possamai",
  funcao: "Técnica em Segurança do Trabalho PL",
  periodo: "06/01/2020 - 13/12/2025",
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
      2,
      4,
      4,
      4,
      4,
      4,
      5,
      4,
      4,
      4
    ],
    auto: [
      4,
      3,
      4,
      4,
      5,
      4,
      3,
      5,
      3,
      5,
      5
    ],
    ambicao: [
      4,
      3,
      4,
      4,
      5,
      4,
      3,
      5,
      3,
      5,
      5
    ],
    totais: {
      diretiva: 42,
      auto: 45,
      ambicao: 45,
      max: 55
    }
  },
  planoDeAcao: [
    {
      competencia: "Conflito",
      desenvolver: "Lidar com Conflitos Pessoais",
      acoes: "Buscar diminuir barreiras  com colegas",
      resultadosEsperados: "Uma convivência mais harmoniosa e que impulsione o lado técnico",
      inicio: "17/12/2025",
      termino: "28/02/2025",
      status: "Em Andamento"
    },
    {
      competencia: "Conflito",
      desenvolver: "Entendimento que situações de convívio irão ocorrer",
      acoes: "Buscar ao máximo não deixar afetar o dia a dia, não criando restrições. Exercitar uma comunicação não agressiva, troca por comunicação assertiva e clara, com harmonia, convite ao debate saudável.",
      resultadosEsperados: "Entender que o como reagimos a algo é uma questão nossa, não deixar se afetar com comentários e fofocas e afins, pois não determinam o que é fato ou não",
      inicio: "17/12/2025",
      termino: "28/02/2025",
      status: "Em Andamento"
    },
    {
      competencia: "Comportamental",
      desenvolver: "Iniciativa",
      acoes: "Procurar assumir mais responsabilidades, principalmente no âmbito técnico (o qual detém plena capacidade), como no caso da PLS",
      resultadosEsperados: "Ascender a um maior nível profissional e pessoal",
      inicio: "17/12/2025",
      termino: "28/02/2025",
      status: "Em Andamento"
    },
    {
      competencia: "Documentação",
      desenvolver: "Se valer de experiência e bases técnicas (Exposição do seu potencial alcançado pela experiência)",
      acoes: "Iniciativa em utilizar a experiência individual, amparada à bases técnicas, para enriquecer o debate interno ou externo sobre atividades diversificadas",
      resultadosEsperados: "Aprimorar a gama de conhecimento já existente, estimular e orientar a equipe a novos pontos e assertivos pontos de vista, a fim de contribuir para a fluidez da análise dos documentos diversos.",
      inicio: "17/12/2025",
      termino: "28/02/2025",
      status: "Em Andamento"
    }
  ],
  perfilComportamental: {
    eneagrama: {
      ranking: [
        {
          rank: 1,
          tipo: "Tipo 2 — Ajudante",
          pontuacao: "17/25"
        },
        {
          rank: 2,
          tipo: "Tipo 6 — Precavido",
          pontuacao: "16/25"
        },
        {
          rank: 3,
          tipo: "Tipo 1 — Perfeccionista",
          pontuacao: "14/25"
        }
      ],
      pontosFortes: [
        "Alto comprometimento com a empresa e com as pessoas",
        'Não "finge concordar": quando algo incomoda, ela comunica'
      ],
      pontosAtencao: [
        "Quando pressionada, pode ficar defensiva ou impaciente",
        "Tende a evitar assumir protagonismo total, mesmo sendo capaz",
        "Conflitos não resolvidos tendem a se prolongar"
      ],
      comoDesenvolver: [
        "Trabalhar distanciamento emocional entre opinião técnica e valor pessoal",
        "Desenvolver comunicação assertiva sem carga emocional",
        "Exposição gradual a decisões sem consenso total (ambientes imperfeitos)",
        "Referência técnica",
        "Apoio a novos colaboradores",
        "Ponte entre operação, normas e pessoas"
      ]
    },
    animais: [
      {
        animal: "Águia",
        emoji: "🦅",
        pontoForte: 'Boa leitura técnica e visão de "como deveria ser feito"',
        tendencia: "Analisa cenários pensando em riscos futuros e consequências.",
        percentual: 36
      },
      {
        animal: "Lobo",
        emoji: "🐺",
        pontoForte: "Lealdade institucional muito forte",
        tendencia: "Defende a empresa e o time, mas pode entrar em conflito quando sente injustiça",
        percentual: 32
      },
      {
        animal: "Gato",
        emoji: "🐱",
        pontoForte: "Autonomia técnica e observação cuidadosa.",
        tendencia: "Prefere agir quando se sente segura; evita exposição desnecessária.",
        percentual: 20
      },
      {
        animal: "Tubarão",
        emoji: "🦈",
        pontoForte: "Capacidade de enfrentamento quando valores são ameaçados.",
        tendencia: "Aparece mais de forma reativa/emocional, não como estilo dominante. Pode emergir em conflitos específicos",
        percentual: 12
      }
    ]
  },
  conclusoes: {
    forcas: [
      "Competência técnica consistente",
      "Lealdade institucional"
    ],
    pontosAtencao: [
      "Levar críticas para o emocional",
      "Resistência a conflitos diretos - Quando estoura, vem carregado de emoção",
      "Pode acumular frustração silenciosa"
    ],
    ondeAgrega: [
      "Análise técnica de documentos de SST",
      "Padronizações, revisões e validações",
      "Apoio para novos colaboradores"
    ],
    comoPodeApoiar: [
      "Validação cruzada de processos"
    ],
    riscos: [],
    comoLiderar: []
  }
}

export default camilaAguiarPossamai
