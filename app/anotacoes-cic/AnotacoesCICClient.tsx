'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Concessao = {
  id: string
  tipo: 'empresa' | 'pessoa'
  documento: string
  pessoa: string
  concedido_por: string
  obs: string
}

type Empresa = {
  id: string
  nome: string
  status: 'sem' | 'reativada' | 'ok' | 'pendente'
  obs: string
  expanded: boolean
  concessoes: Concessao[]
}

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
function novaConcessao(): Concessao { return { id: uid(), tipo: 'empresa', documento: '', pessoa: '', concedido_por: '', obs: '' } }
function novaEmpresa(nome = ''): Empresa { return { id: uid(), nome, status: 'sem', obs: '', expanded: false, concessoes: [] } }

function pastaStats(empresas: Empresa[]) {
  let pend = 0, ok = 0, totalConcessoes = 0
  for (const e of empresas) {
    if (e.status === 'ok') ok++
    if (e.status === 'sem' || e.status === 'pendente') pend++
    totalConcessoes += (e.concessoes ?? []).length
  }
  return { total: empresas.length, pend, ok, totalConcessoes }
}

function migrateEmpresa(raw: Record<string, unknown>): Empresa {
  if ('anotacoes' in raw && !('concessoes' in raw)) {
    const anots = (raw.anotacoes as { id?: string; pessoa?: string; doc?: string; obs?: string; responsavel?: string }[]) ?? []
    return {
      id: String(raw.id ?? uid()),
      nome: String(raw.nome ?? ''),
      status: STATUS_ORDER.includes(raw.status as Empresa['status']) ? raw.status as Empresa['status'] : 'sem',
      obs: String(raw.obs ?? ''),
      expanded: false,
      concessoes: anots.map(a => ({
        id: a.id ?? uid(), tipo: 'empresa' as const,
        documento: a.doc ?? '', pessoa: a.pessoa ?? '',
        concedido_por: a.responsavel ?? '', obs: a.obs ?? '',
      })),
    }
  }
  const emp = raw as Empresa
  return {
    ...emp,
    status: STATUS_ORDER.includes(emp.status) ? emp.status : 'sem',
    concessoes: Array.isArray(emp.concessoes) ? emp.concessoes : [],
  }
}

function rowFromApi(row: { id: string; nome: string; periodo: string; dados: unknown; created_at: string }): PastaFull {
  const raw = row.dados
  let empresas: Empresa[] = []
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as Record<string, unknown>
    if ('empresas' in first) {
      empresas = (raw as { empresas?: Record<string, unknown>[] }[])
        .flatMap(c => (c.empresas ?? []).map(migrateEmpresa))
    } else {
      empresas = (raw as Record<string, unknown>[]).map(migrateEmpresa)
    }
  }
  return { id: row.id, nome: row.nome, periodo: row.periodo, empresas, created_at: row.created_at }
}

// ─── Report / Export ─────────────────────────────────────────────────────────

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildReportHtml(pasta: PastaFull, wordMode = false): string {
  const date = new Date().toLocaleDateString('pt-BR')
  const sorted = [...pasta.empresas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const withC = sorted.filter(e => (e.concessoes ?? []).length > 0)

  const sections = withC.map(emp => {
    const sc = STATUS_CFG[emp.status] ?? STATUS_CFG.sem
    const rows = (emp.concessoes ?? []).map((c, i) => `
      <tr>
        <td style="text-align:center;color:#888;width:28px">${i + 1}</td>
        <td style="white-space:nowrap;font-weight:600;color:${c.tipo === 'empresa' ? '#1d3a74' : '#6b21a8'}">${c.tipo === 'empresa' ? 'Docs Empresa' : 'Docs Pessoa'}</td>
        <td>${esc(c.documento)}</td>
        <td>${esc(c.pessoa)}</td>
        <td style="font-weight:600">${esc(c.concedido_por)}</td>
        <td style="color:#555">${esc(c.obs)}</td>
      </tr>`).join('')
    return `
      <div class="emp-section">
        <h3>${esc(emp.nome)}</h3>
        <p class="emp-meta">Situação: <b>${sc.label}</b>${emp.obs ? ` &nbsp;·&nbsp; ${esc(emp.obs)}` : ''} &nbsp;·&nbsp; <b>${emp.concessoes.length}</b> concessão(ões)</p>
        <table>
          <thead><tr>
            <th>Nº</th><th>Tipo</th><th>Documento / Concessão</th>
            <th>Pessoa / Situação</th><th>Autorizado por</th><th>Observações</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  const ns = wordMode ? " xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'" : ''
  return `<html${ns}><head><meta charset='utf-8'><title>Relatório de Concessões</title>
<style>
  body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1f2e;margin:24px 32px}
  h1{font-size:17pt;color:#2A4F96;margin:0 0 4px}
  .sub{font-size:10.5pt;color:#555;margin:0 0 24px;line-height:1.7}
  h3{font-size:12pt;color:#2A4F96;margin:22px 0 2px;border-bottom:2px solid #2A4F96;padding-bottom:3px}
  .emp-meta{font-size:9.5pt;color:#666;margin:2px 0 8px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:9.5pt}
  th{background:#2A4F96;color:#fff;padding:5px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em}
  td{border:1px solid #ddd;padding:4px 8px}
  tr:nth-child(even) td{background:#f5f7fa}
  .emp-section{page-break-inside:avoid}
  @media print{body{margin:10px}}
</style></head>
<body>
  <h1>Relatório de Concessões</h1>
  <p class="sub">
    <b>${esc(pasta.nome)}</b>${pasta.periodo ? ` — ${esc(pasta.periodo)}` : ''}<br>
    Emissão: ${date} &nbsp;·&nbsp; ${withC.length} empresa(s) com concessões registradas
  </p>
  ${sections || '<p style="color:#888;font-style:italic">Nenhuma concessão registrada.</p>'}
</body></html>`
}

function buildExcelHtml(pasta: PastaFull): string {
  const sorted = [...pasta.empresas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const rows = sorted.flatMap(emp => {
    const sc = STATUS_CFG[emp.status] ?? STATUS_CFG.sem
    if (!(emp.concessoes ?? []).length) return []
    return emp.concessoes.map(c => `<tr>
      <td>${esc(emp.nome)}</td><td>${sc.label}</td><td>${esc(emp.obs)}</td>
      <td>${c.tipo === 'empresa' ? 'Docs Empresa' : 'Docs Pessoa'}</td>
      <td>${esc(c.documento)}</td><td>${esc(c.pessoa)}</td>
      <td>${esc(c.concedido_por)}</td><td>${esc(c.obs)}</td>
    </tr>`)
  }).join('')
  return `<html><head><meta charset='utf-8'></head><body>
    <table><thead><tr>
      <th>Empresa</th><th>Situação</th><th>Obs. Empresa</th>
      <th>Tipo</th><th>Documento / Concessão</th><th>Pessoa / Situação</th>
      <th>Autorizado por</th><th>Observações</th>
    </tr></thead><tbody>${rows}</tbody></table>
  </body></html>`
}

function dlBlob(content: string, filename: string, type: string) {
  const blob = new Blob(['﻿' + content], { type: type + ';charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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

  function openPasta(p: PastaFull) { setCurrent(p); setView('detail') }
  function backToList() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(false); setCurrent(null); setView('list'); setQuickAdd('')
  }

  async function handleCreatePasta() {
    const nome = modalNome.trim(); if (!nome) return
    const res = await fetch('/api/anotacoes-cic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, periodo: modalPeriodo.trim(), dados: [] }) })
    if (!res.ok) return
    const pasta = rowFromApi(await res.json())
    setPastas(prev => [pasta, ...prev]); setModal(false); setModalNome(''); setModalPeriodo('')
    openPasta(pasta)
  }

  async function handleDeletePasta(id: string) {
    if (!confirm('Excluir esta pasta?')) return
    await fetch(`/api/anotacoes-cic/${id}`, { method: 'DELETE' })
    setPastas(prev => prev.filter(p => p.id !== id))
  }

  function addEmpresa(nome = '') {
    updateCurrent(p => ({ ...p, empresas: [...p.empresas, { ...novaEmpresa(nome), expanded: !!nome }] }))
    setQuickAdd('')
  }
  function deleteEmpresa(id: string) {
    if (!confirm('Excluir esta empresa?')) return
    updateCurrent(p => ({ ...p, empresas: p.empresas.filter(e => e.id !== id) }))
  }
  function updateEmpresa(id: string, patch: Partial<Empresa>) {
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id === id ? { ...e, ...patch } : e) }))
  }
  function cycleStatus(id: string) {
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id !== id ? e : { ...e, status: STATUS_ORDER[(STATUS_ORDER.indexOf(e.status) + 1) % STATUS_ORDER.length] }) }))
  }

  function addConcessao(empId: string) {
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id === empId ? { ...e, expanded: true, concessoes: [...e.concessoes, novaConcessao()] } : e) }))
  }
  function deleteConcessao(empId: string, cId: string) {
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id === empId ? { ...e, concessoes: e.concessoes.filter(c => c.id !== cId) } : e) }))
  }
  function updateConcessao(empId: string, cId: string, patch: Partial<Concessao>) {
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id === empId ? { ...e, concessoes: e.concessoes.map(c => c.id === cId ? { ...c, ...patch } : c) } : e) }))
  }

  function exportPDF() {
    if (!current) return
    const win = window.open('', '_blank', 'width=950,height=750')
    if (!win) return
    win.document.write(buildReportHtml(current))
    win.document.close(); win.focus()
    setTimeout(() => win.print(), 400)
  }
  function exportWord() { if (current) dlBlob(buildReportHtml(current, true), `${current.nome} — Concessões.doc`, 'application/msword') }
  function exportExcel() { if (current) dlBlob(buildExcelHtml(current), `${current.nome} — Concessões.xls`, 'application/vnd.ms-excel') }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Carregando...</div>

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Anotações CIC</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>Registro de concessões e autorizações por feira, para apresentação ao cliente.</div>
        </div>
        <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 16px', borderRadius: 7, background: PRIMARY, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
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
                <button onClick={() => handleDeletePasta(p.id)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 4, fontSize: 14, borderRadius: 6 }}>🗑</button>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{p.nome || 'Sem nome'}</div>
              {p.periodo && <div style={{ fontSize: 12, color: MUTED }}>📅 {p.periodo}</div>}
              <div style={{ display: 'flex', gap: 14 }}>
                {[{ l: 'Empresas', v: s.total, c: TEXT }, { l: 'Concessões', v: s.totalConcessoes, c: PRIMARY }, { l: 'Pendências', v: s.pend, c: '#b45309' }].map(x => (
                  <div key={x.l} style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {x.l}<div style={{ fontSize: 17, fontWeight: 700, color: x.c, textTransform: 'none' }}>{x.v}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => openPasta(p)} style={{ background: 'none', border: 'none', color: PRIMARY, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, alignSelf: 'flex-start' }}>
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
            {[{ label: 'Nome da feira', value: modalNome, setter: setModalNome, ph: 'Ex.: Expobento 2027' }, { label: 'Período', value: modalPeriodo, setter: setModalPeriodo, ph: 'Ex.: Agosto/2027' }].map((f, i) => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                <input autoFocus={i === 0} value={f.value} onChange={e => f.setter(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreatePasta()} placeholder={f.ph}
                  style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '0 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setModal(false); setModalNome(''); setModalPeriodo('') }} style={{ height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCreatePasta} disabled={!modalNome.trim()} style={{ height: 32, padding: '0 16px', borderRadius: 7, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: modalNome.trim() ? 1 : 0.6 }}>✓ Criar</button>
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
    <div style={{ padding: '24px 28px 60px', maxWidth: 1020, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
            <span onClick={backToList} style={{ color: PRIMARY, cursor: 'pointer', fontWeight: 600 }}>Pastas</span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: TEXT, fontWeight: 600 }}>{current.nome || 'Sem nome'}</span>
          </div>
          <input value={current.nome} onChange={e => updateCurrent(p => ({ ...p, nome: e.target.value }))} placeholder="Nome da feira..."
            style={{ fontSize: 22, fontWeight: 700, color: PRIMARY, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', display: 'block', marginBottom: 6, width: '100%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período:</span>
            <input value={current.periodo} onChange={e => updateCurrent(p => ({ ...p, periodo: e.target.value }))} placeholder="Ex.: Maio/2026"
              style={{ fontSize: 13, border: 'none', borderBottom: `1px solid ${BORDER}`, background: 'transparent', outline: 'none', padding: '2px 0', fontFamily: 'inherit', color: TEXT, minWidth: 130 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {saving && <span style={{ fontSize: 12, color: MUTED }}>Salvando...</span>}
          <button onClick={exportPDF} title="Abrir relatório para imprimir / salvar como PDF"
            style={{ height: 32, padding: '0 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: '#b45309', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📄 PDF
          </button>
          <button onClick={exportExcel} title="Baixar planilha Excel"
            style={{ height: 32, padding: '0 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: '#2e7d32', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📊 Excel
          </button>
          <button onClick={exportWord} title="Baixar documento Word"
            style={{ height: 32, padding: '0 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: '#1d3a74', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📝 Word
          </button>
          <button onClick={backToList}
            style={{ height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ← Voltar
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, padding: '12px 16px', background: BG_SURF, borderRadius: 10, border: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
        {[
          { label: 'Empresas', val: stats.total, color: TEXT },
          { label: 'Concessões', val: stats.totalConcessoes, color: PRIMARY },
          { label: 'Pendências', val: stats.pend, color: '#b45309' },
          { label: 'OK', val: stats.ok, color: '#2e7d32' },
        ].map(x => (
          <div key={x.label} style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {x.label}<div style={{ fontSize: 20, fontWeight: 700, color: x.color, textTransform: 'none', marginTop: 1 }}>{x.val}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CFG[s]
            const count = current.empresas.filter(e => e.status === s).length
            if (!count) return null
            return <div key={s} style={{ fontSize: 10.5, color: cfg.color, background: cfg.bg, padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>{count} {cfg.label}</div>
          })}
        </div>
      </div>

      {/* Companies */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {current.empresas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 13, fontStyle: 'italic' }}>
            Nenhuma empresa registrada. Adicione a primeira abaixo.
          </div>
        )}

        {current.empresas.map((emp, idx) => {
          const sc = STATUS_CFG[emp.status] ?? STATUS_CFG.sem
          const concessoes = emp.concessoes ?? []
          return (
            <div key={emp.id} style={{ background: BG_SURF, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Empresa row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: MUTED, minWidth: 20, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>
                <button onClick={() => updateEmpresa(emp.id, { expanded: !emp.expanded })}
                  style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 11, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transform: emp.expanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                  ▶
                </button>
                <input value={emp.nome} onChange={e => updateEmpresa(emp.id, { nome: e.target.value })} placeholder="Nome da empresa..."
                  style={{ flex: '2', minWidth: 180, fontSize: 13.5, fontWeight: 600, color: TEXT, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={() => cycleStatus(emp.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: sc.bg, color: sc.color, flexShrink: 0, whiteSpace: 'nowrap' }}
                  title="Clique para alterar o status">
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                  {sc.label}
                </button>
                <input value={emp.obs} onChange={e => updateEmpresa(emp.id, { obs: e.target.value })} placeholder="Observação..."
                  style={{ flex: '3', minWidth: 130, fontSize: 12.5, color: MUTED, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit' }} />
                {concessoes.length > 0 && (
                  <span onClick={() => updateEmpresa(emp.id, { expanded: !emp.expanded })}
                    style={{ fontSize: 11, color: PRIMARY, background: '#e8f0fc', borderRadius: 20, padding: '2px 8px', flexShrink: 0, fontWeight: 600, cursor: 'pointer' }}>
                    {concessoes.length} conc.
                  </span>
                )}
                <button onClick={() => deleteEmpresa(emp.id)}
                  style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0, fontSize: 13 }}>🗑</button>
              </div>

              {/* Expanded: concessões */}
              {emp.expanded && (
                <div style={{ padding: '10px 14px 14px 54px', borderTop: `1px solid ${BORDER}`, background: BG_SEC }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Concessões</div>

                  {concessoes.length > 0 && (
                    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: BG_SURF, borderRadius: 6, overflow: 'hidden' }}>
                        <thead>
                          <tr>
                            {['', 'Tipo', 'Documento / Concessão', 'Pessoa / Situação', 'Autorizado por', 'Observações', ''].map((h, i) => (
                              <th key={i} style={{ border: `1px solid ${BORDER}`, padding: '6px 9px', textAlign: 'left', background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', width: i === 0 || i === 6 ? 28 : undefined }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {concessoes.map((c, i) => (
                            <tr key={c.id} style={{ background: i % 2 === 1 ? BG_SEC : BG_SURF }}>
                              <td style={{ border: `1px solid ${BORDER}`, padding: '5px 8px', textAlign: 'center', color: MUTED, fontSize: 11 }}>{i + 1}</td>

                              {/* Tipo toggle */}
                              <td style={{ border: `1px solid ${BORDER}`, padding: '4px 8px', whiteSpace: 'nowrap' }}>
                                <button onClick={() => updateConcessao(emp.id, c.id, { tipo: c.tipo === 'empresa' ? 'pessoa' : 'empresa' })}
                                  style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, border: 'none', cursor: 'pointer', background: c.tipo === 'empresa' ? '#e8f0fc' : '#f3e8ff', color: c.tipo === 'empresa' ? '#1d3a74' : '#6b21a8', whiteSpace: 'nowrap' }}
                                  title="Clique para alternar">
                                  {c.tipo === 'empresa' ? 'Docs Empresa' : 'Docs Pessoa'}
                                </button>
                              </td>

                              {(['documento', 'pessoa', 'concedido_por', 'obs'] as const).map(field => (
                                <td key={field} style={{ border: `1px solid ${BORDER}`, padding: '4px 6px' }}>
                                  <input value={c[field]} onChange={e => updateConcessao(emp.id, c.id, { [field]: e.target.value })}
                                    placeholder={field === 'concedido_por' ? 'Ex.: Renato' : '—'}
                                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', font: 'inherit', color: TEXT, minWidth: field === 'obs' ? 80 : 100 }}
                                    onFocus={e => (e.target.style.background = '#e8f0fc')}
                                    onBlur={e => (e.target.style.background = 'transparent')} />
                                </td>
                              ))}

                              <td style={{ border: `1px solid ${BORDER}`, padding: '4px', textAlign: 'center' }}>
                                <button onClick={() => deleteConcessao(emp.id, c.id)}
                                  style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, fontSize: 12 }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {concessoes.length === 0 && (
                    <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', marginBottom: 8 }}>Nenhuma concessão registrada ainda.</div>
                  )}

                  <button onClick={() => addConcessao(emp.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: PRIMARY, background: 'transparent', border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
                    + Nova concessão
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick-add */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input ref={quickRef} value={quickAdd} onChange={e => setQuickAdd(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && quickAdd.trim()) addEmpresa(quickAdd.trim()) }}
          placeholder="Digite o nome da empresa e pressione Enter para adicionar..."
          style={{ flex: 1, height: 40, border: `1.5px dashed ${BORDER}`, borderRadius: 9, padding: '0 14px', fontSize: 13, color: TEXT, background: BG_SURF, outline: 'none', fontFamily: 'inherit' }}
          onFocus={e => (e.target.style.borderColor = PRIMARY)}
          onBlur={e => (e.target.style.borderColor = BORDER)} />
        <button onClick={() => { if (quickAdd.trim()) addEmpresa(quickAdd.trim()); else quickRef.current?.focus() }}
          style={{ height: 40, padding: '0 18px', borderRadius: 9, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          + Empresa
        </button>
      </div>
    </div>
  )
}
