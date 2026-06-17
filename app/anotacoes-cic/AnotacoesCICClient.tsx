'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Concessao = {
  id: string
  tipo: 'empresa' | 'pessoa'
  documento: string
  pessoa: string
  situacao: string
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
function novaConcessao(): Concessao { return { id: uid(), tipo: 'empresa', documento: '', pessoa: '', situacao: '', concedido_por: '', obs: '' } }
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
      concessoes: anots.map(a => ({ id: a.id ?? uid(), tipo: 'empresa' as const, documento: a.doc ?? '', pessoa: a.pessoa ?? '', situacao: '', concedido_por: a.responsavel ?? '', obs: a.obs ?? '' })),
    }
  }
  const emp = raw as Empresa
  return { ...emp, status: STATUS_ORDER.includes(emp.status) ? emp.status : 'sem', concessoes: Array.isArray(emp.concessoes) ? emp.concessoes : [] }
}

function rowFromApi(row: { id: string; nome: string; periodo: string; dados: unknown; created_at: string }): PastaFull {
  const raw = row.dados
  let empresas: Empresa[] = []
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as Record<string, unknown>
    if ('empresas' in first) {
      empresas = (raw as { empresas?: Record<string, unknown>[] }[]).flatMap(c => (c.empresas ?? []).map(migrateEmpresa))
    } else {
      empresas = (raw as Record<string, unknown>[]).map(migrateEmpresa)
    }
  }
  return { id: row.id, nome: row.nome, periodo: row.periodo, empresas, created_at: row.created_at }
}

function cloneEmpresa(emp: Empresa): Empresa {
  return { ...emp, id: uid(), expanded: false, concessoes: emp.concessoes.map(c => ({ ...c, id: uid() })) }
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
        <td style="word-break:break-word">${esc(c.documento)}</td>
        <td style="word-break:break-word">${c.tipo === 'pessoa' ? esc(c.pessoa) : '—'}</td>
        <td style="word-break:break-word">${c.tipo === 'pessoa' ? esc((c as {situacao?: string}).situacao ?? '') : '—'}</td>
        <td style="font-weight:600">${esc(c.concedido_por)}</td>
        <td style="color:#555;word-break:break-word">${esc(c.obs)}</td>
      </tr>`).join('')
    return `<div class="emp-section">
      <h3>${esc(emp.nome)}</h3>
      <p class="emp-meta">Situação: <b>${sc.label}</b>${emp.obs ? ` &nbsp;·&nbsp; ${esc(emp.obs)}` : ''} &nbsp;·&nbsp; <b>${emp.concessoes.length}</b> concessão(ões)</p>
      <table>
        <thead><tr><th>Nº</th><th>Tipo</th><th>Documento / Concessão</th><th>Pessoa</th><th>Situação</th><th>Autorizado por</th><th>Observações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`
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
  <p class="sub"><b>${esc(pasta.nome)}</b>${pasta.periodo ? ` — ${esc(pasta.periodo)}` : ''}<br>
  Emissão: ${date} &nbsp;·&nbsp; ${withC.length} empresa(s) com concessões</p>
  ${sections || '<p style="color:#888;font-style:italic">Nenhuma concessão registrada.</p>'}
</body></html>`
}

function buildExcelHtml(pasta: PastaFull): string {
  const sorted = [...pasta.empresas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const rows = sorted.flatMap(emp => {
    const sc = STATUS_CFG[emp.status] ?? STATUS_CFG.sem
    return (emp.concessoes ?? []).map(c => `<tr>
      <td>${esc(emp.nome)}</td><td>${sc.label}</td><td>${esc(emp.obs)}</td>
      <td>${c.tipo === 'empresa' ? 'Docs Empresa' : 'Docs Pessoa'}</td>
      <td>${esc(c.documento)}</td>
      <td>${c.tipo === 'pessoa' ? esc(c.pessoa) : ''}</td>
      <td>${c.tipo === 'pessoa' ? esc((c as {situacao?: string}).situacao ?? '') : ''}</td>
      <td>${esc(c.concedido_por)}</td><td>${esc(c.obs)}</td>
    </tr>`)
  }).join('')
  return `<html><head><meta charset='utf-8'></head><body><table>
    <thead><tr><th>Empresa</th><th>Situação</th><th>Obs. Empresa</th><th>Tipo</th><th>Documento / Concessão</th><th>Pessoa</th><th>Situação Pessoa</th><th>Autorizado por</th><th>Observações</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></body></html>`
}

function dlBlob(content: string, filename: string, type: string) {
  const blob = new Blob(['﻿' + content], { type: type + ';charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── AutoArea ────────────────────────────────────────────────────────────────

function AutoArea({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties
}) {
  function resize(el: HTMLTextAreaElement | null) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  return (
    <textarea rows={1} value={value ?? ''} placeholder={placeholder}
      onChange={e => { onChange(e.target.value); resize(e.target) }}
      ref={el => { if (el) { setTimeout(() => resize(el), 0) } }}
      style={{ resize: 'none', overflow: 'hidden', width: '100%', border: 'none', background: 'transparent', outline: 'none', font: 'inherit', lineHeight: '1.45', padding: 0, ...style }} />
  )
}

function FieldBox({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ padding: '5px 8px', background: BG_SURF, border: `1px solid ${BORDER}`, borderRadius: 6, minHeight: 28 }}>
        {children}
      </div>
    </div>
  )
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

function useAutocomplete(allNomes: string[], query: string) {
  if (!query.trim() || query.length < 2) return []
  const q = query.toLowerCase()
  return allNomes.filter(n => n.toLowerCase().includes(q)).slice(0, 8)
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({ pastas, currentId, onImport, onClose }: {
  pastas: PastaFull[]
  currentId: string
  onImport: (empresas: Empresa[]) => void
  onClose: () => void
}) {
  const outras = pastas.filter(p => p.id !== currentId)
  const [selectedPastaId, setSelectedPastaId] = useState(outras[0]?.id ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importarConcessoes, setImportarConcessoes] = useState(true)
  const selectedPasta = outras.find(p => p.id === selectedPastaId)

  function toggleAll() {
    if (!selectedPasta) return
    setSelectedIds(selectedIds.size === selectedPasta.empresas.length ? new Set() : new Set(selectedPasta.empresas.map(e => e.id)))
  }

  function doImport() {
    if (!selectedPasta || selectedIds.size === 0) return
    onImport(
      selectedPasta.empresas
        .filter(e => selectedIds.has(e.id))
        .map(e => {
          const clone = cloneEmpresa(e)
          if (!importarConcessoes) clone.concessoes = []
          return clone
        })
    )
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: BG_SURF, borderRadius: 14, padding: '24px 26px', width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 8px 30px rgba(42,79,150,0.18)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>📥 Importar de outra pasta</div>

        {outras.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 13 }}>Não há outras pastas disponíveis para importar.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pasta de origem</label>
              <select value={selectedPastaId} onChange={e => { setSelectedPastaId(e.target.value); setSelectedIds(new Set()) }}
                style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: BG_SURF, color: TEXT }}>
                {outras.map(p => <option key={p.id} value={p.id}>{p.nome}{p.periodo ? ` — ${p.periodo}` : ''}</option>)}
              </select>
            </div>

            {selectedPasta && (
              <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 8, maxHeight: 320 }}>
                <div style={{ padding: '8px 12px', background: BG_SEC, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1 }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
                    {selectedPasta.empresas.length} empresa(s) &nbsp;·&nbsp; {selectedIds.size} selecionada(s)
                  </span>
                  <button onClick={toggleAll} style={{ fontSize: 11, color: PRIMARY, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    {selectedIds.size === selectedPasta.empresas.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>
                </div>
                {selectedPasta.empresas.map(emp => {
                  const sc = STATUS_CFG[emp.status] ?? STATUS_CFG.sem
                  const checked = selectedIds.has(emp.id)
                  return (
                    <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: checked ? '#e8f0fc' : 'transparent' }}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        const next = new Set(selectedIds); checked ? next.delete(emp.id) : next.add(emp.id); setSelectedIds(next)
                      }} style={{ width: 15, height: 15, accentColor: PRIMARY, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.nome}</div>
                        {emp.obs && <div style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.obs}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                        <span style={{ fontSize: 10.5, color: sc.color, background: sc.bg, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{sc.label}</span>
                        {(emp.concessoes ?? []).length > 0 && (
                          <span style={{ fontSize: 10.5, color: PRIMARY, background: '#e8f0fc', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{emp.concessoes.length} conc.</span>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: TEXT, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={importarConcessoes} onChange={e => setImportarConcessoes(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: PRIMARY, flexShrink: 0 }} />
                Incluir concessões
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{ height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={doImport} disabled={selectedIds.size === 0}
                  style={{ height: 32, padding: '0 16px', borderRadius: 7, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', opacity: selectedIds.size === 0 ? 0.6 : 1 }}>
                  Importar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
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
  const [bancNomes, setBancNomes] = useState<string[]>([])
  const [acSuggs, setAcSuggs] = useState<string[]>([])
  const [acIdx, setAcIdx] = useState(-1)
  const [showImport, setShowImport] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quickRef = useRef<HTMLInputElement>(null)

  const suggestions = useAutocomplete(bancNomes, quickAdd)

  useEffect(() => {
    fetch('/api/anotacoes-cic')
      .then(r => r.ok ? r.json() : [])
      .then((rows: unknown[]) => setPastas((rows as Parameters<typeof rowFromApi>[0][]).map(rowFromApi)))
      .finally(() => setLoading(false))
    fetch('/api/banco-empresas-cic')
      .then(r => r.ok ? r.json() : [])
      .then((nomes: string[]) => setBancNomes(nomes))
  }, [])

  // sync autocomplete suggestions with query
  useEffect(() => { setAcSuggs(suggestions); setAcIdx(-1) }, [quickAdd]) // eslint-disable-line

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
    setSaving(false); setCurrent(null); setView('list'); setQuickAdd(''); setAcSuggs([])
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

  function commitQuickAdd(nome: string) {
    if (!nome.trim()) return
    const trimmed = nome.trim()
    updateCurrent(p => ({ ...p, empresas: [...p.empresas, { ...novaEmpresa(trimmed), expanded: true }] }))
    setQuickAdd(''); setAcSuggs([])
    if (!bancNomes.includes(trimmed)) {
      setBancNomes(prev => [...prev, trimmed].sort())
      fetch('/api/banco-empresas-cic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([trimmed]) })
    }
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

  function handleImport(empresas: Empresa[]) {
    updateCurrent(p => ({ ...p, empresas: [...p.empresas, ...empresas] }))
    const novos = empresas.map(e => e.nome.trim()).filter(n => n && !bancNomes.includes(n))
    if (novos.length) {
      setBancNomes(prev => [...new Set([...prev, ...novos])].sort())
      fetch('/api/banco-empresas-cic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novos) })
    }
  }

  function exportPDF() {
    if (!current) return
    const win = window.open('', '_blank', 'width=950,height=750')
    if (!win) return
    win.document.write(buildReportHtml(current)); win.document.close(); win.focus()
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
          <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>Registro de concessões e autorizações por feira.</div>
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
              <button onClick={() => openPasta(p)} style={{ background: 'none', border: 'none', color: PRIMARY, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, alignSelf: 'flex-start' }}>Abrir →</button>
            </div>
          )
        })}
        <div onClick={() => setModal(true)}
          style={{ border: `2px dashed ${BORDER}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: MUTED, cursor: 'pointer', minHeight: 140 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLElement).style.color = PRIMARY }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = MUTED }}>
          <span style={{ fontSize: 26 }}>📂</span><span style={{ fontSize: 12, fontWeight: 600 }}>Nova pasta</span>
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setModal(false); setModalNome(''); setModalPeriodo('') } }}>
          <div style={{ background: BG_SURF, borderRadius: 14, padding: '24px 26px', width: 360, boxShadow: '0 8px 30px rgba(42,79,150,0.15)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY, marginBottom: 16 }}>📁 Nova pasta</div>
            {([{ label: 'Nome da feira', value: modalNome, setter: setModalNome, ph: 'Ex.: Expobento 2027' }, { label: 'Período', value: modalPeriodo, setter: setModalPeriodo, ph: 'Ex.: Agosto/2027' }] as const).map((f, i) => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                <input autoFocus={i === 0} value={f.value} onChange={e => (f.setter as (v: string) => void)(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreatePasta()} placeholder={f.ph}
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
          <button onClick={() => setShowImport(true)} title="Importar empresas de outra pasta"
            style={{ height: 32, padding: '0 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: '#1d3a74', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📥 Importar de outra pasta
          </button>
          <button onClick={exportPDF} style={{ height: 32, padding: '0 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: '#b45309', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📄 PDF</button>
          <button onClick={exportExcel} style={{ height: 32, padding: '0 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: '#2e7d32', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📊 Excel</button>
          <button onClick={exportWord} style={{ height: 32, padding: '0 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: '#1d3a74', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📝 Word</button>
          <button onClick={backToList} style={{ height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Voltar</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, padding: '12px 16px', background: BG_SURF, borderRadius: 10, border: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
        {[{ label: 'Empresas', val: stats.total, color: TEXT }, { label: 'Concessões', val: stats.totalConcessoes, color: PRIMARY }, { label: 'Pendências', val: stats.pend, color: '#b45309' }, { label: 'OK', val: stats.ok, color: '#2e7d32' }].map(x => (
          <div key={x.label} style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {x.label}<div style={{ fontSize: 20, fontWeight: 700, color: x.color, textTransform: 'none', marginTop: 1 }}>{x.val}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CFG[s]; const count = current.empresas.filter(e => e.status === s).length
            if (!count) return null
            return <div key={s} style={{ fontSize: 10.5, color: cfg.color, background: cfg.bg, padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>{count} {cfg.label}</div>
          })}
        </div>
      </div>

      {/* Companies */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {current.empresas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 13, fontStyle: 'italic' }}>
            Nenhuma empresa registrada. Adicione abaixo ou importe de outra pasta.
          </div>
        )}

        {current.empresas.map((emp, idx) => {
          const concessoes = emp.concessoes ?? []
          return (
            <div key={emp.id} style={{ background: BG_SURF, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: MUTED, minWidth: 20, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>
                <button onClick={() => updateEmpresa(emp.id, { expanded: !emp.expanded })}
                  style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 11, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transform: emp.expanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                  ▶
                </button>
                <input value={emp.nome} onChange={e => updateEmpresa(emp.id, { nome: e.target.value })} placeholder="Nome da empresa..."
                  style={{ flex: '2', minWidth: 180, fontSize: 13.5, fontWeight: 600, color: TEXT, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit' }} />
                <input value={emp.obs} onChange={e => updateEmpresa(emp.id, { obs: e.target.value })} placeholder="Observação..."
                  style={{ flex: '3', minWidth: 130, fontSize: 12.5, color: MUTED, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit' }} />
                {concessoes.length > 0 && (
                  <span onClick={() => updateEmpresa(emp.id, { expanded: !emp.expanded })}
                    style={{ fontSize: 11, color: PRIMARY, background: '#e8f0fc', borderRadius: 20, padding: '2px 8px', flexShrink: 0, fontWeight: 600, cursor: 'pointer' }}>
                    {concessoes.length} conc.
                  </span>
                )}
                <button onClick={() => deleteEmpresa(emp.id)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0, fontSize: 13 }}>🗑</button>
              </div>

              {emp.expanded && (
                <div style={{ padding: '10px 14px 14px 54px', borderTop: `1px solid ${BORDER}`, background: BG_SEC }}>
                  {/* Situação (status cycling) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Situação</span>
                    <button onClick={() => cycleStatus(emp.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: STATUS_CFG[emp.status].bg, color: STATUS_CFG[emp.status].color }}
                      title="Clique para alterar">
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_CFG[emp.status].dot, display: 'inline-block' }} />
                      {STATUS_CFG[emp.status].label}
                    </button>
                  </div>

                  {/* Concessões */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Concessões</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {concessoes.length === 0 && <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>Nenhuma concessão registrada ainda.</div>}
                    {concessoes.map((c, i) => (
                      <div key={c.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px 10px', background: i % 2 === 0 ? BG_SURF : '#f0f3f9' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 10, color: MUTED, minWidth: 18 }}>{i + 1}</span>
                          <button onClick={() => updateConcessao(emp.id, c.id, { tipo: c.tipo === 'empresa' ? 'pessoa' : 'empresa' })} title="Clique para alternar"
                            style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: c.tipo === 'empresa' ? '#e8f0fc' : '#f3e8ff', color: c.tipo === 'empresa' ? '#1d3a74' : '#6b21a8' }}>
                            {c.tipo === 'empresa' ? '● Docs Empresa' : '● Docs Pessoa'}
                          </button>
                          <div style={{ flex: 1 }} />
                          <button onClick={() => deleteConcessao(emp.id, c.id)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 12, padding: '2px 4px', borderRadius: 4 }}>✕</button>
                        </div>
                        {/* Fields */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <FieldBox label="Documento / Concessão" full>
                            <AutoArea value={c.documento} onChange={v => updateConcessao(emp.id, c.id, { documento: v })} placeholder="Descreva a concessão..." style={{ color: TEXT, fontSize: 12.5 }} />
                          </FieldBox>
                          {c.tipo === 'pessoa' && (
                            <>
                              <FieldBox label="Pessoa">
                                <AutoArea value={c.pessoa} onChange={v => updateConcessao(emp.id, c.id, { pessoa: v })} placeholder="Nome da pessoa..." style={{ color: TEXT, fontSize: 12.5 }} />
                              </FieldBox>
                              <FieldBox label="Situação">
                                <AutoArea value={c.situacao ?? ''} onChange={v => updateConcessao(emp.id, c.id, { situacao: v })} placeholder="Situação / contexto..." style={{ color: TEXT, fontSize: 12.5 }} />
                              </FieldBox>
                            </>
                          )}
                          <FieldBox label="Autorizado por">
                            <AutoArea value={c.concedido_por} onChange={v => updateConcessao(emp.id, c.id, { concedido_por: v })} placeholder="Ex.: Renato" style={{ color: TEXT, fontSize: 12.5 }} />
                          </FieldBox>
                          <FieldBox label="Observações">
                            <AutoArea value={c.obs} onChange={v => updateConcessao(emp.id, c.id, { obs: v })} placeholder="—" style={{ color: TEXT, fontSize: 12.5 }} />
                          </FieldBox>
                        </div>
                      </div>
                    ))}
                  </div>
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

      {/* Quick-add with autocomplete */}
      <div style={{ marginTop: 10, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input ref={quickRef} value={quickAdd}
            onChange={e => setQuickAdd(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(i => Math.min(i + 1, acSuggs.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setAcIdx(i => Math.max(i - 1, -1)) }
              else if (e.key === 'Enter') { e.preventDefault(); if (acIdx >= 0 && acSuggs[acIdx]) commitQuickAdd(acSuggs[acIdx]); else if (quickAdd.trim()) commitQuickAdd(quickAdd) }
              else if (e.key === 'Escape') { setAcSuggs([]) }
            }}
            onFocus={() => { if (quickAdd.length >= 2) setAcSuggs(suggestions) }}
            onBlur={() => setTimeout(() => setAcSuggs([]), 150)}
            placeholder="Digite o nome da empresa e pressione Enter para adicionar..."
            style={{ flex: 1, height: 40, border: `1.5px dashed ${BORDER}`, borderRadius: 9, padding: '0 14px', fontSize: 13, color: TEXT, background: BG_SURF, outline: 'none', fontFamily: 'inherit' }}
            onFocusCapture={e => (e.target.style.borderColor = PRIMARY)}
            onBlurCapture={e => (e.target.style.borderColor = BORDER)} />
          <button onClick={() => { if (quickAdd.trim()) commitQuickAdd(quickAdd); else quickRef.current?.focus() }}
            style={{ height: 40, padding: '0 18px', borderRadius: 9, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            + Empresa
          </button>
        </div>

        {acSuggs.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 56, background: BG_SURF, border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(42,79,150,0.12)', zIndex: 100, marginTop: 4, overflow: 'hidden' }}>
            {acSuggs.map((s, i) => (
              <div key={s} onMouseDown={() => commitQuickAdd(s)}
                style={{ padding: '9px 14px', fontSize: 13, color: i === acIdx ? PRIMARY : TEXT, background: i === acIdx ? '#e8f0fc' : 'transparent', cursor: 'pointer', fontWeight: i === acIdx ? 600 : 400 }}>
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import modal */}
      {showImport && (
        <ImportModal pastas={pastas} currentId={current.id} onImport={handleImport} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
