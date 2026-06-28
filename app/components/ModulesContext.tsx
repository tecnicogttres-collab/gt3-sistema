'use client'

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { MODULES } from '../lib/modules'
import type { Module } from '../lib/modules'
import { createClient } from '../lib/supabase'

/** Override de nome/cor por módulo, vindo da tabela modulos_config */
type Override = { label: string | null; color: string | null }
type OverrideMap = Record<string, Override>

type ModulesContextType = {
  /** MODULES com as personalizações de nome/cor já aplicadas */
  modules: Module[]
  overrides: OverrideMap
  loading: boolean
  /** Salva nome e cor de um módulo (gestor/admin). Atualiza otimisticamente + realtime. */
  saveOverride: (id: string, label: string, color: string) => Promise<void>
  /** Remove a personalização — volta ao padrão do código */
  resetOverride: (id: string) => Promise<void>
}

const ModulesContext = createContext<ModulesContextType>({
  modules: MODULES,
  overrides: {},
  loading: true,
  saveOverride: async () => {},
  resetOverride: async () => {},
})

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<OverrideMap>({})
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const { data } = await supabase.from('modulos_config').select('id, label, color')
        if (!mounted || !data) { setLoading(false); return }
        const map: OverrideMap = {}
        for (const row of data) map[row.id as string] = { label: row.label, color: row.color }
        setOverrides(map)
      } catch { /* tabela pode não existir ainda */ }
      finally { if (mounted) setLoading(false) }
    }
    load()

    const channel = supabase
      .channel('modulos-config-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'modulos_config' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id
            if (!oldId) return
            setOverrides(prev => {
              if (!(oldId in prev)) return prev
              const next = { ...prev }
              delete next[oldId]
              return next
            })
          } else {
            const row = payload.new as { id?: string; label: string | null; color: string | null }
            if (!row?.id) return
            setOverrides(prev => ({ ...prev, [row.id!]: { label: row.label, color: row.color } }))
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const modules = useMemo<Module[]>(() => MODULES.map((m) => {
    const o = overrides[m.id]
    if (!o) return m
    const label = o.label?.trim() ? o.label : m.label
    const color = o.color?.trim() ? o.color : m.color
    if (label === m.label && color === m.color) return m
    return { ...m, label, color }
  }), [overrides])

  const saveOverride = useCallback(async (id: string, label: string, color: string) => {
    const clean = { label: label.trim() || null, color: color.trim() || null }
    // Otimista — reflete instantaneamente em toda a aplicação
    setOverrides(prev => ({ ...prev, [id]: clean }))
    const { error } = await supabase
      .from('modulos_config')
      .upsert({ id, ...clean, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) throw error
  }, [supabase])

  const resetOverride = useCallback(async (id: string) => {
    setOverrides(prev => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    const { error } = await supabase.from('modulos_config').delete().eq('id', id)
    if (error) throw error
  }, [supabase])

  return (
    <ModulesContext.Provider value={{ modules, overrides, loading, saveOverride, resetOverride }}>
      {children}
    </ModulesContext.Provider>
  )
}

export function useModules() {
  return useContext(ModulesContext)
}
