'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '../lib/supabase'

export type Profile = {
  id: string
  nome: string | null
  usuario: string | null
  email: string | null
  papel: 'colaborador' | 'gestor' | 'admin' | 'trainee' | null
  gestor_id: string | null
  pdi_slug: string | null
  modulos_permitidos: string[] | null
  modulos_dashboard: string[] | null
  created_at: string | null
  aniversario_dia: number | null
  aniversario_mes: number | null
}

export type PapelRole = NonNullable<Profile['papel']>

const OVERRIDE_KEY = 'gt3_role_override'

/** Retorna o nome de exibição: nome real se preenchido, senão usuario */
export function displayName(profile: Profile | null, fallback = 'Usuário'): string {
  return profile?.nome?.trim() || profile?.usuario?.trim() || fallback
}

type UserContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  roleOverride: PapelRole | null
  setRoleOverride: (r: PapelRole | null) => void
  signOut: () => Promise<void>
  reloadProfile: (userId: string) => Promise<void>
}

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
  roleOverride: null,
  setRoleOverride: () => {},
  signOut: async () => {},
  reloadProfile: async () => {},
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [rawProfile, setRawProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleOverride, setRoleOverrideState] = useState<PapelRole | null>(() => {
    if (typeof window === 'undefined') return null
    return (sessionStorage.getItem(OVERRIDE_KEY) as PapelRole | null)
  })
  const supabase = createClient()

  function setRoleOverride(r: PapelRole | null) {
    setRoleOverrideState(r)
    if (r) sessionStorage.setItem(OVERRIDE_KEY, r)
    else sessionStorage.removeItem(OVERRIDE_KEY)
  }

  async function loadProfile(_userId: string) {
    try {
      const res = await fetch('/api/me')
      if (res.ok) setRawProfile(await res.json())
      else setRawProfile(null)
    } catch {
      setRawProfile(null)
    }
  }

  // Aplica o override no papel sem alterar o banco
  const profile = useMemo<Profile | null>(() => {
    if (!rawProfile) return null
    if (!roleOverride) return rawProfile
    return { ...rawProfile, papel: roleOverride, modulos_permitidos: null, modulos_dashboard: null }
  }, [rawProfile, roleOverride])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) loadProfile(user.id)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u.id)
      else setRawProfile(null)
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    setRoleOverride(null)
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <UserContext.Provider value={{ user, profile, loading, roleOverride, setRoleOverride, signOut, reloadProfile: loadProfile }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
