import type { PdiColaborador } from './types'

const marianeBorges: PdiColaborador = {
  id: "mariane-borges",
  nome: "Mariane Borges",
  funcao: "Assistente Administrativo",
  periodo: "15/09/25 - 01/04/2026",
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
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    auto: [
      3,
      4,
      4,
      4,
      4,
      3,
      2,
      1,
      4,
      2,
      3
    ],
    ambicao: [
      5,
      4,
      4,
      5,
      5,
      4,
      4,
      4,
      4,
      4,
      5
    ],
    totais: {
      diretiva: 0,
      auto: 34,
      ambicao: 48,
      max: 55
    }
  },
  planoDeAcao: [
    {
      competencia: "Conflito",
      desenvolver: "1) Lidar com Conflitos Pessoais 2) Lidar com Conflitos de Gerações diferentes",
      acoes: "1) Conversar com Sandra para entender reais causas do Ciúmes dos trainees e Encontrar solução conjunta. 2) Marcar conversa com Angeli e Clóvis para escutar ambas as partes e propor projeto em conjunto.",
      resultadosEsperados: "1) Maior entrosamento com os trainees e menor nível de atrito. 2) Aumentar a sinergia da geração X com a Y.",
      inicio: "01/01/2018",
      termino: "31/07/2018",
      status: "Em Andamento"
    }
  ],
  perfilComportamental: {
    eneagrama: {
      ranking: [
        {
          rank: 1,
          tipo: "Tipo 1 — Perfeccionista",
          pontuacao: "17/25"
        },
        {
          rank: 2,
          tipo: "Tipo 3 — Vencedor",
          pontuacao: "17/25"
        },
        {
          rank: 3,
          tipo: "Tipo 6 — Precavido",
          pontuacao: "16/25"
        }
      ],
      pontosFortes: [
        "Boa capacidade de comunicação franca e direta quando precisa expressar insatisfações ou desconfortos.",
        "Perseverança e resiliência (conseguiu se adaptar ao ritmo acelerado da GT3 mesmo com dificuldade inicial)."
      ],
      pontosAtencao: [
        "Adaptação mais lenta a ambientes de alto volume e ritmo acelerado (veio de um contexto com poucas demandas mensais).",
        "Dificuldade inicial em lidar com pressão e volume elevado de tarefas.",
        "Tendência a se sentir pessoalmente atingida por críticas ou exemplos genéricos (pode interpretar como injustiça ou exposição)."
      ],
      comoDesenvolver: [
        "Fortalecer autoconfiança na execução de tarefas financeiras sob pressão.",
        "Aprimorar a capacidade de separar observações profissionais de interpretações pessoais.",
        "Acelerar a curva de aprendizado em rotinas de alto volume e repetitivas.",
        "Atividades de rotina financeira bem estruturadas (emissão de notas, boletos e controle de recebimentos).",
        "Suporte administrativo financeiro com foco em execução e organização."
      ]
    },
    animais: [
      {
        animal: "Lobo",
        emoji: "🐺",
        pontoForte: "Organização, atenção a detalhes e capacidade de seguir processos de forma estruturada.",
        tendencia: "Prefere trabalhar com regras claras, checklists e padrões bem definidos.",
        percentual: 44
      },
      {
        animal: "Tubarão",
        emoji: "🦈",
        pontoForte: "Capacidade de agir com agilidade quando necessário para resolver pendências.",
        tendencia: "Pode gerar ansiedade interna em situações de alto volume ou pressão por velocidade.",
        percentual: 38
      },
      {
        animal: "Gato",
        emoji: "🐱",
        pontoForte: "Boa habilidade de manter um tom cordial e educado nas interações internas e com clientes. Facilita o ambiente de trabalho.",
        tendencia: "Prioriza harmonia e evita confrontos diretos.",
        percentual: 32
      },
      {
        animal: "Águia",
        emoji: "🦅",
        pontoForte: "Capacidade básica de visualizar o contexto geral das tarefas.",
        tendencia: "Baixa influência. Prefere seguir caminhos já conhecidos ao invés de propor inovações ou mudanças radicais.",
        percentual: 4
      }
    ],
    mbti: {
      tipo: "ESTJ",
      nucleo: "Mariane opera predominantemente no modo ESTJ (com forte proximidade de ESTP e ISTJ). Seu núcleo é prático, organizado e orientado por resultados. Ela funciona melhor em ambientes com regras claras, processos definidos e objetivos concretos. Tem boa capacidade de execução, senso de responsabilidade e prefere trabalhar com fatos, rotinas e entregas mensuráveis. É uma pessoa que valoriza ordem, eficiência e cumprimento de deveres.",
      veredito: "Mariane tem um perfil ESTJ bem marcado (86% de caimento), com forte viés para organização, execução prática e foco em resultados. É uma profissional confiável para rotinas financeiras e administrativas que exigem precisão, consistência e cumprimento de prazos. Seu maior valor está em funções operacionais bem estruturadas, onde pode aplicar sua capacidade de organização e senso de dever. No entanto, precisa de clareza de processos, estabilidade e feedback objetivo para performar no seu melhor. Ambientes muito flexíveis, caóticos ou com ritmo extremamente acelerado sem suporte podem gerar frustração.",
      estiloDecisao: "Decide principalmente pela lógica e eficiência (T – Thinking), com forte influência de estrutura e organização (J). Prefere decisões baseadas em fatos, prazos, regras e resultados práticos, em vez de considerações emocionais ou subjetivas. Gosta de clareza e objetividade. Quando há ambiguidade, tende a buscar padrões ou procedimentos já existentes para se apoiar. Pode ser direta e assertiva nas decisões, especialmente quando percebe ineficiência ou desorganização.",
      curvaAprendizado: "Aprende melhor de forma estruturada, prática e sequencial (fazendo + repetindo). Tem boa capacidade de absorver rotinas operacionais e procedimentos detalhados. A curva de aprendizado é mais rápida em tarefas concretas e repetitivas, mas mais lenta em situações de alta ambiguidade ou que exigem muita improvisação. Fortalece-se com treinamento prático, exemplos claros, checklists e feedback objetivo sobre performance.",
      impactoClima: "Contribui com organização, pontualidade e foco em resultados, ajudando a manter o time alinhado com processos. Traz estabilidade e previsibilidade para rotinas administrativas/financeiras. Pode gerar tensão se perceber desorganização ou falta de comprometimento dos outros. Seu impacto é mais positivo em equipes que valorizam estrutura, responsabilidade e execução eficiente."
    }
  },
  conclusoes: {
    forcas: [
      "Capacidade de expressar insatisfações de forma direta e madura (não guarda rancor).",
      "Experiência prévia na área financeira, mesmo que em contexto diferente."
    ],
    pontosAtencao: [],
    ondeAgrega: [
      "Execução de rotinas financeiras operacionais (emissão de notas fiscais, boletos e controle de pagamentos).",
      "Atividades administrativas que exigem organização, cuidado e consistência.",
      "Suporte em processos financeiros com possibilidade de aprendizado gradual."
    ],
    comoPodeApoiar: [
      "Tarefas repetitivas que demandem atenção e precisão."
    ],
    riscos: [],
    comoLiderar: []
  }
}

export default marianeBorges
