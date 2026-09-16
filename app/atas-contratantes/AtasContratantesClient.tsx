'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '../components/UserContext'
import { createClient } from '../lib/supabase'
import AtasEditor, { StatusBadge, type AtaEditorData, type Participante, type Topico, type TopicoHistorico, type ContatoDiretorio } from '../atas/AtasEditor'
import { renderAtaHtml, nomeArquivoAta } from '../lib/ata-html'

// ─── Types ────────────────────────────────────────────────────────────────────

type Ata = {
  id: string
  titulo: string | null
  conteudo: string
  data: string
  status: 'Rascunho' | 'Aguardando Validação' | 'Validada'
  autor_id: string
  autor: { nome: string } | null
  created_at: string
  updated_at: string
  cliente: string | null
  local_reuniao: string | null
  numero_ata: string | null
  participantes: string | null
  share_token: string | null
  share_enabled: boolean | null
}

type Leitura = { user_id: string; nome: string; lido_em?: string }

type DiretorioPessoa = { nome: string; empresa: string; email: string }
type EmailPreview = { resolvidos: { nome: string; email: string }[]; semEmail: string[]; assunto: string; corpoPreview: string; ccGt3: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const STATUS_COLORS: Record<string, string> = {
  'Rascunho': '#94A3B8',
  'Aguardando Validação': '#F59E0B',
  'Validada': '#10B981',
}
const STATUS_OPTIONS = ['Rascunho', 'Aguardando Validação', 'Validada']

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function ataLabel(a: { titulo: string | null; data: string }) {
  return a.titulo?.trim() || `Ata de ${fmtDate(a.data)}`
}

function getSnippet(text: string, query: string, maxLen = 130): string {
  if (!text) return ''
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '')
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

type YearEntry   = { year: number; months: { month: number; atas: Ata[] }[] }
type ClientEntry = { cliente: string; years: YearEntry[] }
type Tree        = ClientEntry[]

function parseParticipantes(val: string): Participante[] {
  if (!val?.trim()) return []
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p } catch {}
  return val.split(/[,;]/).map(s => ({ nome: s.trim(), empresa: '' })).filter(p => p.nome)
}

function parseTopicos(val: string): Topico[] {
  if (!val?.trim()) return []
  try { const t = JSON.parse(val); if (Array.isArray(t)) return t } catch {}
  return []
}

function generateAtaHtml(ata: Ata, topicos: Topico[], partes: Participante[], forPrint = false): string {
  return renderAtaHtml(ata, topicos, partes, forPrint)
}

function printAtaPdf(ata: Ata, topicos: Topico[], partes: Participante[]) {
  const html = generateAtaHtml(ata, topicos, partes, true)
  // Imprime em um iframe isolado: o documento sai limpo (sem a interface do app),
  // sem páginas em branco e sem depender de bloqueador de pop-up.
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) { document.body.removeChild(iframe); return }
  doc.open()
  doc.write(html)
  doc.close()

  // O nome sugerido em "Salvar como PDF" vem do <title> da ABA principal, não do <title>
  // de dentro do iframe — por isso trocamos o título da página de verdade por um instante,
  // só durante a impressão, e devolvemos o original em seguida.
  const tituloOriginal = document.title
  document.title = nomeArquivoAta(ata)

  const trigger = () => {
    const win = iframe.contentWindow
    if (!win) return
    win.focus()
    win.print()
    setTimeout(() => {
      document.title = tituloOriginal
      if (iframe.parentNode) document.body.removeChild(iframe)
    }, 1500)
  }
  if (doc.readyState === 'complete') setTimeout(trigger, 150)
  else iframe.onload = () => setTimeout(trigger, 150)
}

function getConteudoText(val: string): string {
  if (!val?.trim()) return ''
  try { const t = JSON.parse(val); if (Array.isArray(t)) return (t as Topico[]).map(x => `${x.titulo} ${x.descricao}`).join(' ') } catch {}
  return val.replace(/<[^>]+>/g, ' ')
}

function buildTree(atas: Ata[]): Tree {
  const cMap = new Map<string, Map<number, Map<number, Ata[]>>>()
  for (const a of atas) {
    const c = a.cliente?.trim() || '(Sem cliente)'
    const [y, m] = a.data.split('-').map(Number)
    if (!cMap.has(c)) cMap.set(c, new Map())
    const yMap = cMap.get(c)!
    if (!yMap.has(y)) yMap.set(y, new Map())
    const mMap = yMap.get(y)!
    if (!mMap.has(m)) mMap.set(m, [])
    mMap.get(m)!.push(a)
  }
  return [...cMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([cliente, yMap]) => ({
      cliente,
      years: [...yMap.entries()]
        .sort(([a], [b]) => b - a)
        .map(([year, mMap]) => ({
          year,
          months: [...mMap.entries()]
            .sort(([a], [b]) => b - a)
            .map(([month, atas]) => ({ month, atas })),
        })),
    }))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AtasContratantesClient() {
  const { profile } = useUser()
  const router = useRouter()

  const [atas, setAtas] = useState<Ata[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Ata | null>(null)
  const [loadingAta, setLoadingAta] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingAta, setEditingAta] = useState<Ata | null>(null)
  const [copyingAta, setCopyingAta] = useState<Ata | null>(null)
  const [novaReuniaoAta, setNovaReuniaoAta] = useState<Ata | null>(null)
  const [openClientes, setOpenClientes] = useState<Set<string>>(new Set())
  const [openYears, setOpenYears] = useState<Set<string>>(new Set())
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [leituras, setLeituras] = useState<{ leram: Leitura[]; naoLeram: Leitura[] } | null>(null)
  const [leiturasOpen, setLeiturasOpen] = useState(false)
  const [leiturasLoading, setLeiturasLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Ata[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [allUsers, setAllUsers] = useState<{ id: string; nome: string }[]>([])
  const [openHistorico, setOpenHistorico] = useState<Set<string>>(new Set())
  const [statusNotifModal, setStatusNotifModal] = useState(false)
  const [statusNotifOption, setStatusNotifOption] = useState<'none' | 'all' | 'select'>('none')
  const [statusNotifSelected, setStatusNotifSelected] = useState<Set<string>>(new Set())
  const [shareOpen, setShareOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [arquivados, setArquivados] = useState<Set<string>>(new Set())
  const [showArquivados, setShowArquivados] = useState(false)
  const [clienteMenuOpen, setClienteMenuOpen] = useState<string | null>(null)

  // ── Gerar e-mail (destinatários + PDF anexado) ──
  const [emailConfigOpen, setEmailConfigOpen] = useState(false)
  const [emailDirDraft, setEmailDirDraft] = useState<DiretorioPessoa[]>([])
  const [emailAssuntoDraft, setEmailAssuntoDraft] = useState('')
  const [emailCorpoDraft, setEmailCorpoDraft] = useState('')
  const [emailCcGt3Draft, setEmailCcGt3Draft] = useState('')
  const [emailConfigLoading, setEmailConfigLoading] = useState(false)
  const [emailConfigSaving, setEmailConfigSaving] = useState(false)
  const [novaEmpresaInput, setNovaEmpresaInput] = useState('')
  // Diretório de contatos carregado de cara (não só ao abrir a config) — alimenta a
  // sugestão de nome→e-mail ao digitar um participante em qualquer ata.
  const [diretorioContatos, setDiretorioContatos] = useState<ContatoDiretorio[]>([])

  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null)
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false)
  const [emailChecked, setEmailChecked] = useState<Set<string>>(new Set())
  const [emailExtras, setEmailExtras] = useState<string[]>([])
  const [emailExtraInput, setEmailExtraInput] = useState('')
  const [emailSending, setEmailSending] = useState(false)

  const papel = profile?.papel ?? ''
  const isGestorOrAdmin = papel === 'gestor' || papel === 'admin'

  // ── Fetch list ──────────────────────────────────────────────────────────────

  const fetchAtas = useCallback(async () => {
    try {
      const res = await fetch('/api/atas-contratantes')
      if (!res.ok) return
      const data: Ata[] = await res.json()
      setAtas(data)
      // Pastas (contratante/ano/mês) começam todas fechadas — nada é pré-aberto aqui;
      // abrem só quando o próprio usuário clica (ver toggle em cada nível e selectAta).
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAtas() }, [fetchAtas])

  useEffect(() => {
    if (!isGestorOrAdmin) return
    fetch('/api/usuarios')
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; nome: string }[]) => setAllUsers(data))
      .catch(() => {})
  }, [isGestorOrAdmin])

  useEffect(() => {
    if (!isGestorOrAdmin) return
    fetch('/api/atas-contratantes/clientes')
      .then(r => r.ok ? r.json() : [])
      .then((data: string[]) => setArquivados(new Set(data)))
      .catch(() => {})
  }, [isGestorOrAdmin])

  useEffect(() => {
    fetch('/api/atas-contratantes/email-config')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.diretorio) setDiretorioContatos(d.diretorio) })
      .catch(() => {})
  }, [])

  // ── Search ──────────────────────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setSearchResults(null); return }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/atas-contratantes?q=${encodeURIComponent(value.trim())}`)
        if (res.ok) setSearchResults(await res.json())
      } finally {
        setSearchLoading(false)
      }
    }, 320)
  }

  function clearSearch() {
    setSearchQuery('')
    setSearchResults(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  // ── Select & fetch detail ───────────────────────────────────────────────────

  async function selectAta(id: string) {
    if (selectedId === id) return
    setSelectedId(id)
    setSelected(null)
    setLeituras(null)
    setLeiturasOpen(false)
    setOpenHistorico(new Set())
    setLoadingAta(true)
    try {
      const res = await fetch(`/api/atas-contratantes/${id}`)
      if (!res.ok) return
      const ata: Ata = await res.json()
      setSelected(ata)
      const c = ata.cliente?.trim() || '(Sem cliente)'
      const [y, m] = ata.data.split('-').map(Number)
      setOpenClientes(prev => new Set([...prev, c]))
      setOpenYears(prev => new Set([...prev, `${c}|${y}`]))
      setOpenMonths(prev => new Set([...prev, `${c}|${y}-${m}`]))
    } finally {
      setLoadingAta(false)
    }
  }

  // ── Leituras panel ──────────────────────────────────────────────────────────

  const fetchLeituras = useCallback(async (ataId: string) => {
    setLeiturasLoading(true)
    try {
      const res = await fetch(`/api/atas-contratantes/${ataId}/leituras`)
      if (!res.ok) return
      setLeituras(await res.json())
    } finally {
      setLeiturasLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selected || !isGestorOrAdmin || selected.status !== 'Validada') return
    const supabase = createClient()
    const ch = supabase
      .channel(`atas-contratantes-leituras-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'atas_contratantes_leituras' }, () => {
        fetchLeituras(selected.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selected, isGestorOrAdmin, fetchLeituras])

  function toggleLeituras() {
    if (!selected) return
    if (!leiturasOpen && !leituras) fetchLeituras(selected.id)
    setLeiturasOpen(v => !v)
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  function toPayload(form: AtaEditorData) {
    return {
      titulo: form.titulo,
      data: form.data,
      status: form.status,
      conteudo: form.conteudo,
      cliente: form.cliente,
      local_reuniao: form.localReuniao,
      numero_ata: form.numeroAta,
      participantes: form.participantes,
    }
  }

  async function sendNotifications(ataId: string, userIds: string[]) {
    if (!userIds.length) return
    await fetch(`/api/atas-contratantes/${ataId}/notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds }),
    }).catch(() => {})
  }

  async function handleCreate(form: AtaEditorData) {
    const res = await fetch('/api/atas-contratantes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(form)),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
    const nova: Ata = await res.json()
    if (form.notifyUserIds?.length) await sendNotifications(nova.id, form.notifyUserIds)
    setAtas(prev => [nova, ...prev])
    setShowEditor(false)
    selectAta(nova.id)
  }

  async function handleEdit(form: AtaEditorData) {
    if (!editingAta) return
    const res = await fetch(`/api/atas-contratantes/${editingAta.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(form)),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
    const updated: Ata = await res.json()
    if (form.notifyUserIds?.length) await sendNotifications(updated.id, form.notifyUserIds)
    setAtas(prev => prev.map(a => a.id === updated.id ? updated : a))
    setSelected(updated)
    setEditingAta(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta ata?')) return
    const res = await fetch(`/api/atas-contratantes/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setAtas(prev => prev.filter(a => a.id !== id))
    if (selectedId === id) { setSelectedId(null); setSelected(null) }
    router.replace('/atas-contratantes')
  }

  // ── Contratante: arquivar / excluir ────────────────────────────────────────

  async function toggleArquivarCliente(cliente: string, arquivar: boolean) {
    setClienteMenuOpen(null)
    const res = await fetch('/api/atas-contratantes/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente, arquivado: arquivar }),
    })
    if (!res.ok) return
    setArquivados(prev => {
      const s = new Set(prev)
      arquivar ? s.add(cliente) : s.delete(cliente)
      return s
    })
  }

  async function handleDeleteCliente(cliente: string, count: number) {
    setClienteMenuOpen(null)
    if (!confirm(`Excluir a contratante "${cliente}" e ${count === 1 ? 'a única ata dela' : `todas as ${count} atas dela`}? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/atas-contratantes/clientes/${encodeURIComponent(cliente)}`, { method: 'DELETE' })
    if (!res.ok) return
    setAtas(prev => prev.filter(a => (a.cliente?.trim() || '(Sem cliente)') !== cliente))
    setArquivados(prev => { const s = new Set(prev); s.delete(cliente); return s })
    if (selected && (selected.cliente?.trim() || '(Sem cliente)') === cliente) {
      setSelectedId(null); setSelected(null)
      router.replace('/atas-contratantes')
    }
  }

  async function applyStatusChange(newStatus: string, notifyUserIds?: string[]) {
    if (!selected) return
    const res = await fetch(`/api/atas-contratantes/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) return
    const updated: Ata = await res.json()
    setAtas(prev => prev.map(a => a.id === updated.id ? updated : a))
    setSelected(updated)
    if (notifyUserIds?.length) await sendNotifications(updated.id, notifyUserIds)
  }

  async function handleStatusChange(newStatus: string) {
    if (!selected) return
    if (newStatus === 'Validada') {
      setStatusNotifOption('none')
      setStatusNotifSelected(new Set())
      setStatusNotifModal(true)
      return
    }
    await applyStatusChange(newStatus)
  }

  async function handleStatusNotifConfirm() {
    setStatusNotifModal(false)
    let notifyUserIds: string[] | undefined
    if (statusNotifOption === 'all') notifyUserIds = allUsers.map(u => u.id)
    else if (statusNotifOption === 'select') notifyUserIds = [...statusNotifSelected]
    await applyStatusChange('Validada', notifyUserIds)
  }

  // ── Compartilhamento via link público ────────────────────────────────────────
  async function enableShare(rotate = false) {
    if (!selected) return
    setShareBusy(true)
    try {
      const res = await fetch(`/api/atas-contratantes/${selected.id}/compartilhar${rotate ? '?rotate=1' : ''}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { alert(json.error || 'Erro ao gerar o link'); return }
      setSelected({ ...selected, share_token: json.token, share_enabled: true })
      setShareCopied(false)
    } finally { setShareBusy(false) }
  }

  async function disableShare() {
    if (!selected) return
    setShareBusy(true)
    try {
      const res = await fetch(`/api/atas-contratantes/${selected.id}/compartilhar`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { alert(json.error || 'Erro ao desativar'); return }
      setSelected({ ...selected, share_enabled: false })
      setShareCopied(false)
    } finally { setShareBusy(false) }
  }

  async function copyShareLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch { /* navegador sem clipboard: o usuário copia manualmente */ }
  }

  // ── Gerar e-mail: configurações (diretório + modelo) ──────────────────────────

  function participantesConhecidos(): { nome: string; empresa: string }[] {
    const porNome = new Map<string, string>()
    for (const a of atas) {
      for (const p of parseParticipantes(a.participantes ?? '')) {
        if (!p.nome?.trim()) continue
        if (!porNome.has(p.nome.trim())) porNome.set(p.nome.trim(), p.empresa?.trim() ?? '')
      }
    }
    return [...porNome.entries()]
      .map(([nome, empresa]) => ({ nome, empresa }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  async function openEmailConfig() {
    setEmailConfigOpen(true)
    setEmailConfigLoading(true)
    try {
      const res = await fetch('/api/atas-contratantes/email-config')
      if (res.ok) {
        const d = await res.json()
        setEmailDirDraft(d.diretorio ?? [])
        setEmailAssuntoDraft(d.assunto ?? '')
        setEmailCorpoDraft(d.corpo ?? '')
        setEmailCcGt3Draft(d.ccGt3 ?? '')
      }
    } finally {
      setEmailConfigLoading(false)
    }
  }

  function adicionarPessoasSemEmail() {
    const jaTem = new Set(emailDirDraft.map(d => d.nome.trim().toLowerCase()))
    const novos = participantesConhecidos().filter(p => !jaTem.has(p.nome.toLowerCase()))
    setEmailDirDraft(prev => [...prev, ...novos.map(({ nome, empresa }) => ({ nome, empresa, email: '' }))])
  }

  function adicionarEmpresaGrupo() {
    const empresa = novaEmpresaInput.trim()
    if (!empresa) return
    setEmailDirDraft(prev => [...prev, { nome: '', empresa, email: '' }])
    setNovaEmpresaInput('')
  }

  async function salvarEmailConfig() {
    setEmailConfigSaving(true)
    try {
      const diretorio = emailDirDraft.map(d => ({ nome: d.nome.trim(), empresa: d.empresa.trim(), email: d.email.trim() })).filter(d => d.nome && d.email)
      const res = await fetch('/api/atas-contratantes/email-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diretorio, assunto: emailAssuntoDraft, corpo: emailCorpoDraft, ccGt3: emailCcGt3Draft }),
      })
      if (!res.ok) { alert('Erro ao salvar'); return }
      setDiretorioContatos(diretorio)
      setEmailConfigOpen(false)
    } finally {
      setEmailConfigSaving(false)
    }
  }

  // ── Gerar e-mail: por ata (destinatários + PDF anexado) ───────────────────────

  async function openEmailModal() {
    if (!selected) return
    setEmailModalOpen(true)
    setEmailPreview(null)
    setEmailExtras([])
    setEmailExtraInput('')
    setEmailPreviewLoading(true)
    try {
      const res = await fetch(`/api/atas-contratantes/${selected.id}/email-preview`)
      if (!res.ok) { alert('Erro ao preparar o e-mail'); setEmailModalOpen(false); return }
      const data: EmailPreview = await res.json()
      setEmailPreview(data)
      setEmailChecked(new Set(data.resolvidos.map(r => r.email)))
    } finally {
      setEmailPreviewLoading(false)
    }
  }

  function adicionarEmailExtra() {
    const email = emailExtraInput.trim()
    if (!email) return
    if (!emailExtras.includes(email)) setEmailExtras(prev => [...prev, email])
    setEmailExtraInput('')
  }

  async function baixarEmailAta() {
    if (!selected || !emailPreview) return
    const destinatarios = [
      ...emailPreview.resolvidos.filter(r => emailChecked.has(r.email)).map(r => r.email),
      ...emailExtras,
    ]
    setEmailSending(true)
    try {
      const res = await fetch(`/api/atas-contratantes/${selected.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinatarios }),
      })
      if (!res.ok) { alert('Erro ao gerar o e-mail'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url
      el.download = `${nomeArquivoAta(selected)}.eml`
      el.click()
      URL.revokeObjectURL(url)
      setEmailModalOpen(false)
    } finally {
      setEmailSending(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const tree = buildTree(atas)
  const arquivadasCount = tree.filter(c => arquivados.has(c.cliente)).length
  const visibleTree = showArquivados ? tree : tree.filter(c => !arquivados.has(c.cliente))
  const isSearchActive = searchQuery.trim().length > 0
  const partsList = selected ? parseParticipantes(selected.participantes ?? '') : []
  const topicosList = selected ? parseTopicos(selected.conteudo ?? '') : []
  const isLegacyContent = topicosList.length === 0 && !!selected?.conteudo?.trim()
  const topicosAtivos = topicosList.filter(t => !t.finalizado)
  const topicosFinalizados = topicosList.filter(t => t.finalizado)

  /** Card de um tópico na tela de consulta — só leitura (histórico incluso). Usado tanto
   *  para os tópicos ativos quanto para a seção "Tópicos finalizados nesta reunião". */
  function renderTopicoCard(t: Topico, idx: number) {
    const cor = t.cor ?? '#2A4F96'
    const hist: TopicoHistorico[] = t.historico ?? []
    const histOpen = openHistorico.has(t.id)
    return (
      <div key={t.id || idx} style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid rgba(42,79,150,0.10)', borderLeft: `3px solid ${cor}` }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: cor, marginBottom: (t.andamentoGeral || t.descricao) ? 6 : 0 }}>
          {idx + 1}. {t.titulo || '(Sem título)'}
        </div>
        {t.andamentoGeral && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>Até aqui:</div>
            <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: t.andamentoGeral }} />
          </div>
        )}
        {t.descricao && (
          <div style={{ marginBottom: (t.contratante || t.prazo || t.responsavel || hist.length > 0) ? 10 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: cor, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>
              Na data desta reunião{selected?.data ? ` (${new Date(selected.data + 'T12:00').toLocaleDateString('pt-BR')})` : ''}, definiu-se:
            </div>
            <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: t.descricao }} />
          </div>
        )}
        {(t.contratante || t.prazo || t.responsavel || t.status) && (
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#6B7A99', paddingTop: 8, borderTop: '1px solid rgba(42,79,150,0.08)', flexWrap: 'wrap' as const, marginBottom: hist.length > 0 ? 10 : 0, alignItems: 'center' }}>
            {t.contratante && <span><span style={{ color: '#94A3B8' }}>Contratante:</span> {t.contratante}</span>}
            {t.prazo && <span><span style={{ color: '#94A3B8' }}>Prazo:</span> {new Date(t.prazo + 'T12:00').toLocaleDateString('pt-BR')}</span>}
            {t.responsavel && <span><span style={{ color: '#94A3B8' }}>Responsável:</span> {t.responsavel}</span>}
            {t.status && <StatusBadge status={t.status} />}
          </div>
        )}

        {hist.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(42,79,150,0.08)', paddingTop: 8 }}>
            <button
              onClick={() => setOpenHistorico(prev => { const s = new Set(prev); s.has(t.id) ? s.delete(t.id) : s.add(t.id); return s })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, border: `1px solid ${cor}33`, background: histOpen ? `${cor}14` : '#fff', color: cor, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              {histOpen ? '▼' : '▶'} Histórico ({hist.length})
            </button>
            {histOpen && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hist.map((h, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: '#F0F4FF', borderRadius: 8, borderLeft: `2px solid ${cor}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: cor, marginBottom: 3 }}>
                      {new Date(h.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: h.texto }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const rowStyle = (id: string): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '6px 16px 6px 40px',
    border: 'none', background: selectedId === id ? '#EBF0FB' : 'none',
    cursor: 'pointer', fontSize: 12, color: selectedId === id ? '#2A4F96' : '#334155',
    borderLeft: selectedId === id ? '3px solid #5B8DEF' : '3px solid transparent',
  })

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: 0 }}>

      {/* ── Tree / Search Sidebar ── */}
      <div style={{
        width: 300, flexShrink: 0, background: '#fff', borderRadius: 12,
        border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', marginRight: 20,
      }}>
        {/* Header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F0F4FA', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1A2340' }}>Atas Contratantes</span>
            {isGestorOrAdmin && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={openEmailConfig}
                  title="Configurar diretório de e-mails e modelo do 'Gerar e-mail'"
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #CBD5E0', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }}
                >
                  ⚙
                </button>
                <button
                  onClick={() => setShowEditor(true)}
                  style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#5B8DEF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  + Nova
                </button>
              </div>
            )}
          </div>
          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Buscar nas atas…"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              style={{
                width: '100%', padding: '7px 32px 7px 10px', border: '1px solid #CBD5E0',
                borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none',
                backgroundColor: '#F8FAFC',
              }}
            />
            {isSearchActive && (
              <button
                onClick={clearSearch}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
                  color: '#94A3B8', lineHeight: 1, padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
          {isGestorOrAdmin && arquivadasCount > 0 && (
            <button
              onClick={() => setShowArquivados(v => !v)}
              style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6B7A99', padding: 0, fontWeight: 600 }}
            >
              {showArquivados ? '▼' : '▶'} 🗄 Contratantes arquivadas ({arquivadasCount})
            </button>
          )}
        </div>

        {/* List body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

          {/* ── Search results ── */}
          {isSearchActive && (
            <>
              {searchLoading && <p style={{ padding: '12px 16px', fontSize: 13, color: '#94A3B8' }}>Buscando…</p>}
              {!searchLoading && searchResults && searchResults.length === 0 && (
                <p style={{ padding: '12px 16px', fontSize: 13, color: '#94A3B8' }}>Nenhum resultado.</p>
              )}
              {!searchLoading && searchResults && searchResults.map(a => (
                <button
                  key={a.id}
                  onClick={() => { selectAta(a.id); router.replace(`/atas-contratantes?ata=${a.id}`) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    border: 'none', borderBottom: '1px solid #F0F4FA',
                    background: selectedId === a.id ? '#EBF0FB' : 'none',
                    cursor: 'pointer', display: 'block',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: selectedId === a.id ? '#2A4F96' : '#1A2340', marginBottom: 2 }}>
                    {ataLabel(a)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#6B7A99' }}>{fmtDate(a.data)}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLORS[a.status] }}>{a.status}</span>
                  </div>
                  {a.conteudo && (
                    <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>
                      {getSnippet(getConteudoText(a.conteudo), searchQuery)}
                    </div>
                  )}
                </button>
              ))}
            </>
          )}

          {/* ── Tree ── */}
          {!isSearchActive && (
            <>
              {loading && <p style={{ padding: 16, fontSize: 13, color: '#94A3B8' }}>Carregando…</p>}
              {!loading && atas.length === 0 && <p style={{ padding: 16, fontSize: 13, color: '#94A3B8' }}>Nenhuma ata.</p>}
              {visibleTree.map(({ cliente, years }) => {
                const totalAtasCliente = years.reduce((acc, y) => acc + y.months.reduce((a2, m) => a2 + m.atas.length, 0), 0)
                const isArquivada = arquivados.has(cliente)
                const canManageCliente = isGestorOrAdmin && cliente !== '(Sem cliente)'
                return (
                <div key={cliente}>
                  {/* ── Cliente folder ── */}
                  <div style={{ display: 'flex', alignItems: 'center', background: openClientes.has(cliente) ? '#F0F4FA' : 'none', borderBottom: '1px solid #F0F4FA', opacity: isArquivada ? 0.65 : 1 }}>
                    <button
                      onClick={() => {
                        const jaAberta = openClientes.has(cliente)
                        setOpenClientes(prev => { const s = new Set(prev); jaAberta ? s.delete(cliente) : s.add(cliente); return s })
                        // Ao abrir a pasta (não ao fechar), já mostra a última ata da contratante
                        // à direita — economiza os cliques de também abrir ano → mês → ata.
                        const ultima = years[0]?.months[0]?.atas[0]
                        if (!jaAberta && ultima) {
                          selectAta(ultima.id)
                          router.replace(`/atas-contratantes?ata=${ultima.id}`)
                        }
                      }}
                      style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '7px 8px 7px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#1A2340', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span style={{ fontSize: 9 }}>{openClientes.has(cliente) ? '▼' : '▶'}</span>
                      <span style={{ fontSize: 14, marginRight: 4 }}>{isArquivada ? '🗄' : '📁'}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400, flexShrink: 0 }}>
                        {totalAtasCliente}
                      </span>
                    </button>
                    {canManageCliente && (
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          onClick={() => setClienteMenuOpen(prev => prev === cliente ? null : cliente)}
                          title="Opções da contratante"
                          style={{ width: 26, height: 26, marginRight: 8, border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 14, borderRadius: 6 }}
                        >
                          ⋮
                        </button>
                        {clienteMenuOpen === cliente && (
                          <>
                            <div onClick={() => setClienteMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                            <div style={{ position: 'absolute', right: 8, top: '100%', zIndex: 31, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 8px 20px rgba(15,23,42,0.14)', minWidth: 190, overflow: 'hidden' }}>
                              <button
                                onClick={() => toggleArquivarCliente(cliente, !isArquivada)}
                                style={{ width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 12.5, color: '#334155' }}
                              >
                                {isArquivada ? '↩ Desarquivar' : '🗄 Arquivar'}
                              </button>
                              <button
                                onClick={() => handleDeleteCliente(cliente, totalAtasCliente)}
                                style={{ width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', borderTop: '1px solid #F0F4FA', background: '#fff', cursor: 'pointer', fontSize: 12.5, color: '#EF4444' }}
                              >
                                🗑 Excluir contratante
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {openClientes.has(cliente) && years.map(({ year, months }) => (
                    <div key={year}>
                      {/* ── Ano ── */}
                      <button
                        onClick={() => setOpenYears(prev => { const k = `${cliente}|${year}`; const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s })}
                        style={{ width: '100%', textAlign: 'left', padding: '5px 16px 5px 30px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#2A4F96', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span style={{ fontSize: 9 }}>{openYears.has(`${cliente}|${year}`) ? '▼' : '▶'}</span>
                        {year}
                      </button>
                      {openYears.has(`${cliente}|${year}`) && months.map(({ month, atas: mAtas }) => (
                        <div key={month}>
                          {/* ── Mês ── */}
                          <button
                            onClick={() => setOpenMonths(prev => { const k = `${cliente}|${year}-${month}`; const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s })}
                            style={{ width: '100%', textAlign: 'left', padding: '4px 16px 4px 44px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#5B8DEF', display: 'flex', alignItems: 'center', gap: 5 }}
                          >
                            <span style={{ fontSize: 9 }}>{openMonths.has(`${cliente}|${year}-${month}`) ? '▼' : '▶'}</span>
                            {MESES[month - 1]}
                            <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400 }}>({mAtas.length})</span>
                          </button>
                          {openMonths.has(`${cliente}|${year}-${month}`) && mAtas.map(a => (
                            <button
                              key={a.id}
                              onClick={() => { selectAta(a.id); router.replace(`/atas-contratantes?ata=${a.id}`) }}
                              style={{ ...rowStyle(a.id), padding: '6px 16px 6px 56px' }}
                            >
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ataLabel(a)}</div>
                              <div style={{ fontSize: 10, color: STATUS_COLORS[a.status], marginTop: 1 }}>{a.status}</div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )})}
            </>
          )}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected && !loadingAta && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>
            Selecione uma ata na lista
          </div>
        )}
        {loadingAta && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>
            Carregando…
          </div>
        )}
        {selected && !loadingAta && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #F0F4FA', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 20, color: '#1A2340', fontWeight: 700 }}>{ataLabel(selected)}</h2>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: '#6B7A99' }}>{fmtDate(selected.data)}</span>
                    {selected.numero_ata && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: '#D1AE6E', color: '#fff' }}>{selected.numero_ata}</span>}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, backgroundColor: `${STATUS_COLORS[selected.status]}22`, color: STATUS_COLORS[selected.status] }}>
                      {selected.status}
                    </span>
                    {selected.autor && <span style={{ fontSize: 12, color: '#94A3B8' }}>por {selected.autor.nome}</span>}
                  </div>
                  {(selected.cliente || selected.local_reuniao || partsList.length > 0) && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                      {selected.cliente && <span style={{ fontSize: 12, color: '#334155' }}><span style={{ color: '#94A3B8' }}>Contratante:</span> {selected.cliente}</span>}
                      {selected.local_reuniao && <span style={{ fontSize: 12, color: '#334155' }}><span style={{ color: '#94A3B8' }}>Local:</span> {selected.local_reuniao}</span>}
                      {partsList.length > 0 && (
                        <span style={{ fontSize: 12, color: '#334155' }}>
                          <span style={{ color: '#94A3B8' }}>Participantes:</span>{' '}
                          {partsList.map(p => p.empresa ? `${p.nome} (${p.empresa})` : p.nome).join(' · ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => printAtaPdf(selected, parseTopicos(selected.conteudo ?? ''), partsList)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #CBD5E0', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }} title="Gerar PDF (use 'Salvar como PDF' na impressão). Em 'Mais configurações', desmarque 'Cabeçalhos e rodapés' para o PDF sair sem o link do sistema.">
                    🖨 PDF
                  </button>
                  {isGestorOrAdmin && (
                    <>
                      <button
                        onClick={openEmailModal}
                        style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #CBD5E0', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }}
                        title="Gerar e-mail com a ata em PDF anexada, já com os participantes cadastrados como destinatários"
                      >
                        ✉ E-mail
                      </button>
                      <button
                        onClick={() => { setShareCopied(false); setShareOpen(true) }}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${selected.share_enabled ? '#10B981' : '#CBD5E0'}`, background: selected.share_enabled ? '#ECFDF5' : '#fff', color: selected.share_enabled ? '#047857' : '#5a6178', fontSize: 13, cursor: 'pointer' }}
                        title="Gerar link para enviar ao cliente"
                      >
                        🔗 Link{selected.share_enabled ? ' ativo' : ''}
                      </button>
                      <select
                        value={selected.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 12, cursor: 'pointer', color: '#334155' }}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button
                        onClick={() => setCopyingAta(selected)}
                        style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #10B981', background: '#fff', color: '#10B981', fontSize: 13, cursor: 'pointer' }}
                        title="Criar nova ata a partir desta (sem tópicos finalizados)"
                      >
                        ⊕ Nova a partir desta
                      </button>
                      <button onClick={() => setNovaReuniaoAta(selected)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #10B981', background: '#fff', color: '#10B981', fontSize: 13, cursor: 'pointer' }}>
                        Nova reunião
                      </button>
                      <button onClick={() => { setEditingAta(selected) }} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #5B8DEF', background: '#fff', color: '#5B8DEF', fontSize: 13, cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button onClick={() => handleDelete(selected.id)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #EF4444', background: '#fff', color: '#EF4444', fontSize: 13, cursor: 'pointer' }}>
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', background: '#F0F3F9' }}>
              <div style={{ maxWidth: 880, margin: '0 auto', background: '#fff', borderRadius: 14, border: '1px solid rgba(42,79,150,0.10)', boxShadow: '0 4px 20px rgba(42,79,150,0.08)', overflow: 'hidden' }}>
                <div style={{ height: 4, background: 'linear-gradient(90deg, #2A4F96, #5B8DEF)' }} />
                <div style={{ padding: '32px 40px' }}>

                  {/* Participantes */}
                  {partsList.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(42,79,150,0.10)' }}>
                        Participantes
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                        {partsList.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid rgba(42,79,150,0.10)' }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#EEF2FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#2A4F96', flexShrink: 0 }}>
                              {p.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e' }}>{p.nome}</div>
                              {p.empresa && <div style={{ fontSize: 11, color: '#6B7A99' }}>{p.empresa}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tópicos — somente leitura aqui; finalizar um tópico é feito editando a
                      ata (botão "Editar"), não a partir desta tela de consulta. */}
                  {topicosList.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#2A4F96', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(42,79,150,0.10)' }}>
                        Pontos discutidos
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                        {topicosAtivos.map((t, idx) => renderTopicoCard(t, idx))}
                      </div>

                      {topicosFinalizados.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#10B981', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(16,185,129,0.20)' }}>
                            ✓ Tópicos finalizados nesta reunião
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                            {topicosFinalizados.map((t, idx) => renderTopicoCard(t, idx))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isLegacyContent ? (
                    <div dangerouslySetInnerHTML={{ __html: selected.conteudo }} style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.65 }} />
                  ) : (
                    <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>Sem conteúdo registrado.</p>
                  )}

                </div>
              </div>
            </div>

            {isGestorOrAdmin && selected.status === 'Validada' && (
              <div style={{ borderTop: '1px solid #F0F4FA', flexShrink: 0 }}>
                <button
                  onClick={toggleLeituras}
                  style={{ width: '100%', padding: '12px 28px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#5B8DEF', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span>{leiturasOpen ? '▼' : '▶'}</span>
                  👁 Leituras
                  {leituras && (
                    <span style={{ fontWeight: 400, color: '#6B7A99' }}>
                      — {leituras.leram.length} leram · {leituras.naoLeram.length} pendentes
                    </span>
                  )}
                  {leiturasLoading && <span style={{ color: '#94A3B8', fontWeight: 400 }}> carregando…</span>}
                </button>

                {leiturasOpen && leituras && (
                  <div style={{ padding: '0 28px 20px', display: 'flex', gap: 32 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 8, marginTop: 0 }}>Leram ({leituras.leram.length})</p>
                      {leituras.leram.length === 0
                        ? <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Ninguém ainda.</p>
                        : leituras.leram.map(l => (
                          <div key={l.user_id} style={{ fontSize: 13, color: '#334155', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{l.nome}</span>
                            {l.lido_em && <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(l.lido_em).toLocaleString('pt-BR')}</span>}
                          </div>
                        ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', marginBottom: 8, marginTop: 0 }}>Ainda não leram ({leituras.naoLeram.length})</p>
                      {leituras.naoLeram.length === 0
                        ? <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Todos leram!</p>
                        : leituras.naoLeram.map(l => (
                          <div key={l.user_id} style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>{l.nome}</div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showEditor && (
        <AtasEditor
          onSave={handleCreate}
          onClose={() => setShowEditor(false)}
          enableNotifModal
          availableUsers={allUsers}
          diretorioContatos={diretorioContatos}
        />
      )}
      {editingAta && (
        <AtasEditor
          initial={{
            titulo: editingAta.titulo ?? '',
            data: editingAta.data,
            status: editingAta.status,
            conteudo: editingAta.conteudo,
            cliente: editingAta.cliente ?? '',
            localReuniao: editingAta.local_reuniao ?? '',
            numeroAta: editingAta.numero_ata ?? '',
            participantes: editingAta.participantes ?? '',
          }}
          onSave={handleEdit}
          onClose={() => setEditingAta(null)}
          enableNotifModal
          availableUsers={allUsers}
          diretorioContatos={diretorioContatos}
        />
      )}
      {copyingAta && (
        <AtasEditor
          initial={{
            titulo: copyingAta.titulo ? `${copyingAta.titulo} (cópia)` : '',
            data: new Date().toISOString().slice(0, 10),
            status: 'Rascunho',
            conteudo: JSON.stringify(parseTopicos(copyingAta.conteudo ?? '').filter(t => !t.finalizado)),
            cliente: copyingAta.cliente ?? '',
            localReuniao: copyingAta.local_reuniao ?? '',
            numeroAta: '',
            participantes: copyingAta.participantes ?? '',
          }}
          onSave={async (form) => { await handleCreate(form); setCopyingAta(null) }}
          onClose={() => setCopyingAta(null)}
          diretorioContatos={diretorioContatos}
        />
      )}
      {novaReuniaoAta && (
        <AtasEditor
          initial={{
            titulo: novaReuniaoAta.titulo ?? '',
            data: new Date().toISOString().slice(0, 10),
            status: 'Rascunho',
            conteudo: JSON.stringify(
              parseTopicos(novaReuniaoAta.conteudo ?? '')
                .filter(t => !t.finalizado)
                .map(t => ({
                  ...t,
                  historico: t.descricao?.trim()
                    ? [{ data: novaReuniaoAta.data, texto: t.descricao }, ...(t.historico ?? [])]
                    : (t.historico ?? []),
                  descricao: '',
                }))
            ),
            cliente: novaReuniaoAta.cliente ?? '',
            localReuniao: novaReuniaoAta.local_reuniao ?? '',
            numeroAta: '',
            participantes: novaReuniaoAta.participantes ?? '',
          }}
          onSave={async (form) => { await handleCreate(form); setNovaReuniaoAta(null) }}
          onClose={() => setNovaReuniaoAta(null)}
          enableNotifModal
          availableUsers={allUsers}
          diretorioContatos={diretorioContatos}
        />
      )}

      {/* ── Modal: notificação ao validar (via dropdown de status) ── */}
      {statusNotifModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 440, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1f2e', marginBottom: 6 }}>Validar ata</div>
            <p style={{ fontSize: 13, color: '#5a6178', marginBottom: 20 }}>Deseja notificar usuários sobre esta ata validada?</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {([['none', 'Não notificar ninguém'], ['all', 'Notificar toda a equipe'], ['select', 'Escolher usuários']] as const).map(([val, label]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1px solid ${statusNotifOption === val ? '#2A4F96' : 'rgba(42,79,150,0.18)'}`, background: statusNotifOption === val ? '#EEF2FB' : '#fff', cursor: 'pointer' }}>
                  <input type="radio" name="statusNotif" value={val} checked={statusNotifOption === val} onChange={() => setStatusNotifOption(val)} style={{ accentColor: '#2A4F96' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1f2e' }}>{label}</span>
                </label>
              ))}
            </div>

            {statusNotifOption === 'select' && allUsers.length > 0 && (
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid rgba(42,79,150,0.15)', borderRadius: 8, marginBottom: 20 }}>
                {allUsers.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(42,79,150,0.07)' }}>
                    <input type="checkbox" checked={statusNotifSelected.has(u.id)} onChange={() => setStatusNotifSelected(prev => { const s = new Set(prev); s.has(u.id) ? s.delete(u.id) : s.add(u.id); return s })} style={{ accentColor: '#2A4F96' }} />
                    <span style={{ fontSize: 13, color: '#1a1f2e' }}>{u.nome}</span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setStatusNotifModal(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(42,79,150,0.20)', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleStatusNotifConfirm} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Validar</button>
            </div>
          </div>
        </div>
      )}

      {shareOpen && selected && (() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        const url = selected.share_enabled && selected.share_token ? `${origin}/ata/${selected.share_token}` : ''
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShareOpen(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 520, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1f2e', marginBottom: 6 }}>🔗 Compartilhar ata por link</div>
              <p style={{ fontSize: 13, color: '#5a6178', marginBottom: 20, lineHeight: 1.55 }}>
                O cliente abre o link no navegador e vê a ata formatada (somente leitura), sem precisar de login.
                <strong> Qualquer pessoa com o link consegue ver esta ata</strong> — envie apenas a quem deve ter acesso.
              </p>

              {url ? (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input
                      readOnly
                      value={url}
                      onFocus={e => e.target.select()}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13, color: '#334155', background: '#F8FAFC' }}
                    />
                    <button onClick={() => copyShareLink(url)} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: shareCopied ? '#10B981' : '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {shareCopied ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 22 }}>
                    <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2A4F96', textDecoration: 'none' }}>↗ Abrir para conferir</a>
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F0F4FA', paddingTop: 18 }}>
                    <button
                      disabled={shareBusy}
                      onClick={() => { if (confirm('Gerar um link novo invalida o link atual. O que você já enviou deixará de funcionar. Continuar?')) enableShare(true) }}
                      style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E0', background: '#fff', color: '#5a6178', fontSize: 12.5, cursor: shareBusy ? 'default' : 'pointer' }}
                    >
                      ↻ Gerar link novo
                    </button>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        disabled={shareBusy}
                        onClick={disableShare}
                        style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #EF4444', background: '#fff', color: '#EF4444', fontSize: 13, cursor: shareBusy ? 'default' : 'pointer' }}
                      >
                        Desativar link
                      </button>
                      <button onClick={() => setShareOpen(false)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShareOpen(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(42,79,150,0.20)', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button
                    disabled={shareBusy}
                    onClick={() => enableShare(false)}
                    style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: shareBusy ? 'default' : 'pointer' }}
                  >
                    {shareBusy ? 'Gerando…' : 'Gerar link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Modal: configurações do "Gerar e-mail" (diretório + modelo) ── */}
      {emailConfigOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEmailConfigOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 560, maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1f2e', marginBottom: 6 }}>⚙ Configurar &quot;Gerar e-mail&quot;</div>
            <p style={{ fontSize: 13, color: '#5a6178', marginBottom: 20, lineHeight: 1.5 }}>
              Cadastre o e-mail de cada pessoa (o nome precisa bater com o nome usado nos participantes da ata), organizado por empresa —
              use a extensão do e-mail (@empresa.com.br) pra saber de qual contratante é cada pessoa. Ao digitar um nome numa ata, quem já
              está aqui aparece como sugestão automaticamente.
            </p>

            {emailConfigLoading ? (
              <p style={{ fontSize: 13, color: '#94A3B8' }}>Carregando…</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1f2e' }}>Diretório de pessoas, por empresa</label>
                  <button onClick={adicionarPessoasSemEmail} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #CBD5E0', background: '#fff', color: '#5B8DEF', fontSize: 11.5, cursor: 'pointer' }}>
                    + Adicionar participantes já cadastrados
                  </button>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid rgba(42,79,150,0.15)', borderRadius: 8, marginBottom: 8, padding: emailDirDraft.length ? '8px 10px' : 0 }}>
                  {emailDirDraft.length === 0 && (
                    <p style={{ fontSize: 12.5, color: '#94A3B8', padding: '14px', margin: 0 }}>Nenhuma pessoa cadastrada ainda.</p>
                  )}
                  {(() => {
                    const porEmpresa = new Map<string, { d: DiretorioPessoa; i: number }[]>()
                    emailDirDraft.forEach((d, i) => {
                      const chave = d.empresa.trim() || 'Sem empresa'
                      if (!porEmpresa.has(chave)) porEmpresa.set(chave, [])
                      porEmpresa.get(chave)!.push({ d, i })
                    })
                    const empresasOrdenadas = [...porEmpresa.keys()].sort((a, b) => {
                      if (a === 'Sem empresa') return 1
                      if (b === 'Sem empresa') return -1
                      return a.localeCompare(b, 'pt-BR')
                    })
                    return empresasOrdenadas.map(empresa => (
                      <div key={empresa} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, padding: '0 2px' }}>
                          {empresa}
                        </div>
                        {porEmpresa.get(empresa)!.map(({ d, i }) => (
                          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0' }}>
                            <input
                              value={d.nome}
                              onChange={e => setEmailDirDraft(prev => prev.map((p, idx) => idx === i ? { ...p, nome: e.target.value } : p))}
                              placeholder="Nome"
                              style={{ flex: '1 1 0', minWidth: 0, padding: '5px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12.5 }}
                            />
                            <input
                              value={d.empresa}
                              onChange={e => setEmailDirDraft(prev => prev.map((p, idx) => idx === i ? { ...p, empresa: e.target.value } : p))}
                              placeholder="Empresa"
                              style={{ flex: '0 1 120px', minWidth: 0, padding: '5px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12.5 }}
                            />
                            <input
                              value={d.email}
                              onChange={e => setEmailDirDraft(prev => prev.map((p, idx) => idx === i ? { ...p, email: e.target.value } : p))}
                              placeholder="e-mail@exemplo.com"
                              style={{ flex: '1 1 0', minWidth: 0, padding: '5px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12.5 }}
                            />
                            <button onClick={() => setEmailDirDraft(prev => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 4px' }}>×</button>
                          </div>
                        ))}
                      </div>
                    ))
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setEmailDirDraft(prev => [...prev, { nome: '', empresa: '', email: '' }])}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #CBD5E0', background: '#fff', color: '#5a6178', fontSize: 11.5, cursor: 'pointer' }}
                  >
                    + Adicionar linha
                  </button>
                  <input
                    value={novaEmpresaInput}
                    onChange={e => setNovaEmpresaInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarEmpresaGrupo() } }}
                    placeholder="Nova empresa…"
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #CBD5E0', fontSize: 11.5, width: 140 }}
                  />
                  <button
                    onClick={adicionarEmpresaGrupo}
                    disabled={!novaEmpresaInput.trim()}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #CBD5E0', background: '#fff', color: novaEmpresaInput.trim() ? '#5B8DEF' : '#CBD5E0', fontSize: 11.5, cursor: novaEmpresaInput.trim() ? 'pointer' : 'default' }}
                  >
                    + Nova empresa
                  </button>
                </div>

                <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1f2e', display: 'block', marginBottom: 6 }}>E-mail(s) da GT3 em cópia (Cc)</label>
                <input
                  value={emailCcGt3Draft}
                  onChange={e => setEmailCcGt3Draft(e.target.value)}
                  placeholder="cadastro@gttres.com.br"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 14px' }}>
                  Entra sempre em cópia (Cc) — nunca como destinatário. Quem recebe (Para) é sempre a contratante. Vários e-mails: separe por vírgula.
                </p>

                <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1f2e', display: 'block', marginBottom: 6 }}>Assunto</label>
                <input
                  value={emailAssuntoDraft}
                  onChange={e => setEmailAssuntoDraft(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
                />

                <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1f2e', display: 'block', marginBottom: 6 }}>Corpo do e-mail</label>
                <textarea
                  value={emailCorpoDraft}
                  onChange={e => setEmailCorpoDraft(e.target.value)}
                  rows={7}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '6px 0 0' }}>
                  Variáveis disponíveis: <code>{'{{contratante}}'}</code> <code>{'{{numero_ata}}'}</code> <code>{'{{data}}'}</code> <code>{'{{local}}'}</code> <code>{'{{titulo}}'}</code> <code>{'{{nome_arquivo}}'}</code>
                </p>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button onClick={() => setEmailConfigOpen(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(42,79,150,0.20)', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button disabled={emailConfigSaving} onClick={salvarEmailConfig} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: emailConfigSaving ? 'default' : 'pointer' }}>
                {emailConfigSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: gerar e-mail de uma ata (destinatários + PDF anexado) ── */}
      {emailModalOpen && selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEmailModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 500, maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1f2e', marginBottom: 6 }}>✉ Gerar e-mail</div>
            <p style={{ fontSize: 13, color: '#5a6178', marginBottom: 18, lineHeight: 1.5 }}>
              Baixa um e-mail (.eml) já com destinatários, assunto e a ata em PDF anexada. Abra o arquivo pra revisar e enviar pelo seu cliente de e-mail.
            </p>

            {emailPreviewLoading && <p style={{ fontSize: 13, color: '#94A3B8' }}>Preparando…</p>}

            {emailPreview && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1f2e', display: 'block', marginBottom: 4 }}>Assunto</label>
                  <div style={{ fontSize: 13, color: '#334155', padding: '7px 10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>{emailPreview.assunto}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 12, color: '#5a6178' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: '#EEF2FB', color: '#2A4F96', fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cc automático</span>
                  <span>{emailPreview.ccGt3} <span style={{ color: '#94A3B8' }}>(GT3 — nunca como destinatária)</span></span>
                </div>

                <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1f2e', display: 'block', marginBottom: 6 }}>Destinatários (Para) — da contratante</label>
                {emailPreview.resolvidos.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: '#94A3B8', margin: '0 0 12px' }}>Nenhum participante desta ata tem e-mail cadastrado no diretório.</p>
                ) : (
                  <div style={{ marginBottom: 12, border: '1px solid rgba(42,79,150,0.15)', borderRadius: 8, overflow: 'hidden' }}>
                    {emailPreview.resolvidos.map(r => (
                      <label key={r.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(42,79,150,0.07)' }}>
                        <input
                          type="checkbox"
                          checked={emailChecked.has(r.email)}
                          onChange={() => setEmailChecked(prev => { const s = new Set(prev); s.has(r.email) ? s.delete(r.email) : s.add(r.email); return s })}
                          style={{ accentColor: '#2A4F96' }}
                        />
                        <span style={{ fontSize: 13, color: '#1a1f2e' }}>{r.nome} <span style={{ color: '#94A3B8' }}>— {r.email}</span></span>
                      </label>
                    ))}
                  </div>
                )}

                {emailPreview.semEmail.length > 0 && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                    Sem e-mail cadastrado: <strong>{emailPreview.semEmail.join(', ')}</strong>.{' '}
                    <button onClick={() => { setEmailModalOpen(false); openEmailConfig() }} style={{ border: 'none', background: 'none', color: '#2A4F96', fontWeight: 700, cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
                      Configurar
                    </button>
                  </div>
                )}

                <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1f2e', display: 'block', marginBottom: 6 }}>Adicionar e-mail manualmente</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    value={emailExtraInput}
                    onChange={e => setEmailExtraInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarEmailExtra() } }}
                    placeholder="e-mail@exemplo.com"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13 }}
                  />
                  <button onClick={adicionarEmailExtra} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #CBD5E0', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }}>+ Adicionar</button>
                </div>
                {emailExtras.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {emailExtras.map(email => (
                      <span key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#EEF2FB', color: '#2A4F96', fontSize: 12 }}>
                        {email}
                        <button onClick={() => setEmailExtras(prev => prev.filter(e => e !== email))} style={{ border: 'none', background: 'none', color: '#2A4F96', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEmailModalOpen(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(42,79,150,0.20)', background: '#fff', color: '#5a6178', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button
                disabled={!emailPreview || emailSending}
                onClick={baixarEmailAta}
                style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#2A4F96', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (!emailPreview || emailSending) ? 'default' : 'pointer', opacity: (!emailPreview || emailSending) ? 0.6 : 1 }}
              >
                {emailSending ? 'Gerando…' : '⬇ Baixar e-mail (.eml)'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
