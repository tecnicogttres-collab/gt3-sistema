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
  users, modules, currentUserId, isAdmin, canManage, onToggle, onClose,
}: {
  users: UserRow[]
  modules: Module[]
  currentUserId: string | null
  isAdmin: boolean
  canManage: boolean
  onToggle: (user: UserRow, modId: string) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<string | null>(null) // `${userId}|${modId}` em voo

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

  async function handleClick(u: UserRow, modId: string) {
    const isProtectedAdmin = u.papel === 'admin' && currentUserId !== u.id
    if (!canManage || isProtectedAdmin) return
    const key = `${u.id}|${modId}`
    setPending(key)
    try {
      await onToggle(u, modId)
    } finally {
      setPending(prev => (prev === key ? null : prev))
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, padding: '22px 24px', width: '100%', maxWidth: '95vw',
        maxHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>🗂️ Mapa de acessos por módulo</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#6B7A99' }}>
              Quem tem acesso a cada módulo. {canManage ? 'Clique numa célula para conceder ou revogar o acesso.' : 'Somente visualização.'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>

        <input
          type="text"
          placeholder="Buscar usuário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 320, margin: '10px 0 14px', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13.5, color: '#1E293B', outline: 'none', boxSizing: 'border-box' }}
          onFocus={(e) => { e.target.style.borderColor = PRIMARY }}
          onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
        />

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
                {orderedModules.map(mod => (
                  <th key={mod.id} title={mod.label} style={{
                    position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#F9FAFB',
                    borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9',
                    padding: '8px 4px 10px', height: 150, width: 30, minWidth: 30, verticalAlign: 'bottom',
                  }}>
                    <div style={{
                      writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap',
                      fontSize: 11, fontWeight: 500, color: '#374151', margin: '0 auto',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: mod.color, flexShrink: 0 }} />
                      {mod.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderedUsers.map((u, i) => {
                const colors = PAPEL_COLORS[u.papel ?? ''] ?? { bg: '#F3F4F6', color: '#374151' }
                const isProtectedAdmin = u.papel === 'admin' && currentUserId !== u.id
                const editableRow = canManage && !isProtectedAdmin
                const enabledIds = u.modulos_permitidos ?? orderedModules.map(m => m.id)
                return (
                  <tr key={u.id} style={{ backgroundColor: i % 2 === 1 ? '#FBFCFE' : '#fff' }}>
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 1, backgroundColor: i % 2 === 1 ? '#FBFCFE' : '#fff',
                      padding: '7px 14px', borderBottom: '1px solid #F1F5F9', borderRight: '1px solid #E2E8F0',
                      whiteSpace: 'nowrap',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{u.nome || u.usuario || u.email}</span>
                        <span style={{ padding: '2px 6px', borderRadius: 5, backgroundColor: colors.bg, color: colors.color, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                          {PAPEL_LABELS[u.papel ?? ''] ?? u.papel ?? '—'}
                        </span>
                      </div>
                    </td>
                    {orderedModules.map(mod => {
                      const checked = enabledIds.includes(mod.id)
                      const key = `${u.id}|${mod.id}`
                      const isPending = pending === key
                      return (
                        <td
                          key={mod.id}
                          onClick={() => handleClick(u, mod.id)}
                          title={`${u.nome || u.usuario || u.email} · ${mod.label}${editableRow ? ' — clique para ' + (checked ? 'revogar' : 'conceder') : ''}`}
                          style={{
                            borderBottom: '1px solid #F1F5F9', borderRight: '1px solid #F8FAFC',
                            textAlign: 'center', cursor: editableRow ? 'pointer' : 'default',
                            transition: 'background-color .1s',
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
