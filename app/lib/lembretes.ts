// Lógica compartilhada de ocorrências/atraso de lembretes — usada pelo módulo
// de Lembretes e pelo aviso diário no AppShell, para os dois concordarem sobre
// o que conta como "atrasado".

export const PERIODS = ['unico', 'diario', 'semanal', 'mensal', 'trimestral', 'semestral', 'anual'] as const
export type Period = typeof PERIODS[number]

export type LembreteOcorrencia = {
  periodo: Period
  data_inicio: string
  hora_inicio?: string | null
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
