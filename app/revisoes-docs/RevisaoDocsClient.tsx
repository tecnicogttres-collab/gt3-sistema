'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Campo = { id: string; label: string }
type Registro = { id: string; nome: string; empresa: string; flags: Record<string, boolean>; corrigido: boolean }
type RevisaoDados = { campos: Campo[]; registros: Registro[] }

type RevisaoMeta = {
  id: string; nome: string
  criado_por: string; criado_por_nome: string | null
  created_at: string; minha: boolean
  nRegistros: number; nCampos: number; nPendencias: number
}

type RevisaoFull = {
  id: string; nome: string
  criado_por: string; criado_por_nome: string | null
  created_at: string; minha: boolean
  dados: RevisaoDados
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#2A4F96'
const BORDER = 'rgba(42,79,150,0.12)'
const MUTED = '#9399ae'
const TEXT = '#1a1f2e'
const BG_SEC = '#f4f6fb'
const BG_SURF = '#ffffff'

const CAMPOS_DEFAULT: Campo[] = [
  { id: 'aso', label: 'ASO S/ Aptidão' },
  { id: 'epi_capacete', label: 'EPI p/ Altura — Capacete' },
  { id: 'epi_cinto', label: 'EPI p/ Altura — Cinto c/ Talabarte' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    || 'campo_' + uid()
}

function fmtData(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR')
}

function metaFromFull(r: RevisaoFull): RevisaoMeta {
  const regs = r.dados.registros
  return {
    id: r.id, nome: r.nome, criado_por: r.criado_por,
    criado_por_nome: r.criado_por_nome, created_at: r.created_at, minha: r.minha,
    nRegistros: regs.length,
    nCampos: r.dados.campos.length,
    nPendencias: regs.filter(reg => Object.values(reg.flags ?? {}).some(Boolean) && !reg.corrigido).length,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

function ToggleCell({ checked, onClick, color = '#c0392b' }: { checked: boolean; onClick: () => void; color?: string }) {
  return (
    <td onClick={onClick} style={{ textAlign: 'center', cursor: 'pointer', padding: 6, userSelect: 'none' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 8, margin: 'auto', transition: 'all .15s',
        border: checked ? `2px solid ${color}` : '2px solid #dce3ef',
        background: checked ? color : '#f9fafc',
        color: '#fff',
      }}>
        {checked && CHECK_ICON}
      </div>
    </td>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RevisaoDocsClient() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [revisoes, setRevisoes] = useState<RevisaoMeta[]>([])
  const [current, setCurrent] = useState<RevisaoFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState<'minhas' | 'todas'>('minhas')
  const [modoCorrecao, setModoCorrecao] = useState(false)
  const [busca, setBusca] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nomeRef = useRef<HTMLInputElement>(null)

  // Modal nova revisão
  const [modal, setModal] = useState(false)
  const [modalNome, setModalNome] = useState('')
  const [modalCampos, setModalCampos] = useState<Campo[]>(CAMPOS_DEFAULT)
  const [modalCustomLabel, setModalCustomLabel] = useState('')

  // Add row form
  const [inputNome, setInputNome] = useState('')
  const [inputEmpresa, setInputEmpresa] = useState('')
  const [inputFlags, setInputFlags] = useState<Record<string, boolean>>({})

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/revisoes-docs')
      .then(r => r.ok ? r.json() : [])
      .then((data: RevisaoMeta[]) => setRevisoes(data))
      .finally(() => setLoading(false))
  }, [])

  // ── Auto-save ─────────────────────────────────────────────────────────────────

  const scheduleSave = useCallback((rev: RevisaoFull) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/revisoes-docs/${rev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: rev.nome, dados: rev.dados }),
      })
      setSaving(false)
      setRevisoes(prev => prev.map(r => r.id === rev.id ? metaFromFull(rev) : r))
    }, 600)
  }, [])

  function updateCurrent(fn: (r: RevisaoFull) => RevisaoFull) {
    setCurrent(prev => {
      if (!prev) return prev
      const next = fn(prev)
      scheduleSave(next)
      return next
    })
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  async function openRevisao(meta: RevisaoMeta) {
    setCurrent({ ...meta, dados: { campos: [], registros: [] } })
    setView('detail')
    setBusca('')
    setModoCorrecao(false)
    setInputFlags({})
    setInputNome('')
    setInputEmpresa('')
    const r = await fetch(`/api/revisoes-docs/${meta.id}`)
    if (r.ok) {
      const fresh: RevisaoFull = await r.json()
      setCurrent(fresh)
      setRevisoes(prev => prev.map(x => x.id === fresh.id ? metaFromFull(fresh) : x))
    }
  }

  function backToList() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(false)
    setCurrent(null)
    setView('list')
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!modalNome.trim()) return
    const res = await fetch('/api/revisoes-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: modalNome.trim(),
        dados: { campos: modalCampos, registros: [] },
      }),
    })
    if (!res.ok) { showToast('Erro ao criar revisão.'); return }
    const nova: RevisaoMeta = await res.json()
    setRevisoes(prev => [nova, ...prev])
    setModal(false); setModalNome(''); setModalCampos(CAMPOS_DEFAULT); setModalCustomLabel('')
    openRevisao(nova)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta revisão e todos os seus registros?')) return
    const res = await fetch(`/api/revisoes-docs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRevisoes(prev => prev.filter(r => r.id !== id))
    } else {
      showToast('Sem permissão para excluir.')
    }
  }

  function addRegistro() {
    if (!inputNome.trim()) { nomeRef.current?.focus(); return }
    const reg: Registro = {
      id: uid(), nome: inputNome.trim(), empresa: inputEmpresa.trim(),
      flags: { ...inputFlags }, corrigido: false,
    }
    updateCurrent(r => ({ ...r, dados: { ...r.dados, registros: [...r.dados.registros, reg] } }))
    setInputNome(''); setInputEmpresa(''); setInputFlags({})
    nomeRef.current?.focus()
  }

  function toggleFlag(regId: string, campo: string) {
    updateCurrent(r => ({
      ...r, dados: {
        ...r.dados,
        registros: r.dados.registros.map(reg =>
          reg.id === regId ? { ...reg, flags: { ...reg.flags, [campo]: !reg.flags[campo] } } : reg
        ),
      },
    }))
  }

  function toggleCorrigido(regId: string) {
    updateCurrent(r => ({
      ...r, dados: {
        ...r.dados,
        registros: r.dados.registros.map(reg =>
          reg.id === regId ? { ...reg, corrigido: !reg.corrigido } : reg
        ),
      },
    }))
  }

  function deleteRegistro(regId: string) {
    updateCurrent(r => ({
      ...r, dados: { ...r.dados, registros: r.dados.registros.filter(reg => reg.id !== regId) },
    }))
  }

  function clearFlags() {
    if (!confirm('Limpar todas as marcações e correções?')) return
    updateCurrent(r => ({
      ...r, dados: {
        ...r.dados,
        registros: r.dados.registros.map(reg => ({ ...reg, flags: {}, corrigido: false })),
      },
    }))
  }

  // ── Modal campo helpers ───────────────────────────────────────────────────────

  function toggleModalCampo(id: string) {
    setModalCampos(prev => {
      if (prev.some(c => c.id === id)) return prev.filter(c => c.id !== id)
      const def = CAMPOS_DEFAULT.find(c => c.id === id)
      return def ? [...prev, def] : prev
    })
  }

  function addModalCampo() {
    const label = modalCustomLabel.trim()
    if (!label) return
    const id = 'custom_' + slugify(label)
    if (modalCampos.some(c => c.id === id || c.label.toLowerCase() === label.toLowerCase())) return
    setModalCampos(prev => [...prev, { id, label }])
    setModalCustomLabel('')
  }

  // ── PDF ───────────────────────────────────────────────────────────────────────

  function printReport() {
    if (!current) return
    const campos = current.dados.campos
    const sorted = [...current.dados.registros].sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'))
    let lastEmpresa = ''
    const rows = sorted.map((r, i) => {
      const newGroup = r.empresa !== lastEmpresa
      lastEmpresa = r.empresa
      const sep = newGroup && i > 0 ? 'border-top:2px solid #bbc8dc;' : ''
      const temPend = Object.values(r.flags ?? {}).some(Boolean)
      const bg = r.corrigido ? '#f0fdf4' : temPend ? '#fff8f0' : '#fff'
      const flagCells = campos.map(c =>
        `<td style="padding:5px 8px;text-align:center;color:${r.flags[c.id] ? '#c0392b' : '#ccc'};font-weight:${r.flags[c.id] ? 'bold' : 'normal'};${sep}">${r.flags[c.id] ? 'PENDENTE' : '—'}</td>`
      ).join('')
      return `<tr style="background:${bg}">
        <td style="padding:5px 8px;text-align:center;color:#aaa;font-size:11px;${sep}">${i + 1}</td>
        <td style="padding:5px 8px;font-weight:600;${r.corrigido ? 'text-decoration:line-through;color:#aaa;' : ''}${sep}">${r.nome}</td>
        <td style="padding:5px 8px;${newGroup ? 'color:#1e3a6e;font-weight:700;' : 'color:transparent;'}${sep}">${newGroup ? r.empresa : '·'}</td>
        ${flagCells}
        <td style="padding:5px 8px;text-align:center;color:${r.corrigido ? '#16a34a' : '#ccc'};${sep}">${r.corrigido ? 'CORRIGIDO' : '—'}</td>
      </tr>`
    }).join('')

    const ths = campos.map(c =>
      `<th style="width:130px;text-align:center;font-size:10px;padding:8px">${c.label}</th>`
    ).join('')

    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${current.nome}</title>
    <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#2A4F96;color:#fff;padding:8px 10px;text-align:left}
    td{border-bottom:1px solid #f0f3f8}
    @media print{.no-print{display:none}}</style></head><body>
    <div style="background:#2A4F96;color:#fff;padding:16px 20px;margin:-20px -20px 16px">
      <h2 style="margin:0 0 4px;font-size:17px">${current.nome}</h2>
      <p style="margin:0;font-size:11px;opacity:.75">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    <button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;background:#2A4F96;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Imprimir</button>
    <table><thead><tr>
      <th style="width:36px">#</th><th>Nome</th><th>Empresa</th>
      ${ths}
      <th style="width:100px;text-align:center">Corrigido</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <p style="margin-top:16px;font-size:10px;color:#aaa">GT3 Consultoria · ${current.criado_por_nome ?? ''} · Total: ${sorted.length} registro(s)</p>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const listaFiltrada = filtro === 'minhas' ? revisoes.filter(r => r.minha) : revisoes

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Carregando...</div>

  // ──────────────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ──────────────────────────────────────────────────────────────────────────────

  if (view === 'list') return (
    <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1100, background: '#1E3A6E', color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Revisões Documentos</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>
            Checklists de pendências por revisão. Cada revisão tem seus próprios campos configuráveis.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Toggle Minhas/Todas */}
          <div style={{ display: 'flex', background: BG_SEC, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            {(['minhas', 'todas'] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: filtro === f ? PRIMARY : 'transparent',
                  color: filtro === f ? '#fff' : MUTED,
                  transition: 'all .15s',
                }}>
                {f === 'minhas' ? 'Minhas revisões' : 'Todas revisões'}
              </button>
            ))}
          </div>
          <button onClick={() => setModal(true)}
            style={{ height: 34, padding: '0 16px', borderRadius: 7, background: PRIMARY, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Nova revisão
          </button>
        </div>
      </div>

      {listaFiltrada.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED, fontSize: 13 }}>
          {filtro === 'minhas' ? 'Você não tem revisões ainda. Crie uma nova.' : 'Nenhuma revisão encontrada.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {listaFiltrada.map(r => (
          <div key={r.id} style={{ background: BG_SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(42,79,150,0.07)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: '#e8f0fc', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                📋
              </div>
              {r.minha && (
                <button onClick={() => handleDelete(r.id)}
                  style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 4, fontSize: 14, borderRadius: 6 }}
                  title="Excluir revisão">
                  🗑
                </button>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>{r.nome || 'Sem nome'}</div>
            {r.criado_por_nome && <div style={{ fontSize: 11, color: MUTED }}>👤 {r.criado_por_nome}</div>}
            <div style={{ fontSize: 11, color: MUTED }}>📅 {fmtData(r.created_at)}</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                { l: 'Registros', v: r.nRegistros, c: TEXT },
                { l: 'Pendentes', v: r.nPendencias, c: r.nPendencias > 0 ? '#c47a00' : MUTED },
                { l: 'Campos', v: r.nCampos, c: PRIMARY },
              ].map(x => (
                <div key={x.l} style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {x.l}
                  <div style={{ fontSize: 17, fontWeight: 700, color: x.c, textTransform: 'none' }}>{x.v}</div>
                </div>
              ))}
            </div>
            <button onClick={() => openRevisao(r)}
              style={{ background: 'none', border: 'none', color: PRIMARY, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, alignSelf: 'flex-start' }}>
              Abrir →
            </button>
          </div>
        ))}

        <div onClick={() => setModal(true)}
          style={{ border: `2px dashed ${BORDER}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: MUTED, cursor: 'pointer', minHeight: 160 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLElement).style.color = PRIMARY }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = MUTED }}>
          <span style={{ fontSize: 26 }}>📋</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Nova revisão</span>
        </div>
      </div>

      {/* Modal Nova Revisão */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setModal(false); setModalNome(''); setModalCampos(CAMPOS_DEFAULT); setModalCustomLabel('') } }}>
          <div style={{ background: BG_SURF, borderRadius: 14, padding: '24px 26px', width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 30px rgba(42,79,150,0.18)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY, marginBottom: 18 }}>📋 Nova revisão</div>

            {/* Nome */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
                Nome da revisão
              </label>
              <input autoFocus value={modalNome} onChange={e => setModalNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Ex.: Revisão NR-35 — Contratante X"
                style={{ width: '100%', height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            {/* Campos de verificação */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 10 }}>
                Campos de verificação
              </label>

              {/* Campos padrão */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {CAMPOS_DEFAULT.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, cursor: 'pointer', padding: '6px 10px', borderRadius: 7, background: modalCampos.some(mc => mc.id === c.id) ? '#e8f0fc' : BG_SEC, border: `1px solid ${BORDER}` }}>
                    <input type="checkbox" checked={modalCampos.some(mc => mc.id === c.id)}
                      onChange={() => toggleModalCampo(c.id)}
                      style={{ width: 15, height: 15, accentColor: PRIMARY, flexShrink: 0 }} />
                    <span style={{ color: TEXT }}>{c.label}</span>
                  </label>
                ))}

                {/* Campos customizados */}
                {modalCampos.filter(c => !CAMPOS_DEFAULT.some(d => d.id === c.id)).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, padding: '6px 10px', borderRadius: 7, background: '#e8f0fc', border: `1px solid ${BORDER}` }}>
                    <input type="checkbox" checked readOnly style={{ width: 15, height: 15, accentColor: PRIMARY, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: TEXT }}>{c.label}</span>
                    <button onClick={() => setModalCampos(prev => prev.filter(mc => mc.id !== c.id))}
                      style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 13, padding: '2px 4px', flexShrink: 0 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Adicionar campo personalizado */}
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={modalCustomLabel} onChange={e => setModalCustomLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addModalCampo()}
                  placeholder="Adicionar campo personalizado..."
                  style={{ flex: 1, height: 32, border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '0 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: BG_SURF }} />
                <button onClick={addModalCampo} disabled={!modalCustomLabel.trim()}
                  style={{ height: 32, padding: '0 14px', background: 'transparent', border: `1px solid ${PRIMARY}`, borderRadius: 6, color: PRIMARY, fontSize: 12, fontWeight: 600, cursor: modalCustomLabel.trim() ? 'pointer' : 'not-allowed', opacity: modalCustomLabel.trim() ? 1 : 0.5 }}>
                  + Campo
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setModal(false); setModalNome(''); setModalCampos(CAMPOS_DEFAULT); setModalCustomLabel('') }}
                style={{ height: 33, padding: '0 16px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={!modalNome.trim()}
                style={{ height: 33, padding: '0 18px', borderRadius: 7, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: modalNome.trim() ? 'pointer' : 'not-allowed', opacity: modalNome.trim() ? 1 : 0.6 }}>
                ✓ Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ──────────────────────────────────────────────────────────────────────────────
  // DETAIL VIEW
  // ──────────────────────────────────────────────────────────────────────────────

  if (!current) return null

  const campos = current.dados.campos
  const registros = current.dados.registros
  const q = busca.toLowerCase().trim()
  const filtered = q
    ? registros.filter(r => r.nome.toLowerCase().includes(q) || r.empresa.toLowerCase().includes(q))
    : registros

  const stats = {
    total: registros.length,
    comPendencia: registros.filter(r => Object.values(r.flags ?? {}).some(Boolean) && !r.corrigido).length,
    corrigidos: registros.filter(r => r.corrigido).length,
  }

  const colSpanTotal = 3 + campos.length + (modoCorrecao ? 1 : 0) + 1

  const TH: React.CSSProperties = {
    background: PRIMARY, color: '#fff', fontWeight: 600,
    padding: '12px 14px', textAlign: 'left', fontSize: 12, letterSpacing: '0.3px',
  }

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1100, background: '#1E3A6E', color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>
            <span onClick={backToList} style={{ color: PRIMARY, cursor: 'pointer', fontWeight: 600 }}>Revisões</span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: TEXT, fontWeight: 600 }}>{current.nome}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT }}>{current.nome}</h1>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
            {current.criado_por_nome && <>👤 {current.criado_por_nome} · </>}
            📅 {fmtData(current.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 12, color: MUTED }}>Salvando…</span>}
          <input type="text" placeholder="🔍 Filtrar..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ padding: '7px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 13, width: 190, outline: 'none', color: TEXT, background: '#fff', fontFamily: 'inherit' }} />
          <button onClick={() => setModoCorrecao(v => !v)}
            style={{ padding: '7px 13px', background: modoCorrecao ? '#16a34a' : '#fff', color: modoCorrecao ? '#fff' : '#16a34a', border: `1.5px solid ${modoCorrecao ? '#16a34a' : '#bbf7d0'}`, borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}>
            {modoCorrecao ? '✓ Modo Correção ativo' : 'Marcar Correções'}
          </button>
          <button onClick={clearFlags}
            style={{ padding: '7px 13px', background: '#fff', color: PRIMARY, border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Limpar marcações
          </button>
          <button onClick={printReport}
            style={{ padding: '7px 13px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            🖨 Gerar PDF
          </button>
          <button onClick={backToList}
            style={{ padding: '7px 13px', background: '#fff', color: MUTED, border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ← Voltar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { n: stats.total, label: 'registros', color: PRIMARY },
          { n: stats.comPendencia, label: 'com pendência', color: '#c47a00' },
          { n: stats.corrigidos, label: 'corrigidos', color: '#16a34a' },
          ...campos.map(c => ({
            n: registros.filter(r => r.flags[c.id]).length,
            label: c.label,
            color: PRIMARY,
          })),
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#556', display: 'flex', alignItems: 'center', gap: 5 }}>
            <strong style={{ color: s.color, fontSize: 14 }}>{s.n}</strong>
            {s.label}
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(42,79,150,.07)', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 40, textAlign: 'center', color: 'rgba(255,255,255,.55)', fontSize: 11 }}>#</th>
                <th style={TH}>Nome</th>
                <th style={TH}>Empresa</th>
                {campos.map(c => (
                  <th key={c.id} style={{ ...TH, width: 140, textAlign: 'center', fontSize: 11, lineHeight: 1.3, padding: '10px 8px' }}>
                    {c.label}
                  </th>
                ))}
                {modoCorrecao && (
                  <th style={{ ...TH, width: 110, textAlign: 'center', fontSize: 11, background: '#15803d' }}>
                    Corrigido
                  </th>
                )}
                <th style={{ ...TH, width: 40, padding: '12px 8px' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={colSpanTotal} style={{ textAlign: 'center', padding: '40px 20px', color: '#aab2c2', fontSize: 13 }}>
                    {registros.length === 0
                      ? 'Nenhum registro. Use o formulário abaixo para adicionar.'
                      : 'Nenhum resultado para a busca.'}
                  </td>
                </tr>
              ) : filtered.map((reg, idx) => {
                const temPendencia = Object.values(reg.flags ?? {}).some(Boolean)
                return (
                  <tr key={reg.id}
                    style={{ borderBottom: '1px solid #f0f3f8', background: reg.corrigido ? '#f0fdf4' : temPendencia ? '#fff8f0' : 'transparent', transition: 'background .1s' }}
                    onMouseEnter={e => { if (!reg.corrigido && !temPendencia) (e.currentTarget as HTMLElement).style.background = '#f7f9fd' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = reg.corrigido ? '#f0fdf4' : temPendencia ? '#fff8f0' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#aab2c2', fontSize: 11 }}>{idx + 1}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: reg.corrigido ? '#86a890' : TEXT, textDecoration: reg.corrigido ? 'line-through' : 'none' }}>
                      {reg.nome}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#4a5568' }}>{reg.empresa}</td>
                    {campos.map(c => (
                      <ToggleCell key={c.id} checked={!!reg.flags[c.id]} onClick={() => toggleFlag(reg.id, c.id)} />
                    ))}
                    {modoCorrecao && (
                      <ToggleCell checked={reg.corrigido} onClick={() => toggleCorrigido(reg.id)} color="#16a34a" />
                    )}
                    <td style={{ textAlign: 'center', padding: 6 }}>
                      <button onClick={() => deleteRegistro(reg.id)} title="Remover"
                        style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: 4, borderRadius: 5, display: 'inline-flex', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#c0392b'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#ccc'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Formulário de adição */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px', background: BG_SEC, borderTop: '1px solid #e8edf5', flexWrap: 'wrap', alignItems: 'center' }}>
          <input ref={nomeRef} type="text" placeholder="Nome da pessoa"
            value={inputNome} onChange={e => setInputNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRegistro()}
            style={{ flex: 1, minWidth: 140, padding: '7px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 13, color: TEXT, outline: 'none', background: '#fff', fontFamily: 'inherit' }}
            onFocus={e => { e.target.style.borderColor = PRIMARY }}
            onBlur={e => { e.target.style.borderColor = BORDER }} />
          <input type="text" placeholder="Empresa"
            value={inputEmpresa} onChange={e => setInputEmpresa(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRegistro()}
            style={{ flex: 1, minWidth: 140, padding: '7px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 13, color: TEXT, outline: 'none', background: '#fff', fontFamily: 'inherit' }}
            onFocus={e => { e.target.style.borderColor = PRIMARY }}
            onBlur={e => { e.target.style.borderColor = BORDER }} />
          {campos.map(c => (
            <div key={c.id}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#556', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setInputFlags(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 7, transition: 'all .15s', flexShrink: 0,
                border: inputFlags[c.id] ? '2px solid #c0392b' : `2px solid ${BORDER}`,
                background: inputFlags[c.id] ? '#c0392b' : '#f9fafc',
                color: '#fff',
              }}>
                {inputFlags[c.id] && CHECK_ICON}
              </div>
              {c.label}
            </div>
          ))}
          <button onClick={addRegistro} disabled={!inputNome.trim()}
            style={{ padding: '8px 16px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: !inputNome.trim() ? 'not-allowed' : 'pointer', opacity: !inputNome.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            + Adicionar
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, color: '#7a8aaa', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#c0392b', display: 'inline-block' }} />
          Pendência marcada
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#dce3ef', border: '1.5px solid #ccc', display: 'inline-block' }} />
          Sem pendência
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#16a34a', display: 'inline-block' }} />
          Corrigido
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED }}>
          Alterações salvas automaticamente
        </span>
      </div>
    </div>
  )
}
