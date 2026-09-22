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

export function currentMonthOccurrence(r: LembreteOcorrencia, now: Date = new Date()): Date | null {
  const ds = findMonthOccurrence(r, now.getFullYear(), now.getMonth())
  return ds ? parseDate(ds) : null
}

// Um lembrete só conta como atrasado se tiver uma ocorrência real neste mês
// (não apenas uma data_inicio antiga) e ainda não tiver sido confirmado.
export function isLembreteOverdue(r: LembreteOcorrencia, confirmed: boolean, now: Date = new Date()): boolean {
  if (confirmed) return false
  const occ = currentMonthOccurrence(r, now)
  if (!occ) return false
  if (r.hora_inicio) {
    const [h, m] = r.hora_inicio.split(':').map(Number)
    const deadline = new Date(occ)
    deadline.setHours(h, m, 0, 0)
    return deadline < now
  }
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return occ < today
}
