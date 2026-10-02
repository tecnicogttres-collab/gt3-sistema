export type TextField = {
  type: 'text'
  label: string
  value: string
}

export type TableField = {
  type: 'table'
  label: string
  headers: string[]
  rows: string[][]
}

export type Field = TextField | TableField

export type FeriasColetivas = {
  /** Unidade a que se refere o período (opcional — contratantes com mais de uma unidade têm um período por unidade) */
  unidade: string
  /** AAAA-MM-DD */
  inicio: string
  /** AAAA-MM-DD */
  fim: string
  contato: string
  email: string
}

export type Company = {
  id: string
  sheetName: string
  name: string
  segment: string
  updated: string
  fields: Field[]
  feriasColetivas?: FeriasColetivas[]
}

export const SEGMENTS = [
  'Bertolini',
  'Marcopolo',
  'FCC',
  'Auto/Componentes',
  'Alimentos/Bebidas',
  'Indústria Geral',
  'Outros',
] as const

export const SEGMENT_COLORS: Record<string, string> = {
  Bertolini: '#D1AE6E',
  Marcopolo: '#40C8B4',
  FCC: '#C8A0E6',
  'Auto/Componentes': '#8C6EDC',
  'Alimentos/Bebidas': '#96D25A',
  'Indústria Geral': '#E8C896',
  Outros: '#E15A5A',
}

export const ALL_KEY = '__ALL__'
