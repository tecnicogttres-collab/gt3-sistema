import { criarCalendarioFeriados, nameMatchesPessoa, normalizeName, type DiaSemExpediente } from './feriados'

// Aviso do Dashboard sobre as férias de quem está logado:
//  - 'saida':   hoje é o último dia de trabalho antes das férias (começam no próximo dia útil)
//  - 'retorno': hoje é o 1º dia útil depois do último dia de férias
// Só vale para férias — folga não gera aviso.

export type RegistroFerias = { pessoa: string; inicio: string; fim: string; tipo: string | null }

export type AvisoFerias =
  | { tipo: 'saida'; inicio: string; fim: string; retorno: string }
  | { tipo: 'retorno'; inicio: string; fim: string }

/** O registro é desta pessoa? Nome exato vence; nome abreviado de registro antigo
 *  (ex.: "Rodrigo") só vale se casar com um único login — evita pegar homônimos
 *  como "Rodrigo Balem" × "Rodrigo Balem Gestor". */
export function registroEhDe(pessoa: string, nome: string, todosNomes: string[]): boolean {
  const p = normalizeName(pessoa)
  if (p === normalizeName(nome)) return true
  if (todosNomes.some(n => normalizeName(n) === p)) return false
  const candidatos = todosNomes.filter(n => nameMatchesPessoa(pessoa, n))
  return candidatos.length === 1 && normalizeName(candidatos[0]) === normalizeName(nome)
}

export function calcularAvisoFerias(opts: {
  nome: string
  todosNomes: string[]
  registros: RegistroFerias[]
  config: DiaSemExpediente[]
  hoje: string
}): AvisoFerias | null {
  const { nome, todosNomes, registros, config, hoje } = opts
  const minhas = registros.filter(r => registroEhDe(r.pessoa, nome, todosNomes))
  // De férias/folga hoje (inclusive períodos emendados) → nenhum aviso
  if (!minhas.length || minhas.some(r => r.inicio <= hoje && hoje <= r.fim)) return null

  const cal = criarCalendarioFeriados(config)
  const ferias = minhas.filter(r => (r.tipo ?? 'ferias') === 'ferias')

  const voltou = ferias.find(r => r.fim < hoje && cal.proximoDiaUtil(r.fim) === hoje)
  if (voltou) return { tipo: 'retorno', inicio: voltou.inicio, fim: voltou.fim }

  // Sai no próximo dia útil: não sobra nenhum dia útil entre hoje e o início
  const proximoUtil = cal.proximoDiaUtil(hoje)
  const sai = ferias
    .filter(r => r.inicio > hoje && proximoUtil >= r.inicio)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0]
  if (sai) return { tipo: 'saida', inicio: sai.inicio, fim: sai.fim, retorno: cal.proximoDiaUtil(sai.fim) }

  return null
}
