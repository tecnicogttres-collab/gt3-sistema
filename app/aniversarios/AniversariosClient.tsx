'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '../lib/supabase'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEKDAYS_FULL = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']

type Pessoa = { key: string; nome: string; usuarioId: string | null; livreId: string | null }
type Entry = Pessoa & { dia: number }
type BdayData = Record<string, Pessoa[]>
type UsuarioOpcao = { id: string; nome: string | null; usuario: string | null; vinculado: boolean }

function dateKey(month: number, day: number): string {
  return `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function AniversariosClient() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [data, setData] = useState<BdayData>({})
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [formDay, setFormDay] = useState(today.getDate())
  const [formMonth, setFormMonth] = useState(today.getMonth())
  const [modo, setModo] = useState<'login' | 'livre'>('login')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [inputName, setInputName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadAll = useCallback(async () => {
    try {
      const res = await fetch('/api/aniversarios')
      if (!res.ok) return
      const json = await res.json() as {
        vinculados: { usuario_id: string; nome: string | null; dia: number; mes: number }[]
        livres: { id: string; nome: string; dia: number; mes: number }[]
        usuarios: UsuarioOpcao[]
      }
      const result: BdayData = {}
      const push = (k: string, p: Pessoa) => { if (!result[k]) result[k] = []; result[k].push(p) }
      json.vinculados.forEach(v => push(dateKey(v.mes - 1, v.dia), { key: 'u_' + v.usuario_id, nome: v.nome ?? '—', usuarioId: v.usuario_id, livreId: null }))
      json.livres.forEach(l => push(dateKey(l.mes - 1, l.dia), { key: 'l_' + l.id, nome: l.nome, usuarioId: null, livreId: l.id }))
      setData(result)
      setUsuarios(json.usuarios)
    } catch { /* noop */ }
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  const usuariosDisponiveis = useMemo(() => usuarios.filter(u => !u.vinculado), [usuarios])

  // Lista de todo mundo, agrupada por mês (0-11) e ordenada por dia — a "relação" que
  // substitui o calendário. Meses sem ninguém cadastrado somem da lista.
  const porMes = useMemo(() => {
    const buckets: Entry[][] = Array.from({ length: 12 }, () => [])
    for (const [key, pessoas] of Object.entries(data)) {
      const [mm, dd] = key.split('-').map(Number)
      for (const p of pessoas) buckets[mm - 1].push({ ...p, dia: dd })
    }
    buckets.forEach(list => list.sort((a, b) => a.dia - b.dia))
    return buckets
  }, [data])
  const totalCadastrados = porMes.reduce((n, l) => n + l.length, 0)

  function openAddModal() {
    setFormDay(today.getDate()); setFormMonth(today.getMonth())
    setInputName(''); setSelectedUserId(''); setModo('login'); setMsg('')
    setAddOpen(true)
  }

  const vincularUsuario = async () => {
    if (!selectedUserId) return
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/aniversarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: selectedUserId, dia: formDay, mes: formMonth + 1 }),
    })
    setSaving(false)
    if (!res.ok) { setMsg((await res.json().catch(() => ({})))?.error ?? 'Erro ao vincular.'); return }
    setSelectedUserId('')
    await loadAll()
  }

  const addPersonLivre = async () => {
    const name = inputName.trim()
    if (!name) return
    setInputName('')
    const supabase = createClient()
    const { error } = await supabase
      .from('aniversarios')
      .insert({ nome: name, dia: formDay, mes: formMonth + 1 })
    if (error) console.error('Erro ao adicionar aniversário:', error)
    await loadAll()
  }

  const removePerson = async (p: Pessoa) => {
    if (p.usuarioId) {
      await fetch(`/api/aniversarios?usuario_id=${encodeURIComponent(p.usuarioId)}`, { method: 'DELETE' })
    } else if (p.livreId) {
      const supabase = createClient()
      await supabase.from('aniversarios').delete().eq('id', p.livreId)
    }
    await loadAll()
  }

  // Upcoming birthdays (next 30 days from today, independente do ano que está sendo visto)
  const upcoming: { name: string; label: string }[] = []
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  for (let offset = 0; offset <= 30; offset++) {
    const d = new Date(ref)
    d.setDate(ref.getDate() + offset)
    const k = dateKey(d.getMonth(), d.getDate())
    if (data[k]?.length > 0) {
      data[k].forEach(p => {
        const label = offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : `${d.getDate()}/${d.getMonth() + 1}`
        upcoming.push({ name: p.nome, label })
      })
    }
  }

  const modalKey = dateKey(formMonth, formDay)
  const modalPeopleNesteDia = data[modalKey] ?? []

  const navBtn: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 6, border: '1px solid #E2E8F0',
    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#6B7A99', fontSize: 16,
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #E2E8F0', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', letterSpacing: -0.3 }}>Aniversários</div>
          <div style={{ fontSize: 12, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
            GT3 Consultoria · {totalCadastrados} cadastrado{totalCadastrados !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setViewYear(y => y - 1)} style={navBtn} title="Ano anterior">←</button>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#1E293B', minWidth: 56, textAlign: 'center' }}>{viewYear}</span>
          <button onClick={() => setViewYear(y => y + 1)} style={navBtn} title="Próximo ano">→</button>
          <button
            onClick={openAddModal}
            style={{ marginLeft: 6, background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + Adicionar aniversário
          </button>
        </div>
      </div>

      {/* Upcoming bar */}
      <div style={{
        background: '#EBF0FB', border: '1px solid #C5D4F5', borderRadius: 10,
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, marginBottom: 16, minHeight: 42, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2A4F96', whiteSpace: 'nowrap' }}>
          Próximos
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {upcoming.length === 0 ? (
            <span style={{ fontSize: 13, color: '#6B7A99', fontStyle: 'italic' }}>
              Nenhum aniversário nos próximos 30 dias
            </span>
          ) : upcoming.slice(0, 6).map((item, i) => (
            <div key={i} style={{
              background: '#fff', border: '1px solid #C5D4F5', borderRadius: 100,
              padding: '3px 10px', fontSize: 12, color: '#1E3A6E',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontWeight: 600, color: '#2A4F96', fontSize: 11 }}>{item.label}</span>
              {item.name}
            </div>
          ))}
        </div>
      </div>

      {/* Relação — agrupada por mês, separação sutil */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        {totalCadastrados === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#B0ADA5', fontSize: 13.5 }}>
            Nenhum aniversário cadastrado ainda.
          </div>
        ) : porMes.map((lista, mes0) => {
          if (lista.length === 0) return null
          return (
            <div key={mes0}>
              <div style={{
                padding: '9px 20px', background: '#FAFBFC',
                borderTop: mes0 === 0 ? 'none' : '1px solid #E2E8F0', borderBottom: '1px solid #F1F5F9',
                fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9AAABF',
              }}>
                {MONTHS[mes0]}
              </div>
              {lista.map((p, i) => {
                const weekday = WEEKDAYS_FULL[new Date(viewYear, mes0, p.dia).getDay()]
                return (
                  <div key={p.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 20px', borderBottom: i < lista.length - 1 ? '1px solid #F4F6FA' : 'none',
                    transition: 'background-color .12s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#FAFBFC' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}
                  >
                    <span style={{ fontSize: 14, color: '#1E293B', lineHeight: 1.4 }}>
                      <b style={{ fontWeight: 600 }}>{p.nome}</b>
                      {', '}{String(p.dia).padStart(2, '0')}/{String(mes0 + 1).padStart(2, '0')}. {weekday}
                      {p.usuarioId && <span style={{ marginLeft: 8, fontSize: 10, color: '#2A4F96', fontWeight: 600 }}>· login vinculado</span>}
                    </span>
                    <button
                      onClick={() => void removePerson(p)}
                      title={`Remover ${p.nome}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D8D4CC', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#E74C3C' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#D8D4CC' }}
                    >×</button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#B0ADA5', marginTop: 12 }}>
        Os dados ficam salvos na nuvem e são compartilhados entre todos os usuários.
      </p>

      {/* Modal: novo aniversário */}
      {addOpen && (
        <div
          className="gt3-overlay-fade"
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,25,22,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setAddOpen(false) }}
        >
          <div className="gt3-drop-in" style={{ background: '#fff', borderRadius: 14, width: 380, maxWidth: '94vw', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ background: '#2A4F96', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontWeight: 600, fontSize: 17, color: '#fff', letterSpacing: -0.2, margin: 0 }}>
                Novo aniversário
              </h2>
              <button onClick={() => setAddOpen(false)} className="gt3-close-btn" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>
                ×
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B0ADA5', marginBottom: 8 }}>
                Data de nascimento (dia/mês)
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="number" min={1} max={31} value={formDay}
                  onChange={e => setFormDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  style={{ width: 72, border: '1px solid #E2E8F0', borderRadius: 6, padding: '9px 10px', fontSize: 14, background: '#fff', color: '#1E293B', outline: 'none' }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#2A4F96' }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E2E8F0' }}
                />
                <select
                  value={formMonth}
                  onChange={e => setFormMonth(Number(e.target.value))}
                  style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: 6, padding: '9px 12px', fontSize: 14, background: '#fff', color: '#1E293B', outline: 'none' }}
                >
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>

              {modalPeopleNesteDia.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B0ADA5', marginBottom: 8 }}>
                    Já cadastrado{modalPeopleNesteDia.length !== 1 ? 's' : ''} neste dia
                  </div>
                  {modalPeopleNesteDia.map(p => (
                    <div key={p.key} style={{ fontSize: 13, color: '#1E293B', padding: '4px 10px', background: '#F4F6FA', borderRadius: 6, marginBottom: 4 }}>
                      {p.nome}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                {([['login', 'Vincular login'], ['livre', 'Nome sem login']] as const).map(([val, label]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: modo === val ? '#2A4F96' : '#6B7A99', fontWeight: modo === val ? 600 : 400, cursor: 'pointer' }}>
                    <input type="radio" checked={modo === val} onChange={() => setModo(val)} style={{ accentColor: '#2A4F96' }} />
                    {label}
                  </label>
                ))}
              </div>

              {modo === 'login' ? (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={selectedUserId}
                      onChange={e => setSelectedUserId(e.target.value)}
                      style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: 6, padding: '9px 12px', fontSize: 14, background: '#fff', color: '#1E293B', outline: 'none' }}
                    >
                      <option value="">Selecione um login...</option>
                      {usuariosDisponiveis.map(u => (
                        <option key={u.id} value={u.id}>{u.nome || u.usuario || u.id}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => void vincularUsuario()}
                      disabled={!selectedUserId || saving}
                      style={{ background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 14, fontWeight: 500, cursor: !selectedUserId || saving ? 'not-allowed' : 'pointer', opacity: !selectedUserId || saving ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      {saving ? 'Salvando...' : 'Vincular'}
                    </button>
                  </div>
                  {usuariosDisponiveis.length === 0 && (
                    <p style={{ fontSize: 11, color: '#B0ADA5', marginTop: 6 }}>Todos os logins já têm aniversário cadastrado.</p>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={inputName}
                    onChange={e => setInputName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void addPersonLivre() }}
                    placeholder="Nome completo (sem login no sistema)"
                    maxLength={80}
                    autoComplete="off"
                    style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: 6, padding: '9px 12px', fontSize: 14, background: '#fff', color: '#1E293B', outline: 'none' }}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#2A4F96' }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E2E8F0' }}
                  />
                  <button
                    onClick={() => void addPersonLivre()}
                    style={{ background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Adicionar
                  </button>
                </div>
              )}
              {msg && <p style={{ fontSize: 12, color: '#E74C3C', marginTop: 8 }}>{msg}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
