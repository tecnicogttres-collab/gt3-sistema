export type AcaoPdi = {
  competencia: string
  desenvolver: string
  acoes: string
  resultadosEsperados: string
  inicio: string
  termino: string
  status: string
}

export type EneagramaRank = {
  rank: number
  tipo: string
  pontuacao: string
}

export type Animal = {
  animal: string
  emoji: string
  pontoForte: string
  tendencia: string
  percentual?: number
}

export type Mbti = {
  tipo: string
  nucleo: string
  veredito: string
  estiloDecisao?: string
  curvaAprendizado?: string
  impactoClima?: string
}

export type PdiColaborador = {
  id: string
  nome: string
  funcao: string
  periodo: string

  matrizAvaliacao: {
    competencias: string[]
    diretiva: number[]
    auto: number[]
    ambicao: number[]
    totais: {
      diretiva: number
      auto: number
      ambicao: number
      max: number
    }
  }

  planoDeAcao: AcaoPdi[]

  perfilComportamental: {
    eneagrama: {
      ranking: EneagramaRank[]
      pontosFortes: string[]
      pontosAtencao: string[]
      comoDesenvolver: string[]
    }
    animais: Animal[]
    mbti?: Mbti
  }

  conclusoes: {
    forcas: string[]
    pontosAtencao: string[]
    ondeAgrega: string[]
    comoPodeApoiar: string[]
    riscos: string[]
    comoLiderar: string[]
  }
}
