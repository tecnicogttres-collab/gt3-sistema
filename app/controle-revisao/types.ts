export type RowType = 'normal' | 'weekend' | 'holiday'

export type Revision = {
  id: string
  data: string
  documento: string
  empresa: string
  responsavel: string
  inconsistencia: string
  resolvido: boolean
}

export type ScheduleRow = { day: number; type: RowType; label: string; person: string }

export type Sheet = {
  id?: string
  year: number
  monthIdx: number
  name: string
  revisions: Revision[]
  schedule: ScheduleRow[]
}

export type HistoryData = Record<number, Record<number, Sheet>>

export type Suggestions = {
  empresa: string[]
  documento: string[]
  responsavel: string[]
  inconsistencia: string[]
}
