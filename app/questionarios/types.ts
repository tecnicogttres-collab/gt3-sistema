export type TipoPergunta = 'escala' | 'multipla' | 'texto'
export type Publico = 'Contratante' | 'Prestador'
export type StatusQn = 'rascunho' | 'ativo' | 'encerrado'
/** Ciclo do LINK: pendente = sem link, enviado = link gerado, respondido = resposta gravada pelo link. */
export type StatusConvite = 'pendente' | 'enviado' | 'respondido'
export type StatusEnvio = 'nao_enviado' | 'enviado'
/** O que o painel mostra — só estes três. "Respondido" (vindo do link) tem prioridade. O sistema
 *  não sabe se o e-mail foi recebido, entregue ou lido, então não existe status para isso. */
export type StatusExib = 'nao_enviado' | 'enviado' | 'respondido'

export type Pergunta = {
  id: string
  type: TipoPergunta
  label: string
  min?: string
  max?: string
  options?: string[]
  /** Só múltipla escolha: true = o respondente pode marcar várias respostas (precisa de ao
   *  menos uma); ausente/false = exatamente uma. */
  multiplas?: boolean
  /** Pergunta condicional: só aparece (e só é exigida) quando a pergunta `perguntaId`, que vem
   *  antes dela, foi respondida com um dos `valores`. */
  condicao?: { perguntaId: string; valores: (string | number)[] }
}

export type ValorResposta = string | number | string[]

/** Respostas de uma pergunta como lista — múltipla com várias respostas grava string[]. */
export function valoresResposta(v: ValorResposta | undefined | null): (string | number)[] {
  if (v == null || v === '') return []
  return Array.isArray(v) ? v : [v]
}

/** A pergunta está visível com estas respostas? Segue a cadeia: se a pergunta-gatilho também
 *  está oculta, esta fica oculta. */
export function perguntaVisivel(q: Pergunta, perguntas: Pergunta[], respostas: Record<string, ValorResposta>, prof = 0): boolean {
  if (!q.condicao) return true
  const pai = perguntas.find(p => p.id === q.condicao!.perguntaId)
  if (!pai || prof > 20) return true
  if (!perguntaVisivel(pai, perguntas, respostas, prof + 1)) return false
  return valoresResposta(respostas[pai.id]).some(v => q.condicao!.valores.includes(v))
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
  respostas: Record<string, ValorResposta>
  respondido_em: string | null
  created_at: string
  /** Envio feito fora do sistema (mala direta no Word/Outlook) — só registro manual. */
  status_envio: StatusEnvio
  canal_envio: 'manual' | 'sistema' | null
  enviado_em: string | null
  lembretes_enviados: number
  ultimo_lembrete_em: string | null
}

export const TYPE_NAME: Record<TipoPergunta, string> = {
  escala: 'Nota de satisfação',
  multipla: 'Múltipla escolha',
  texto: 'Resposta escrita',
}

export const TYPE_DESC: Record<TipoPergunta, string> = {
  escala: 'Respondente dá uma nota de 1 a 5.',
  multipla: 'Respondente escolhe uma ou várias das opções que você definir.',
  texto: 'Respondente escreve livremente.',
}

export const STATUS_QN_NAME: Record<StatusQn, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
}

export const QN_SELECT = 'id, titulo, publico, status, perguntas, painel_config, created_at, updated_at'
export const CONVITE_SELECT = 'id, questionario_id, nome, email, empresa, tipo, vinculo, status, token, respostas, respondido_em, created_at, status_envio, canal_envio, enviado_em, lembretes_enviados, ultimo_lembrete_em'

export const STATUS_EXIB_LABEL: Record<StatusExib, string> = {
  nao_enviado: 'Não enviado',
  enviado: 'Enviado manualmente',
  respondido: 'Respondido',
}

export function statusExib(c: Pick<Convite, 'status' | 'status_envio'>): StatusExib {
  if (c.status === 'respondido') return 'respondido'
  return c.status_envio === 'enviado' ? 'enviado' : 'nao_enviado'
}

/** Endereço público dos links — fixo em produção, para a planilha da mala direta nunca sair com
 *  localhost mesmo exportada de um ambiente de teste. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gt3-sistema-gt3.vercel.app').replace(/\/+$/, '')
export const linkConvite = (token: string) => `${SITE_URL}/questionario/${token}`

/** Primeira palavra do nome do responsável (coluna PrimeiroNome da mala direta). */
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''

/** Token do link público — 64 caracteres hex (32 bytes aleatórios). Tokens antigos, de 24
 *  caracteres, continuam valendo (a rota pública aceita de 16 a 64). */
export function gerarToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
