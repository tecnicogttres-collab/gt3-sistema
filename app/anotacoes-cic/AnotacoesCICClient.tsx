'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Anotacao = { id: string; pessoa: string; doc: string; obs: string; responsavel: string }
type Empresa = { id: string; nome: string; status: 'sem' | 'reativada' | 'ok' | 'pendente'; obs: string; expanded: boolean; anotacoes: Anotacao[] }
type Categoria = { id: string; nome: string; collapsed: boolean; empresas: Empresa[] }
type PastaFull = { id: string; nome: string; periodo: string; categorias: Categoria[]; created_at: string }

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_ORDER: Array<Empresa['status']> = ['sem', 'reativada', 'ok', 'pendente']
const STATUS_CFG: Record<Empresa['status'], { label: string; bg: string; color: string }> = {
  sem:       { label: 'Sem cadastro', bg: '#f0f2f7', color: '#5a6178' },
  reativada: { label: 'Reativada',    bg: '#e8f0fc', color: '#1d3a74' },
  ok:        { label: 'OK',           bg: '#e8f5e9', color: '#2e7d32' },
  pendente:  { label: 'Pendente',     bg: '#fef3e2', color: '#b45309' },
}
const DEFAULT_CATS = ['INDUSTRIAL', 'SERVIÇOS', 'EVENTOS', 'COMUNICAÇÃO']
const PRIMARY = '#2A4F96'
const BORDER = 'rgba(42,79,150,0.12)'
const MUTED = '#9399ae'
const TEXT = '#1a1f2e'
const BG_SEC = '#f0f2f7'
const BG_SURF = '#ffffff'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function novaAnotacao(): Anotacao { return { id: uid(), pessoa: '', doc: '', obs: '', responsavel: '' } }
function novaEmpresa(): Empresa { return { id: uid(), nome: '', status: 'sem', obs: '', expanded: false, anotacoes: [] } }
function novaCategoria(nome: string): Categoria { return { id: uid(), nome, collapsed: false, empresas: [] } }

function pastaStats(cats: Categoria[]) {
  let total = 0, pend = 0, ok = 0
  for (const c of cats) for (const e of c.empresas) { total++; if (e.status === 'ok') ok++; if (e.status === 'sem' || e.status === 'pendente') pend++ }
  return { total, pend, ok }
}

function rowFromApi(row: { id: string; nome: string; periodo: string; dados: unknown; created_at: string }): PastaFull {
  const cats = (Array.isArray(row.dados) ? row.dados : []) as Categoria[]
  return { id: row.id, nome: row.nome, periodo: row.periodo, categorias: cats, created_at: row.created_at }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AnotacoesCICClient() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [pastas, setPastas] = useState<PastaFull[]>([])
  const [current, setCurrent] = useState<PastaFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(false)
  const [modalNome, setModalNome] = useState('')
  const [modalPeriodo, setModalPeriodo] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/anotacoes-cic')
      .then(r => r.ok ? r.json() : [])
      .then((rows: unknown[]) => setPastas((rows as Parameters<typeof rowFromApi>[0][]).map(rowFromApi)))
      .finally(() => setLoading(false))
  }, [])

  const scheduleSave = useCallback((pasta: PastaFull) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/anotacoes-cic/${pasta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: pasta.nome, periodo: pasta.periodo, dados: pasta.categorias }),
      })
      setSaving(false)
      setPastas(prev => prev.map(p => p.id === pasta.id ? { ...pasta } : p))
    }, 800)
  }, [])

  function updateCurrent(fn: (p: PastaFull) => PastaFull) {
    setCurrent(prev => {
      if (!prev) return prev
      const next = fn(prev)
      scheduleSave(next)
      return next
    })
  }

  function openPasta(pasta: PastaFull) {
    setCurrent(pasta)
    setView('detail')
  }

  function backToList() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(false)
    setCurrent(null)
    setView('list')
  }

  async function handleCreatePasta() {
    const nome = modalNome.trim()
    if (!nome) return
    const categorias = DEFAULT_CATS.map(novaCategoria)
    const res = await fetch('/api/anotacoes-cic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, periodo: modalPeriodo.trim(), dados: categorias }),
    })
    if (!res.ok) return
    const row = await res.json()
    const pasta = rowFromApi(row)
    setPastas(prev => [pasta, ...prev])
    setModal(false)
    setModalNome('')
    setModalPeriodo('')
    openPasta(pasta)
  }

  async function handleDeletePasta(id: string) {
    if (!confirm('Excluir esta pasta e todos os registros dentro dela?')) return
    await fetch(`/api/anotacoes-cic/${id}`, { method: 'DELETE' })
    setPastas(prev => prev.filter(p => p.id !== id))
  }

  // ── category actions ────────────────────────────────────────────────────────
  function addCategoria() {
    const nome = prompt('Nome da nova categoria (ex.: Industrial, Serviços):')
    if (!nome?.trim()) return
    updateCurrent(p => ({ ...p, categorias: [...p.categorias, novaCategoria(nome.trim().toUpperCase())] }))
  }
  function deleteCategoria(catId: string) {
    if (!confirm('Excluir esta categoria e todas as empresas nela?')) return
    updateCurrent(p => ({ ...p, categorias: p.categorias.filter(c => c.id !== catId) }))
  }
  function toggleCategoria(catId: string) {
    updateCurrent(p => ({ ...p, categorias: p.categorias.map(c => c.id === catId ? { ...c, collapsed: !c.collapsed } : c) }))
  }
  function updateCategoriaNome(catId: string, nome: string) {
    updateCurrent(p => ({ ...p, categorias: p.categorias.map(c => c.id === catId ? { ...c, nome } : c) }))
  }

  // ── empresa actions ─────────────────────────────────────────────────────────
  function addEmpresa(catId: string) {
    const emp = { ...novaEmpresa(), expanded: true }
    updateCurrent(p => ({ ...p, categorias: p.categorias.map(c => c.id === catId ? { ...c, empresas: [...c.empresas, emp] } : c) }))
  }
  function deleteEmpresa(catId: string, empId: string) {
    if (!confirm('Excluir esta empresa e todas as anotações?')) return
    updateCurrent(p => ({ ...p, categorias: p.categorias.map(c => c.id === catId ? { ...c, empresas: c.empresas.filter(e => e.id !== empId) } : c) }))
  }
  function updateEmpresa(catId: string, empId: string, patch: Partial<Empresa>) {
    updateCurrent(p => ({ ...p, categorias: p.categorias.map(c => c.id === catId ? { ...c, empresas: c.empresas.map(e => e.id === empId ? { ...e, ...patch } : e) } : c) }))
  }
  function cycleStatus(catId: string, empId: string) {
    updateCurrent(p => ({
      ...p, categorias: p.categorias.map(c => c.id === catId
        ? { ...c, empresas: c.empresas.map(e => { if (e.id !== empId) return e; const i = STATUS_ORDER.indexOf(e.status); return { ...e, status: STATUS_ORDER[(i + 1) % STATUS_ORDER.length] } }) }
        : c)
    }))
  }

  // ── anotacao actions ────────────────────────────────────────────────────────
  function addAnotacao(catId: string, empId: string) {
    updateCurrent(p => ({ ...p, categorias: p.categorias.map(c => c.id === catId ? { ...c, empresas: c.empresas.map(e => e.id === empId ? { ...e, expanded: true, anotacoes: [...e.anotacoes, novaAnotacao()] } : e) } : c) }))
  }
  function deleteAnotacao(catId: string, empId: string, anotId: string) {
    updateCurrent(p => ({ ...p, categorias: p.categorias.map(c => c.id === catId ? { ...c, empresas: c.empresas.map(e => e.id === empId ? { ...e, anotacoes: e.anotacoes.filter(a => a.id !== anotId) } : e) } : c) }))
  }
  function updateAnotacao(catId: string, empId: string, anotId: string, patch: Partial<Anotacao>) {
    updateCurrent(p => ({ ...p, categorias: p.categorias.map(c => c.id === catId ? { ...c, empresas: c.empresas.map(e => e.id === empId ? { ...e, anotacoes: e.anotacoes.map(a => a.id === anotId ? { ...a, ...patch } : a) } : e) } : c) }))
  }

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 14 }}>Carregando...</div>

  if (view === 'list') return (
    <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Anotações CIC</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>Registros de exceções, concessões e pendências de contratantes, organizados por feira.</div>
        </div>
        <button
          onClick={() => setModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 16px', borderRadius: 7, background: PRIMARY, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          + Nova pasta
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
        {pastas.map(p => {
          const s = pastaStats(p.categorias)
          return (
            <div key={p.id} style={{ background: BG_SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(42,79,150,0.07)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e8f0fc', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📁</div>
                <button onClick={() => handleDeletePasta(p.id)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }} title="Excluir pasta">🗑</button>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>{p.nome || 'Sem nome'}</div>
              <div style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>📅 {p.periodo || 'Período não definido'}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 2 }}>
                <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Empresas<div style={{ fontSize: 16, fontWeight: 700, color: TEXT, textTransform: 'none' }}>{s.total}</div></div>
                <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pendências<div style={{ fontSize: 16, fontWeight: 700, color: '#b45309', textTransform: 'none' }}>{s.pend}</div></div>
                <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>OK<div style={{ fontSize: 16, fontWeight: 700, color: TEXT, textTransform: 'none' }}>{s.ok}</div></div>
              </div>
              <button onClick={() => openPasta(p)} style={{ background: 'none', border: 'none', color: PRIMARY, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
                Abrir pasta →
              </button>
            </div>
          )
        })}
        <div
          onClick={() => setModal(true)}
          style={{ border: `2px dashed ${BORDER}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: MUTED, cursor: 'pointer', minHeight: 148, transition: 'all .15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLDivElement).style.color = PRIMARY }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = BORDER; (e.currentTarget as HTMLDivElement).style.color = MUTED }}
        >
          <span style={{ fontSize: 28 }}>📂</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nova pasta</span>
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setModal(false); setModalNome(''); setModalPeriodo('') } }}>
          <div style={{ background: BG_SURF, borderRadius: 14, padding: '24px 26px', width: 380, boxShadow: '0 4px 20px rgba(42,79,150,0.15)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY, marginBottom: 16 }}>📁 Nova pasta (feira)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome da feira</label>
              <input autoFocus value={modalNome} onChange={e => setModalNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreatePasta()} placeholder="Ex.: MOVsul 2026"
                style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '0 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Período</label>
              <input value={modalPeriodo} onChange={e => setModalPeriodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreatePasta()} placeholder="Ex.: Julho/2026"
                style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '0 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setModal(false); setModalNome(''); setModalPeriodo('') }}
                style={{ height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleCreatePasta} disabled={!modalNome.trim()}
                style={{ height: 32, padding: '0 16px', borderRadius: 7, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !modalNome.trim() ? 0.6 : 1 }}>
                ✓ Criar pasta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (!current) return null
  const stats = pastaStats(current.categorias)

  return (
    <div style={{ padding: '24px 32px 60px', maxWidth: 1080, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
            <span onClick={backToList} style={{ color: PRIMARY, cursor: 'pointer', fontWeight: 600 }}>Pastas</span>
            <span style={{ margin: '0 6px', color: MUTED }}>/</span>
            <span style={{ color: TEXT, fontWeight: 600 }}>{current.nome || 'Sem nome'}</span>
          </div>
          <input
            value={current.nome}
            onChange={e => updateCurrent(p => ({ ...p, nome: e.target.value }))}
            placeholder="Nome da feira..."
            style={{ fontSize: 22, fontWeight: 700, color: PRIMARY, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', minWidth: 200, display: 'block', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Período:</span>
            <input
              value={current.periodo}
              onChange={e => updateCurrent(p => ({ ...p, periodo: e.target.value }))}
              placeholder="Ex.: Maio/2026"
              style={{ fontSize: 13, border: 'none', borderBottom: `1px solid ${BORDER}`, background: 'transparent', outline: 'none', padding: '2px 0', fontFamily: 'inherit', color: TEXT, minWidth: 140 }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 12, color: MUTED }}>Salvando...</span>}
          <button onClick={backToList}
            style={{ height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Voltar
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 26, marginBottom: 24, padding: '14px 18px', background: BG_SURF, borderRadius: 10, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(42,79,150,0.07)', flexWrap: 'wrap' }}>
        {[
          { label: 'Empresas registradas', val: stats.total, color: TEXT },
          { label: 'Pendências abertas', val: stats.pend, color: '#b45309' },
          { label: 'Regularizadas (OK)', val: stats.ok, color: '#2e7d32' },
        ].map(item => (
          <div key={item.label} style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {item.label}
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color, textTransform: 'none', marginTop: 2 }}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Categories */}
      {current.categorias.map(cat => (
        <div key={cat.id} style={{ marginBottom: 14, border: `1px solid ${BORDER}`, borderRadius: 12, background: BG_SURF, boxShadow: '0 1px 4px rgba(42,79,150,0.07)', overflow: 'hidden' }}>
          {/* Category header */}
          <div
            onClick={() => toggleCategoria(cat.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: BG_SEC, cursor: 'pointer', borderBottom: cat.collapsed ? 'none' : `1px solid ${BORDER}` }}
          >
            <span style={{ fontSize: 12, color: MUTED, transform: cat.collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s', display: 'inline-block', lineHeight: 1 }}>▼</span>
            <input
              value={cat.nome}
              onClick={e => e.stopPropagation()}
              onChange={e => updateCategoriaNome(cat.id, e.target.value)}
              style={{ flex: 1, fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit' }}
            />
            <span style={{ fontSize: 11, color: MUTED, background: BG_SURF, border: `1px solid ${BORDER}`, padding: '1px 9px', borderRadius: 20, flexShrink: 0 }}>{cat.empresas.length}</span>
            <button
              onClick={e => { e.stopPropagation(); deleteCategoria(cat.id) }}
              style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 13, flexShrink: 0 }}
              title="Excluir categoria"
            >🗑</button>
          </div>

          {!cat.collapsed && (
            <div style={{ padding: '8px 10px 10px' }}>
              {cat.empresas.length === 0 && (
                <div style={{ fontSize: 12, color: MUTED, padding: '10px 8px', fontStyle: 'italic' }}>Nenhuma empresa registrada nesta categoria.</div>
              )}

              {cat.empresas.map(emp => {
                const sc = STATUS_CFG[emp.status]
                return (
                  <div key={emp.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, margin: '6px 2px', background: BG_SURF, overflow: 'hidden' }}>
                    {/* Empresa row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => updateEmpresa(cat.id, emp.id, { expanded: !emp.expanded })}
                        style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 12, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: emp.expanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}
                      >▶</button>
                      <input
                        value={emp.nome}
                        onChange={e => updateEmpresa(cat.id, emp.id, { nome: e.target.value })}
                        placeholder="Nome do contratante..."
                        style={{ flex: '1.4', minWidth: 150, fontSize: 13.5, fontWeight: 600, color: TEXT, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit' }}
                      />
                      <button
                        onClick={() => cycleStatus(cat.id, emp.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: sc.bg, color: sc.color, flexShrink: 0, whiteSpace: 'nowrap' }}
                        title="Clique para alterar o status"
                      >
                        ● {sc.label}
                      </button>
                      <input
                        value={emp.obs}
                        onChange={e => updateEmpresa(cat.id, emp.id, { obs: e.target.value })}
                        placeholder="Observação rápida..."
                        style={{ flex: 2, minWidth: 140, fontSize: 12.5, color: MUTED, border: 'none', borderBottom: '1px dashed transparent', background: 'transparent', outline: 'none', fontFamily: 'inherit' }}
                        onFocus={e => (e.target.style.borderBottomColor = BORDER)}
                        onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
                      />
                      <button
                        onClick={() => deleteEmpresa(cat.id, emp.id)}
                        style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}
                        title="Excluir empresa"
                      >🗑</button>
                    </div>

                    {/* Empresa detail (anotações) */}
                    {emp.expanded && (
                      <div style={{ padding: '4px 14px 14px 46px', borderTop: `1px solid ${BORDER}`, background: BG_SEC }}>
                        {emp.anotacoes.length === 0 ? (
                          <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', padding: '8px 2px' }}>Nenhuma anotação registrada ainda.</div>
                        ) : (
                          <div style={{ overflowX: 'auto', marginTop: 6 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: BG_SURF, borderRadius: 6, overflow: 'hidden' }}>
                              <thead>
                                <tr>
                                  {['Nº', 'Pessoa / Situação', 'Documentação da empresa', 'Observação', 'Responsável', ''].map((h, i) => (
                                    <th key={i} style={{ border: `1px solid ${BORDER}`, padding: '6px 9px', textAlign: 'left', background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: i === 0 ? 32 : i === 5 ? 30 : undefined }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {emp.anotacoes.map((a, idx) => (
                                  <tr key={a.id}>
                                    <td style={{ border: `1px solid ${BORDER}`, padding: '5px 8px', textAlign: 'center', color: MUTED, fontSize: 11.5 }}>{idx + 1}</td>
                                    {(['pessoa', 'doc', 'obs', 'responsavel'] as const).map(field => (
                                      <td key={field} style={{ border: `1px solid ${BORDER}`, padding: '4px 8px' }}>
                                        <input
                                          value={a[field]}
                                          onChange={e => updateAnotacao(cat.id, emp.id, a.id, { [field]: e.target.value })}
                                          placeholder="—"
                                          style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', font: 'inherit', color: TEXT }}
                                          onFocus={e => (e.target.style.background = '#e8f0fc')}
                                          onBlur={e => (e.target.style.background = 'transparent')}
                                        />
                                      </td>
                                    ))}
                                    <td style={{ border: `1px solid ${BORDER}`, padding: '4px 8px', textAlign: 'center' }}>
                                      <button onClick={() => deleteAnotacao(cat.id, emp.id, a.id)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 12 }} title="Excluir anotação">✕</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <button
                          onClick={() => addAnotacao(cat.id, emp.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: PRIMARY, background: 'transparent', border: 'none', cursor: 'pointer', marginTop: 9, padding: '4px 2px', fontWeight: 600 }}
                        >
                          + Nova anotação
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                onClick={() => addEmpresa(cat.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: PRIMARY, background: 'transparent', border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '7px 12px', cursor: 'pointer', marginTop: 4, width: 'calc(100% - 8px)', justifyContent: 'center' }}
              >
                + Adicionar empresa
              </button>
            </div>
          )}
        </div>
      ))}

      <div style={{ textAlign: 'center', margin: '4px 0 30px' }}>
        <button
          onClick={addCategoria}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED, background: BG_SURF, border: `1px dashed ${BORDER}`, borderRadius: 20, padding: '8px 16px', cursor: 'pointer' }}
        >
          + Nova categoria
        </button>
      </div>
    </div>
  )
}
