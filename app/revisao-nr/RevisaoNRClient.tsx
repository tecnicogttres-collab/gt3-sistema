'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '../lib/supabase'

type Registro = {
  id: string
  nome: string
  empresa: string
  aso: boolean
  epi: boolean
  created_at: string
}

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function RevisaoNRClient() {
  const [registros, setRegistros]       = useState<Registro[]>([])
  const [loading, setLoading]           = useState(true)
  const [busca, setBusca]               = useState('')
  const [inputNome, setInputNome]       = useState('')
  const [inputEmpresa, setInputEmpresa] = useState('')
  const [adding, setAdding]             = useState(false)
  const [loadingIds, setLoadingIds]     = useState<Set<string>>(new Set())
  const [toast, setToast]               = useState('')
  const nomeRef                         = useRef<HTMLInputElement>(null)
  const toastTimer                      = useRef<ReturnType<typeof setTimeout>>()

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/revisao-nr')
      .then(r => r.ok ? r.json() : [])
      .then((data: Registro[]) => setRegistros(data))
      .finally(() => setLoading(false))
  }, [])

  // ── Realtime ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('revisao-nr-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'revisao_nr_registros' }, payload => {
        const row = payload.new as Registro
        setRegistros(prev => prev.some(r => r.id === row.id) ? prev : [...prev, row])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'revisao_nr_registros' }, payload => {
        const row = payload.new as Registro
        setRegistros(prev => prev.map(r => r.id === row.id ? { ...r, ...row } : r))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'revisao_nr_registros' }, payload => {
        const id = (payload.old as { id: string }).id
        setRegistros(prev => prev.filter(r => r.id !== id))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function toggle(id: string, field: 'aso' | 'epi') {
    const reg = registros.find(r => r.id === id)
    if (!reg) return
    const newVal = !reg[field]
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, [field]: newVal } : r))
    const res = await fetch(`/api/revisao-nr/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newVal }),
    })
    if (!res.ok) {
      setRegistros(prev => prev.map(r => r.id === id ? { ...r, [field]: !newVal } : r))
      showToast('Erro ao salvar.')
    }
  }

  async function addRow() {
    if (!inputNome.trim()) { nomeRef.current?.focus(); return }
    setAdding(true)
    const res = await fetch('/api/revisao-nr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: inputNome, empresa: inputEmpresa }),
    })
    setAdding(false)
    if (res.ok) {
      setInputNome('')
      setInputEmpresa('')
      nomeRef.current?.focus()
    } else {
      showToast('Erro ao adicionar.')
    }
  }

  async function deleteRow(id: string) {
    setLoadingIds(prev => new Set([...prev, id]))
    await fetch(`/api/revisao-nr/${id}`, { method: 'DELETE' })
    setLoadingIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  async function clearAll() {
    if (!confirm('Limpar todas as marcações de ASO e EPI?')) return
    const marked = registros.filter(r => r.aso || r.epi)
    await Promise.all(marked.map(r =>
      fetch(`/api/revisao-nr/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aso: false, epi: false }),
      })
    ))
  }

  function printReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = registros.map((r, i) => `
      <tr style="background:${r.aso || r.epi ? '#fff8f0' : '#fff'}">
        <td style="padding:6px 10px;text-align:center;color:#aaa;font-size:11px">${i + 1}</td>
        <td style="padding:6px 10px;font-weight:600">${r.nome}</td>
        <td style="padding:6px 10px;color:#4a5568">${r.empresa}</td>
        <td style="padding:6px 10px;text-align:center;color:${r.aso ? '#c0392b' : '#aaa'};font-weight:${r.aso ? 'bold' : 'normal'}">${r.aso ? 'PENDENTE' : '—'}</td>
        <td style="padding:6px 10px;text-align:center;color:${r.epi ? '#c0392b' : '#aaa'};font-weight:${r.epi ? 'bold' : 'normal'}">${r.epi ? 'PENDENTE' : '—'}</td>
      </tr>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pendências SST</title>
    <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#2A4F96;color:#fff;padding:9px 10px;text-align:left;font-size:11px;font-weight:600}
    td{border-bottom:1px solid #f0f3f8}
    @media print{.no-print{display:none}}</style></head><body>
    <div style="background:#2A4F96;color:#fff;padding:16px 20px;margin:-20px -20px 16px">
      <h2 style="margin:0 0 4px;font-size:17px">Relatório de Pendências SST</h2>
      <p style="margin:0;font-size:11px;opacity:.75">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    <div style="display:flex;gap:20px;margin-bottom:14px;font-size:12px;color:#556">
      <span>Total: <b>${registros.length}</b></span>
      <span style="color:#c47a00">Com pendência: <b>${registros.filter(r => r.aso || r.epi).length}</b></span>
      <span>ASO s/ aptidão: <b>${registros.filter(r => r.aso).length}</b></span>
      <span>EPI s/ entrega: <b>${registros.filter(r => r.epi).length}</b></span>
    </div>
    <button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;background:#2A4F96;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
    <table><thead><tr>
      <th style="width:36px">#</th><th>Nome</th><th>Empresa</th>
      <th style="width:120px;text-align:center">ASO S/ Aptidão</th>
      <th style="width:150px;text-align:center">EPI S/ Entrega p/ Altura</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <p style="margin-top:16px;font-size:10px;color:#aaa">GT3 Consultoria — Documento interno</p>
    </body></html>`)
    win.document.close()
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = busca.toLowerCase()
    return q
      ? registros.filter(r => r.nome.toLowerCase().includes(q) || r.empresa.toLowerCase().includes(q))
      : registros
  }, [registros, busca])

  const stats = useMemo(() => ({
    total:     registros.length,
    pendentes: registros.filter(r => r.aso || r.epi).length,
    aso:       registros.filter(r => r.aso).length,
    epi:       registros.filter(r => r.epi).length,
  }), [registros])

  // ── Render ──────────────────────────────────────────────────────────────────

  const TH: React.CSSProperties = {
    background: '#2A4F96', color: '#fff', fontWeight: 600,
    padding: '13px 16px', textAlign: 'left', fontSize: 12,
    letterSpacing: '0.3px',
  }

  function ToggleCell({ checked, onClick }: { checked: boolean; onClick: () => void }) {
    return (
      <td onClick={onClick}
        title={checked ? 'Clique para desmarcar' : 'Clique para marcar pendência'}
        style={{ textAlign: 'center', cursor: 'pointer', padding: 8, userSelect: 'none' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 8, margin: 'auto', transition: 'all .15s',
          border: checked ? '2px solid #c0392b' : '2px solid #dce3ef',
          background: checked ? '#c0392b' : '#f9fafc',
          color: '#fff',
        }}>
          {checked && CHECK_ICON}
        </div>
      </td>
    )
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
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Revisão NR — Pendências SST</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7A99' }}>
            Clique nas células de ASO e EPI para marcar pendências · alterações aparecem em tempo real para todos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" placeholder="🔍  Filtrar por nome ou empresa…"
            value={busca} onChange={e => setBusca(e.target.value)}
            style={{ padding: '7px 13px', border: '1.5px solid #d6dce8', borderRadius: 7, fontSize: 13, width: 240, outline: 'none', color: '#1a2340', background: '#fff' }}
            onFocus={e => { e.target.style.borderColor = '#2A4F96' }}
            onBlur={e => { e.target.style.borderColor = '#d6dce8' }}
          />
          <button onClick={clearAll}
            style={{ padding: '8px 14px', background: '#fff', color: '#2A4F96', border: '1.5px solid #c2cedf', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Limpar marcações
          </button>
          <button onClick={printReport}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Gerar relatório PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { n: stats.total,     label: 'registros',       warn: false },
          { n: stats.pendentes, label: 'com pendência',   warn: true  },
          { n: stats.aso,       label: 'ASO s/ aptidão',  warn: false },
          { n: stats.epi,       label: 'EPI s/ entrega',  warn: false },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#556', display: 'flex', alignItems: 'center', gap: 5 }}>
            <strong style={{ color: s.warn ? '#c47a00' : '#2A4F96', fontSize: 14 }}>{s.n}</strong>
            {s.label}
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(42,79,150,.07)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Carregando…</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 40, textAlign: 'center', color: 'rgba(255,255,255,.55)', fontSize: 11 }}>#</th>
                    <th style={TH}>Nome</th>
                    <th style={TH}>Empresa</th>
                    <th style={{ ...TH, width: 160, textAlign: 'center', fontSize: 11, lineHeight: 1.3, padding: '10px 8px' }}>
                      ASO<br /><span style={{ fontWeight: 400, opacity: .75 }}>S/ Aptidão</span>
                    </th>
                    <th style={{ ...TH, width: 160, textAlign: 'center', fontSize: 11, lineHeight: 1.3, padding: '10px 8px' }}>
                      EPI para Altura<br /><span style={{ fontWeight: 400, opacity: .75 }}>S/ Entrega</span>
                    </th>
                    <th style={{ ...TH, width: 40, padding: '13px 8px' }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: '#aab2c2', fontSize: 13 }}>
                        {registros.length === 0 ? 'Nenhum registro. Use o formulário abaixo para adicionar.' : 'Nenhum registro encontrado.'}
                      </td>
                    </tr>
                  ) : filtered.map((reg, idx) => (
                    <tr key={reg.id}
                      style={{ borderBottom: '1px solid #f0f3f8', background: reg.aso || reg.epi ? '#fff8f0' : 'transparent', transition: 'background .1s' }}
                      onMouseEnter={e => { if (!(reg.aso || reg.epi)) (e.currentTarget as HTMLElement).style.background = '#f7f9fd' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = reg.aso || reg.epi ? '#fff8f0' : 'transparent' }}>
                      <td style={{ padding: '11px 16px', textAlign: 'center', color: '#aab2c2', fontSize: 11 }}>{idx + 1}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: '#1a2340' }}>{reg.nome}</td>
                      <td style={{ padding: '11px 16px', color: '#4a5568' }}>{reg.empresa}</td>
                      <ToggleCell checked={reg.aso} onClick={() => toggle(reg.id, 'aso')} />
                      <ToggleCell checked={reg.epi} onClick={() => toggle(reg.id, 'epi')} />
                      <td style={{ textAlign: 'center', padding: 8 }}>
                        <button
                          onClick={() => deleteRow(reg.id)}
                          disabled={loadingIds.has(reg.id)}
                          title="Remover"
                          style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: 4, borderRadius: 5, display: 'inline-flex', alignItems: 'center', opacity: loadingIds.has(reg.id) ? 0.4 : 1 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c0392b' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#ccc' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add row */}
            <div style={{ display: 'flex', gap: 10, padding: '14px 16px', background: '#f7f9fd', borderTop: '1px solid #e8edf5', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                ref={nomeRef}
                type="text" placeholder="Nome da pessoa"
                value={inputNome} onChange={e => setInputNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRow()}
                style={{ flex: 1, minWidth: 140, padding: '7px 12px', border: '1.5px solid #d6dce8', borderRadius: 7, fontSize: 13, color: '#1a2340', outline: 'none', background: '#fff' }}
                onFocus={e => { e.target.style.borderColor = '#2A4F96' }}
                onBlur={e => { e.target.style.borderColor = '#d6dce8' }}
              />
              <input
                type="text" placeholder="Empresa"
                value={inputEmpresa} onChange={e => setInputEmpresa(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRow()}
                style={{ flex: 1, minWidth: 140, padding: '7px 12px', border: '1.5px solid #d6dce8', borderRadius: 7, fontSize: 13, color: '#1a2340', outline: 'none', background: '#fff' }}
                onFocus={e => { e.target.style.borderColor = '#2A4F96' }}
                onBlur={e => { e.target.style.borderColor = '#d6dce8' }}
              />
              <button
                onClick={addRow} disabled={adding || !inputNome.trim()}
                style={{ padding: '8px 16px', background: '#2A4F96', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: adding || !inputNome.trim() ? 'not-allowed' : 'pointer', opacity: adding || !inputNome.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {adding ? 'Adicionando…' : '+ Adicionar'}
              </button>
            </div>
          </>
        )}
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
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}>
          🟢 Ao vivo — alterações aparecem instantaneamente para todos os usuários
        </span>
      </div>
    </div>
  )
}
