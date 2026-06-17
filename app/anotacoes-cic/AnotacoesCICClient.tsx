'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Anotacao = { id: string; pessoa: string; doc: string; obs: string; responsavel: string }
type Empresa = { id: string; nome: string; status: 'sem' | 'reativada' | 'ok' | 'pendente'; obs: string; expanded: boolean; anotacoes: Anotacao[] }
type PastaFull = { id: string; nome: string; periodo: string; empresas: Empresa[]; created_at: string }

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_ORDER: Array<Empresa['status']> = ['sem', 'reativada', 'ok', 'pendente']
const STATUS_CFG: Record<Empresa['status'], { label: string; bg: string; color: string; dot: string }> = {
  sem:       { label: 'Sem cadastro', bg: '#f0f2f7', color: '#5a6178', dot: '#9399ae' },
  reativada: { label: 'Reativada',    bg: '#e8f0fc', color: '#1d3a74', dot: '#4A90D9' },
  ok:        { label: 'OK',           bg: '#e8f5e9', color: '#2e7d32', dot: '#4caf50' },
  pendente:  { label: 'Pendente',     bg: '#fef3e2', color: '#b45309', dot: '#f59e0b' },
}
const PRIMARY = '#2A4F96'
const BORDER = 'rgba(42,79,150,0.12)'
const MUTED = '#9399ae'
const TEXT = '#1a1f2e'
const BG_SEC = '#f4f6fb'
const BG_SURF = '#ffffff'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function novaAnotacao(): Anotacao { return { id: uid(), pessoa: '', doc: '', obs: '', responsavel: '' } }
function novaEmpresa(nome = ''): Empresa { return { id: uid(), nome, status: 'sem', obs: '', expanded: false, anotacoes: [] } }

function pastaStats(empresas: Empresa[]) {
  let pend = 0, ok = 0
  for (const e of empresas) {
    if (e.status === 'ok') ok++
    if (e.status === 'sem' || e.status === 'pendente') pend++
  }
  return { total: empresas.length, pend, ok }
}

function rowFromApi(row: { id: string; nome: string; periodo: string; dados: unknown; created_at: string }): PastaFull {
  const raw = row.dados
  let empresas: Empresa[] = []
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as Record<string, unknown>
    if ('empresas' in first) {
      // formato antigo: array de categorias → achata para lista plana de empresas
      empresas = (raw as { empresas?: Empresa[] }[]).flatMap(c => c.empresas ?? [])
    } else {
      empresas = raw as Empresa[]
    }
  }
  return { id: row.id, nome: row.nome, periodo: row.periodo, empresas, created_at: row.created_at }
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
  const [quickAdd, setQuickAdd] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quickRef = useRef<HTMLInputElement>(null)

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
        body: JSON.stringify({ nome: pasta.nome, periodo: pasta.periodo, dados: pasta.empresas }),
      })
      setSaving(false)
      setPastas(prev => prev.map(p => p.id === pasta.id ? { ...pasta } : p))
    }, 600)
  }, [])

  function updateCurrent(fn: (p: PastaFull) => PastaFull) {
    setCurrent(prev => {
      if (!prev) return prev
      const next = fn(prev)
      scheduleSave(next)
      return next
    })
  }

  function openPasta(pasta: PastaFull) { setCurrent(pasta); setView('detail') }
  function backToList() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(false); setCurrent(null); setView('list'); setQuickAdd('')
  }

  async function handleCreatePasta() {
    const nome = modalNome.trim()
    if (!nome) return
    const res = await fetch('/api/anotacoes-cic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, periodo: modalPeriodo.trim(), dados: [] }),
    })
    if (!res.ok) return
    const pasta = rowFromApi(await res.json())
    setPastas(prev => [pasta, ...prev])
    setModal(false); setModalNome(''); setModalPeriodo('')
    openPasta(pasta)
  }

  async function handleDeletePasta(id: string) {
    if (!confirm('Excluir esta pasta e todos os registros dentro dela?')) return
    await fetch(`/api/anotacoes-cic/${id}`, { method: 'DELETE' })
    setPastas(prev => prev.filter(p => p.id !== id))
  }

  // ── empresa actions ─────────────────────────────────────────────────────────

  function addEmpresa(nome = '') {
    const emp = { ...novaEmpresa(nome), expanded: false }
    updateCurrent(p => ({ ...p, empresas: [...p.empresas, emp] }))
    setQuickAdd('')
  }

  function deleteEmpresa(empId: string) {
    if (!confirm('Excluir esta empresa e todas as anotações?')) return
    updateCurrent(p => ({ ...p, empresas: p.empresas.filter(e => e.id !== empId) }))
  }

  function updateEmpresa(empId: string, patch: Partial<Empresa>) {
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id === empId ? { ...e, ...patch } : e) }))
  }

  function cycleStatus(empId: string) {
    updateCurrent(p => ({
      ...p,
      empresas: p.empresas.map(e => {
        if (e.id !== empId) return e
        return { ...e, status: STATUS_ORDER[(STATUS_ORDER.indexOf(e.status) + 1) % STATUS_ORDER.length] }
      }),
    }))
  }

  // ── anotacao actions ────────────────────────────────────────────────────────

  function addAnotacao(empId: string) {
    updateCurrent(p => ({
      ...p,
      empresas: p.empresas.map(e => e.id === empId
        ? { ...e, expanded: true, anotacoes: [...e.anotacoes, novaAnotacao()] }
        : e),
    }))
  }

  function deleteAnotacao(empId: string, anotId: string) {
    updateCurrent(p => ({
      ...p,
      empresas: p.empresas.map(e => e.id === empId
        ? { ...e, anotacoes: e.anotacoes.filter(a => a.id !== anotId) }
        : e),
    }))
  }

  function updateAnotacao(empId: string, anotId: string, patch: Partial<Anotacao>) {
    updateCurrent(p => ({
      ...p,
      empresas: p.empresas.map(e => e.id === empId
        ? { ...e, anotacoes: e.anotacoes.map(a => a.id === anotId ? { ...a, ...patch } : a) }
        : e),
    }))
  }

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 14 }}>Carregando...</div>

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Anotações CIC</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>Registros de exceções, concessões e pendências por feira.</div>
        </div>
        <button onClick={() => setModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 16px', borderRadius: 7, background: PRIMARY, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          + Nova pasta
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {pastas.map(p => {
          const s = pastaStats(p.empresas)
          return (
            <div key={p.id} style={{ background: BG_SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(42,79,150,0.07)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: '#e8f0fc', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📁</div>
                <button onClick={() => handleDeletePasta(p.id)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 4, fontSize: 14, borderRadius: 6 }} title="Excluir">🗑</button>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>{p.nome || 'Sem nome'}</div>
              {p.periodo && <div style={{ fontSize: 12, color: MUTED }}>📅 {p.periodo}</div>}
              <div style={{ display: 'flex', gap: 14 }}>
                {[
                  { label: 'Empresas', val: s.total, color: TEXT },
                  { label: 'Pendências', val: s.pend, color: '#b45309' },
                  { label: 'OK', val: s.ok, color: '#2e7d32' },
                ].map(x => (
                  <div key={x.label} style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {x.label}
                    <div style={{ fontSize: 17, fontWeight: 700, color: x.color, textTransform: 'none' }}>{x.val}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => openPasta(p)}
                style={{ background: 'none', border: 'none', color: PRIMARY, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, alignSelf: 'flex-start' }}>
                Abrir →
              </button>
            </div>
          )
        })}
        <div onClick={() => setModal(true)}
          style={{ border: `2px dashed ${BORDER}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: MUTED, cursor: 'pointer', minHeight: 140 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLElement).style.color = PRIMARY }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = MUTED }}>
          <span style={{ fontSize: 26 }}>📂</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Nova pasta</span>
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setModal(false); setModalNome(''); setModalPeriodo('') } }}>
          <div style={{ background: BG_SURF, borderRadius: 14, padding: '24px 26px', width: 360, boxShadow: '0 8px 30px rgba(42,79,150,0.15)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY, marginBottom: 16 }}>📁 Nova pasta</div>
            {[
              { label: 'Nome da feira', value: modalNome, setter: setModalNome, placeholder: 'Ex.: Expobento 2027', auto: true },
              { label: 'Período', value: modalPeriodo, setter: setModalPeriodo, placeholder: 'Ex.: Agosto/2027', auto: false },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                <input autoFocus={f.auto} value={f.value} onChange={e => f.setter(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreatePasta()} placeholder={f.placeholder}
                  style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '0 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setModal(false); setModalNome(''); setModalPeriodo('') }}
                style={{ height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleCreatePasta} disabled={!modalNome.trim()}
                style={{ height: 32, padding: '0 16px', borderRadius: 7, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: modalNome.trim() ? 1 : 0.6 }}>
                ✓ Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (!current) return null

  const stats = pastaStats(current.empresas)

  return (
    <div style={{ padding: '24px 28px 60px', maxWidth: 980, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
            <span onClick={backToList} style={{ color: PRIMARY, cursor: 'pointer', fontWeight: 600 }}>Pastas</span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: TEXT, fontWeight: 600 }}>{current.nome || 'Sem nome'}</span>
          </div>
          <input value={current.nome} onChange={e => updateCurrent(p => ({ ...p, nome: e.target.value }))}
            placeholder="Nome da feira..."
            style={{ fontSize: 22, fontWeight: 700, color: PRIMARY, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', display: 'block', marginBottom: 6, width: '100%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período:</span>
            <input value={current.periodo} onChange={e => updateCurrent(p => ({ ...p, periodo: e.target.value }))}
              placeholder="Ex.: Maio/2026"
              style={{ fontSize: 13, border: 'none', borderBottom: `1px solid ${BORDER}`, background: 'transparent', outline: 'none', padding: '2px 0', fontFamily: 'inherit', color: TEXT, minWidth: 130 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {saving && <span style={{ fontSize: 12, color: MUTED }}>Salvando...</span>}
          <button onClick={backToList}
            style={{ height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ← Voltar
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, padding: '12px 16px', background: BG_SURF, borderRadius: 10, border: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
        {[
          { label: 'Total de empresas', val: stats.total, color: TEXT },
          { label: 'Pendências', val: stats.pend, color: '#b45309' },
          { label: 'Regularizadas', val: stats.ok, color: '#2e7d32' },
        ].map(x => (
          <div key={x.label} style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {x.label}
            <div style={{ fontSize: 20, fontWeight: 700, color: x.color, textTransform: 'none', marginTop: 1 }}>{x.val}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CFG[s]
            const count = current.empresas.filter(e => e.status === s).length
            return (
              <div key={s} style={{ fontSize: 10.5, color: cfg.color, background: cfg.bg, padding: '3px 9px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {count} {cfg.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Companies list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {current.empresas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 13, fontStyle: 'italic' }}>
            Nenhuma empresa registrada. Adicione a primeira abaixo.
          </div>
        )}

        {current.empresas.map((emp, idx) => {
          const sc = STATUS_CFG[emp.status] ?? STATUS_CFG.sem
          return (
            <div key={emp.id} style={{ background: BG_SURF, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', flexWrap: 'wrap' }}>
                {/* Index */}
                <span style={{ fontSize: 11, color: MUTED, minWidth: 20, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>

                {/* Expand toggle */}
                <button onClick={() => updateEmpresa(emp.id, { expanded: !emp.expanded })}
                  style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 11, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transform: emp.expanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                  ▶
                </button>

                {/* Nome */}
                <input value={emp.nome} onChange={e => updateEmpresa(emp.id, { nome: e.target.value })}
                  placeholder="Nome da empresa..."
                  style={{ flex: '2', minWidth: 180, fontSize: 13.5, fontWeight: 600, color: TEXT, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit' }} />

                {/* Status */}
                <button onClick={() => cycleStatus(emp.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: sc.bg, color: sc.color, flexShrink: 0, whiteSpace: 'nowrap' }}
                  title="Clique para alterar o status">
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                  {sc.label}
                </button>

                {/* Observação rápida */}
                <input value={emp.obs} onChange={e => updateEmpresa(emp.id, { obs: e.target.value })}
                  placeholder="Observação..."
                  style={{ flex: '3', minWidth: 140, fontSize: 12.5, color: MUTED, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit' }} />

                {/* Anotações count */}
                {emp.anotacoes.length > 0 && (
                  <span style={{ fontSize: 11, color: PRIMARY, background: '#e8f0fc', borderRadius: 20, padding: '2px 8px', flexShrink: 0, fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => updateEmpresa(emp.id, { expanded: !emp.expanded })}>
                    {emp.anotacoes.length} anot.
                  </span>
                )}

                {/* Delete */}
                <button onClick={() => deleteEmpresa(emp.id)}
                  style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0, fontSize: 13 }}
                  title="Excluir empresa">🗑</button>
              </div>

              {/* Expanded: anotações */}
              {emp.expanded && (
                <div style={{ padding: '8px 14px 14px 54px', borderTop: `1px solid ${BORDER}`, background: BG_SEC }}>
                  {emp.anotacoes.length > 0 && (
                    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: BG_SURF, borderRadius: 6, overflow: 'hidden' }}>
                        <thead>
                          <tr>
                            {['', 'Pessoa / Situação', 'Documentação', 'Observação', 'Responsável', ''].map((h, i) => (
                              <th key={i} style={{ border: `1px solid ${BORDER}`, padding: '6px 9px', textAlign: 'left', background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', width: i === 0 || i === 5 ? 28 : undefined }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {emp.anotacoes.map((a, i) => (
                            <tr key={a.id} style={{ background: i % 2 === 1 ? BG_SEC : BG_SURF }}>
                              <td style={{ border: `1px solid ${BORDER}`, padding: '5px 8px', textAlign: 'center', color: MUTED, fontSize: 11 }}>{i + 1}</td>
                              {(['pessoa', 'doc', 'obs', 'responsavel'] as const).map(field => (
                                <td key={field} style={{ border: `1px solid ${BORDER}`, padding: '4px 6px' }}>
                                  <input value={a[field]} onChange={e => updateAnotacao(emp.id, a.id, { [field]: e.target.value })}
                                    placeholder="—"
                                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', font: 'inherit', color: TEXT }}
                                    onFocus={e => (e.target.style.background = '#e8f0fc')}
                                    onBlur={e => (e.target.style.background = 'transparent')} />
                                </td>
                              ))}
                              <td style={{ border: `1px solid ${BORDER}`, padding: '4px', textAlign: 'center' }}>
                                <button onClick={() => deleteAnotacao(emp.id, a.id)}
                                  style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, fontSize: 12 }}
                                  title="Excluir">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {emp.anotacoes.length === 0 && (
                    <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', marginBottom: 8 }}>Nenhuma anotação ainda.</div>
                  )}
                  <button onClick={() => addAnotacao(emp.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: PRIMARY, background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 0', fontWeight: 600 }}>
                    + Nova anotação
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick-add row */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          ref={quickRef}
          value={quickAdd}
          onChange={e => setQuickAdd(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && quickAdd.trim()) addEmpresa(quickAdd.trim()) }}
          placeholder="Digite o nome da empresa e pressione Enter para adicionar..."
          style={{
            flex: 1, height: 40, border: `1.5px dashed ${BORDER}`, borderRadius: 9, padding: '0 14px',
            fontSize: 13, color: TEXT, background: BG_SURF, outline: 'none', fontFamily: 'inherit',
            transition: 'border-color .15s',
          }}
          onFocus={e => (e.target.style.borderColor = PRIMARY)}
          onBlur={e => (e.target.style.borderColor = BORDER)}
        />
        <button
          onClick={() => { if (quickAdd.trim()) addEmpresa(quickAdd.trim()); else { setQuickAdd(''); quickRef.current?.focus() } }}
          style={{ height: 40, padding: '0 18px', borderRadius: 9, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          + Empresa
        </button>
      </div>
    </div>
  )
}
