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
const DANGER_LIGHT = '#FEF2F2'

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
  file: FileData | null
  createdAt: number
  updatedAt: number
}

type ModalState = { open: boolean; editId: string | null; title: string; client: string; category: string; subject: string; tags: string; notes: string; file: FileData | null; dragOver: boolean }

const MODAL_INIT: ModalState = {
  open: false, editId: null, title: '', client: '', category: 'Orientação Inicial',
  subject: '', tags: '', notes: '', file: null, dragOver: false,
}

function uid() { return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7) }

function rowToTemplate(row: {
  id: string
  title: string
  client: string
  category: string
  subject: string
  tags: unknown
  notes: string
  created_at: string
  updated_at: string
}): Template {
  return {
    id: row.id,
    title: row.title,
    client: row.client,
    category: row.category,
    subject: row.subject,
    tags: (row.tags as string[]) ?? [],
    notes: row.notes,
    file: null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function escapeHtml(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function EmailsClient() {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<Template[]>([])
  const [modal, setModal] = useState<ModalState>(MODAL_INIT)
  const [activeTab, setActiveTab] = useState('Orientação Inicial')
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [toast, setToast] = useState({ msg: '', show: false })
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    supabase
      .from('email_templates')
      .select('id, title, client, category, subject, tags, notes, created_at, updated_at')
      .order('created_at', { ascending: false })
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

  function openModal(id?: string) {
    if (id) {
      const t = templates.find(x => x.id === id)
      if (!t) return
      setModal({ open: true, editId: id, title: t.title, client: t.client, category: t.category, subject: t.subject, tags: t.tags.join(', '), notes: t.notes, file: t.file, dragOver: false })
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
    const { title, client, category, subject, tags, notes, file, editId } = modal
    if (!title.trim() || !client.trim()) { showToast('Preencha título e cliente'); return }
    if (!file && !editId) { showToast('Anexe o arquivo .msg'); return }

    const supabase = createClient()
    const now = Date.now()

    if (editId) {
      const payload = {
        title: title.trim(),
        client: client.trim(),
        category,
        subject: subject.trim(),
        tags: tags.split(',').map(s => s.trim()).filter(Boolean),
        notes: notes.trim(),
        ...(file !== templates.find(x => x.id === editId)?.file ? { file } : {}),
      }
      const optimistic = templates.map(x =>
        x.id === editId ? { ...x, ...payload, tags: payload.tags, updatedAt: now } : x
      )
      setTemplates(optimistic)
      closeModal()
      showToast('Template atualizado')
      const { error } = await supabase.from('email_templates').update(payload).eq('id', editId)
      if (error) console.error('Erro ao atualizar template:', error)
    } else {
      const id = uid()
      const tpl: Template = {
        id,
        title: title.trim(),
        client: client.trim(),
        category,
        subject: subject.trim(),
        tags: tags.split(',').map(s => s.trim()).filter(Boolean),
        notes: notes.trim(),
        file,
        createdAt: now,
        updatedAt: now,
      }
      setTemplates(prev => [tpl, ...prev])
      closeModal()
      showToast('Template salvo')
      const { error } = await supabase.from('email_templates').insert({
        id: tpl.id,
        title: tpl.title,
        client: tpl.client,
        category: tpl.category,
        subject: tpl.subject,
        tags: tpl.tags,
        notes: tpl.notes,
        file: tpl.file,
      })
      if (error) console.error('Erro ao criar template:', error)
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Excluir este template? Esta ação não pode ser desfeita.')) return
    setTemplates(prev => prev.filter(x => x.id !== id))
    showToast('Template excluído')
    const supabase = createClient()
    const { error } = await supabase.from('email_templates').delete().eq('id', id)
    if (error) console.error('Erro ao excluir template:', error)
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
      return [t.title, t.client, t.subject, t.notes, ...t.tags].join(' ').toLowerCase().includes(q)
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

  return (
    <>
      {/* Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,20,37,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '40px 20px', overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: 'auto' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: '0 0 4px' }}>
              {modal.editId ? 'Editar Template' : 'Novo Template'}
            </h2>
            <p style={{ fontSize: 13, color: MUTED, margin: '0 0 24px' }}>Preencha os dados e anexe o arquivo .msg do Outlook</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 6 }}>Título do Template *</label>
              <input style={inputStyle} value={modal.title} onChange={e => setModal(m => ({ ...m, title: e.target.value }))} placeholder="Ex: Onboarding inicial - documentação SST" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 6 }}>Cliente / Empresa *</label>
                <input style={inputStyle} value={modal.client} onChange={e => setModal(m => ({ ...m, client: e.target.value }))} placeholder="Ex: Marcopolo, CSG, Genérico" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 6 }}>Pasta</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={modal.category} onChange={e => setModal(m => ({ ...m, category: e.target.value }))}>
                  {PASTAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 6 }}>Assunto do E-mail</label>
              <input style={inputStyle} value={modal.subject} onChange={e => setModal(m => ({ ...m, subject: e.target.value }))} placeholder="Ex: Informações para Novas Empresas - 2026" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 6 }}>Tags (separadas por vírgula)</label>
              <input style={inputStyle} value={modal.tags} onChange={e => setModal(m => ({ ...m, tags: e.target.value }))} placeholder="Ex: portal-terceiros, primeiro-contato, sst" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 6 }}>Notas / Quando usar</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 90, fontFamily: 'inherit', lineHeight: 1.5 }}
                value={modal.notes} onChange={e => setModal(m => ({ ...m, notes: e.target.value }))}
                placeholder="Ex: Enviar quando uma nova empresa for cadastrada no portal. Personalizar campos: [NOME_EMPRESA], [CNPJ]." />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 6 }}>Arquivo .msg do Outlook *</label>
              <input ref={fileInputRef} type="file" accept=".msg,.eml,.oft" style={{ display: 'none' }} onChange={handleFileSelect} />
              <div
                onDragOver={e => { e.preventDefault(); setModal(m => ({ ...m, dragOver: true })) }}
                onDragLeave={() => setModal(m => ({ ...m, dragOver: false }))}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${modal.file || modal.dragOver ? PRIMARY : '#CBD5E1'}`,
                  borderStyle: modal.file ? 'solid' : 'dashed',
                  borderRadius: 8, padding: 20, textAlign: 'center', cursor: 'pointer',
                  background: modal.file || modal.dragOver ? PRIMARY_LIGHT : '#FAFBFD',
                  transition: 'all 0.15s',
                }}
              >
                {modal.file ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>📎 {modal.file.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{(modal.file.size / 1024).toFixed(1)} KB · clique para trocar</div>
                  </>
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
              placeholder="Buscar por título, cliente, assunto, tag..."
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
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', minHeight: 200,
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
              >
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
                <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 8, lineHeight: 1.3 }}>{t.title}</div>
                {t.subject && (
                  <div style={{ fontSize: 13, color: MUTED, marginBottom: 10, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    📧 {t.subject}
                  </div>
                )}
                {t.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, marginTop: 'auto' }}>
                    {t.tags.slice(0, 4).map(tag => (
                      <span key={tag} style={{ fontSize: 10, background: '#F8FAFC', border: `1px solid ${BORDER}`, padding: '3px 7px', borderRadius: 4, color: MUTED }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {t.createdAt ? (
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                    📎 .msg · {formatDate(t.createdAt)}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                  <button onClick={() => downloadTemplate(t.id)} style={{ flex: 1, padding: '7px 12px', borderRadius: 6, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
                    ↓ Baixar
                  </button>
                  <button
                    onClick={() => downloadTemplate(t.id, 'Arquivo baixado — clique nele na barra do Chrome para abrir no Outlook ↓')}
                    style={{ flex: 1, padding: '7px 12px', borderRadius: 6, border: 'none', background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
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
