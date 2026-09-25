// Feriados e dias úteis — usado pelo Calendário de Férias (marcação dos dias e contagem)
// e pelo aviso de "Ótimo retorno" no Dashboard (1º dia útil depois das férias).
// Datas sempre como string 'YYYY-MM-DD' pra não sofrer com fuso horário.

/** Dia sem expediente cadastrado em Configurações (tabela ferias_feriados). */
export type DiaSemExpediente = {
  id: string
  data: string          // YYYY-MM-DD
  descricao: string
  anual: boolean        // true = repete todo ano no mesmo dia/mês (ex.: 31/12)
}

export type Feriado = { data: string; nome: string; origem: 'nacional' | 'config' }

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => new Date(s + 'T00:00:00')

function addDias(s: string, n: number): string {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return `${ano}-${pad(mes)}-${pad(dia)}`
}

/** Feriados nacionais oficiais. Pontos facultativos (Carnaval, Corpus Christi) e
 *  feriados estaduais/municipais entram por Configurações, conforme a empresa. */
export function feriadosNacionais(ano: number): Feriado[] {
  const fixos: [string, string][] = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
    ['12-25', 'Natal'],
  ]
  return [
    ...fixos.map(([md, nome]) => ({ data: `${ano}-${md}`, nome, origem: 'nacional' as const })),
    { data: addDias(pascoa(ano), -2), nome: 'Sexta-feira Santa', origem: 'nacional' as const },
  ].sort((a, b) => a.data.localeCompare(b.data))
}

/** Mapa data → nome de todos os dias sem expediente (nacionais + configurados) do ano. */
export function feriadosDoAno(ano: number, config: DiaSemExpediente[]): Map<string, Feriado> {
  const map = new Map<string, Feriado>()
  for (const f of feriadosNacionais(ano)) map.set(f.data, f)
  for (const c of config) {
    const data = c.anual ? `${ano}${c.data.slice(4)}` : c.data
    if (data.startsWith(`${ano}-`)) map.set(data, { data, nome: c.descricao || 'Sem expediente', origem: 'config' })
  }
  return map
}

/** Consulta rápida de feriado por data, cacheando o mapa de cada ano. */
export function criarCalendarioFeriados(config: DiaSemExpediente[]) {
  const cache = new Map<number, Map<string, Feriado>>()
  const doAno = (ano: number) => {
    let m = cache.get(ano)
    if (!m) { m = feriadosDoAno(ano, config); cache.set(ano, m) }
    return m
  }
  const feriado = (data: string): Feriado | undefined => doAno(Number(data.slice(0, 4))).get(data)
  const diaUtil = (data: string): boolean => {
    const dow = parse(data).getDay()
    return dow !== 0 && dow !== 6 && !feriado(data)
  }
  return {
    feriado,
    diaUtil,
    /** 1º dia útil DEPOIS de `data` (ex.: dia de retorno depois do último dia de férias). */
    proximoDiaUtil(data: string): string {
      let d = addDias(data, 1)
      for (let i = 0; i < 60 && !diaUtil(d); i++) d = addDias(d, 1)
      return d
    },
    /** Quantos dias úteis há entre `inicio` e `fim` (inclusive). */
    diasUteis(inicio: string, fim: string): number {
      let n = 0
      for (let d = inicio; d <= fim; d = addDias(d, 1)) if (diaUtil(d)) n++
      return n
    },
  }
}

/** Hoje no fuso de Brasília (o servidor pode estar em UTC). */
export function hojeBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

// ── Casamento de nome (registro de férias ↔ login) ───────────────────────────

export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Registros antigos foram salvos com nome curto/abreviado (ex.: "Marcio Z.",
// "Jose", "Rodrigo") — pode não bater mais 100% com o nome completo do login
// (ex.: "Marcio Zim", "José Knapp"). Casa por prefixo, token a token, pra achar
// o colaborador certo sem precisar migrar os dados antigos.
export function nameMatchesPessoa(pessoa: string, nomeCompleto: string): boolean {
  const pessoaTokens = normalizeName(pessoa).split(/\s+/).filter(Boolean)
  const nomeTokens = normalizeName(nomeCompleto).split(/\s+/).filter(Boolean)
  if (pessoaTokens.length === 0) return false
  return pessoaTokens.every((tok, i) => {
    const alvo = nomeTokens[i]
    return !!alvo && alvo.startsWith(tok.replace(/\.$/, ''))
  })
}
