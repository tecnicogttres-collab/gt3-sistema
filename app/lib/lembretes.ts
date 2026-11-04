// Lógica compartilhada de ocorrências/atraso de lembretes — usada pelo módulo
// de Lembretes e pelo aviso diário no AppShell, para os dois concordarem sobre
// o que conta como "atrasado".

export const PERIODS = ['unico', 'diario', 'semanal', 'mensal', 'trimestral', 'semestral', 'anual', 'mensal_dia_semana'] as const
export type Period = typeof PERIODS[number]

export type LembreteOcorrencia = {
  periodo: Period
  data_inicio: string
  hora_inicio?: string | null
  // Só usados quando periodo === 'mensal_dia_semana' (ex.: 3ª segunda-feira do mês).
  // "Toda segunda-feira" simples é só 'semanal' com data_inicio numa segunda — não
  // precisa desses campos.
  dia_semana?: number | null     // 0=Domingo ... 6=Sábado
  semana_ordinal?: number | null // 1,2,3,4 ou -1 (última ocorrência do mês)
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function fmtDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Data do N-ésimo dia da semana de um mês (ex.: 3ª segunda-feira) — ordinal 1 a 4, ou
 *  -1 para a última ocorrência daquele dia da semana no mês. Retorna null se o ordinal
 *  pedido não existir nesse mês (ex.: 5ª semana). */
export function nthWeekdayOfMonth(year: number, month: number, weekday: number, ordinal: number): Date | null {
  if (ordinal === -1) {
    const last = new Date(year, month + 1, 0)
    const diff = (last.getDay() - weekday + 7) % 7
    last.setDate(last.getDate() - diff)
    return last
  }
  const first = new Date(year, month, 1)
  const diff = (weekday - first.getDay() + 7) % 7
  const day = 1 + diff + (ordinal - 1) * 7
  const result = new Date(year, month, day)
  return result.getMonth() === month ? result : null
}

// Data (YYYY-MM-DD) em que este lembrete ocorre no mês/ano informado, ou null
// se ele não tem ocorrência nesse mês (ex.: "único" de outro mês).
export function findMonthOccurrence(r: LembreteOcorrencia, year: number, month: number): string | null {
  const mStart = new Date(year, month, 1)
  const mEnd = new Date(year, month + 1, 0)
  const start = parseDate(r.data_inicio)

  if (r.periodo === 'unico') {
    if (start.getFullYear() === year && start.getMonth() === month) return fmtDateStr(start)
    return null
  }
  if (r.periodo === 'diario') {
    const day = start > mStart ? start : new Date(mStart)
    return day <= mEnd ? fmtDateStr(day) : null
  }
  if (r.periodo === 'mensal_dia_semana') {
    if (r.dia_semana == null || r.semana_ordinal == null) return null
    const occ = nthWeekdayOfMonth(year, month, r.dia_semana, r.semana_ordinal)
    if (!occ || occ < start) return null
    return fmtDateStr(occ)
  }

  const cur = new Date(start)
  while (cur < mStart) {
    if (r.periodo === 'semanal')           cur.setDate(cur.getDate() + 7)
    else if (r.periodo === 'mensal')       cur.setMonth(cur.getMonth() + 1)
    else if (r.periodo === 'trimestral')   cur.setMonth(cur.getMonth() + 3)
    else if (r.periodo === 'semestral')    cur.setMonth(cur.getMonth() + 6)
    else if (r.periodo === 'anual')        cur.setFullYear(cur.getFullYear() + 1)
    else break
  }
  return cur <= mEnd ? fmtDateStr(cur) : null
}

// Todas as ocorrências da série no mês. Só "semanal" tem mais de uma por mês no calendário;
// "diario" é tratado à parte para não lotar todos os dias com um mesmo lembrete.
function ocorrenciasDaSerieNoMes(r: LembreteOcorrencia, year: number, month: number): string[] {
  const first = findMonthOccurrence(r, year, month)
  if (!first) return []
  if (r.periodo !== 'semanal') return [first]
  const datas: string[] = []
  const cur = parseDate(first)
  while (cur.getMonth() === month) {
    datas.push(fmtDateStr(cur))
    cur.setDate(cur.getDate() + 7)
  }
  return datas
}

// Quantos meses procurar a ocorrência vizinha — cobre até a recorrência anual.
const MESES_BUSCA = 24

function ultimaOcorrenciaAte(r: LembreteOcorrencia, ds: string): string | null {
  if (r.periodo === 'unico' || r.periodo === 'diario') {
    if (r.data_inicio > ds) return null
    return r.periodo === 'unico' ? r.data_inicio : ds
  }
  const d = parseDate(ds)
  for (let i = 0; i <= MESES_BUSCA; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const datas = ocorrenciasDaSerieNoMes(r, m.getFullYear(), m.getMonth()).filter(o => o <= ds)
    if (datas.length > 0) return datas[datas.length - 1]
  }
  return null
}

function proximaOcorrenciaApos(r: LembreteOcorrencia, ds: string): string | null {
  if (r.periodo === 'unico') return r.data_inicio > ds ? r.data_inicio : null
  if (r.periodo === 'diario') {
    const next = parseDate(ds)
    next.setDate(next.getDate() + 1)
    const s = fmtDateStr(next)
    return s > r.data_inicio ? s : r.data_inicio
  }
  const d = parseDate(ds)
  for (let i = 0; i <= MESES_BUSCA; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1)
    const data = ocorrenciasDaSerieNoMes(r, m.getFullYear(), m.getMonth()).find(o => o > ds)
    if (data) return data
  }
  return null
}

export type OcorrenciaVigente = {
  /** Data real na série — é a que vai para lembretes_historico.data_ocorrencia ao dar OK. */
  serie: string
  /** Data em que o lembrete aparece: a da série, ou a do adiamento quando ele a empurrou. */
  data: string
}

/** Ocorrência que representa o lembrete agora: a mais recente até hoje se ainda não teve OK
 *  (vencida ou de hoje), senão a próxima sem OK. Uma recorrência vencida sem OK é substituída
 *  quando chega a seguinte. null = não há mais nada pendente (único já confirmado).
 *  Adiamento anterior à data da série é ignorado: sobrou de antes de o lembrete mudar de data. */
export function ocorrenciaVigente(r: LembreteOcorrencia, confirmadas: Set<string>, now: Date = new Date(), adiamento?: string | null): OcorrenciaVigente | null {
  let serie = ultimaOcorrenciaAte(r, fmtDateStr(now))
  if (!serie || confirmadas.has(serie)) {
    let cursor: string | null = serie ?? fmtDateStr(now)
    serie = null
    for (let i = 0; cursor && i < 400 && !serie; i++) {
      cursor = proximaOcorrenciaApos(r, cursor)
      if (cursor && !confirmadas.has(cursor)) serie = cursor
    }
  }
  if (!serie) return null
  return { serie, data: adiamento && adiamento > serie ? adiamento : serie }
}

/** Ocorrências que venceram sem OK e já foram "passadas para trás" pela vigente (a recorrência
 *  seguinte chegou). Para não perder a gestão, elas continuam pendentes até alguém dar OK.
 *  Conta só as posteriores ao último OK (as anteriores são tidas como tratadas) e ignora o
 *  diário, que geraria uma pendência por dia. */
export function ocorrenciasVencidasAnteriores(r: LembreteOcorrencia, confirmadas: Set<string>, vigente: OcorrenciaVigente | null): string[] {
  if (r.periodo === 'diario' || r.periodo === 'unico' || !vigente) return []
  const ultimoOk = [...confirmadas].filter(d => d < vigente.serie).sort().pop() ?? null
  const fim = parseDate(vigente.serie)
  const datas: string[] = []
  for (let i = MESES_BUSCA; i >= 0; i--) {
    const m = new Date(fim.getFullYear(), fim.getMonth() - i, 1)
    datas.push(...ocorrenciasDaSerieNoMes(r, m.getFullYear(), m.getMonth()))
  }
  return [...new Set(datas)]
    .filter(d => d >= r.data_inicio && d < vigente.serie && !confirmadas.has(d) && (!ultimoOk || d > ultimoOk))
    .sort()
}

/** Mês (YYYY-MM-01) ao qual uma ocorrência pertence — lembretes_historico.mes_referencia. */
export function mesReferenciaDe(ds: string): string {
  return `${ds.slice(0, 7)}-01`
}

/** Último dia (YYYY-MM-DD) do mês de `now`. */
export function fimDoMes(now: Date = new Date()): string {
  return fmtDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0))
}

export type ConfirmacaoLembrete = { lembrete_id: string; data_ocorrencia: string | null; mes_referencia: string }

/** Data confirmada por uma linha do histórico. Linhas antigas não têm data_ocorrencia: o OK
 *  era por mês, então valem para a ocorrência daquele mês. */
export function dataConfirmada(r: LembreteOcorrencia, h: ConfirmacaoLembrete): string | null {
  if (h.data_ocorrencia) return h.data_ocorrencia
  const mes = parseDate(h.mes_referencia)
  return findMonthOccurrence(r, mes.getFullYear(), mes.getMonth())
}

/** Datas (YYYY-MM-DD) em que o lembrete aparece no mês, com a ocorrência vigente já na data
 *  do adiamento. O diário aparece só na vigente; a série é pulada entre ela e a data adiada. */
export function findMonthOccurrences(r: LembreteOcorrencia, year: number, month: number, vigente?: OcorrenciaVigente | null): string[] {
  const datas = r.periodo === 'diario' ? [] : ocorrenciasDaSerieNoMes(r, year, month)
  const noMes = datas.filter(ds => !vigente || ds < vigente.serie || ds >= vigente.data)
  if (vigente && parseDate(vigente.data).getFullYear() === year && parseDate(vigente.data).getMonth() === month && !noMes.includes(vigente.data)) {
    noMes.push(vigente.data)
  }
  return noMes.sort()
}

// Vencido = a ocorrência vigente já passou sem OK. Continua vencido, mesmo em outro mês, até
// o OK; na recorrência, até chegar a ocorrência seguinte.
export function isLembreteOverdue(r: LembreteOcorrencia, confirmadas: Set<string>, now: Date = new Date(), adiamento?: string | null): boolean {
  const vigente = ocorrenciaVigente(r, confirmadas, now, adiamento)
  if (!vigente) return false
  const occ = parseDate(vigente.data)
  if (r.hora_inicio) {
    const [h, m] = r.hora_inicio.split(':').map(Number)
    occ.setHours(h, m, 0, 0)
    return occ < now
  }
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return occ < today
}
