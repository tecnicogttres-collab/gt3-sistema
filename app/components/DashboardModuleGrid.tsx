'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Module } from '../lib/modules'
import { useUser } from './UserContext'
import { createClient } from '../lib/supabase'

type SortMode = 'padrao' | 'az' | 'za' | 'personalizado'

const INK = '#2A4F96'
const MUTED = '#6B7A99'
const BORDER = '#E8EDF5'
const TEXT = '#1E253D'

function sortModules(mods: Module[], mode: SortMode, ordem: string[]): Module[] {
  if (mode === 'az') return [...mods].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  if (mode === 'za') return [...mods].sort((a, b) => b.label.localeCompare(a.label, 'pt-BR'))
  if (mode === 'personalizado' && ordem.length > 0) {
    const idx = new Map(ordem.map((id, i) => [id, i]))
    return [...mods].sort((a, b) => {
      const ai = idx.has(a.id) ? idx.get(a.id)! : Number.MAX_SAFE_INTEGER
      const bi = idx.has(b.id) ? idx.get(b.id)! : Number.MAX_SAFE_INTEGER
      return ai - bi
    })
  }
  return mods
}

export default function DashboardModuleGrid({ modules, moduleNotifs }: {
  modules: Module[]
  moduleNotifs: Record<string, number>
}) {
  const { profile } = useUser()
  const supabase = useMemo(() => createClient(), [])

  const [sortMode, setSortMode] = useState<SortMode>('padrao')
  const [ordem, setOrdem] = useState<string[]>([])
  // Evita mostrar os cards na ordem padrão por um instante antes da preferência salva chegar do Supabase.
  const [prefsReady, setPrefsReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [draftOrder, setDraftOrder] = useState<string[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Carrega a preferência salva do usuário
  useEffect(() => {
    if (!profile) return
    let mounted = true
    async function load() {
      try {
        const { data } = await supabase.from('dashboard_prefs').select('modo, ordem').eq('user_id', profile!.id).maybeSingle()
        if (!mounted) return
        if (data) {
          setSortMode((data.modo as SortMode) ?? 'padrao')
          setOrdem((data.ordem as string[]) ?? [])
        }
      } catch { /* tabela pode não existir ainda */ }
      finally { if (mounted) setPrefsReady(true) }
    }
    void load()
    return () => { mounted = false }
  }, [profile, supabase])

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  async function persist(modo: SortMode, novaOrdem: string[]) {
    if (!profile) return
    const { error } = await supabase.from('dashboard_prefs')
      .upsert({ user_id: profile.id, modo, ordem: novaOrdem, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) console.error('Erro ao salvar ordenação do dashboard', error)
  }

  const ordered = useMemo(() => sortModules(modules, sortMode, ordem), [modules, sortMode, ordem])

  const displayModules = reordering
    ? (draftOrder.map(id => modules.find(m => m.id === id)).filter(Boolean) as Module[])
    : ordered

  function pickMode(mode: 'padrao' | 'az' | 'za') {
    setMenuOpen(false)
    setSortMode(mode)
    void persist(mode, ordem)
  }

  function startCustomize() {
    setMenuOpen(false)
    setDraftOrder(ordered.map(m => m.id))
    setReordering(true)
  }

  function cancelCustomize() {
    setReordering(false)
    setDraftOrder([])
  }

  async function finishCustomize() {
    setReordering(false)
    setSortMode('personalizado')
    setOrdem(draftOrder)
    await persist('personalizado', draftOrder)
  }

  function onDragOverCard(id: string) {
    return (e: React.DragEvent) => {
      e.preventDefault()
      if (!dragId || dragId === id) return
      setDraftOrder(prev => {
        const from = prev.indexOf(dragId)
        const to = prev.indexOf(id)
        if (from === -1 || to === -1 || from === to) return prev
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        // Depois de remover o item arrastado, tudo que estava depois dele desliza uma
        // posição pra trás — sem esse ajuste, o índice de destino calculado sobre o array
        // ORIGINAL fica sempre uma casa adiante quando from < to, fazendo o item pular
        // pra frente e pra trás sem parar a cada dragover (é o "trava" ao arrastar).
        const adjustedTo = from < to ? to - 1 : to
        next.splice(adjustedTo, 0, moved)
        return next
      })
    }
  }

  const MENU_ITEMS: { mode: 'padrao' | 'az' | 'za'; label: string; icon: string }[] = [
    { mode: 'padrao', label: 'Padrão', icon: '↺' },
    { mode: 'az', label: 'A → Z', icon: '⭡' },
    { mode: 'za', label: 'Z → A', icon: '⭣' },
  ]

  // Evita renderizar os cards na ordem padrão e só reorganizar depois — espera a preferência salva chegar primeiro.
  if (!prefsReady) {
    return <div style={{ minHeight: 120 }} />
  }

  return (
    <div style={{ position: 'relative' }}>
      {reordering && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 40 }} />
      )}

      <div style={{
        position: reordering ? 'relative' : 'static',
        zIndex: reordering ? 41 : 'auto',
        background: reordering ? '#F4F6FA' : 'transparent',
        borderRadius: reordering ? 16 : 0,
        padding: reordering ? 16 : 0,
        margin: reordering ? -16 : 0,
        boxShadow: reordering ? '0 12px 40px rgba(15,23,42,0.25)' : 'none',
      }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: reordering ? 'space-between' : 'flex-end', marginBottom: 10, gap: 10 }}>
          {reordering && (
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
              🖐 Arraste os cards para reorganizar
            </span>
          )}

          {reordering ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelCustomize} style={{
                padding: '7px 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff',
                color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Cancelar
              </button>
              <button onClick={() => void finishCustomize()} style={{
                padding: '7px 16px', borderRadius: 7, border: 'none', background: INK,
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                ✓ Finalizar
              </button>
            </div>
          ) : (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                title="Organizar módulos"
                style={{
                  width: 30, height: 30, borderRadius: 7, border: `1px solid ${BORDER}`,
                  background: menuOpen ? '#EBF0FA' : '#fff', color: menuOpen ? INK : MUTED,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/>
                  <line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/>
                  <line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/>
                </svg>
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 50,
                  background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(30,37,61,0.14)', overflow: 'hidden', width: 170,
                }}>
                  <button onClick={startCustomize} style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    padding: '9px 12px', border: 'none', borderBottom: `1px solid ${BORDER}`,
                    background: sortMode === 'personalizado' ? '#EBF0FA' : '#fff',
                    color: sortMode === 'personalizado' ? INK : TEXT,
                    fontSize: 13, fontWeight: sortMode === 'personalizado' ? 700 : 500, cursor: 'pointer',
                  }}>
                    ✋ Personalizado
                  </button>
                  {MENU_ITEMS.map(({ mode, label, icon }) => (
                    <button key={mode} onClick={() => pickMode(mode)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                      padding: '9px 12px', border: 'none', borderBottom: mode !== 'za' ? `1px solid ${BORDER}` : 'none',
                      background: sortMode === mode ? '#EBF0FA' : '#fff',
                      color: sortMode === mode ? INK : TEXT,
                      fontSize: 13, fontWeight: sortMode === mode ? 700 : 500, cursor: 'pointer',
                    }}>
                      {icon} {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="module-grid">
          {displayModules.map((mod) => {
            const hasNotif = (moduleNotifs[mod.id] ?? 0) > 0
            const isDragging = reordering && dragId === mod.id
            const cardInner = (
              <div className="module-card" style={reordering ? {
                outline: `2px dashed ${isDragging ? INK : '#C7D2E8'}`,
                outlineOffset: 2,
                opacity: isDragging ? 0.5 : 1,
                cursor: 'grab',
              } : undefined}>
                <div style={{ height: 4, backgroundColor: mod.color }} />
                <div style={{ padding: 16 }}>
                  <div className="module-card-icon" style={{ backgroundColor: `${mod.color}1A` }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: mod.color }} />
                  </div>
                  <h2 className="module-card-title">{mod.label}</h2>
                </div>
              </div>
            )
            return (
              <div
                key={mod.id}
                style={{ position: 'relative' }}
                draggable={reordering}
                onDragStart={reordering ? (e: React.DragEvent) => {
                  e.dataTransfer.setData('text/plain', mod.id)
                  e.dataTransfer.effectAllowed = 'move'
                  setDragId(mod.id)
                } : undefined}
                onDragOver={reordering ? onDragOverCard(mod.id) : undefined}
                onDrop={reordering ? (e: React.DragEvent) => e.preventDefault() : undefined}
                onDragEnd={reordering ? () => setDragId(null) : undefined}
              >
                {hasNotif && !reordering && (
                  <span style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 1,
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: '#EF4444', border: '2px solid #F4F6FA',
                    pointerEvents: 'none',
                  }} />
                )}
                {reordering ? (
                  <div className="module-card-link">{cardInner}</div>
                ) : (
                  <Link href={mod.path} className="module-card-link">{cardInner}</Link>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
