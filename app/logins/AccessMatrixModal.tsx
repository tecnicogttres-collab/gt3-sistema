'use client'

import { useMemo, useState } from 'react'
import type { Module } from '../lib/modules'
import type { UserRow } from './LoginsClient'

const PRIMARY = '#2A4F96'

const PAPEL_LABELS: Record<string, string> = {
  colaborador: 'Colaborador',
  gestor: 'Gestor',
  admin: 'Admin',
  trainee: 'Trainee',
}

const PAPEL_COLORS: Record<string, { bg: string; color: string }> = {
  admin:       { bg: '#FEF3C7', color: '#92400E' },
  gestor:      { bg: '#EBF4FF', color: '#1E40AF' },
  colaborador: { bg: '#F0FFF4', color: '#166534' },
  trainee:     { bg: '#D1FAE5', color: '#065F46' },
}

export default function AccessMatrixModal({
  users, modules, currentUserId, isAdmin, canManage, onToggle, onToggleDashboard, onClose,
}: {
  users: UserRow[]
  modules: Module[]
  currentUserId: string | null
  isAdmin: boolean
  canManage: boolean
  onToggle: (user: UserRow, modId: string) => Promise<void>
  onToggleDashboard: (user: UserRow, modId: string) => Promise<void>
  onClose: () => void
}) {
  // "Acesso" edita modulos_permitidos (quem pode entrar no módulo); "Dashboard" edita
  // modulos_dashboard (quais módulos aparecem no mapa de cards da Home) — mesma matriz,
  // só troca qual campo é lido/gravado, pra dar pra fazer os dois de uma vez sem sair daqui.
  const [modo, setModo] = useState<'acesso' | 'dashboard'>('acesso')
  const onToggleAtivo = modo === 'acesso' ? onToggle : onToggleDashboard
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<string | null>(null) // `${userId}|${modId}` em voo
  // Destaque: clicar no nome de um usuário ou no cabeçalho de um módulo deixa
  // os demais quase transparentes. Clicar de novo (ou "Limpar destaque") desfaz.
  const [focusUsers, setFocusUsers] = useState<Set<string>>(new Set())
  const [focusModules, setFocusModules] = useState<Set<string>>(new Set())

  function toggleFocusUser(id: string) {
    setFocusUsers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleFocusModule(id: string) {
    setFocusModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const hasFocus = focusUsers.size > 0 || focusModules.size > 0

  const orderedModules = useMemo(
    () => [...modules].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [modules]
  )

  const orderedUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...users]
      .filter(u => !q || (u.nome ?? '').toLowerCase().includes(q) || (u.usuario ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => (a.nome ?? a.usuario ?? a.email).localeCompare(b.nome ?? b.usuario ?? b.email, 'pt-BR'))
  }, [users, search])

  const [grantAllPending, setGrantAllPending] = useState<string | null>(null)

  /** Conjunto habilitado pro modo atual — acesso (modulos_permitidos) ou dashboard
   *  (modulos_dashboard, caindo pro que já é permitido quando null). */
  function enabledIdsFor(u: UserRow): string[] {
    const permitidos = u.modulos_permitidos ?? orderedModules.map(m => m.id)
    if (modo === 'acesso') return permitidos
    return u.modulos_dashboard ?? permitidos
  }

  /** Concede/mostra um módulo pra todo mundo que ainda não tem — não mexe em quem já tem
   *  nem em admin protegido. Vale tanto pra "acesso" quanto pra "dashboard", conforme o modo. */
  async function grantModuleToAll(modId: string) {
    if (!canManage) return
    setGrantAllPending(modId)
    try {
      const targets = users.filter(u => {
        const isProtectedAdmin = u.papel === 'admin' && currentUserId !== u.id
        if (isProtectedAdmin) return false
        return !enabledIdsFor(u).includes(modId)
      })
      await Promise.all(targets.map(u => onToggleAtivo(u, modId)))
    } finally {
      setGrantAllPending(prev => (prev === modId ? null : prev))
    }
  }

  async function handleClick(u: UserRow, modId: string) {
    const isProtectedAdmin = u.papel === 'admin' && currentUserId !== u.id
    if (!canManage || isProtectedAdmin) return
    const key = `${u.id}|${modId}`
    setPending(key)
    try {
      await onToggleAtivo(u, modId)
    } finally {
      setPending(prev => (prev === key ? null : prev))
    }
  }

  return (
    <div
      className="gt3-overlay-fade"
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="gt3-drop-in" style={{
        backgroundColor: '#fff', borderRadius: 12, padding: '22px 24px', width: '100%', maxWidth: '95vw',
        maxHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>
              🗂️ {modo === 'acesso' ? 'Mapa de acessos por módulo' : 'Módulos no Dashboard por usuário'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#6B7A90' }}>
              {modo === 'acesso'
                ? 'Quem tem acesso a cada módulo.'
                : 'Quais módulos aparecem no mapa de cards da Home de cada um — não muda quem pode acessar, só o que aparece lá.'}
              {' '}{canManage ? 'Clique numa célula para conceder/mostrar ou revogar/ocultar, ou use a bolinha no topo da coluna pra fazer isso de uma vez para todo mundo.' : 'Somente visualização.'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>

        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3, margin: '12px 0 2px', width: 'fit-content' }}>
          {([['acesso', '🔓 Acesso ao módulo'], ['dashboard', '🖥️ Aparece no Dashboard']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setModo(id)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: modo === id ? 700 : 500,
                color: modo === id ? PRIMARY : '#6B7A99',
                backgroundColor: modo === id ? '#fff' : 'transparent',
                boxShadow: modo === id ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                transition: 'all .15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 14px' }}>
          <input
            type="text"
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', maxWidth: 320, padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13.5, color: '#1E293B', outline: 'none', boxSizing: 'border-box' }}
            onFocus={(e) => { e.target.style.borderColor = PRIMARY }}
            onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
          />
          {hasFocus && (
            <button
              onClick={() => { setFocusUsers(new Set()); setFocusModules(new Set()) }}
              style={{
                padding: '7px 14px', borderRadius: 8, border: `1px solid ${PRIMARY}`, backgroundColor: '#fff',
                color: PRIMARY, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              }}
            >
              ✕ Limpar destaque
            </button>
          )}
        </div>

        <div style={{ overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, flex: 1 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{
                  position: 'sticky', left: 0, top: 0, zIndex: 3, backgroundColor: '#F9FAFB',
                  padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0',
                  fontSize: 11, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '.04em', minWidth: 200,
                }}>
                  Usuário
                </th>
                {orderedModules.map(mod => {
                  const selected = focusModules.has(mod.id)
                  const dimmed = focusModules.size > 0 && !selected
                  const granting = grantAllPending === mod.id
                  return (
                    <th key={mod.id} title={`${mod.label} — clique para destacar esta coluna`}
                      onClick={() => toggleFocusModule(mod.id)}
                      style={{
                        position: 'sticky', top: 0, zIndex: 2, backgroundColor: selected ? '#EBF0FA' : '#F9FAFB',
                        borderBottom: `1px solid ${selected ? PRIMARY : '#E2E8F0'}`, borderRight: '1px solid #F1F5F9',
                        padding: '8px 4px 10px', height: 180, width: 30, minWidth: 30, verticalAlign: 'bottom',
                        cursor: 'pointer', opacity: dimmed ? 0.25 : 1, transition: 'opacity .15s, background-color .15s',
                        overflow: 'hidden',
                      }}>
                      {selected && canManage && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (!granting) void grantModuleToAll(mod.id) }}
                          title={modo === 'acesso' ? `Conceder ${mod.label} para todo mundo` : `Mostrar ${mod.label} no Dashboard de todo mundo`}
                          disabled={granting}
                          style={{
                            position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                            width: 15, height: 15, borderRadius: '50%', border: `1.5px solid ${PRIMARY}`, padding: 0, lineHeight: 0,
                            backgroundColor: granting ? '#CBD5E1' : '#fff', cursor: granting ? 'default' : 'pointer',
                          }}
                        />
                      )}
                      <div style={{
                        writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap',
                        fontSize: 11, fontWeight: selected ? 700 : 500, color: selected ? PRIMARY : '#374151', margin: '0 auto',
                        display: 'flex', alignItems: 'center', gap: 5,
                        maxHeight: 140, overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: mod.color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod.label}</span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {orderedUsers.map((u, i) => {
                const colors = PAPEL_COLORS[u.papel ?? ''] ?? { bg: '#F3F4F6', color: '#374151' }
                const isProtectedAdmin = u.papel === 'admin' && currentUserId !== u.id
                const editableRow = canManage && !isProtectedAdmin
                const enabledIds = enabledIdsFor(u)
                const rowSelected = focusUsers.has(u.id)
                const rowDimmed = focusUsers.size > 0 && !rowSelected
                const rowBg = rowSelected ? '#EBF0FA' : (i % 2 === 1 ? '#FBFCFE' : '#fff')
                return (
                  <tr key={u.id} style={{ backgroundColor: rowBg, opacity: rowDimmed ? 0.25 : 1, transition: 'opacity .15s' }}>
                    <td
                      onClick={() => toggleFocusUser(u.id)}
                      title="Clique para destacar esta linha"
                      style={{
                        position: 'sticky', left: 0, zIndex: 1, backgroundColor: rowBg,
                        padding: '7px 14px', borderBottom: '1px solid #F1F5F9',
                        borderRight: `1px solid ${rowSelected ? PRIMARY : '#E2E8F0'}`,
                        whiteSpace: 'nowrap', cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: rowSelected ? 700 : 500, color: rowSelected ? PRIMARY : '#1E293B' }}>{u.nome || u.usuario || u.email}</span>
                        <span style={{ padding: '2px 6px', borderRadius: 5, backgroundColor: colors.bg, color: colors.color, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                          {PAPEL_LABELS[u.papel ?? ''] ?? u.papel ?? '—'}
                        </span>
                      </div>
                    </td>
                    {orderedModules.map(mod => {
                      const checked = enabledIds.includes(mod.id)
                      const key = `${u.id}|${mod.id}`
                      const isPending = pending === key
                      const colDimmed = focusModules.size > 0 && !focusModules.has(mod.id)
                      return (
                        <td
                          key={mod.id}
                          onClick={() => handleClick(u, mod.id)}
                          title={`${u.nome || u.usuario || u.email} · ${mod.label}${editableRow ? ' — clique para ' + (checked ? (modo === 'acesso' ? 'revogar' : 'ocultar') : (modo === 'acesso' ? 'conceder' : 'mostrar')) : ''}`}
                          style={{
                            borderBottom: '1px solid #F1F5F9', borderRight: '1px solid #F8FAFC',
                            textAlign: 'center', cursor: editableRow ? 'pointer' : 'default',
                            opacity: colDimmed ? 0.3 : 1,
                            transition: 'background-color .1s, opacity .15s',
                          }}
                          onMouseEnter={e => { if (editableRow) (e.currentTarget as HTMLElement).style.backgroundColor = '#EEF2FF' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                        >
                          <span style={{
                            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                            backgroundColor: isPending ? '#CBD5E1' : (checked ? mod.color : '#E2E8F0'),
                            opacity: checked ? 1 : 0.6,
                          }} />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {orderedUsers.length === 0 && (
                <tr>
                  <td colSpan={orderedModules.length + 1} style={{ padding: '32px 0', textAlign: 'center', color: '#6B7A99' }}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
            {orderedUsers.length} usuário{orderedUsers.length !== 1 ? 's' : ''} · {orderedModules.length} módulos
            {!isAdmin && ' · admins ocultos'}
          </span>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', backgroundColor: PRIMARY, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
