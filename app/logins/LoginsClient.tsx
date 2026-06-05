'use client'

import { useEffect, useState, useCallback } from 'react'
import { useUser } from '../components/UserContext'
import * as allPdis from '../../data/pdis/index'
import type { PdiColaborador } from '../../data/pdis/types'
import { MODULES } from '../lib/modules'

const PDI_OPTIONS = (Object.values(allPdis) as PdiColaborador[])
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  .map(p => ({ value: p.id, label: p.nome }))

// All modules are configurable per user (admin can grant any module to any user)
const CONFIGURABLE_MODULES = MODULES

type UserRow = {
  id: string
  email: string
  nome: string | null
  usuario: string | null
  papel: string | null
  pdi_slug: string | null
  modulos_permitidos: string[] | null
  modulos_dashboard: string[] | null
  banned: boolean
  last_sign_in: string | null
  created_at: string
}

const PAPEIS_CRIACAO = ['colaborador', 'gestor', 'trainee'] as const
const PAPEIS_TODOS = ['colaborador', 'gestor', 'admin', 'trainee'] as const

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

function toUsername(email: string) {
  if (email.endsWith('@gt3.internal')) {
    const nome = email.split('@')[0].replace(/^gt3\./, '')
    return 'GT3.' + nome.toUpperCase()
  }
  return email
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const EMPTY_FORM = { nome: '', usuario: '', senha: '', papel: 'colaborador', pdi_slug: '' }

export default function LoginsClient() {
  const { user, profile, loading: profileLoading, reloadProfile } = useUser()
  const isAdmin = profile?.papel === 'admin'
  const canManage = profile?.papel === 'admin' || profile?.papel === 'gestor'

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [search, setSearch] = useState('')

  // Create user modal
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  // Edit user modal
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ nome: '', usuario: '', papel: '', pdi_slug: '' })
  const [editModulos, setEditModulos] = useState<string[] | null>(null)
  const [editModulosDashboard, setEditModulosDashboard] = useState<string[] | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editMsg, setEditMsg] = useState('')

  // Reset password modal
  const [resetUser, setResetUser] = useState<UserRow | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (profileLoading) return
    if (!user) return

    if (!profile) {
      setSeeding(true)
      fetch('/api/admin/seed-admin', { method: 'POST' })
        .then((r) => r.json())
        .then(async (d) => { if (d.success) await reloadProfile(user.id) })
        .finally(() => { setSeeding(false); fetchUsers() })
    } else {
      fetchUsers()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading])

  const filtered = users.filter((u) => {
    // Apenas admin vê outros admins
    if (u.papel === 'admin' && !isAdmin) return false
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.nome ?? '').toLowerCase().includes(q) ||
      (u.usuario ?? '').toLowerCase().includes(q) ||
      (u.papel ?? '').toLowerCase().includes(q)
    )
  })

  // ── Create user ──────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError('')
    setCreateSuccess('')

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) {
      setCreateError(data.error ?? 'Erro ao criar usuário.')
      setCreateLoading(false)
      return
    }

    setCreateSuccess(`Usuário criado!\nUsuário: ${data.usuario}\nSenha: ${form.senha}`)
    setForm(EMPTY_FORM)
    setCreateLoading(false)
    fetchUsers()
  }

  // ── Edit user ─────────────────────────────────────────────────
  function openEdit(u: UserRow) {
    setEditUser(u)
    setEditForm({ nome: u.nome ?? '', usuario: u.usuario ?? '', papel: u.papel ?? 'colaborador', pdi_slug: u.pdi_slug ?? '' })
    setEditModulos(u.modulos_permitidos ?? null)
    setEditModulosDashboard(u.modulos_dashboard ?? null)
    setEditMsg('')
  }

  function toggleEditModulo(modId: string) {
    const currentList = editModulos ?? CONFIGURABLE_MODULES.map(m => m.id)
    const isRemoving = currentList.includes(modId)
    const next = isRemoving
      ? currentList.filter(id => id !== modId)
      : [...currentList, modId]
    setEditModulos(next.length === CONFIGURABLE_MODULES.length ? null : next)
    // Removing from sidebar also removes from dashboard (subset constraint)
    if (isRemoving && editModulosDashboard !== null) {
      setEditModulosDashboard(editModulosDashboard.filter(id => id !== modId))
    }
  }

  function toggleEditModuloDashboard(modId: string) {
    const enabledIds = editModulos ?? CONFIGURABLE_MODULES.map(m => m.id)
    setEditModulosDashboard(prev => {
      const currentList = prev ?? enabledIds
      const next = currentList.includes(modId)
        ? currentList.filter(id => id !== modId)
        : [...currentList, modId]
      return next.length === enabledIds.length ? null : next
    })
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setEditLoading(true)
    setEditMsg('')

    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: editForm.nome,
        usuario: editForm.usuario,
        papel: editForm.papel,
        pdi_slug: editForm.pdi_slug || null,
        modulos_permitidos: editModulos,
        modulos_dashboard: editModulosDashboard,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setEditMsg(data.error ?? 'Erro ao salvar.')
      setEditLoading(false)
      return
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === editUser.id
          ? { ...u, nome: editForm.nome, usuario: editForm.usuario, papel: editForm.papel, pdi_slug: editForm.pdi_slug || null, modulos_permitidos: editModulos, modulos_dashboard: editModulosDashboard }
          : u
      )
    )
    setEditLoading(false)
    setEditUser(null)
  }

  // ── Change PDI ────────────────────────────────────────────────
  async function handlePdiChange(userId: string, pdi_slug: string | null) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdi_slug }),
    })
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, pdi_slug } : u)))
  }

  // ── Change role ───────────────────────────────────────────────
  async function handleRoleChange(userId: string, papel: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ papel }),
    })
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, papel } : u)))
  }

  // ── Reset password ────────────────────────────────────────────
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetUser) return
    setResetLoading(true)
    setResetMsg('')

    const res = await fetch(`/api/admin/users/${resetUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPassword }),
    })
    const data = await res.json()

    if (!res.ok) {
      setResetMsg(data.error ?? 'Erro ao resetar senha.')
    } else {
      setResetMsg(`Senha alterada para: ${resetPassword}`)
    }
    setResetLoading(false)
  }

  // ── Replicar módulos ──────────────────────────────────────────
  async function handleReplicar(u: UserRow) {
    if (!confirm(`Replicar configuração de módulos de "${u.nome || u.usuario || u.email}" para todos os ${u.papel}s?`)) return
    try {
      const res = await fetch('/api/admin/replicate-modulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: u.id, target_role: u.papel }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        alert(`Configuração replicada para ${data.updated ?? '?'} usuário(s).`)
        fetchUsers()
      } else {
        alert(data.error ?? `Erro ${res.status}`)
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor.')
    }
  }

  // ── Toggle ban ────────────────────────────────────────────────
  async function handleToggleBan(u: UserRow) {
    await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: !u.banned }),
    })
    setUsers((prev) => prev.map((r) => (r.id === u.id ? { ...r, banned: !r.banned } : r)))
  }

  // ── Loading / seeding state ───────────────────────────────────
  if (seeding || profileLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6B7A99', fontSize: 14 }}>
        {seeding ? 'Inicializando perfil...' : 'Carregando...'}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Gestão de Usuários</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7A99' }}>
            {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setCreateOpen(true); setCreateSuccess(''); setCreateError('') }}
            style={{ padding: '9px 20px', backgroundColor: '#2A4F96', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            + Novo usuário
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Buscar por nome, e-mail ou papel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 360, padding: '9px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box' }}
          onFocus={(e) => { e.target.style.borderColor = '#2A4F96' }}
          onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
        />
      </div>

      {/* Table */}
      <div style={{ backgroundColor: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#6B7A99', fontSize: 14 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#6B7A99', fontSize: 14 }}>Nenhum usuário encontrado.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                {['Nome', 'Usuário', 'Papel', 'PDI vinculado', 'Status', 'Último acesso', 'Ações'].map((col) => (
                  <th key={col} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const colors = PAPEL_COLORS[u.papel ?? ''] ?? { bg: '#F3F4F6', color: '#374151' }
                const initials = (u.usuario || u.nome || u.email).slice(0, 2).toUpperCase()
                // Rows belonging to another admin are read-only
                const isProtectedAdmin = u.papel === 'admin' && user?.id !== u.id
                const canEditThisRow = canManage && !isProtectedAdmin
                const canManageThisRow = canManage && !isProtectedAdmin
                return (
                  <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', opacity: u.banned ? 0.5 : 1 }}>

                    {/* Nome */}
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#1E3A6E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1AE6E', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {initials}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#1E293B' }}>
                          {u.nome ?? '—'}
                        </span>
                      </div>
                    </td>

                    {/* Usuário */}
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#6B7A99' }}>{u.usuario || toUsername(u.email)}</td>

                    {/* Papel */}
                    <td style={{ padding: '13px 16px' }}>
                      {canManageThisRow ? (
                        <select
                          value={u.papel ?? ''}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${colors.bg}`, backgroundColor: colors.bg, color: colors.color, fontSize: 12, fontWeight: 500, cursor: 'pointer', outline: 'none' }}
                        >
                          {(isAdmin ? PAPEIS_TODOS : PAPEIS_CRIACAO).map((p) => (
                            <option key={p} value={p}>{PAPEL_LABELS[p]}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ padding: '4px 8px', borderRadius: 6, backgroundColor: colors.bg, color: colors.color, fontSize: 12, fontWeight: 500 }}>
                          {PAPEL_LABELS[u.papel ?? ''] ?? u.papel ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* PDI vinculado */}
                    <td style={{ padding: '13px 16px' }}>
                      {canManageThisRow ? (
                        <select
                          value={u.pdi_slug ?? ''}
                          onChange={(e) => handlePdiChange(u.id, e.target.value || null)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer', outline: 'none', maxWidth: 180 }}
                        >
                          <option value="">— Nenhum —</option>
                          {PDI_OPTIONS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, color: '#6B7A99' }}>
                          {PDI_OPTIONS.find(p => p.value === u.pdi_slug)?.label ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: u.banned ? '#DC2626' : '#16A34A' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: u.banned ? '#DC2626' : '#16A34A' }} />
                        {u.banned ? 'Inativo' : 'Ativo'}
                      </span>
                    </td>

                    {/* Último acesso */}
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#6B7A99', whiteSpace: 'nowrap' }}>
                      {formatDate(u.last_sign_in)}
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canEditThisRow && (
                          <button
                            onClick={() => openEdit(u)}
                            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}
                          >
                            Editar
                          </button>
                        )}
                        {isAdmin && u.papel !== 'admin' && (
                          <button
                            onClick={() => handleReplicar(u)}
                            title={`Replicar módulos para todos os ${u.papel}s`}
                            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #C7D2FE', backgroundColor: '#EEF2FF', color: '#3730A3', fontSize: 12, cursor: 'pointer' }}
                          >
                            Replicar
                          </button>
                        )}
                        {canManageThisRow && (
                          <>
                            <button
                              onClick={() => { setResetUser(u); setResetPassword(''); setResetMsg('') }}
                              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}
                            >
                              Resetar senha
                            </button>
                            <button
                              onClick={() => handleToggleBan(u)}
                              style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${u.banned ? '#BBF7D0' : '#FECACA'}`, backgroundColor: u.banned ? '#F0FFF4' : '#FEF2F2', color: u.banned ? '#16A34A' : '#DC2626', fontSize: 12, cursor: 'pointer' }}
                            >
                              {u.banned ? 'Reativar' : 'Desativar'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal: Novo usuário ────────────────────────────────── */}
      {createOpen && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false) }}
        >
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>Novo usuário</h2>
              <button onClick={() => setCreateOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            <form onSubmit={handleCreate}>
              {[
                { label: 'Nome', key: 'nome', type: 'text', placeholder: 'Ex: João Silva' },
                { label: 'Usuário', key: 'usuario', type: 'text', placeholder: 'GT3.NOME' },
                { label: 'Senha temporária', key: 'senha', type: 'text', placeholder: 'Senha do usuário' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>{label}</label>
                  <input
                    type={type}
                    required
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.target.style.borderColor = '#2A4F96' }}
                    onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Papel</label>
                <select
                  value={form.papel}
                  onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  {PAPEIS_CRIACAO.map((p) => (
                    <option key={p} value={p}>{PAPEL_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>PDI vinculado</label>
                <select
                  value={form.pdi_slug}
                  onChange={(e) => setForm((f) => ({ ...f, pdi_slug: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="">— Nenhum —</option>
                  {PDI_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {createError && (
                <div style={{ marginBottom: 14, padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div style={{ marginBottom: 14, padding: '10px 12px', backgroundColor: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#166534', whiteSpace: 'pre-line' }}>
                  {createSuccess}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setCreateOpen(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                  Fechar
                </button>
                <button type="submit" disabled={createLoading} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: createLoading ? '#9BB3D4' : '#2A4F96', color: '#fff', fontSize: 14, fontWeight: 600, cursor: createLoading ? 'not-allowed' : 'pointer' }}>
                  {createLoading ? 'Criando...' : 'Criar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Editar usuário ─────────────────────────────── */}
      {editUser && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditUser(null) }}
        >
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 500, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>Editar usuário</h2>
              <button onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            <form onSubmit={handleEditSave}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
                  Usuário <span style={{ fontSize: 11, color: '#6B7A99', fontWeight: 400 }}>(identificador de login)</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.usuario}
                  onChange={(e) => setEditForm((f) => ({ ...f, usuario: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.target.style.borderColor = '#2A4F96' }}
                  onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
                  Nome <span style={{ fontSize: 11, color: '#6B7A99', fontWeight: 400 }}>(nome real — pode deixar em branco)</span>
                </label>
                <input
                  type="text"
                  value={editForm.nome}
                  onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.target.style.borderColor = '#2A4F96' }}
                  onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Papel</label>
                <select
                  value={editForm.papel}
                  onChange={(e) => setEditForm((f) => ({ ...f, papel: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  {(isAdmin ? PAPEIS_TODOS : PAPEIS_CRIACAO).map((p) => (
                    <option key={p} value={p}>{PAPEL_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>PDI vinculado</label>
                <select
                  value={editForm.pdi_slug}
                  onChange={(e) => setEditForm((f) => ({ ...f, pdi_slug: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="">— Nenhum —</option>
                  {PDI_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Módulos disponíveis</label>
                  <button
                    type="button"
                    onClick={() => setEditModulos(null)}
                    style={{ fontSize: 11, color: '#2A4F96', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    Selecionar todos
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', maxHeight: 220, overflowY: 'auto' }}>
                  {CONFIGURABLE_MODULES.map(mod => {
                    const checked = editModulos === null || editModulos.includes(mod.id)
                    return (
                      <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEditModulo(mod.id)}
                          style={{ accentColor: mod.color, width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.label}</span>
                      </label>
                    )
                  })}
                </div>
                {editModulos !== null && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6B7A99' }}>
                    {editModulos.length} de {CONFIGURABLE_MODULES.length} módulos liberados
                  </p>
                )}
              </div>

              {/* ── Dashboard modules (subset of sidebar) ── */}
              {(() => {
                const enabledIds = editModulos ?? CONFIGURABLE_MODULES.map(m => m.id)
                const enabledModules = CONFIGURABLE_MODULES.filter(m => enabledIds.includes(m.id))
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Módulos no Dashboard</label>
                      <button
                        type="button"
                        onClick={() => setEditModulosDashboard(null)}
                        style={{ fontSize: 11, color: '#2A4F96', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      >
                        Selecionar todos
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', maxHeight: 220, overflowY: 'auto' }}>
                      {enabledModules.map(mod => {
                        const checked = editModulosDashboard === null || editModulosDashboard.includes(mod.id)
                        return (
                          <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEditModuloDashboard(mod.id)}
                              style={{ accentColor: mod.color, width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                            />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.label}</span>
                          </label>
                        )
                      })}
                    </div>
                    {editModulosDashboard !== null && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6B7A99' }}>
                        {editModulosDashboard.length} de {enabledModules.length} módulos no dashboard
                      </p>
                    )}
                  </div>
                )
              })()}

              {editMsg && (
                <div style={{ marginBottom: 14, padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
                  {editMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditUser(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={editLoading} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: editLoading ? '#9BB3D4' : '#2A4F96', color: '#fff', fontSize: 14, fontWeight: 600, cursor: editLoading ? 'not-allowed' : 'pointer' }}>
                  {editLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Resetar senha ───────────────────────────────── */}
      {resetUser && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setResetUser(null); setResetMsg('') } }}
        >
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>Resetar senha</h2>
              <button onClick={() => { setResetUser(null); setResetMsg('') }} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7A99' }}>{resetUser.nome ?? resetUser.email}</p>

            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Nova senha</label>
                <input
                  type="text"
                  required
                  placeholder="Nova senha"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, color: '#1E293B', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.target.style.borderColor = '#2A4F96' }}
                  onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
                />
              </div>

              {resetMsg && (
                <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, fontSize: 13, backgroundColor: resetMsg.startsWith('Senha') ? '#F0FFF4' : '#FEF2F2', border: `1px solid ${resetMsg.startsWith('Senha') ? '#BBF7D0' : '#FECACA'}`, color: resetMsg.startsWith('Senha') ? '#166534' : '#DC2626' }}>
                  {resetMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setResetUser(null); setResetMsg('') }} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                  Fechar
                </button>
                <button type="submit" disabled={resetLoading} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: resetLoading ? '#9BB3D4' : '#2A4F96', color: '#fff', fontSize: 14, fontWeight: 600, cursor: resetLoading ? 'not-allowed' : 'pointer' }}>
                  {resetLoading ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
