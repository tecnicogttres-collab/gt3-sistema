'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '../lib/supabase'
import { useUser, displayName } from '../components/UserContext'

// ─── Types ───────────────────────────────────────────────────────────────────

type TipoConcessao = 'empresa' | 'pessoa' | 'cadastro'

type Concessao = {
  id: string
  tipo: TipoConcessao
  documento: string
  pessoa: string
  situacao: string
  concedido_por: string
  obs: string
  anotado_por_nome?: string
  anotado_em?: string
  editando?: boolean
}

type Empresa = {
  id: string
  nome: string
  obs: string
  expanded: boolean
  concessoes: Concessao[]
}

type PastaFull = {
  id: string; nome: string; periodo: string; empresas: Empresa[]; created_at: string
  updated_at?: string; atualizado_por_nome?: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIMARY = '#2A4F96'
const BORDER = 'rgba(42,79,150,0.12)'
const MUTED = '#9399ae'
const TEXT = '#1a1f2e'
const BG_SEC = '#f4f6fb'
const BG_SURF = '#ffffff'

const TIPO_ORDER: TipoConcessao[] = ['pessoa', 'empresa', 'cadastro']
const TIPO_CFG: Record<TipoConcessao, { label: string; bg: string; color: string }> = {
  pessoa:   { label: 'Doc Pessoa',   bg: '#f3e8ff', color: '#6b21a8' },
  empresa:  { label: 'Docs Empresa', bg: '#e8f0fc', color: '#1d3a74' },
  cadastro: { label: 'Cadastro',     bg: '#e8f5e9', color: '#2e7d32' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function novaConcessao(): Concessao { return { id: uid(), tipo: 'empresa', documento: '', pessoa: '', situacao: '', concedido_por: '', obs: '', editando: true } }
function novaEmpresa(nome = ''): Empresa { return { id: uid(), nome, obs: '', expanded: false, concessoes: [] } }

function pastaStats(empresas: Empresa[]) {
  let totalConcessoes = 0
  for (const e of empresas) totalConcessoes += (e.concessoes ?? []).length
  return { total: empresas.length, totalConcessoes }
}

function migrateConcessao(raw: Record<string, unknown>): Concessao {
  return {
    id: String(raw.id ?? uid()),
    tipo: (raw.tipo === 'empresa' || raw.tipo === 'pessoa' || raw.tipo === 'cadastro') ? raw.tipo : 'empresa',
    documento: String(raw.documento ?? raw.doc ?? ''),
    pessoa: String(raw.pessoa ?? ''),
    situacao: String(raw.situacao ?? ''),
    concedido_por: String(raw.concedido_por ?? raw.responsavel ?? ''),
    obs: String(raw.obs ?? ''),
    anotado_por_nome: raw.anotado_por_nome ? String(raw.anotado_por_nome) : undefined,
    anotado_em: raw.anotado_em ? String(raw.anotado_em) : undefined,
  }
}

function migrateEmpresa(raw: Record<string, unknown>): Empresa {
  if ('anotacoes' in raw && !('concessoes' in raw)) {
    const anots = (raw.anotacoes as Record<string, unknown>[]) ?? []
    return {
      id: String(raw.id ?? uid()),
      nome: String(raw.nome ?? ''),
      obs: String(raw.obs ?? ''),
      expanded: false,
      concessoes: anots.map(migrateConcessao),
    }
  }
  const emp = raw as Empresa
  const rawConcessoes = Array.isArray(emp.concessoes) ? emp.concessoes : []
  return {
    ...emp,
    concessoes: rawConcessoes.map(c => migrateConcessao(c as Record<string, unknown>)),
  }
}

function rowFromApi(row: { id: string; nome: string; periodo: string; dados: unknown; created_at: string; updated_at?: string; atualizado_por_nome?: string | null }): PastaFull {
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
  return { id: row.id, nome: row.nome, periodo: row.periodo, empresas, created_at: row.created_at, updated_at: row.updated_at, atualizado_por_nome: row.atualizado_por_nome ?? null }
}

function cloneEmpresa(emp: Empresa): Empresa {
  return { ...emp, id: uid(), expanded: false, concessoes: (emp.concessoes ?? []).map(c => ({ ...c, id: uid() })) }
}

// ─── 3-way merge (evita perder edições concorrentes de outros usuários) ───────

type Baseline = { nome: string; periodo: string; empresas: Empresa[] }

function deepEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function mergeScalar<T>(base: T, local: T, server: T): T {
  const localChanged = !deepEqual(local, base)
  const serverChanged = !deepEqual(server, base)
  if (localChanged && !serverChanged) return local
  if (!localChanged && serverChanged) return server
  return local // ambos mudaram (raro) ou nenhum mudou: local prevalece
}

function mergeConcessao(base: Concessao | undefined, local: Concessao, server: Concessao): Concessao {
  const b = base ?? local
  return {
    id: local.id,
    tipo: mergeScalar(b.tipo, local.tipo, server.tipo),
    documento: mergeScalar(b.documento, local.documento, server.documento),
    pessoa: mergeScalar(b.pessoa, local.pessoa, server.pessoa),
    situacao: mergeScalar(b.situacao, local.situacao, server.situacao),
    concedido_por: mergeScalar(b.concedido_por, local.concedido_por, server.concedido_por),
    obs: mergeScalar(b.obs, local.obs, server.obs),
    anotado_por_nome: mergeScalar(b.anotado_por_nome, local.anotado_por_nome, server.anotado_por_nome),
    anotado_em: mergeScalar(b.anotado_em, local.anotado_em, server.anotado_em),
    editando: local.editando, // estado de UI: nunca vem do servidor
  }
}

function concessaoDataEqual(a: Concessao, b: Concessao) {
  return a.tipo === b.tipo && a.documento === b.documento && a.pessoa === b.pessoa && a.situacao === b.situacao
    && a.concedido_por === b.concedido_por && a.obs === b.obs
}

function mergeConcessoes(base: Concessao[], local: Concessao[], server: Concessao[]): Concessao[] {
  const baseMap = new Map(base.map(c => [c.id, c]))
  const localMap = new Map(local.map(c => [c.id, c]))
  const serverMap = new Map(server.map(c => [c.id, c]))
  const seen = new Set<string>()
  const orderIds = [...local.map(c => c.id), ...server.map(c => c.id)].filter(id => (seen.has(id) ? false : (seen.add(id), true)))

  const result: Concessao[] = []
  for (const id of orderIds) {
    const b = baseMap.get(id), l = localMap.get(id), s = serverMap.get(id)
    if (l && s) result.push(mergeConcessao(b, l, s))
    else if (l && !s) { if (!b || !concessaoDataEqual(l, b)) result.push(l) } // criado localmente, ou editado após exclusão remota
    else if (!l && s) { if (!b || !concessaoDataEqual(s, b)) result.push(s) } // criado remotamente, ou editado remotamente após exclusão local
  }
  return result
}

function empresaDataEqual(a: Empresa, b: Empresa) {
  return a.nome === b.nome && a.obs === b.obs && a.concessoes.length === b.concessoes.length
    && a.concessoes.every((c, i) => c.id === b.concessoes[i].id && concessaoDataEqual(c, b.concessoes[i]))
}

function mergeEmpresa(base: Empresa | undefined, local: Empresa, server: Empresa): Empresa {
  const b = base ?? local
  return {
    id: local.id,
    nome: mergeScalar(b.nome, local.nome, server.nome),
    obs: mergeScalar(b.obs, local.obs, server.obs),
    expanded: local.expanded, // estado de UI: nunca vem do servidor
    concessoes: mergeConcessoes(b.concessoes ?? [], local.concessoes ?? [], server.concessoes ?? []),
  }
}

function mergeEmpresas(base: Empresa[], local: Empresa[], server: Empresa[]): Empresa[] {
  const baseMap = new Map(base.map(e => [e.id, e]))
  const localMap = new Map(local.map(e => [e.id, e]))
  const serverMap = new Map(server.map(e => [e.id, e]))
  const seen = new Set<string>()
  const orderIds = [...local.map(e => e.id), ...server.map(e => e.id)].filter(id => (seen.has(id) ? false : (seen.add(id), true)))

  const result: Empresa[] = []
  for (const id of orderIds) {
    const b = baseMap.get(id), l = localMap.get(id), s = serverMap.get(id)
    if (l && s) result.push(mergeEmpresa(b, l, s))
    else if (l && !s) { if (!b || !empresaDataEqual(l, b)) result.push(l) }
    else if (!l && s) { if (!b || !empresaDataEqual(s, b)) result.push(s) }
  }
  return result
}

function mergePastaData(base: Baseline, local: Baseline, server: Baseline): Baseline {
  return {
    nome: mergeScalar(base.nome, local.nome, server.nome),
    periodo: mergeScalar(base.periodo, local.periodo, server.periodo),
    empresas: mergeEmpresas(base.empresas, local.empresas, server.empresas),
  }
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
    const rows = (emp.concessoes ?? []).map((c, i) => `
      <tr>
        <td style="text-align:center;color:#888;width:28px">${i + 1}</td>
        <td style="white-space:nowrap;font-weight:600;color:${TIPO_CFG[c.tipo].color}">${esc(TIPO_CFG[c.tipo].label)}</td>
        <td style="word-break:break-word">${esc(c.documento)}</td>
        <td style="word-break:break-word">${c.tipo === 'pessoa' ? esc(c.pessoa) : '—'}</td>
        <td style="word-break:break-word">${esc(c.situacao ?? '')}</td>
        <td style="font-weight:600">${esc(c.concedido_por)}</td>
        <td style="color:#555;word-break:break-word">${esc(c.obs)}</td>
      </tr>`).join('')
    return `<div class="emp-section">
      <h3>${esc(emp.nome)}</h3>
      <p class="emp-meta">${emp.obs ? `${esc(emp.obs)} &nbsp;·&nbsp; ` : ''}<b>${emp.concessoes.length}</b> concessão(ões)</p>
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
    return (emp.concessoes ?? []).map((c, i) => {
      const sep = i === 0 ? 'border-top:6px solid #2A4F96;' : ''
      return `<tr>
      <td style="${sep}">${esc(emp.nome)}</td><td style="${sep}">${esc(emp.obs)}</td>
      <td style="${sep}">${esc(TIPO_CFG[c.tipo].label)}</td>
      <td style="${sep}">${esc(c.documento)}</td>
      <td style="${sep}">${c.tipo === 'pessoa' ? esc(c.pessoa) : ''}</td>
      <td style="${sep}">${esc(c.situacao ?? '')}</td>
      <td style="${sep}">${esc(c.concedido_por)}</td><td style="${sep}">${esc(c.obs)}</td>
    </tr>`
    })
  }).join('')
  return `<html><head><meta charset='utf-8'>
<style>
  table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt}
  th,td{border:1px solid #808080;padding:4px 8px;mso-number-format:'\\@'}
  th{background:#2A4F96;color:#fff;font-weight:700}
  tr:nth-child(even) td{background:#f5f7fa}
</style></head><body><table border="1" cellspacing="0" cellpadding="4">
    <thead><tr><th>Empresa</th><th>Obs. Empresa</th><th>Tipo</th><th>Documento / Concessão</th><th>Pessoa</th><th>Situação</th><th>Autorizado por</th><th>Observações</th></tr></thead>
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

  const empresasOrdenadas = selectedPasta
    ? [...selectedPasta.empresas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    : []

  function toggleAll() {
    if (!selectedPasta) return
    setSelectedIds(selectedIds.size === empresasOrdenadas.length ? new Set() : new Set(empresasOrdenadas.map(e => e.id)))
  }

  function doImport() {
    if (!selectedPasta || selectedIds.size === 0) return
    onImport(
      empresasOrdenadas
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
    <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="gt3-drop-in" style={{ background: BG_SURF, borderRadius: 14, padding: '24px 26px', width: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 8px 30px rgba(42,79,150,0.18)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>📥 Importar de outra pasta</div>

        {outras.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 13 }}>Não há outras pastas disponíveis para importar.</p>
        ) : (
          <>
            {/* Pasta de origem */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pasta de origem</label>
              <select value={selectedPastaId} onChange={e => { setSelectedPastaId(e.target.value); setSelectedIds(new Set()) }}
                style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: BG_SURF, color: TEXT }}>
                {outras.map(p => <option key={p.id} value={p.id}>{p.nome}{p.periodo ? ` — ${p.periodo}` : ''}</option>)}
              </select>
            </div>

            {selectedPasta && (
              <>
                {/* Indicador da pasta */}
                <div style={{ fontSize: 12, color: MUTED, background: BG_SEC, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 10px' }}>
                  Importando de: <strong style={{ color: TEXT }}>{selectedPasta.nome}{selectedPasta.periodo ? ` — ${selectedPasta.periodo}` : ''}</strong>
                  &nbsp;·&nbsp; {empresasOrdenadas.length} empresa(s)
                  &nbsp;·&nbsp; {empresasOrdenadas.filter(e => (e.concessoes ?? []).length > 0).length} com concessão
                </div>

                {/* Lista de empresas ordenada */}
                <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 8, maxHeight: 360 }}>
                  <div style={{ padding: '8px 12px', background: BG_SEC, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1 }}>
                    <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
                      {selectedIds.size} selecionada(s)
                    </span>
                    <button onClick={toggleAll} style={{ fontSize: 11, color: PRIMARY, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      {selectedIds.size === empresasOrdenadas.length ? 'Desmarcar todas' : 'Selecionar todas'}
                    </button>
                  </div>
                  {empresasOrdenadas.map(emp => {
                    const checked = selectedIds.has(emp.id)
                    const nConc = (emp.concessoes ?? []).length
                    return (
                      <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: checked ? '#e8f0fc' : 'transparent' }}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          const next = new Set(selectedIds); checked ? next.delete(emp.id) : next.add(emp.id); setSelectedIds(next)
                        }} style={{ width: 15, height: 15, accentColor: PRIMARY, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.nome}</div>
                          {emp.obs && <div style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.obs}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                          {nConc > 0
                            ? <span style={{ fontSize: 10.5, color: PRIMARY, background: '#e8f0fc', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>{nConc} conc.</span>
                            : <span style={{ fontSize: 10.5, color: MUTED, background: BG_SEC, padding: '2px 7px', borderRadius: 20 }}>sem conc.</span>
                          }
                        </div>
                      </label>
                    )
                  })}
                </div>
              </>
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
  const [remoteNotice, setRemoteNotice] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quickRef = useRef<HTMLInputElement>(null)
  const baselineRef = useRef<Baseline>({ nome: '', periodo: '', empresas: [] })
  const persistingRef = useRef(false)
  const queuedRef = useRef<PastaFull | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedAtRef = useRef<string | null>(null)
  const currentRef = useRef<PastaFull | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const concessaoRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const { profile } = useUser()

  useEffect(() => {
    if (!highlightId) return
    const el = concessaoRefs.current.get(highlightId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.querySelector('textarea')?.focus()
    }
  }, [highlightId])

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

  useEffect(() => { currentRef.current = current }, [current])

  // Autosave (debounced) manda o estado local direto — a segurança contra
  // sobrescrever a edição de outro usuário vem do canal realtime, que já
  // mantém `baselineRef`/`current` atualizados enquanto a pasta está aberta.
  // O botão "Salvar" manual, além disso, rebusca o servidor e faz merge de
  // 3 vias antes de enviar, como uma rede de segurança extra.
  const persistOnce = useCallback(async (pasta: PastaFull, refetch: boolean) => {
    const local: Baseline = { nome: pasta.nome, periodo: pasta.periodo, empresas: pasta.empresas }
    let toSend: Baseline = local
    if (refetch) {
      const r = await fetch(`/api/anotacoes-cic/${pasta.id}`)
      const server = r.ok ? rowFromApi(await r.json()) : null
      if (server) toSend = mergePastaData(baselineRef.current, local, { nome: server.nome, periodo: server.periodo, empresas: server.empresas })
    }

    const res = await fetch(`/api/anotacoes-cic/${pasta.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: toSend.nome, periodo: toSend.periodo, dados: toSend.empresas }),
    })
    if (res.ok) {
      const saved = rowFromApi(await res.json())
      baselineRef.current = { nome: saved.nome, periodo: saved.periodo, empresas: saved.empresas }
      lastSavedAtRef.current = saved.updated_at ?? null
      const prev = currentRef.current
      if (prev && prev.id === saved.id) {
        const reconciled = mergePastaData(local, { nome: prev.nome, periodo: prev.periodo, empresas: prev.empresas }, { nome: saved.nome, periodo: saved.periodo, empresas: saved.empresas })
        const nextCurrent = { ...prev, ...reconciled, updated_at: saved.updated_at, atualizado_por_nome: saved.atualizado_por_nome }
        currentRef.current = nextCurrent
        setCurrent(nextCurrent)
      }
      setPastas(prev2 => prev2.map(p => p.id === saved.id ? { ...p, nome: saved.nome, periodo: saved.periodo, empresas: saved.empresas, atualizado_por_nome: saved.atualizado_por_nome } : p))
    }
  }, [])

  const persist = useCallback(async (pasta: PastaFull, refetch = false) => {
    if (persistingRef.current) { queuedRef.current = pasta; return }
    persistingRef.current = true
    setSaving(true)
    try {
      let next: PastaFull | null = pasta
      while (next) {
        await persistOnce(next, refetch)
        next = queuedRef.current
        queuedRef.current = null
        refetch = false // as próximas voltas do loop já são novas edições locais, não precisam rebuscar
      }
    } finally {
      persistingRef.current = false
      setSaving(false)
    }
  }, [persistOnce])

  const scheduleSave = useCallback((pasta: PastaFull) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveTimer.current = null; persist(pasta) }, 900)
  }, [persist])

  const flushSave = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    if (currentRef.current) persist(currentRef.current, true)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    setHighlightId(null)
  }, [persist])

  // Não usa a forma funcional de setState (prev => ...) de propósito: em
  // desenvolvimento, o Strict Mode chama esse tipo de função duas vezes para
  // detectar impurezas, e `fn` aqui pode gerar um id novo (novaConcessao/uid,
  // que usa Math.random) — cada chamada geraria um id diferente, e só uma
  // das duas entraria no estado final, enquanto o agendamento de salvamento
  // (efeito colateral) rodaria para as duas, podendo salvar um item que não
  // é o que ficou na tela. Por isso `fn` roda uma única vez, contra o valor
  // mais recente conhecido (currentRef), e o resultado é usado direto.
  function updateCurrent(fn: (p: PastaFull) => PastaFull) {
    const prev = currentRef.current
    if (!prev) return
    const next = fn(prev)
    currentRef.current = next
    setCurrent(next)
    scheduleSave(next)
  }

  // Realtime: propaga edições de outros usuários para quem está com a mesma pasta aberta
  useEffect(() => {
    if (!current) return
    const supabase = createClient()
    const ch = supabase
      .channel(`anotacoes-cic-${current.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'anotacoes_cic', filter: `id=eq.${current.id}` }, (payload) => {
        const row = payload.new as { id: string; nome: string; periodo: string; dados: unknown; created_at: string; updated_at?: string; atualizado_por_nome?: string | null }
        // Eco do nosso próprio save: já processado em persistOnce, ignora para não re-renderizar à toa
        if (row.updated_at && row.updated_at === lastSavedAtRef.current) return
        const fresh = rowFromApi(row)
        const prev = currentRef.current
        if (prev && prev.id === fresh.id) {
          const merged = mergePastaData(baselineRef.current, { nome: prev.nome, periodo: prev.periodo, empresas: prev.empresas }, { nome: fresh.nome, periodo: fresh.periodo, empresas: fresh.empresas })
          baselineRef.current = { nome: fresh.nome, periodo: fresh.periodo, empresas: fresh.empresas }
          const nextCurrent = { ...prev, ...merged, updated_at: fresh.updated_at, atualizado_por_nome: fresh.atualizado_por_nome }
          currentRef.current = nextCurrent
          setCurrent(nextCurrent)
        }
        setPastas(prev2 => prev2.map(p => p.id === fresh.id ? { ...p, nome: fresh.nome, periodo: fresh.periodo, empresas: fresh.empresas, atualizado_por_nome: fresh.atualizado_por_nome } : p))
        if (fresh.atualizado_por_nome && fresh.atualizado_por_nome !== displayName(profile, '')) {
          setRemoteNotice(`🔄 ${fresh.atualizado_por_nome} atualizou esta pasta agora`)
          if (noticeTimer.current) clearTimeout(noticeTimer.current)
          noticeTimer.current = setTimeout(() => setRemoteNotice(null), 5000)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  async function openPasta(p: PastaFull) {
    currentRef.current = p
    setCurrent(p); setView('detail')
    const openedBase: Baseline = { nome: p.nome, periodo: p.periodo, empresas: p.empresas }
    baselineRef.current = openedBase
    // Busca dados frescos do servidor para não sobrescrever com cache desatualizado.
    // Faz merge (em vez de sobrescrever) para não apagar uma edição feita
    // pelo usuário nos instantes entre abrir a pasta e essa busca terminar.
    const r = await fetch(`/api/anotacoes-cic/${p.id}`)
    if (r.ok) {
      const fresh = rowFromApi(await r.json())
      baselineRef.current = { nome: fresh.nome, periodo: fresh.periodo, empresas: fresh.empresas }
      const prev = currentRef.current
      const nextCurrent = (prev && prev.id === fresh.id)
        ? { ...prev, ...mergePastaData(openedBase, { nome: prev.nome, periodo: prev.periodo, empresas: prev.empresas }, { nome: fresh.nome, periodo: fresh.periodo, empresas: fresh.empresas }), updated_at: fresh.updated_at, atualizado_por_nome: fresh.atualizado_por_nome }
        : fresh
      currentRef.current = nextCurrent
      setCurrent(nextCurrent)
      setPastas(prev2 => prev2.map(x => x.id === fresh.id ? fresh : x))
    }
  }
  function backToList() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    currentRef.current = null
    setSaving(false); setCurrent(null); setView('list'); setQuickAdd(''); setAcSuggs([]); setRemoteNotice(null); setHighlightId(null)
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
  function stamp() {
    return { anotado_por_nome: displayName(profile, ''), anotado_em: new Date().toISOString() }
  }
  function addConcessao(empId: string) {
    const nova = { ...novaConcessao(), ...stamp() }
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id === empId ? { ...e, expanded: true, concessoes: [...e.concessoes, nova] } : e) }))
    setHighlightId(nova.id)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 6000)
  }
  function deleteConcessao(empId: string, cId: string, jaExistente = false) {
    if (jaExistente) {
      if (!confirm('Excluir esta concessão? Ela já está salva.')) return
      if (!confirm('Tem certeza mesmo? Essa exclusão não pode ser desfeita.')) return
    }
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id === empId ? { ...e, concessoes: e.concessoes.filter(c => c.id !== cId) } : e) }))
  }
  function updateConcessao(empId: string, cId: string, patch: Partial<Concessao>) {
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id === empId ? { ...e, concessoes: e.concessoes.map(c => c.id === cId ? { ...c, ...patch, ...stamp() } : c) } : e) }))
  }
  function setConcessaoEditando(empId: string, cId: string, editando: boolean) {
    updateCurrent(p => ({ ...p, empresas: p.empresas.map(e => e.id === empId ? { ...e, concessoes: e.concessoes.map(c => c.id === cId ? { ...c, editando } : c) } : e) }))
  }
  function saveConcessaoCard(empId: string, cId: string) {
    setConcessaoEditando(empId, cId, false)
    flushSave()
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
            <div key={p.id} style={{ background: BG_SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(42,79,150,0.07)', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: '#e8f0fc', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📁</div>
                <button onClick={() => handleDeletePasta(p.id)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 4, fontSize: 14, borderRadius: 6, flexShrink: 0 }}>🗑</button>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{p.nome || 'Sem nome'}</div>
              {p.periodo && <div style={{ fontSize: 12, color: MUTED, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>📅 {p.periodo}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px' }}>
                {[{ l: 'Empresas', v: s.total, c: TEXT }, { l: 'Concessões', v: s.totalConcessoes, c: PRIMARY }].map(x => (
                  <div key={x.l} style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
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
        <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setModal(false); setModalNome(''); setModalPeriodo('') } }}>
          <div className="gt3-drop-in" style={{ background: BG_SURF, borderRadius: 14, padding: '24px 26px', width: 360, boxShadow: '0 8px 30px rgba(42,79,150,0.15)' }}>
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

      {remoteNotice && (
        <div style={{ fontSize: 12, color: '#1d3a74', background: '#e8f0fc', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 12px', marginBottom: 14 }}>
          {remoteNotice}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, padding: '12px 16px', background: BG_SURF, borderRadius: 10, border: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
        {[{ label: 'Empresas', val: stats.total, color: TEXT }, { label: 'Concessões', val: stats.totalConcessoes, color: PRIMARY }].map(x => (
          <div key={x.label} style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {x.label}<div style={{ fontSize: 20, fontWeight: 700, color: x.color, textTransform: 'none', marginTop: 1 }}>{x.val}</div>
          </div>
        ))}
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
                  {/* Concessões */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Concessões</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {concessoes.length === 0 && <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>Nenhuma concessão registrada ainda.</div>}
                    {concessoes.map((c, i) => {
                      const attribution = c.anotado_por_nome && (
                        <span style={{ fontSize: 10, color: MUTED, whiteSpace: 'nowrap' }}>
                          {c.anotado_por_nome}{c.anotado_em ? ` · ${new Date(c.anotado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                      )
                      const cardStyle: React.CSSProperties = {
                        border: highlightId === c.id ? `2px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                        borderRadius: 8, padding: '8px 10px 10px', background: i % 2 === 0 ? BG_SURF : '#f0f3f9',
                        boxShadow: highlightId === c.id ? '0 6px 20px rgba(42,79,150,0.22)' : 'none',
                        transform: highlightId === c.id ? 'scale(1.015)' : 'scale(1)',
                        transition: 'border-color .3s ease, box-shadow .3s ease, transform .3s ease',
                      }

                      if (!c.editando) {
                        // ── Modo leitura: só mostra os dados, com botão para editar ──────────
                        return (
                          <div key={c.id} ref={el => { if (el) concessaoRefs.current.set(c.id, el); else concessaoRefs.current.delete(c.id) }} style={cardStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 10, color: MUTED, minWidth: 18 }}>{i + 1}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: TIPO_CFG[c.tipo].bg, color: TIPO_CFG[c.tipo].color }}>
                                {TIPO_CFG[c.tipo].label}
                              </span>
                              <div style={{ flex: 1 }} />
                              {attribution}
                              <button onClick={() => setConcessaoEditando(emp.id, c.id, true)} title="Editar"
                                style={{ background: 'none', border: `1px solid ${BORDER}`, color: PRIMARY, cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6 }}>
                                ✏️ Editar
                              </button>
                              <button onClick={() => deleteConcessao(emp.id, c.id, true)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 12, padding: '2px 4px', borderRadius: 4 }}>✕</button>
                            </div>
                            <div style={{ fontSize: 12.5, color: TEXT, marginTop: 6, lineHeight: 1.6 }}>
                              <div><b>Documento:</b> {c.documento || '—'}</div>
                              {c.tipo === 'pessoa' && (
                                <>
                                  <div><b>Pessoa:</b> {c.pessoa || '—'}</div>
                                  <div><b>Situação:</b> {c.situacao || '—'}</div>
                                </>
                              )}
                              {(c.tipo === 'empresa' || c.tipo === 'cadastro') && (
                                <div><b>Situação Empresa:</b> {c.situacao || '—'}</div>
                              )}
                              <div><b>Autorizado por:</b> {c.concedido_por || '—'}</div>
                              {c.obs && <div><b>Observações:</b> {c.obs}</div>}
                            </div>
                          </div>
                        )
                      }

                      // ── Modo edição: campos editáveis + botão Salvar desta concessão ──────
                      return (
                        <div key={c.id} ref={el => { if (el) concessaoRefs.current.set(c.id, el); else concessaoRefs.current.delete(c.id) }} style={cardStyle}>
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 10, color: MUTED, minWidth: 18 }}>{i + 1}</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {TIPO_ORDER.map(t => (
                                <button key={t} onClick={() => updateConcessao(emp.id, c.id, { tipo: t })}
                                  style={{
                                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                                    border: c.tipo === t ? `1.5px solid ${TIPO_CFG[t].color}` : '1.5px solid transparent',
                                    background: c.tipo === t ? TIPO_CFG[t].bg : BG_SEC,
                                    color: c.tipo === t ? TIPO_CFG[t].color : MUTED,
                                  }}>
                                  {c.tipo === t ? '● ' : ''}{TIPO_CFG[t].label}
                                </button>
                              ))}
                            </div>
                            <div style={{ flex: 1 }} />
                            {attribution}
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
                            {(c.tipo === 'empresa' || c.tipo === 'cadastro') && (
                              <FieldBox label="Situação Empresa">
                                <AutoArea value={c.situacao ?? ''} onChange={v => updateConcessao(emp.id, c.id, { situacao: v })} placeholder="Situação da empresa..." style={{ color: TEXT, fontSize: 12.5 }} />
                              </FieldBox>
                            )}
                            <FieldBox label="Autorizado por">
                              <AutoArea value={c.concedido_por} onChange={v => updateConcessao(emp.id, c.id, { concedido_por: v })} placeholder="Ex.: Renato" style={{ color: TEXT, fontSize: 12.5 }} />
                            </FieldBox>
                            <FieldBox label="Observações">
                              <AutoArea value={c.obs} onChange={v => updateConcessao(emp.id, c.id, { obs: v })} placeholder="—" style={{ color: TEXT, fontSize: 12.5 }} />
                            </FieldBox>
                          </div>
                          {/* Salvar desta concessão */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                            <button onClick={() => saveConcessaoCard(emp.id, c.id)} disabled={saving} title="Salvar esta concessão agora"
                              style={{ height: 28, padding: '0 12px', borderRadius: 6, border: 'none', background: '#2e7d32', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                              {saving ? 'Salvando...' : '💾 Salvar'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
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
