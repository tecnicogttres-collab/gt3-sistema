export type { Role, Module } from '../lib/modules'
export type { Profile } from '../components/UserContext'

export type ApiError = { error: string }

export type PaginatedResult<T> = {
  data: T[]
  total: number
}
