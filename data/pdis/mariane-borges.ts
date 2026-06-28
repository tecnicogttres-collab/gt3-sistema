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
      2,
      2,
      2,
      3,
      3,
      2,
      2,
      1,
      2,
      1,
      2
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
      diretiva: 22,
      auto: 34,
      ambicao: 48,
      max: 55
    }
  },
  planoDeAcao: [
    {
      competencia: "Processos que envolvem o setor cadastro",
      desenvolver: "Fluidez e conhecimento dentro do que engloba todo o setor",
      acoes: "Periodicamente, sentar junto ao José e assentar os conhecimentos que já tens noção. Posteriormente, iniciar com coisas que não teve contato ainda, que 'não sabes nada'. Visão sistêmica dos processos da GT3.\n\nObs: sugestão é realizar bastante anotações e depois organizá-las como ficar melhor",
      resultadosEsperados: "Virar referência no setor",
      inicio: "02/04/2026",
      termino: "",
      status: "Não iniciado"
    },
    {
      competencia: "Não acumular frustrações",
      desenvolver: "Buscar impedir que uma série de frustrações pontuais se acumulem, gerando algum grau de insatisfação. 'Não ruminar'. Buscar inteiração profissional com a equipe.",
      acoes: "Buscar entender que, o que parte do outro diz mais sobre ele do que sobre mim. Ignorar comentários alheios que não agregam profissionalmente, pois terás o apoio da gestão em sua caminhada, desde que mantido seu empenho. Engajamento em todos os demais assuntos pertinentes à empresa.",
      resultadosEsperados: "Leveza no dia a dia, resultando um melhor rendimento e uma rotina melhor, também.",
      inicio: "02/04/2026",
      termino: "",
      status: "Não iniciado"
    },
    {
      competencia: "Mapear possíveis melhorias",
      desenvolver: "Indicar o que pode ser melhorado no processo do financeiro",
      acoes: "Engloba dos itens mais simples, como mouse, teclado, PC à melhorias de processo, seja sistema, comportamentos, entre outros.",
      resultadosEsperados: "Tornar mais fácil (e melhor) o dia a dia",
      inicio: "02/04/2026",
      termino: "",
      status: "Não iniciado"
    },
    {
      competencia: "Processos de documentos de pessoas",
      desenvolver: "Realizar aprovações pontuais, prorrogações, orientações via e-mail",
      acoes: "Responder e-mails pertinentes a estes itens, sempre tirando dúvidas com os colegas quando precisar",
      resultadosEsperados: "Poder navegar dentro do básico no que se refere o GT0210 e afins",
      inicio: "02/04/2026",
      termino: "",
      status: "Não iniciado"
    }
  ],
  perfilComportamental: {
    eneagrama: {
      ranking: [
        {
          rank: 1,
          tipo: "Tipo 1 - O Reformador (Perfeccionista)",
          pontuacao: "17/25"
        },
        {
          rank: 2,
          tipo: "Tipo 3 - O Realizador (Bem-Sucedido)",
          pontuacao: "17/25"
        },
        {
          rank: 3,
          tipo: "Tipo 6 - O Lealista (Questionador)",
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
      veredito: "Mariane tem um perfil ESTJ bem marcado (86% de caimento), com forte viés para organização, execução prática e foco em resultados. É uma profissional confiável para rotinas financeiras e administrativas que exigem precisão, consistência e cumprimento de prazos.\nSeu maior valor está em funções operacionais bem estruturadas, onde pode aplicar sua capacidade de organização e senso de dever. No entanto, precisa de clareza de processos, estabilidade e feedback objetivo para performar no seu melhor. Ambientes muito flexíveis, caóticos ou com ritmo extremamente acelerado sem suporte podem gerar frustração e rigidez.\nRecomendação de alocação na GT3: Ideal para rotinas financeiras (emissão de notas, controle de recebimentos e conciliações), desde que haja estrutura clara e treinamento adequado para o volume da empresa. É um perfil que ganha força com o tempo e com processos bem definidos.",
      estiloDecisao: "Decide principalmente pela lógica e eficiência (T – Thinking), com forte influência de estrutura e organização (J). Prefere decisões baseadas em fatos, prazos, regras e resultados práticos, em vez de considerações emocionais ou subjetivas. Gosta de clareza e objetividade. Quando há ambiguidade, tende a buscar padrões ou procedimentos já existentes para se apoiar. Pode ser direta e assertiva nas decisões, especialmente quando percebe ineficiência ou desorganização.",
      relacionamentoAutoridade: "Respeita e valoriza autoridade quando ela é clara, consistente e baseada em competência.\nTem forte preferência por processos bem definidos, padronizados e previsíveis.\nAdapta-se melhor a estruturas hierárquicas claras e rotinas estabelecidas.\nReage mal a ambientes muito flexíveis, caóticos ou com mudanças frequentes sem justificativa lógica.\nPrecisa de orientação clara no início, mas ganha autonomia rapidamente quando o processo está bem mapeado.",
      curvaAprendizado: "Aprende melhor de forma estruturada, prática e sequencial (fazendo + repetindo). Tem boa capacidade de absorver rotinas operacionais e procedimentos detalhados. A curva de aprendizado é mais rápida em tarefas concretas e repetitivas, mas mais lenta em situações de alta ambiguidade ou que exigem muita improvisação. Fortalece-se com treinamento prático, exemplos claros, checklists e feedback objetivo sobre performance.",
      impactoClima: "Contribui com organização, pontualidade e foco em resultados, ajudando a manter o time alinhado com processos. Traz estabilidade e previsibilidade para rotinas administrativas/financeiras. Pode gerar tensão se perceber desorganização ou falta de comprometimento dos outros. Seu impacto é mais positivo em equipes que valorizam estrutura, responsabilidade e execução eficiente.",
      zonaRisco: "Rigidez excessiva com regras e processos (pode resistir a mudanças necessárias ou novas formas de trabalhar).\nImpaciência ou frustração com colegas que não seguem padrões ou entregam com menor qualidade/velocidade.\nDificuldade em lidar com ambientes de alta ambiguidade, improvisação ou falta de estrutura clara.\nTendência a ser excessivamente crítica ou direta ao apontar falhas ou ineficiências.\nSobrecarga por assumir muitas responsabilidades operacionais sem delegar."
    }
  },
  conclusoes: {
    forcas: [
      "Postura educada e respeitosa em todas as interações.",
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
    riscos: [
      "Colocação em funções com volume muito alto e pressão constante por velocidade, podendo gerar sobrecarga, desmotivação ou erros.",
      "Posições que exijam alta proatividade e autonomia desde o início sem suporte gradual."
    ],
    comoLiderar: [
      "Funciona melhor quando o feedback é dado de forma objetiva, com exemplos concretos e sem generalizações.",
      "Deve ser clara, respeitosa, direta e privada.",
      "Comunicação por escrito ou em conversas individuais costuma gerar menos ruído que comentários em grupo.",
      "Dar feedback sempre de forma privada, respeitosa e com exemplos concretos. Reconhecer o esforço e a evolução. Proporcionar treinamento gradual e suporte próximo nos primeiros meses.",
      "O que evitar: Feedbacks em público, generalizações, pressão excessiva por velocidade sem suporte, mudanças abruptas sem explicação."
    ]
  }
}

export default marianeBorges
