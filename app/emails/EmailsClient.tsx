'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '../lib/supabase'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const ACCENT = '#D1AE6E'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const DANGER = '#DC2626'

const PASTAS = ['Orientação Inicial', 'Acesso ao Portal']

type FileData = { name: string; size: number; data?: string }
type Template = {
  id: string
  title: string
  client: string
  category: string
  subject: string
  tags: string[]
  notes: string
  corpo: string
  file: FileData | null
  createdAt: number
  updatedAt: number
}

type ModalState = {
  open: boolean; editId: string | null
  title: string; client: string; category: string; subject: string
  tags: string; notes: string; corpo: string
  file: FileData | null; dragOver: boolean
}

const MODAL_INIT: ModalState = {
  open: false, editId: null, title: '', client: '', category: 'Orientação Inicial',
  subject: '', tags: '', notes: '', corpo: '', file: null, dragOver: false,
}

function uid() { return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7) }

function rowToTemplate(row: {
  id: string; title: string; client: string; category: string; subject: string
  tags: unknown; notes: string; corpo: string | null; created_at: string; updated_at: string
}): Template {
  return {
    id: row.id, title: row.title, client: row.client, category: row.category,
    subject: row.subject, tags: (row.tags as string[]) ?? [], notes: row.notes,
    corpo: row.corpo ?? '', file: null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function EmailsClient() {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<Template[]>([])
  const [modal, setModal] = useState<ModalState>(MODAL_INIT)
  const [activeTab, setActiveTab] = useState('Orientação Inicial')
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [toast, setToast] = useState({ msg: '', show: false })
  const [expandedCorpo, setExpandedCorpo] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    supabase
      .from('email_templates')
      .select('id, title, client, category, subject, tags, notes, corpo, created_at, updated_at')
      .order('title', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Erro ao carregar templates:', error)
        setTemplates((data ?? []).map(rowToTemplate))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  function showToast(msg: string) {
    if (toastRef.current) clearTimeout(toastRef.current)
    setToast({ msg, show: true })
    toastRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2400)
  }

  function copyCorpo(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      if (copiedRef.current) clearTimeout(copiedRef.current)
      setCopied(id)
      copiedRef.current = setTimeout(() => setCopied(null), 2000)
    }).catch(() => showToast('Não foi possível copiar'))
  }

  function openModal(id?: string) {
    if (id) {
      const t = templates.find(x => x.id === id)
      if (!t) return
      setModal({
        open: true, editId: id, title: t.title, client: t.client, category: t.category,
        subject: t.subject, tags: t.tags.join(', '), notes: t.notes, corpo: t.corpo,
        file: t.file, dragOver: false,
      })
    } else {
      setModal({ ...MODAL_INIT, open: true })
    }
  }

  function closeModal() { setModal(MODAL_INIT) }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setModal(m => ({ ...m, file: { name: file.name, size: file.size, data: ev.target?.result as string }, dragOver: false }))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setModal(m => ({ ...m, file: { name: file.name, size: file.size, data: ev.target?.result as string }, dragOver: false }))
    }
    reader.readAsDataURL(file)
  }

  async function saveTemplate() {
    const { title, client, category, subject, tags, notes, corpo, file, editId } = modal
    if (!title.trim() || !client.trim()) { showToast('Preencha título e cliente'); return }
    if (!file && !editId) { showToast('Anexe o arquivo .msg'); return }

    const parsedTags = tags.split(',').map(s => s.trim()).filter(Boolean)
    const now = Date.now()

    if (editId) {
      const existing = templates.find(x => x.id === editId)
      const payload: Record<string, unknown> = {
        title: title.trim(), client: client.trim(), category,
        subject: subject.trim(), tags: parsedTags, notes: notes.trim(),
        corpo: corpo.trim(),
      }
      if (file && file !== existing?.file) payload.file = file

      // Optimistic update
      setTemplates(prev => prev.map(x =>
        x.id === editId ? { ...x, ...payload, corpo: corpo.trim(), tags: parsedTags, updatedAt: now } : x
      ))
      closeModal()
      showToast('Template atualizado')

      const res = await fetch(`/api/emails/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { console.error('Erro ao atualizar template'); showToast('Erro ao salvar') }
    } else {
      const id = uid()
      const tpl: Template = {
        id, title: title.trim(), client: client.trim(), category,
        subject: subject.trim(), tags: parsedTags, notes: notes.trim(),
        corpo: corpo.trim(), file, createdAt: now, updatedAt: now,
      }
      setTemplates(prev => [tpl, ...prev])
      closeModal()
      showToast('Template salvo')

      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tpl.id, title: tpl.title, client: tpl.client, category: tpl.category,
          subject: tpl.subject, tags: tpl.tags, notes: tpl.notes,
          corpo: tpl.corpo, file: tpl.file,
        }),
      })
      if (!res.ok) { console.error('Erro ao criar template'); showToast('Erro ao salvar') }
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Excluir este template? Esta ação não pode ser desfeita.')) return
    setTemplates(prev => prev.filter(x => x.id !== id))
    showToast('Template excluído')
    const res = await fetch(`/api/emails/${id}`, { method: 'DELETE' })
    if (!res.ok) console.error('Erro ao excluir template')
  }

  async function downloadTemplate(id: string, successMsg?: string) {
    showToast('Carregando arquivo…')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('email_templates')
      .select('file')
      .eq('id', id)
      .single()
    if (error || !data?.file) { showToast('Arquivo não encontrado'); return }
    const f = data.file as FileData
    if (!f.data) { showToast('Arquivo sem dados'); return }
    const a = document.createElement('a')
    a.href = f.data; a.download = f.name
    a.click()
    showToast(successMsg ?? 'Download iniciado')
  }

  const clients = useMemo(() =>
    [...new Set(templates.filter(t => t.category === activeTab).map(t => t.client))].sort()
  , [templates, activeTab])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return templates.filter(t => {
      if (t.category !== activeTab) return false
      if (filterClient && t.client !== filterClient) return false
      if (!q) return true
      return [t.title, t.client, t.subject, t.notes, t.corpo, ...t.tags].join(' ').toLowerCase().includes(q)
    })
  }, [templates, search, filterClient, activeTab])

  const stats = useMemo(() => {
    const inTab = templates.filter(t => t.category === activeTab)
    return {
      total: inTab.length,
      clients: new Set(inTab.map(t => t.client)).size,
      recent: inTab.filter(t => t.createdAt > Date.now() - 7 * 86400000).length,
    }
  }, [templates, activeTab])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: MUTED, fontSize: 14 }}>
        Carregando templates…
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 6, border: `1.5px solid ${BORDER}`,
    fontSize: 14, fontFamily: 'inherit', color: INK, background: '#fff', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: MUTED, marginBottom: 6,
  }

  return (
    <>
      {/* Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,20,37,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '40px 20px', overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: 'auto' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: '0 0 4px' }}>
              {modal.editId ? 'Editar Template' : 'Novo Template'}
            </h2>
            <p style={{ fontSize: 13, color: MUTED, margin: '0 0 24px' }}>Preencha os dados e, opcionalmente, anexe o arquivo .msg do Outlook</p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Título do Template *</label>
              <input style={inputStyle} value={modal.title} onChange={e => setModal(m => ({ ...m, title: e.target.value }))} placeholder="Ex: Onboarding inicial - documentação SST" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Cliente / Empresa *</label>
                <input style={inputStyle} value={modal.client} onChange={e => setModal(m => ({ ...m, client: e.target.value }))} placeholder="Ex: Marcopolo, CSG, Genérico" />
              </div>
              <div>
                <label style={labelStyle}>Pasta</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={modal.category} onChange={e => setModal(m => ({ ...m, category: e.target.value }))}>
                  {PASTAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Assunto do E-mail</label>
              <input style={inputStyle} value={modal.subject} onChange={e => setModal(m => ({ ...m, subject: e.target.value }))} placeholder="Ex: Informações para Novas Empresas - 2026" />
            </div>

            {/* Corpo do e-mail */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Corpo do E-mail</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 160, fontFamily: 'inherit', lineHeight: 1.6, fontSize: 13 }}
                value={modal.corpo}
                onChange={e => setModal(m => ({ ...m, corpo: e.target.value }))}
                placeholder="Cole ou escreva o texto do e-mail aqui. Qualquer pessoa poderá copiar para enviar."
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Tags (separadas por vírgula)</label>
              <input style={inputStyle} value={modal.tags} onChange={e => setModal(m => ({ ...m, tags: e.target.value }))} placeholder="Ex: portal-terceiros, primeiro-contato, sst" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Notas / Quando usar</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 70, fontFamily: 'inherit', lineHeight: 1.5 }}
                value={modal.notes} onChange={e => setModal(m => ({ ...m, notes: e.target.value }))}
                placeholder="Ex: Enviar quando uma nova empresa for cadastrada no portal." />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Arquivo .msg do Outlook (opcional para edições)</label>
              <input ref={fileInputRef} type="file" accept=".msg,.eml,.oft" style={{ display: 'none' }} onChange={handleFileSelect} />
              <div
                onDragOver={e => { e.preventDefault(); setModal(m => ({ ...m, dragOver: true })) }}
                onDragLeave={() => setModal(m => ({ ...m, dragOver: false }))}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${modal.file || modal.dragOver ? PRIMARY : '#CBD5E1'}`,
                  borderStyle: modal.file ? 'solid' : 'dashed',
                  borderRadius: 8, padding: 16, textAlign: 'center', cursor: 'pointer',
                  background: modal.file || modal.dragOver ? PRIMARY_LIGHT : '#FAFBFD',
                  transition: 'all 0.15s',
                }}
              >
                {modal.file ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>📎 {modal.file.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{(modal.file.size / 1024).toFixed(1)} KB · clique para trocar</div>
                  </>
                ) : modal.editId ? (
                  <div style={{ fontSize: 13, color: MUTED }}>Clique para trocar o arquivo .msg (deixe em branco para manter o atual)</div>
                ) : (
                  <div style={{ fontSize: 13, color: MUTED }}>Clique para selecionar ou arraste o arquivo .msg aqui</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
              <button onClick={closeModal} style={{ padding: '10px 18px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 14, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={() => void saveTemplate()} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Salvar Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        background: INK, color: '#fff',
        padding: '14px 20px', borderRadius: 6, fontSize: 13,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        transform: toast.show ? 'translateY(0)' : 'translateY(100px)',
        opacity: toast.show ? 1 : 0, transition: 'all 0.3s',
        pointerEvents: 'none', zIndex: 2000,
      }}>{toast.msg}</div>

      {/* Page */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}`, paddingBottom: 20, marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: INK, margin: 0 }}>Biblioteca de E-mails</h1>
            <p style={{ fontSize: 12, color: MUTED, margin: '4px 0 0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>GT3 · Templates de Cadastro</p>
          </div>
          <button onClick={() => openModal()} style={{ padding: '10px 18px', borderRadius: 6, border: 'none', background: INK, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
            + Novo Template
          </button>
        </div>

        {/* Pasta switch */}
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {PASTAS.map(pasta => (
            <button
              key={pasta}
              onClick={() => { setActiveTab(pasta); setFilterClient(''); setSearch('') }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 14, fontWeight: activeTab === pasta ? 700 : 500,
                color: activeTab === pasta ? INK : MUTED,
                background: activeTab === pasta ? '#fff' : 'transparent',
                boxShadow: activeTab === pasta ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                transition: 'all 0.18s',
              }}
            >
              {pasta}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, marginBottom: 24 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }}>🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por título, cliente, assunto, corpo, tag..."
              style={{ ...inputStyle, paddingLeft: 40 }} />
          </div>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">Todos os clientes</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 32, padding: '16px 0', marginBottom: 24, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}>
          <span><strong style={{ fontSize: 22, fontWeight: 600, color: INK, textTransform: 'none', letterSpacing: 0, marginRight: 6 }}>{stats.total}</strong>templates</span>
          <span><strong style={{ fontSize: 22, fontWeight: 600, color: INK, textTransform: 'none', letterSpacing: 0, marginRight: 6 }}>{stats.clients}</strong>clientes</span>
          <span><strong style={{ fontSize: 22, fontWeight: 600, color: INK, textTransform: 'none', letterSpacing: 0, marginRight: 6 }}>{stats.recent}</strong>esta semana</span>
        </div>

        {/* Grid */}
        {templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: MUTED }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: INK, margin: '0 0 8px' }}>Nenhum template ainda</h3>
            <p style={{ fontSize: 14, marginBottom: 20 }}>Comece adicionando seu primeiro modelo de e-mail.</p>
            <button onClick={() => openModal()} style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: INK, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Adicionar primeiro template
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: MUTED }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: INK, margin: '0 0 8px' }}>Nada encontrado</h3>
            <p style={{ fontSize: 14 }}>Tente ajustar a busca ou os filtros.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filtered.map(t => (
              <div key={t.id} style={{
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
              >
                <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: PRIMARY, background: PRIMARY_LIGHT, padding: '4px 8px', borderRadius: 4 }}>
                      {t.client}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openModal(t.id)} title="Editar"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4, borderRadius: 4, fontSize: 14 }}>✎</button>
                      <button onClick={() => void deleteTemplate(t.id)} title="Excluir"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: DANGER, padding: 4, borderRadius: 4, fontSize: 14 }}>🗑</button>
                    </div>
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 6, lineHeight: 1.3 }}>{t.title}</div>

                  {t.subject && (
                    <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      📧 {t.subject}
                    </div>
                  )}

                  {t.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {t.tags.slice(0, 4).map(tag => (
                        <span key={tag} style={{ fontSize: 10, background: '#F8FAFC', border: `1px solid ${BORDER}`, padding: '3px 7px', borderRadius: 4, color: MUTED }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Corpo do e-mail */}
                  {t.corpo && (
                    <div style={{ marginBottom: 10 }}>
                      <button
                        onClick={() => setExpandedCorpo(expandedCorpo === t.id ? null : t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: PRIMARY, fontSize: 12, fontWeight: 600, padding: '3px 0', fontFamily: 'inherit' }}
                      >
                        <span style={{ fontSize: 10 }}>{expandedCorpo === t.id ? '▼' : '▶'}</span>
                        Ver corpo do e-mail
                      </button>
                      {expandedCorpo === t.id && (
                        <div style={{ marginTop: 8, position: 'relative' }}>
                          <pre style={{ fontSize: 12, color: INK, background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, maxHeight: 200, overflowY: 'auto', margin: 0, fontFamily: 'inherit' }}>
                            {t.corpo}
                          </pre>
                          <button
                            onClick={() => copyCorpo(t.id, t.corpo)}
                            style={{ marginTop: 6, width: '100%', padding: '5px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: copied === t.id ? '#F0FFF4' : '#fff', color: copied === t.id ? '#166534' : PRIMARY, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                          >
                            {copied === t.id ? '✓ Copiado!' : '📋 Copiar texto'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {t.createdAt ? (
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 'auto', paddingTop: 6 }}>
                      📎 .msg · {formatDate(t.createdAt)}
                    </div>
                  ) : null}
                </div>

                <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}` }}>
                  <button
                    onClick={() => downloadTemplate(t.id, 'Arquivo baixado — clique nele na barra do Chrome para abrir no Outlook ↓')}
                    style={{ width: '100%', padding: '7px 12px', borderRadius: 6, border: 'none', background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
                  >
                    📨 Abrir no Outlook
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
