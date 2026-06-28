'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useUser } from '../components/UserContext'
import { createClient } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type CatRow = { id: string; label: string; color: string; bg: string; ordem: number }

const PAPEIS = [
  { id: 'admin',       label: 'Admin' },
  { id: 'gestor',      label: 'Gestor' },
  { id: 'colaborador', label: 'Colaborador' },
  { id: 'trainee',     label: 'Trainee' },
]

const COLOR_PRESETS: { color: string; bg: string; name: string }[] = [
  { color: '#2A4F96', bg: '#E5EEFB', name: 'Azul'          },
  { color: '#6B46C1', bg: '#F1E9FB', name: 'Roxo'          },
  { color: '#9C6B16', bg: '#FDEDD3', name: 'Âmbar'         },
  { color: '#2F855A', bg: '#E2F5EA', name: 'Verde'         },
  { color: '#00838F', bg: '#E0F7FA', name: 'Ciano'         },
  { color: '#2E7D32', bg: '#E8F5E9', name: 'Verde escuro'  },
  { color: '#4A5568', bg: '#EDF2F7', name: 'Cinza'         },
  { color: '#C53030', bg: '#FFF5F5', name: 'Vermelho'      },
  { color: '#B7410E', bg: '#FFF7ED', name: 'Laranja'       },
  { color: '#2C7A7B', bg: '#E6FFFA', name: 'Teal'          },
  { color: '#553C9A', bg: '#FAF5FF', name: 'Índigo'        },
  { color: '#B83280', bg: '#FFF0F6', name: 'Rosa'          },
]

const CAT_FALLBACK: Omit<CatRow, 'id' | 'ordem'> = { label: '?', color: '#4A5568', bg: '#EDF2F7' }

type Legislacao = {
  id: string
  titulo: string
  descricao: string | null
  link: string
  categoria: string
  autor_id: string | null
  autor_nome: string | null
  data: string
  destinatarios: string[]
  created_at: string
  lida: boolean
}

type UserRow = { id: string; nome: string | null; usuario: string | null; papel: string | null }

type Form = {
  titulo: string; descricao: string; link: string; categoria: string
  todos: boolean; perfis: string[]; pessoas: string[]
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const PRIMARY      = '#2A4F96'
const PRIMARY_SOFT = '#E8EEF9'
const ACCENT       = '#D1AE6E'
const ACCENT_DARK  = '#B68F4D'
const BG           = '#F4F6FA'
const SURF         = '#FFFFFF'
const BORDER       = '#E2E8F0'
const TEXT         = '#1F2937'
const MUTED        = '#6B7280'
const RADIUS       = 12
const SHADOW       = '0 1px 3px rgba(20,30,60,.06),0 1px 2px rgba(20,30,60,.04)'
const SHADOW_MD    = '0 8px 24px rgba(20,30,60,.12)'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtData(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function getCat(id: string, cats: CatRow[]) {
  return cats.find(c => c.id === id) ?? { ...CAT_FALLBACK, id }
}

function isVisivelPara(leg: Legislacao, userId: string, papel: string) {
  return leg.destinatarios.includes('todos') || leg.destinatarios.includes(papel) || leg.destinatarios.includes(userId)
}

function destinatarioLabels(leg: Legislacao, users: UserRow[]) {
  if (leg.destinatarios.includes('todos')) return ['Todos']
  return leg.destinatarios.map(d => {
    const p = PAPEIS.find(p => p.id === d)
    if (p) return p.label
    const u = users.find(u => u.id === d)
    return u?.nome?.trim() || u?.usuario?.trim() || d
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LegislacoesClient() {
  const { profile } = useUser()

  const [legislacoes, setLegislacoes] = useState<Legislacao[]>([])
  const [users, setUsers]             = useState<UserRow[]>([])
  const [categorias, setCategorias]   = useState<CatRow[]>([])
  const [loading, setLoading]         = useState(true)

  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [busca, setBusca]                     = useState('')
  const [apenasMinhas, setApenasMinhas]       = useState(true)

  // Drawer nova legislação
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm]             = useState<Form>({ titulo: '', descricao: '', link: '', categoria: '', todos: true, perfis: [], pessoas: [] })
  const [saving, setSaving]         = useState(false)
  const [errDestino, setErrDestino] = useState(false)

  // Confirmação de leitura
  const [confirmarOpen, setConfirmarOpen] = useState(false)
  const [realtimeAlert, setRealtimeAlert] = useState<Legislacao | null>(null)

  // Gerenciar categorias
  const [catOpen, setCatOpen]           = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [catDraft, setCatDraft]         = useState<{ label: string; color: string; bg: string }>({ label: '', color: COLOR_PRESETS[0].color, bg: COLOR_PRESETS[0].bg })
  const [addingCat, setAddingCat]       = useState(false)
  const [newCat, setNewCat]             = useState<{ label: string; color: string; bg: string }>({ label: '', color: COLOR_PRESETS[0].color, bg: COLOR_PRESETS[0].bg })
  const [catSaving, setCatSaving]       = useState(false)

  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false })
  const toastTimer        = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, show: true })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2600)
  }

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch('/api/legislacoes').then(r => r.ok ? r.json() : []),
      fetch('/api/legislacoes/usuarios').then(r => r.ok ? r.json() : []),
      fetch('/api/legislacoes/categorias').then(r => r.ok ? r.json() : []),
    ]).then(([legs, usr, cats]) => {
      setLegislacoes(legs)
      setUsers(usr)
      setCategorias(cats)
      if (cats.length > 0) setForm(f => ({ ...f, categoria: cats[0].id }))
    }).finally(() => setLoading(false))
  }, [])

  // ── Realtime ─────────────────────────────────────────────────────────────────

  const userId = profile?.id ?? ''
  const papel  = profile?.papel ?? 'colaborador'

  const checkVisibility = useCallback(
    (leg: Legislacao) => isVisivelPara(leg, userId, papel),
    [userId, papel]
  )

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`legislacoes-inserts-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'legislacoes' }, (payload) => {
        const nova = { ...(payload.new as Omit<Legislacao, 'lida'>), lida: false }
        if (checkVisibility(nova)) {
          setLegislacoes(prev => prev.some(l => l.id === nova.id) ? prev : [nova, ...prev])
          if (nova.autor_id !== userId) setRealtimeAlert(nova)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId, checkVisibility])

  // ── Computed ────────────────────────────────────────────────────────────────

  const canCreate     = true
  const canManageCats = ['gestor', 'admin'].includes(papel)

  const stats = useMemo(() => {
    const vis   = legislacoes.filter(l => isVisivelPara(l, userId, papel))
    const novas = vis.filter(l => !l.lida)
    return { visiveis: vis.length, novas: novas.length, total: legislacoes.length }
  }, [legislacoes, userId, papel])

  const pendentes = useMemo(
    () => legislacoes.filter(l => isVisivelPara(l, userId, papel) && !l.lida),
    [legislacoes, userId, papel]
  )

  const feed = useMemo(() => {
    let list = [...legislacoes]
    if (apenasMinhas) list = list.filter(l => isVisivelPara(l, userId, papel))
    if (filtroCategoria !== 'todas') list = list.filter(l => l.categoria === filtroCategoria)
    if (busca.trim()) list = list.filter(l => l.titulo.toLowerCase().includes(busca.toLowerCase()))
    return list
  }, [legislacoes, apenasMinhas, filtroCategoria, busca, userId, papel])

  // ── Handlers: leitura ────────────────────────────────────────────────────────

  function handleConfirmar(leg: Legislacao) {
    if (leg.lida) return
    setLegislacoes(prev => prev.map(l => l.id === leg.id ? { ...l, lida: true } : l))
    setRealtimeAlert(prev => prev?.id === leg.id ? null : prev)
    fetch(`/api/legislacoes/${leg.id}/lida`, { method: 'POST' }).catch(() => {})
    showToast('Leitura confirmada.')
  }

  function handleAbrirLink(leg: Legislacao) {
    handleConfirmar(leg)
    window.open(leg.link, '_blank')
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta legislação?')) return
    const res = await fetch(`/api/legislacoes/${id}`, { method: 'DELETE' })
    if (res.ok) { setLegislacoes(prev => prev.filter(l => l.id !== id)); showToast('Legislação excluída.') }
    else showToast('Erro ao excluir.')
  }

  async function handlePublicar() {
    const destinatarios: string[] = form.todos ? ['todos'] : [...form.perfis, ...form.pessoas]
    if (destinatarios.length === 0) { setErrDestino(true); return }
    setErrDestino(false)
    if (!form.titulo.trim() || !form.link.trim()) { showToast('Preencha título e link antes de publicar.'); return }
    setSaving(true)
    const categoria = form.categoria || categorias[0]?.id || ''
    const res = await fetch('/api/legislacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: form.titulo, descricao: form.descricao, link: form.link, categoria, destinatarios }),
    })
    setSaving(false)
    if (res.ok) {
      const created: Legislacao = await res.json()
      setLegislacoes(prev => prev.some(l => l.id === created.id) ? prev : [created, ...prev])
      setDrawerOpen(false)
      setForm({ titulo: '', descricao: '', link: '', categoria: categorias[0]?.id ?? '', todos: true, perfis: [], pessoas: [] })
      showToast('Legislação publicada.')
    } else { const e = await res.json().catch(() => ({})); showToast((e as { error?: string }).error ?? 'Erro ao publicar.') }
  }

  // ── Handlers: categorias ─────────────────────────────────────────────────────

  function startEditCat(cat: CatRow) {
    setEditingCatId(cat.id)
    setCatDraft({ label: cat.label, color: cat.color, bg: cat.bg })
  }

  async function saveCatEdit(id: string) {
    if (!catDraft.label.trim()) return
    setCatSaving(true)
    const res = await fetch(`/api/legislacoes/categorias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: catDraft.label, color: catDraft.color, bg: catDraft.bg }),
    })
    setCatSaving(false)
    if (res.ok) {
      const updated: CatRow = await res.json()
      setCategorias(prev => prev.map(c => c.id === id ? updated : c))
      setEditingCatId(null)
    } else showToast('Erro ao salvar.')
  }

  async function deleteCat(id: string) {
    if (!confirm('Excluir esta categoria? Legislações existentes ainda a referenciam.')) return
    const res = await fetch(`/api/legislacoes/categorias/${id}`, { method: 'DELETE' })
    if (res.ok) setCategorias(prev => prev.filter(c => c.id !== id))
    else showToast('Erro ao excluir categoria.')
  }

  async function saveNewCat() {
    if (!newCat.label.trim()) return
    setCatSaving(true)
    const res = await fetch('/api/legislacoes/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newCat.label, color: newCat.color, bg: newCat.bg }),
    })
    setCatSaving(false)
    if (res.ok) {
      const created: CatRow = await res.json()
      setCategorias(prev => [...prev, created])
      setNewCat({ label: '', color: COLOR_PRESETS[0].color, bg: COLOR_PRESETS[0].bg })
      setAddingCat(false)
    } else {
      let msg = 'Erro ao criar categoria.'
      try { const j = await res.json(); if (j?.error) msg = `Erro: ${j.error}` } catch { /* */ }
      showToast(msg)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function ColorPicker({ selected, onSelect }: { selected: string; onSelect: (color: string, bg: string) => void }) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {COLOR_PRESETS.map(p => (
          <div key={p.color} title={p.name} onClick={() => onSelect(p.color, p.bg)}
            style={{ width: 22, height: 22, borderRadius: '50%', background: p.color, cursor: 'pointer', flexShrink: 0, outline: selected === p.color ? `3px solid ${TEXT}` : '2px solid transparent', outlineOffset: 2, transition: 'outline .1s' }} />
        ))}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const anyModalOpen = confirmarOpen || catOpen

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Inter',system-ui,sans-serif", color: TEXT, paddingTop: pendentes.length > 0 ? 56 : 0 }}>

      {/* Header */}
      <div style={{ background: SURF, borderBottom: `1px solid ${BORDER}`, padding: '18px 28px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>Legislações</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Atualizações normativas para a equipe</div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 40px' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {[
            { label: 'Visíveis para mim', value: stats.visiveis, accent: false },
            { label: 'Novas',             value: stats.novas,    accent: true  },
            { label: 'Total',             value: stats.total,    accent: false },
          ].map(s => (
            <div key={s.label} style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 14px', fontSize: 12.5, color: MUTED, display: 'flex', alignItems: 'center', gap: 6 }}>
              {s.label}: <b style={{ color: s.accent ? ACCENT_DARK : PRIMARY }}>{s.value}</b>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input type="text" placeholder="Buscar por título..." value={busca} onChange={e => setBusca(e.target.value)}
              style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'inherit', background: BG, color: TEXT, outline: 'none' }} />
            {canManageCats && (
              <button onClick={() => setCatOpen(true)} title="Gerenciar categorias"
                style={{ background: BG, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                ⚙
              </button>
            )}
            {canCreate && (
              <button onClick={() => setDrawerOpen(true)}
                style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                + Nova legislação
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            {/* Chips de categoria */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[{ id: 'todas', label: 'Todas' }, ...categorias].map(c => (
                <button key={c.id} onClick={() => setFiltroCategoria(c.id)}
                  style={{ border: `1px solid ${filtroCategoria === c.id ? PRIMARY : BORDER}`, background: filtroCategoria === c.id ? PRIMARY : BG, color: filtroCategoria === c.id ? '#fff' : MUTED, borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  {c.label}
                </button>
              ))}
            </div>
            {/* Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: MUTED }}>
              <span>{apenasMinhas ? 'Apenas direcionadas a mim' : 'Mostrando todas'}</span>
              <div onClick={() => setApenasMinhas(v => !v)}
                style={{ position: 'relative', width: 36, height: 20, background: apenasMinhas ? PRIMARY : BORDER, borderRadius: 999, cursor: 'pointer', transition: 'background .15s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: apenasMinhas ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .15s' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED }}>Carregando...</div>
        ) : feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>📋</div>
            <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Nenhuma legislação encontrada.</p>
            <p style={{ fontSize: 13.5, margin: 0 }}>Ajuste os filtros ou publique uma nova atualização.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {feed.map(leg => {
              const cat      = getCat(leg.categoria, categorias)
              const nova     = isVisivelPara(leg, userId, papel) && !leg.lida
              const destLbls = destinatarioLabels(leg, users)
              const canDel   = papel === 'admin' || (papel === 'gestor' && leg.autor_id === userId)
              return (
                <div key={leg.id} style={{ background: SURF, border: `1px solid ${nova ? ACCENT : BORDER}`, borderRadius: RADIUS, padding: '16px 18px', boxShadow: SHADOW }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.3px', color: cat.color, background: cat.bg }}>{cat.label}</span>
                      {nova && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', color: '#5a4421', background: ACCENT }}>Nova</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11.5, color: MUTED, whiteSpace: 'nowrap' }}>{fmtData(leg.data)}</span>
                      {canDel && (
                        <button onClick={() => handleDelete(leg.id)} title="Excluir"
                          style={{ border: 'none', background: 'transparent', color: '#C53030', fontSize: 14, cursor: 'pointer', padding: 2, lineHeight: 1 }}>✕</button>
                      )}
                    </div>
                  </div>
                  <h4 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 6px', lineHeight: 1.35 }}>{leg.titulo}</h4>
                  {leg.descricao && <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.55, margin: '0 0 12px' }}>{leg.descricao}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {leg.autor_nome && <><span>Por {leg.autor_nome}</span><span>·</span></>}
                      {destLbls.map(d => (
                        <span key={d} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '2px 9px', fontSize: 11 }}>{d}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {nova && (
                        <button onClick={() => handleConfirmar(leg)}
                          style={{ background: '#F0FFF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          ✓ Confirmar leitura
                        </button>
                      )}
                      <button onClick={() => handleAbrirLink(leg)}
                        style={{ background: PRIMARY_SOFT, color: PRIMARY, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        Abrir link ↗
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Banner de pendentes (topo fixo) ──────────────────────────────────── */}
      {pendentes.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: '#B45309', color: '#fff', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px', boxShadow: '0 2px 12px rgba(0,0,0,.2)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '.01em' }}>
            📋 {pendentes.length} legislação{pendentes.length > 1 ? 'ões' : ''} aguarda{pendentes.length > 1 ? 'm' : ''} confirmação de leitura
          </span>
          <button onClick={() => setConfirmarOpen(true)}
            style={{ background: '#fff', color: '#B45309', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Ver e confirmar
          </button>
        </div>
      )}

      {/* ── Modal: confirmação de leitura ──────────────────────────────────────── */}
      {confirmarOpen && (
        <>
          <div onClick={() => setConfirmarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: SURF, borderRadius: 16, width: 620, maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', zIndex: 51, boxShadow: SHADOW_MD }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Confirmação de leitura</h3>
                {pendentes.length > 0 && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}</div>}
              </div>
              <button onClick={() => setConfirmarOpen(false)} style={{ border: 'none', background: BG, width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 16, color: MUTED }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendentes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: MUTED }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                  <div style={{ fontWeight: 600 }}>Todas as legislações confirmadas!</div>
                </div>
              ) : pendentes.map(leg => {
                const cat = getCat(leg.categoria, categorias)
                return (
                  <div key={leg.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: cat.color, background: cat.bg, textTransform: 'uppercase' }}>{cat.label}</span>
                      <span style={{ fontSize: 11.5, color: MUTED }}>{fmtData(leg.data)}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: leg.descricao ? 4 : 10, lineHeight: 1.35 }}>{leg.titulo}</div>
                    {leg.descricao && <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>{leg.descricao}</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => handleAbrirLink(leg)} style={{ background: PRIMARY_SOFT, color: PRIMARY, border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Abrir link ↗</button>
                      <button onClick={() => handleConfirmar(leg)} style={{ background: '#F0FFF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Confirmar leitura</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Modal: gerenciar categorias ──────────────────────────────────────── */}
      {catOpen && (
        <>
          <div onClick={() => { setCatOpen(false); setEditingCatId(null); setAddingCat(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: SURF, borderRadius: 16, width: 520, maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', zIndex: 51, boxShadow: SHADOW_MD }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Gerenciar Categorias</h3>
              <button onClick={() => { setCatOpen(false); setEditingCatId(null); setAddingCat(false) }} style={{ border: 'none', background: BG, width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 16, color: MUTED }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>

              {categorias.map(cat => (
                <div key={cat.id}>
                  {editingCatId === cat.id ? (
                    /* Linha em edição */
                    <div style={{ border: `1px solid ${PRIMARY}`, borderRadius: 10, padding: '12px 14px', background: PRIMARY_SOFT }}>
                      <input value={catDraft.label} onChange={e => setCatDraft(d => ({ ...d, label: e.target.value }))}
                        style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '8px 10px', fontSize: 13.5, fontFamily: 'inherit', background: SURF, color: TEXT, boxSizing: 'border-box', marginBottom: 4 }} />
                      <ColorPicker selected={catDraft.color} onSelect={(color, bg) => setCatDraft(d => ({ ...d, color, bg }))} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 700, color: catDraft.color, background: catDraft.bg }}>{catDraft.label || 'Prévia'}</span>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setEditingCatId(null)} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '6px 12px', fontSize: 13, color: MUTED, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                        <button onClick={() => saveCatEdit(cat.id)} disabled={catSaving || !catDraft.label.trim()}
                          style={{ background: PRIMARY, border: 'none', color: '#fff', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: catSaving || !catDraft.label.trim() ? 0.6 : 1 }}>
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Linha normal */
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, background: SURF }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: TEXT, flex: 1 }}>{cat.label}</span>
                      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, color: cat.color, background: cat.bg, fontWeight: 700 }}>{cat.label}</span>
                      <button onClick={() => startEditCat(cat)} title="Editar"
                        style={{ border: 'none', background: 'transparent', color: PRIMARY, fontSize: 14, cursor: 'pointer', padding: '2px 6px' }}>✏</button>
                      <button onClick={() => deleteCat(cat.id)} title="Excluir"
                        style={{ border: 'none', background: 'transparent', color: '#C53030', fontSize: 14, cursor: 'pointer', padding: '2px 6px' }}>✕</button>
                    </div>
                  )}
                </div>
              ))}

              {/* Nova categoria */}
              {addingCat ? (
                <div style={{ border: `1px solid ${PRIMARY}`, borderRadius: 10, padding: '12px 14px', background: PRIMARY_SOFT, marginTop: 4 }}>
                  <input value={newCat.label} onChange={e => setNewCat(d => ({ ...d, label: e.target.value }))}
                    placeholder="Nome da categoria"
                    autoFocus
                    style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '8px 10px', fontSize: 13.5, fontFamily: 'inherit', background: SURF, color: TEXT, boxSizing: 'border-box', marginBottom: 4 }} />
                  <ColorPicker selected={newCat.color} onSelect={(color, bg) => setNewCat(d => ({ ...d, color, bg }))} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 700, color: newCat.color, background: newCat.bg }}>{newCat.label || 'Prévia'}</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setAddingCat(false)} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '6px 12px', fontSize: 13, color: MUTED, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                    <button onClick={saveNewCat} disabled={catSaving || !newCat.label.trim()}
                      style={{ background: PRIMARY, border: 'none', color: '#fff', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: catSaving || !newCat.label.trim() ? 0.6 : 1 }}>
                      Criar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAddingCat(true); setEditingCatId(null) }}
                  style={{ background: 'transparent', border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: PRIMARY, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textAlign: 'left', marginTop: 4 }}>
                  ＋ Nova categoria
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Alerta realtime ───────────────────────────────────────────────────── */}
      {realtimeAlert && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 60, background: SURF, border: `2px solid ${ACCENT}`, borderRadius: 12, padding: '16px 18px', width: 340, maxWidth: 'calc(100vw - 40px)', boxShadow: SHADOW_MD }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>📋</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT_DARK, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Nova legislação publicada</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT, lineHeight: 1.35 }}>{realtimeAlert.titulo}</div>
              {realtimeAlert.descricao && <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>{realtimeAlert.descricao}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleConfirmar(realtimeAlert)} style={{ flex: 1, background: '#F0FFF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Confirmar leitura</button>
            <button onClick={() => setRealtimeAlert(null)} style={{ background: BG, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '8px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Depois</button>
          </div>
        </div>
      )}

      {/* ── Drawer: nova legislação ───────────────────────────────────────────── */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 30 }} />
      )}
      <div style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 420, maxWidth: '92vw', background: SURF, boxShadow: SHADOW_MD, zIndex: 31, transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .25s ease', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nova legislação</h3>
          <button onClick={() => setDrawerOpen(false)} style={{ border: 'none', background: BG, width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 16, color: MUTED }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Título</label>
            <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: NR-12 — atualização sobre máquinas e equipamentos"
              style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', background: BG, color: TEXT, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Descrição breve</label>
            <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} maxLength={300} rows={3} placeholder="Resuma em 1-2 frases o que mudou e por que importa."
              style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', background: BG, color: TEXT, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Link da fonte oficial</label>
            <input type="url" value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="https://..."
              style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', background: BG, color: TEXT, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Categoria</label>
            <select value={form.categoria || categorias[0]?.id || ''} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', background: BG, color: TEXT }}>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Direcionar para</label>
            <div onClick={() => setForm(f => ({ ...f, todos: !f.todos }))}
              style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${form.todos ? ACCENT : BORDER}`, borderRadius: 8, padding: 11, background: form.todos ? '#FBF4E8' : BG, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.todos} onChange={() => {}} style={{ margin: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Todos os usuários</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>Visível para qualquer pessoa no sistema</div>
              </div>
            </div>
            {!form.todos && (
              <>
                <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>Por perfil</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {PAPEIS.map(p => {
                    const checked = form.perfis.includes(p.id)
                    return (
                      <label key={p.id} onClick={() => setForm(f => ({ ...f, perfis: checked ? f.perfis.filter(x => x !== p.id) : [...f.perfis, p.id] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${checked ? PRIMARY : BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, cursor: 'pointer', background: checked ? PRIMARY_SOFT : BG, color: checked ? PRIMARY : TEXT, fontWeight: checked ? 600 : 400 }}>
                        <input type="checkbox" checked={checked} onChange={() => {}} style={{ margin: 0 }} />
                        {p.label}
                      </label>
                    )
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>Por pessoa</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {users.map(u => {
                    const checked = form.pessoas.includes(u.id)
                    const nome = u.nome?.trim() || u.usuario?.trim() || 'Usuário'
                    return (
                      <label key={u.id} onClick={() => setForm(f => ({ ...f, pessoas: checked ? f.pessoas.filter(x => x !== u.id) : [...f.pessoas, u.id] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${checked ? PRIMARY : BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, cursor: 'pointer', background: checked ? PRIMARY_SOFT : BG, color: checked ? PRIMARY : TEXT, fontWeight: checked ? 600 : 400 }}>
                        <input type="checkbox" checked={checked} onChange={() => {}} style={{ margin: 0 }} />
                        {nome}
                      </label>
                    )
                  })}
                </div>
              </>
            )}
            {errDestino && <div style={{ color: '#C53030', fontSize: 12, marginTop: 6 }}>Selecione pelo menos um destinatário.</div>}
          </div>
        </div>
        <div style={{ padding: '16px 22px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setDrawerOpen(false)} style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handlePublicar} disabled={saving} style={{ background: saving ? '#7a96c7' : PRIMARY, border: 'none', color: '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Publicando...' : 'Publicar legislação'}
          </button>
        </div>
      </div>

      {/* Toast */}
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) translateY(${toast.show ? 0 : 20}px)`, background: TEXT, color: '#fff', padding: '11px 20px', borderRadius: 999, fontSize: 13, fontWeight: 500, boxShadow: SHADOW_MD, opacity: toast.show ? 1 : 0, transition: 'all .25s', zIndex: 55, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', flexShrink: 0 }} />
        {toast.msg}
      </div>
    </div>
  )
}
