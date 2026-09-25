export type TipoPergunta = 'escala' | 'multipla' | 'texto'
export type Publico = 'Contratante' | 'Prestador'
export type StatusQn = 'rascunho' | 'ativo' | 'encerrado'
export type StatusConvite = 'pendente' | 'enviado' | 'respondido'

export type Pergunta = {
  id: string
  type: TipoPergunta
  label: string
  min?: string
  max?: string
  options?: string[]
}

export type PainelConfig = {
  statTiles: { total: boolean; taxa: boolean; respondido: boolean; pendente: boolean }
  order: string[]
  visible: Record<string, boolean>
}

export type Questionario = {
  id: string
  titulo: string
  publico: Publico
  status: StatusQn
  perguntas: Pergunta[]
  painel_config: Partial<PainelConfig>
  created_at: string
  updated_at: string
}

export type Convite = {
  id: string
  questionario_id: string
  nome: string
  email: string
  empresa: string
  tipo: Publico
  vinculo: string | null
  status: StatusConvite
  token: string | null
  respostas: Record<string, string | number>
  respondido_em: string | null
  created_at: string
}

export const TYPE_NAME: Record<TipoPergunta, string> = {
  escala: 'Nota de satisfação',
  multipla: 'Múltipla escolha',
  texto: 'Resposta escrita',
}

export const TYPE_DESC: Record<TipoPergunta, string> = {
  escala: 'Respondente dá uma nota de 1 a 5.',
  multipla: 'Respondente escolhe uma das opções que você definir.',
  texto: 'Respondente escreve livremente.',
}

export const STATUS_QN_NAME: Record<StatusQn, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
}

export const QN_SELECT = 'id, titulo, publico, status, perguntas, painel_config, created_at, updated_at'
export const CONVITE_SELECT = 'id, questionario_id, nome, email, empresa, tipo, vinculo, status, token, respostas, respondido_em, created_at'

/** Token do link público — 24 caracteres hex, difícil de adivinhar. */
export function gerarToken(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
