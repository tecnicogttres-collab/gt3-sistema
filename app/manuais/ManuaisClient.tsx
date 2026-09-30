'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '../lib/supabase'
import { useUser, displayName } from '../components/UserContext'
import { GRADIENTE_AZUL, SOMBRA_AZUL_SUAVE } from '../lib/ui-destaque'

// ── Types ──────────────────────────────────────────────────────────────────

type DocSection = { label: string; items: string[] }
type Doc = { id: string; nome: string; periodicidade: string; sections: DocSection[] }
type NRRow = { origem: string; treinamento: string; ch: string; periodicidade: string; reciclagem: string; instrutor: string; resp: string }
type NRObs = { tag: string; texto: string }

type DocTab = 'funcionarios' | 'empresas' | 'veiculos' | 'alimentar' | 'bsa' | 'rescissorios' | 'geral' | 'variacoes'
type TabKey = DocTab | 'nrs'

type ManuaisData = Record<DocTab, Doc[]> & { nrs: NRRow[]; nrsObs: NRObs[] }
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ── Constants ──────────────────────────────────────────────────────────────

const PRIMARY = '#2A4F96'
const ACCENT = '#D1AE6E'
const TEXT = '#1E253D'
const MUTED = '#6B7A99'
const BORDER = '#E4EAF2'
const BG = '#F4F6FA'

const CATS: { key: TabKey; label: string; icon: string; sub: string }[] = [
  { key: 'funcionarios', label: 'Funcionários', icon: '👷', sub: 'Documentos dos colaboradores' },
  { key: 'nrs', label: 'NRs', icon: '📚', sub: 'Tabela de treinamentos normativos' },
  { key: 'empresas', label: 'Empresas', icon: '🏢', sub: 'Documentos das empresas' },
  { key: 'veiculos', label: 'Veículos', icon: '🚚', sub: 'Documentos dos veículos' },
  { key: 'alimentar', label: 'Alimentar', icon: '🍽️', sub: 'Documentos do setor alimentar' },
  { key: 'bsa', label: 'BSA', icon: '🛡️', sub: 'Documentos BSA' },
  { key: 'rescissorios', label: 'Rescisórios', icon: '📄', sub: 'GPF / Marcopolo / Ciferal / Volare' },
  { key: 'geral', label: 'Geral', icon: '📌', sub: 'Definições e rotinas operacionais' },
  { key: 'variacoes', label: 'Variações', icon: '🔀', sub: 'Critérios de validação por contratante' },
]
const CATS_AZ = [...CATS].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
const DOC_KEYS = CATS.filter(c => c.key !== 'nrs').map(c => c.key as DocTab)
const catOf = (k: TabKey) => CATS.find(c => c.key === k)!

const PERIODICIDADES = ['Única', 'Anual', 'Bienal', 'Mensal', 'Condicional']

const PILL: Record<string, { bg: string; color: string }> = {
  Anual:       { bg: '#EBF4FF', color: '#2A4F96' },
  Única:       { bg: '#E8F8EF', color: '#1E7A4A' },
  Bienal:      { bg: '#EDE9FE', color: '#5B21B6' },
  Mensal:      { bg: '#E6F6F8', color: '#0E7490' },
  Condicional: { bg: '#FFF4E0', color: '#92400E' },
}
const pillOf = (p: string) => PILL[p] ?? { bg: '#EEF1F6', color: '#4A5568' }

const EMPTY_DATA: ManuaisData = {
  funcionarios: [], empresas: [], veiculos: [], alimentar: [],
  bsa: [], rescissorios: [], geral: [], variacoes: [], nrs: [], nrsObs: [],
}

function deepCopy<T>(v: T): T { return JSON.parse(JSON.stringify(v)) }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const totalItens = (d: Doc) => d.sections.reduce((n, s) => n + s.items.length, 0)

// ── Pequenos componentes ────────────────────────────────────────────────────

function Pill({ p }: { p: string }) {
  const s = pillOf(p)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {p || '—'}
    </span>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mn-chip" style={{
      padding: '6px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
      border: `1.5px solid ${on ? PRIMARY : BORDER}`, background: on ? GRADIENTE_AZUL : '#fff', color: on ? '#fff' : MUTED, whiteSpace: 'nowrap',
      boxShadow: on ? SOMBRA_AZUL_SUAVE : 'none', transition: 'all .2s',
    }}>{children}</button>
  )
}

function AutoText({ value, onChange, onEnter, placeholder, autoFocus, style }: {
  value: string; onChange: (v: string) => void; onEnter?: () => void
  placeholder?: string; autoFocus?: boolean; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  return (
    <textarea ref={ref} rows={1} value={value} placeholder={placeholder} spellCheck={false}
      onChange={e => onChange(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter?.() } }}
      className="mn-input"
      style={{ width: '100%', resize: 'none', overflow: 'hidden', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.5, color: TEXT, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', outline: 'none', ...style }} />
  )
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: MUTED,
  cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const btnPrimary: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff',
  cursor: 'pointer', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
}
const btnGhost: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', color: '#4A5568',
  cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
}

// ── Componente principal ────────────────────────────────────────────────────

export default function ManuaisClient() {
  const { profile } = useUser()
  const canEdit = profile?.papel === 'gestor' || profile?.papel === 'admin'

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ManuaisData>(EMPTY_DATA)
  const [cat, setCat] = useState<TabKey>('funcionarios')
  const [search, setSearch] = useState('')
  const [perFilter, setPerFilter] = useState<string>('todas')
  const [openRef, setOpenRef] = useState<{ tab: DocTab; id: string } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pdfEscopo, setPdfEscopo] = useState<TabKey | null>(null)
  const MODO_KEY = 'gt3-manuais-modo-checklist'
  const [modoCheck, setModoCheckState] = useState(() => { try { return localStorage.getItem(MODO_KEY) === '1' } catch { return false } })
  function alternarModoCheck() {
    const v = !modoCheck
    setModoCheckState(v)
    try { localStorage.setItem(MODO_KEY, v ? '1' : '0') } catch { /* sem storage */ }
    showToast(v ? 'Modo checklist ligado — confira os critérios e finalize a avaliação.' : 'Modo checklist desligado.')
  }
  const [newName, setNewName] = useState('')
  const [toast, setToast] = useState<{ msg: string; show: boolean; err?: boolean }>({ msg: '', show: false })
  const catIdMap = useRef<Record<string, string>>({})
  const editingRef = useRef(false)          // painel de edição aberto → não sobrescrever com realtime
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string, err = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, show: true, err })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2600)
  }, [])

  // ── Carga + realtime ──
  const load = useCallback(async () => {
    const supabase = createClient()
    const [catsRes, docsRes] = await Promise.all([
      supabase.from('manuais_categorias').select('id, slug').order('ordem'),
      supabase.from('manuais_documentos').select('id, categoria_id, titulo, secoes, periodicidade').eq('ativo', true),
    ])
    if (catsRes.error || docsRes.error) { showToast('Não foi possível carregar os manuais.', true); setLoading(false); return }

    const idMap: Record<string, string> = {}
    const slugById: Record<string, string> = {}
    for (const c of catsRes.data ?? []) { idMap[c.slug as string] = c.id as string; slugById[c.id as string] = c.slug as string }
    catIdMap.current = idMap

    const built: ManuaisData = deepCopy(EMPTY_DATA)
    for (const doc of docsRes.data ?? []) {
      const slug = slugById[doc.categoria_id as string]
      if (slug === 'nrs') {
        const n = doc.secoes as { rows?: NRRow[]; obs?: NRObs[] }
        built.nrs = n.rows ?? []; built.nrsObs = n.obs ?? []
      } else if (slug && (DOC_KEYS as string[]).includes(slug)) {
        built[slug as DocTab].push({
          id: doc.id as string, nome: doc.titulo as string,
          periodicidade: doc.periodicidade as string, sections: (doc.secoes as DocSection[]) ?? [],
        })
      }
    }
    for (const k of DOC_KEYS) built[k].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    setData(built)
    setLoading(false)
  }, [showToast])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial assíncrona
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const ch = supabase
      .channel(`manuais-rt-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manuais_documentos' }, () => {
        if (editingRef.current) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => { void load() }, 300)
      })
      .subscribe()
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(ch) }
  }, [load])

  // Atalho "/" foca a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault(); searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Busca global (nome + conteúdo dos itens) ──
  const q = norm(search.trim())
  const resultados = useMemo(() => {
    if (!q) return []
    const out: { tab: DocTab; doc: Doc; trecho: string | null; porNome: boolean }[] = []
    for (const tab of DOC_KEYS) {
      for (const doc of data[tab]) {
        const porNome = norm(doc.nome).includes(q)
        let trecho: string | null = null
        if (!porNome) {
          for (const s of doc.sections) {
            const hit = s.items.find(i => norm(i).includes(q)) ?? (norm(s.label).includes(q) ? s.label : undefined)
            if (hit) { trecho = hit; break }
          }
          if (!trecho) continue
        }
        out.push({ tab, doc, trecho, porNome })
      }
    }
    return out.sort((a, b) => Number(b.porNome) - Number(a.porNome) || a.doc.nome.localeCompare(b.doc.nome, 'pt-BR'))
  }, [q, data])
  const nrsAchados = useMemo(
    () => q ? data.nrs.filter(r => norm(r.treinamento + ' ' + r.origem).includes(q)).length : 0,
    [q, data.nrs],
  )

  // ── Persistência de documentos ──
  async function salvarDoc(tab: DocTab, doc: Doc): Promise<boolean> {
    const supabase = createClient()
    const { data: salvo, error } = await supabase.from('manuais_documentos')
      .update({ titulo: doc.nome, periodicidade: doc.periodicidade, secoes: doc.sections })
      .eq('id', doc.id)
      .select('id')
    if (error) { showToast('Erro ao salvar: ' + error.message, true); return false }
    if (!salvo?.length) { showToast('Sem permissão para editar este documento.', true); return false }
    setData(d => ({ ...d, [tab]: d[tab].map(x => x.id === doc.id ? doc : x).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }))
    showToast('Documento salvo ✓')
    return true
  }

  async function excluirDoc(tab: DocTab, id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('manuais_documentos').delete().eq('id', id)
    if (error) { showToast('Erro ao excluir: ' + error.message, true); return }
    setData(d => ({ ...d, [tab]: d[tab].filter(x => x.id !== id) }))
    setOpenRef(null)
    showToast('Documento excluído.')
  }

  async function criarDoc() {
    const nome = newName.trim()
    if (!nome || cat === 'nrs') return
    const tab = cat as DocTab
    const catId = catIdMap.current[tab]
    if (!catId) { showToast('Categoria não encontrada.', true); return }
    const doc: Doc = { id: 'doc_' + Date.now(), nome, periodicidade: 'Única', sections: [{ label: 'Verificação', items: [''] }] }
    const supabase = createClient()
    const { error } = await supabase.from('manuais_documentos').insert({
      id: doc.id, categoria_id: catId, titulo: doc.nome, conteudo: '', secoes: doc.sections, periodicidade: doc.periodicidade, ativo: true,
    })
    if (error) { showToast('Erro ao criar: ' + error.message, true); return }
    setData(d => ({ ...d, [tab]: [...d[tab], doc].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }))
    setAddOpen(false); setNewName('')
    setOpenRef({ tab, id: doc.id })
    showToast('Documento criado — preencha os critérios.')
  }

  // ── NRs (salvamento automático com indicador) ──
  const [nrSave, setNrSave] = useState<SaveState>('idle')
  const nrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nrPayload = useRef<{ rows: NRRow[]; obs: NRObs[] }>({ rows: [], obs: [] })

  function atualizarNrs(fn: (rows: NRRow[], obs: NRObs[]) => void) {
    setData(prev => {
      const next = deepCopy(prev)
      fn(next.nrs, next.nrsObs)
      nrPayload.current = { rows: next.nrs, obs: next.nrsObs }
      return next
    })
    setNrSave('saving')
    if (nrTimer.current) clearTimeout(nrTimer.current)
    nrTimer.current = setTimeout(async () => {
      const supabase = createClient()
      const { error } = await supabase.from('manuais_documentos').update({ secoes: nrPayload.current }).eq('id', '__nrs__')
      setNrSave(error ? 'error' : 'saved')
      if (error) showToast('Erro ao salvar NRs: ' + error.message, true)
    }, 700)
  }

  // ── Render ──
  const info = catOf(cat)
  const docsCat = useMemo(() => (cat === 'nrs' ? [] : data[cat as DocTab]), [cat, data])
  const periodicidadesDaCat = useMemo(() => ['todas', ...Array.from(new Set(docsCat.map(d => d.periodicidade).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))], [docsCat])
  const docsFiltrados = docsCat.filter(d => perFilter === 'todas' || d.periodicidade === perFilter)
  const contagem = (k: TabKey) => k === 'nrs' ? data.nrs.length : data[k].length
  const docAberto = openRef ? data[openRef.tab].find(d => d.id === openRef.id) ?? null : null

  return (
    <div className="mn-root">
      <style>{`
        .mn-root{max-width:1320px;margin:0 auto;color:${TEXT}}
        .mn-layout{display:grid;grid-template-columns:230px 1fr;gap:22px;align-items:start}
        .mn-rail{position:sticky;top:12px;display:flex;flex-direction:column;gap:3px}
        .mn-cat{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:none;background:transparent;border-radius:10px;cursor:pointer;font-family:inherit;font-size:13.5px;color:#4A5568;text-align:left;transition:background .18s,color .18s}
        .mn-cat:hover{background:#EAF0FA}
        .mn-cat.on{background:#fff;color:${PRIMARY};font-weight:700;box-shadow:0 2px 8px rgba(26,36,54,.06)}
        .mn-card{background:#fff;border:1.5px solid ${BORDER};border-radius:14px;padding:16px;cursor:pointer;text-align:left;font-family:inherit;display:flex;flex-direction:column;gap:12px;min-height:118px;transition:transform .18s,box-shadow .18s,border-color .18s}
        .mn-card:hover{transform:translateY(-2px);border-color:#BFD0FF;box-shadow:0 8px 22px rgba(42,79,150,.10)}
        .mn-chip:hover{border-color:${PRIMARY}}
        .mn-input:focus{border-color:${PRIMARY}!important;box-shadow:0 0 0 3px rgba(42,79,150,.10)}
        .mn-row:hover{background:#F8FAFE}
        .mn-item:hover .mn-item-actions{opacity:1}
        .mn-item-actions{opacity:0;transition:opacity .15s}
        .mn-drawer{animation:mnSlide .28s cubic-bezier(.16,1,.3,1)}
        @keyframes mnSlide{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
        @keyframes mnShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .mn-skel{background:linear-gradient(90deg,#EEF2F7 25%,#F7F9FC 50%,#EEF2F7 75%);background-size:800px 100%;animation:mnShimmer 1.3s infinite;border-radius:14px}
        @media (max-width:860px){
          .mn-layout{grid-template-columns:1fr}
          .mn-rail{position:static;flex-direction:row;overflow-x:auto;padding-bottom:6px}
          .mn-cat{width:auto;white-space:nowrap;flex-shrink:0}
        }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: '1 1 260px' }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-.3px' }}>📖 Manuais</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: MUTED }}>Critérios de validação de documentos — consulte, confira item a item{canEdit ? ' e mantenha atualizado' : ''}.</p>
        </div>
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 460 }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: .6 }}>🔍</span>
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar em todos os manuais…  (atalho: /)" className="mn-input"
            style={{ width: '100%', padding: '11px 36px 11px 38px', borderRadius: 12, border: `1.5px solid ${BORDER}`, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }} />
          {search && (
            <button onClick={() => setSearch('')} title="Limpar" style={{ ...iconBtn, position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>✕</button>
          )}
        </div>
        <button onClick={alternarModoCheck} role="switch" aria-checked={modoCheck} className="mn-toggle"
          title={modoCheck ? 'Desligar o modo checklist' : 'Ligar o modo checklist em todos os documentos'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 11, padding: '8px 16px 8px 10px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${modoCheck ? PRIMARY : BORDER}`,
            background: modoCheck ? 'linear-gradient(135deg, #2A4F96, #3E68B8)' : '#fff',
            color: modoCheck ? '#fff' : TEXT, boxShadow: modoCheck ? '0 6px 18px rgba(42,79,150,.30)' : '0 1px 2px rgba(26,36,54,.04)',
            transition: 'all .25s',
          }}>
          <span style={{ width: 40, height: 24, borderRadius: 999, background: modoCheck ? 'rgba(255,255,255,.28)' : '#D5DDE9', position: 'relative', flexShrink: 0, transition: 'background .25s' }}>
            <span style={{ position: 'absolute', top: 3, left: modoCheck ? 19 : 3, width: 18, height: 18, borderRadius: 999, background: '#fff', transition: 'left .25s cubic-bezier(.34,.8,.35,1)', boxShadow: '0 1px 4px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: PRIMARY, fontWeight: 800 }}>{modoCheck ? '✓' : ''}</span>
          </span>
          <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>Modo checklist</span>
            <span style={{ display: 'block', fontSize: 11, opacity: modoCheck ? .85 : .6 }}>{modoCheck ? 'Ligado · conferir e finalizar' : 'Desligado · só consulta'}</span>
          </span>
        </button>
      </div>

      <div className="mn-layout">
        {/* Categorias */}
        <nav className="mn-rail" aria-label="Categorias">
          {CATS_AZ.map(c => (
            <button key={c.key} className={`mn-cat${!q && cat === c.key ? ' on' : ''}`}
              onClick={() => { setCat(c.key); setSearch(''); setPerFilter('todas') }}>
              <span style={{ fontSize: 17 }}>{c.icon}</span>
              <span style={{ flex: 1 }}>{c.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, background: '#E9EEF6', borderRadius: 999, padding: '1px 8px' }}>{loading ? '·' : contagem(c.key)}</span>
            </button>
          ))}
        </nav>

        {/* Conteúdo */}
        <main style={{ minWidth: 0 }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="mn-skel" style={{ height: 118 }} />)}
            </div>
          ) : q ? (
            /* Resultados da busca global */
            <div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>
                <b style={{ color: TEXT }}>{resultados.length + (nrsAchados ? 1 : 0)}</b> resultado(s) para &quot;{search}&quot;
              </div>
              {nrsAchados > 0 && (
                <button className="mn-card" style={{ width: '100%', marginBottom: 12, minHeight: 0, flexDirection: 'row', alignItems: 'center' }}
                  onClick={() => { setCat('nrs'); setSearch('') }}>
                  <span style={{ fontSize: 22 }}>📚</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{nrsAchados} treinamento(s) na tabela de NRs</span>
                  <span style={{ color: MUTED }}>›</span>
                </button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {resultados.map(({ tab, doc, trecho }) => (
                  <button key={doc.id} className="mn-card" style={{ minHeight: 0, gap: 6 }} onClick={() => setOpenRef({ tab, id: doc.id })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700 }}>{doc.nome}</span>
                      <Pill p={doc.periodicidade} />
                      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: MUTED }}>{catOf(tab).icon} {catOf(tab).label}</span>
                    </div>
                    {trecho && <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>…{trecho.length > 150 ? trecho.slice(0, 150) + '…' : trecho}</div>}
                  </button>
                ))}
              </div>
              {resultados.length === 0 && !nrsAchados && (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: MUTED }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>🔎</div>
                  Nada encontrado. Tente outra palavra — a busca olha o nome e o conteúdo dos critérios.
                </div>
              )}
            </div>
          ) : cat === 'nrs' ? (
            <NRsView data={data} canEdit={canEdit} saveState={nrSave} onChange={atualizarNrs} onPdf={() => setPdfEscopo('nrs')} />
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 240px' }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{info.icon} {info.label}</div>
                  <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{info.sub}</div>
                </div>
                <button onClick={() => setPdfEscopo(cat)} style={btnGhost}>📄 PDF desta categoria</button>
                {canEdit && <button onClick={() => { setNewName(''); setAddOpen(true) }} style={btnPrimary}>＋ Novo documento</button>}
              </div>

              {periodicidadesDaCat.length > 2 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {periodicidadesDaCat.map(p => (
                    <Chip key={p} on={perFilter === p} onClick={() => setPerFilter(p)}>{p === 'todas' ? 'Todas' : p}</Chip>
                  ))}
                </div>
              )}

              {docsFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: MUTED, background: '#fff', border: `1.5px dashed ${BORDER}`, borderRadius: 14 }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>{info.icon}</div>
                  Nenhum documento {perFilter !== 'todas' ? `com periodicidade “${perFilter}”` : 'nesta categoria'} ainda.
                  {canEdit && perFilter === 'todas' && <div style={{ marginTop: 12 }}><button onClick={() => { setNewName(''); setAddOpen(true) }} style={btnPrimary}>＋ Criar o primeiro</button></div>}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                  {docsFiltrados.map(doc => (
                    <button key={doc.id} className="mn-card" onClick={() => setOpenRef({ tab: cat as DocTab, id: doc.id })}>
                      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, flex: 1 }}>{doc.nome}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Pill p={doc.periodicidade} />
                        <span style={{ fontSize: 11.5, color: MUTED }}>{totalItens(doc)} critério(s)</span>
                        <span style={{ marginLeft: 'auto', color: '#A0AEC0', fontSize: 16 }}>›</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Painel do documento */}
      {openRef && docAberto && (
        <DocPanel
          key={docAberto.id}
          doc={docAberto}
          catLabel={`${catOf(openRef.tab).icon} ${catOf(openRef.tab).label}`}
          canEdit={!!profile}
          canStruct={canEdit}
          matriz={openRef.tab === 'variacoes'}
          modoCheck={modoCheck}
          onEditing={v => { editingRef.current = v }}
          onClose={() => { editingRef.current = false; setOpenRef(null) }}
          onSave={d => salvarDoc(openRef.tab, d)}
          onDelete={() => excluirDoc(openRef.tab, docAberto.id)}
          onToast={showToast}
        />
      )}

      {pdfEscopo && <PdfModal data={data} escopo={pdfEscopo} onClose={() => setPdfEscopo(null)} onToast={showToast} />}

      {/* Novo documento */}
      {addOpen && (
        <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, background: 'rgba(14,20,37,.5)', backdropFilter: 'blur(2px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="gt3-drop-in" style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Novo documento</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>Em {info.icon} {info.label}. Você preenche os critérios em seguida.</div>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} className="mn-input"
              onKeyDown={e => { if (e.key === 'Enter') void criarDoc(); if (e.key === 'Escape') setAddOpen(false) }}
              placeholder="Nome do documento (ex.: ASO, CRLV…)"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setAddOpen(false)} style={btnGhost}>Cancelar</button>
              <button onClick={() => void criarDoc()} disabled={!newName.trim()} style={{ ...btnPrimary, opacity: newName.trim() ? 1 : .5 }}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) translateY(${toast.show ? 0 : 20}px)`,
        background: toast.err ? '#B91C1C' : TEXT, color: '#fff', padding: '11px 20px', borderRadius: 999, fontSize: 13, fontWeight: 500,
        boxShadow: '0 8px 24px rgba(20,30,60,.2)', opacity: toast.show ? 1 : 0, transition: 'all .25s', zIndex: 10000, pointerEvents: 'none', maxWidth: '90vw',
      }}>{toast.msg}</div>
    </div>
  )
}

// ── Painel do documento (leitura + edição) ─────────────────────────────────

function DocPanel({ doc, catLabel, canEdit, canStruct, matriz, modoCheck, onEditing, onClose, onSave, onDelete, onToast }: {
  doc: Doc; catLabel: string; canEdit: boolean; canStruct: boolean; matriz: boolean; modoCheck: boolean
  onEditing: (v: boolean) => void
  onClose: () => void
  onSave: (d: Doc) => Promise<boolean>
  onDelete: () => void
  onToast: (msg: string, err?: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Doc>(() => deepCopy(doc))
  const [saving, setSaving] = useState(false)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [extraRows, setExtraRows] = useState<string[]>([])
  const [viewLista, setViewLista] = useState(false)   // documentos-matriz: alterna matriz/lista na edição
  const mostrarMatriz = matriz && !(editing && viewLista)
  const { profile } = useUser()
  // Modo checklist (global, vem do cabeçalho): desligado = verificação simples; ligado = caixas + finalizar avaliação.
  const [finalizadoRaw, setFinalizado] = useState(false)
  const finalizado = finalizadoRaw && modoCheck
  const storageKey = `gt3-manuais-check:${doc.id}`
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') } catch { return {} }
  })

  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(doc)
  const src = editing ? draft : doc
  const ckey = (s: DocSection, item: string) => `${s.label}|${item}`
  const total = doc.sections.reduce((n, s) => n + s.items.length, 0)
  const feitos = doc.sections.reduce((n, s) => n + s.items.filter(i => checks[ckey(s, i)]).length, 0)

  function persistChecks(next: Record<string, boolean>) {
    setChecks(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* sem storage */ }
  }

  const tentarFechar = useCallback(() => {
    if (dirty && !confirm('Há alterações não salvas. Sair mesmo assim?')) return
    onClose()
  }, [dirty, onClose])

  const salvar = useCallback(async () => {
    if (saving) return
    const limpo: Doc = {
      ...draft, nome: draft.nome.trim() || doc.nome,
      sections: draft.sections
        .map(s => ({ label: s.label.trim() || 'Seção', items: s.items.map(i => i.trim()).filter(Boolean) }))
        .filter(s => s.items.length > 0 || s.label),
    }
    setSaving(true)
    const ok = await onSave(limpo)
    setSaving(false)
    if (ok) { setEditing(false); onEditing(false) }
  }, [draft, doc.nome, onSave, onEditing, saving])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tentarFechar()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && editing) { e.preventDefault(); void salvar() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tentarFechar, salvar, editing])

  function upd(fn: (d: Doc) => void) { setDraft(prev => { const n = deepCopy(prev); fn(n); return n }) }
  function move<T>(arr: T[], i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  async function copiar() {
    const txt = [doc.nome + (doc.periodicidade ? ` (${doc.periodicidade})` : ''), '',
      ...doc.sections.flatMap(s => [s.label.toUpperCase(), ...s.items.map(i => '• ' + i), ''])].join('\n').trim()
    try { await navigator.clipboard.writeText(txt); onToast('Critérios copiados ✓') } catch { onToast('Não foi possível copiar.', true) }
  }

  return (
    <div className="gt3-overlay-fade" onClick={e => { if (e.target === e.currentTarget) tentarFechar() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,20,37,.45)', backdropFilter: 'blur(2px)', zIndex: 9998, display: 'flex', justifyContent: 'flex-end' }}>
      <aside className="mn-drawer" style={{ background: BG, width: '100%', maxWidth: matriz ? 980 : 680, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,.18)' }}>

        {/* Cabeçalho */}
        <div style={{ background: '#fff', padding: '18px 24px 14px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{catLabel}</span>
            {editing && <span style={{ fontSize: 10.5, fontWeight: 800, background: '#FFF4E0', color: '#92400E', padding: '2px 8px', borderRadius: 999, letterSpacing: '.4px' }}>EDITANDO</span>}
            <button onClick={tentarFechar} title="Fechar (Esc)" style={{ ...iconBtn, marginLeft: 'auto', fontSize: 16 }}>✕</button>
          </div>
          {editing && canStruct ? (
            <>
              <input value={draft.nome} onChange={e => upd(d => { d.nome = e.target.value })} className="mn-input" placeholder="Nome do documento"
                style={{ width: '100%', fontSize: 19, fontWeight: 800, padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${BORDER}`, outline: 'none', fontFamily: 'inherit', color: TEXT }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px' }}>Periodicidade</span>
                {PERIODICIDADES.map(p => <Chip key={p} on={draft.periodicidade === p} onClick={() => upd(d => { d.periodicidade = p })}>{p}</Chip>)}
                <input value={PERIODICIDADES.includes(draft.periodicidade) ? '' : draft.periodicidade}
                  onChange={e => upd(d => { d.periodicidade = e.target.value })} placeholder="outra…" className="mn-input"
                  style={{ width: 110, padding: '5px 10px', borderRadius: 999, border: `1.5px solid ${BORDER}`, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
              </div>
            </>
          ) : (
            <>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.3 }}>{doc.nome}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill p={doc.periodicidade} />
                <span style={{ fontSize: 12.5, color: MUTED }}>{doc.sections.length} seção(ões) · {total} critério(s)</span>
              </div>
              {total > 0 && !matriz && modoCheck && !finalizado && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginBottom: 5 }}>
                    <span>Conferência {feitos === total ? '✓ completa' : 'em andamento'} <span style={{ opacity: .7 }}>(só neste computador)</span></span>
                    <span style={{ fontWeight: 700, color: feitos === total ? '#1E7A4A' : TEXT }}>{feitos}/{total}</span>
                  </div>
                  <div style={{ height: 6, background: '#E9EEF6', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${(feitos / total) * 100}%`, height: '100%', background: feitos === total ? '#22A06B' : PRIMARY, transition: 'width .3s' }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 30px' }}>
          {matriz && editing && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <Chip on={!viewLista} onClick={() => setViewLista(false)}>▦ Matriz</Chip>
              <Chip on={viewLista} onClick={() => setViewLista(true)}>☰ Lista (avançado)</Chip>
            </div>
          )}
          {mostrarMatriz ? (
            <Matriz doc={src} editing={editing} extraRows={extraRows} onExtraRows={setExtraRows} onUpdate={upd} />
          ) : finalizado && !editing ? (
            <Resultado doc={doc} checks={checks} ckey={ckey} avaliador={displayName(profile)}
              onNova={() => { persistChecks({}); setFinalizado(false) }} onVoltar={() => setFinalizado(false)} onToast={onToast} />
          ) : (<>
          {src.sections.map((s, si) => (
            <section key={si} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {editing && canStruct ? (
                  <>
                    <input value={s.label} onChange={e => upd(d => { d.sections[si].label = e.target.value })} className="mn-input" placeholder="Nome da seção"
                      style={{ flex: 1, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${BORDER}`, outline: 'none', fontFamily: 'inherit', color: PRIMARY }} />
                    <button title="Subir seção" style={iconBtn} onClick={() => upd(d => move(d.sections, si, -1))}>↑</button>
                    <button title="Descer seção" style={iconBtn} onClick={() => upd(d => move(d.sections, si, 1))}>↓</button>
                    <button title="Remover seção" style={{ ...iconBtn, color: '#DC2626' }}
                      onClick={() => { if (confirm('Remover esta seção e todos os seus itens?')) upd(d => { d.sections.splice(si, 1) }) }}>🗑</button>
                  </>
                ) : (
                  <h4 style={{ margin: 0, fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.7px', color: PRIMARY }}>{s.label}</h4>
                )}
              </div>

              {s.items.map((item, ii) => editing ? (
                <div key={ii} className="mn-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: '#A0AEC0', paddingTop: 9, flexShrink: 0 }}>•</span>
                  <AutoText value={item} placeholder="Descreva o critério…" autoFocus={focusKey === `${si}:${ii}`}
                    onChange={v => upd(d => { d.sections[si].items[ii] = v })}
                    onEnter={() => { upd(d => { d.sections[si].items.splice(ii + 1, 0, '') }); setFocusKey(`${si}:${ii + 1}`) }} />
                  <span className="mn-item-actions" style={{ display: 'flex', flexShrink: 0 }}>
                    <button title="Subir" style={iconBtn} onClick={() => upd(d => move(d.sections[si].items, ii, -1))}>↑</button>
                    <button title="Descer" style={iconBtn} onClick={() => upd(d => move(d.sections[si].items, ii, 1))}>↓</button>
                    <button title="Remover" style={{ ...iconBtn, color: '#DC2626' }} onClick={() => upd(d => { d.sections[si].items.splice(ii, 1) })}>✕</button>
                  </span>
                </div>
              ) : !modoCheck ? (
                <div key={ii} style={{ display: 'flex', gap: 10, padding: '7px 4px', borderTop: ii ? '1px solid #F1F5F9' : 'none', fontSize: 14, lineHeight: 1.55 }}>
                  <span style={{ color: '#A0AEC0', flexShrink: 0 }}>•</span><span>{item}</span>
                </div>
              ) : (
                <label key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 4px', borderTop: ii ? `1px solid #F1F5F9` : 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1.55 }}>
                  <input type="checkbox" checked={!!checks[ckey(s, item)]}
                    onChange={e => persistChecks({ ...checks, [ckey(s, item)]: e.target.checked })}
                    style={{ width: 17, height: 17, marginTop: 3, accentColor: PRIMARY, flexShrink: 0, cursor: 'pointer' }} />
                  <span style={{ color: checks[ckey(s, item)] ? '#98A4B8' : TEXT, textDecoration: checks[ckey(s, item)] ? 'line-through' : 'none', transition: 'color .2s' }}>{item}</span>
                </label>
              ))}

              {editing && (
                <button onClick={() => { upd(d => { d.sections[si].items.push('') }); setFocusKey(`${si}:${s.items.length}`) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: MUTED, padding: '6px 2px', fontFamily: 'inherit', fontWeight: 600 }}>＋ Adicionar item</button>
              )}
            </section>
          ))}

          {editing && canStruct && (
            <button onClick={() => upd(d => { d.sections.push({ label: 'Nova seção', items: [''] }) })}
              style={{ width: '100%', padding: 13, borderRadius: 14, border: `1.5px dashed #B8C6E0`, background: 'transparent', color: PRIMARY, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Adicionar seção</button>
          )}

          {!editing && doc.sections.length === 0 && (
            <div style={{ textAlign: 'center', color: MUTED, padding: 40 }}>Este documento ainda não tem critérios.{canEdit && ' Clique em Editar para preencher.'}</div>
          )}
          </>)}
        </div>

        {/* Rodapé */}
        <div style={{ background: '#fff', borderTop: `1px solid ${BORDER}`, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {editing ? (
            <>
              {canStruct && <button onClick={() => { if (confirm('Excluir este documento? Não dá para desfazer.')) onDelete() }} style={{ ...btnGhost, color: '#DC2626', borderColor: '#FBC9C9' }}>🗑 Excluir</button>}
              <span style={{ flex: 1, fontSize: 12, color: dirty ? '#92400E' : MUTED, textAlign: 'right' }}>{dirty ? 'Alterações não salvas · Ctrl+S salva' : 'Nenhuma alteração'}</span>
              <button onClick={() => { if (dirty && !confirm('Descartar as alterações?')) return; setDraft(deepCopy(doc)); setEditing(false); onEditing(false) }} style={btnGhost}>Cancelar</button>
              <button onClick={() => void salvar()} disabled={!dirty || saving} style={{ ...btnPrimary, opacity: !dirty || saving ? .5 : 1 }}>{saving ? 'Salvando…' : '💾 Salvar'}</button>
            </>
          ) : (
            <>
              <button onClick={() => void copiar()} style={btnGhost}>📋 Copiar critérios</button>
              {modoCheck && !matriz && !finalizado && feitos > 0 && <button onClick={() => persistChecks({})} style={btnGhost}>↺ Limpar conferência</button>}
              <span style={{ flex: 1 }} />
              {modoCheck && !matriz && !finalizado && total > 0 && (
                <button onClick={() => setFinalizado(true)} style={{ ...btnPrimary, background: feitos === total ? '#22A06B' : PRIMARY }}>✔ Finalizar avaliação</button>
              )}
              {canEdit && !finalizado && <button onClick={() => { setDraft(deepCopy(doc)); setEditing(true); onEditing(true) }} style={modoCheck && !matriz && total > 0 ? btnGhost : btnPrimary}>{canStruct ? '✏️ Editar' : '✏️ Editar critérios'}</button>}
              <button onClick={onClose} style={btnGhost}>Fechar</button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

// ── Resultado da avaliação (modo checklist) ────────────────────────────────

function Resultado({ doc, checks, ckey, avaliador, onNova, onVoltar, onToast }: {
  doc: Doc; checks: Record<string, boolean>
  ckey: (s: DocSection, item: string) => string
  avaliador: string
  onNova: () => void; onVoltar: () => void
  onToast: (m: string, err?: boolean) => void
}) {
  const quando = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const linhas = doc.sections.map(s => ({ label: s.label, itens: s.items.map(i => ({ i, ok: !!checks[ckey(s, i)] })) }))
  const todos = linhas.flatMap(l => l.itens)
  const ok = todos.filter(x => x.ok).length
  const pend = todos.length - ok
  const aprovado = pend === 0 && todos.length > 0

  async function copiar() {
    const txt = [`Avaliação — ${doc.nome}`, `Avaliador: ${avaliador} · ${quando}`,
      `Resultado: ${aprovado ? 'TODOS OS CRITÉRIOS CONFERIDOS' : `${pend} PENDÊNCIA(S)`} (${ok}/${todos.length})`, '',
      ...linhas.flatMap(l => [l.label.toUpperCase(), ...l.itens.map(x => `${x.ok ? '[x]' : '[ ]'} ${x.i}`), ''])].join('\n').trim()
    try { await navigator.clipboard.writeText(txt); onToast('Resultado copiado ✓') } catch { onToast('Não foi possível copiar.', true) }
  }
  function pdf() {
    const corpo = `<p><b>Avaliador:</b> ${esc(avaliador)} · ${esc(quando)}</p>` +
      `<h3>Resultado: ${aprovado ? '✓ todos os critérios conferidos' : `✗ ${pend} pendência(s)`} (${ok}/${todos.length})</h3>` +
      linhas.map(l => `<h4>${esc(l.label)}</h4><ul style="list-style:none;margin-left:2px">${l.itens.map(x =>
        `<li style="color:${x.ok ? '#1E7A4A' : '#B91C1C'}">${x.ok ? '✓' : '✗'} <span style="color:#1E253D">${esc(x.i)}</span></li>`).join('')}</ul>`).join('')
    imprimirPdf(`Avaliação — ${doc.nome}`, corpo)
  }

  return (
    <div>
      <div style={{ background: aprovado ? '#ECFAF2' : '#FFF4F2', border: `1.5px solid ${aprovado ? '#A9E6C4' : '#F5C2BA'}`, borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Avaliação finalizada · {avaliador} · {quando}</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: aprovado ? '#1E7A4A' : '#B91C1C' }}>
          {aprovado ? '✓ Todos os critérios conferidos' : `✗ ${pend} critério(s) pendente(s)`}
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{ok} de {todos.length} conferido(s)</div>
      </div>

      {linhas.map((l, si) => (
        <section key={si} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.7px', color: PRIMARY }}>{l.label}</h4>
          {l.itens.map((x, k) => (
            <div key={k} style={{ display: 'flex', gap: 9, padding: '5px 0', fontSize: 13.5, lineHeight: 1.5, borderTop: k ? '1px solid #F1F5F9' : 'none' }}>
              <span style={{ fontWeight: 800, color: x.ok ? '#22A06B' : '#DC2626', width: 16, flexShrink: 0 }}>{x.ok ? '✓' : '✗'}</span>
              <span style={{ color: x.ok ? MUTED : TEXT, fontWeight: x.ok ? 400 : 600 }}>{x.i}</span>
            </div>
          ))}
        </section>
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => void copiar()} style={btnGhost}>📋 Copiar resultado</button>
        <button onClick={pdf} style={btnGhost}>📄 Imprimir / PDF</button>
        <button onClick={onVoltar} style={btnGhost}>← Voltar à conferência</button>
        <button onClick={onNova} style={btnPrimary}>↺ Nova avaliação</button>
      </div>
    </div>
  )
}

// ── Matriz (Variações: contratante × critério) ─────────────────────────────

const isComum = (label: string) => /comum/i.test(label)
const isNota = (item: string) => /^obs/i.test(item.trim()) || item.trim().length > 28

function derivarMatriz(sections: DocSection[], extra: string[]) {
  const colunas = sections.map((s, si) => ({ s, si })).filter(x => !isComum(x.s.label))
  const comuns = sections.filter(s => isComum(s.label))
  const set = new Set<string>(extra)
  colunas.forEach(c => c.s.items.forEach(i => { if (!isNota(i)) set.add(i) }))
  const linhas = [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return { colunas, comuns, linhas }
}

function Matriz({ doc, editing, extraRows, onExtraRows, onUpdate }: {
  doc: Doc; editing: boolean; extraRows: string[]
  onExtraRows: (r: string[]) => void
  onUpdate: (fn: (d: Doc) => void) => void
}) {
  const [busca, setBusca] = useState('')
  const [novaLinha, setNovaLinha] = useState('')
  const { colunas, comuns, linhas } = useMemo(() => derivarMatriz(doc.sections, extraRows), [doc.sections, extraRows])
  const visiveis = linhas.filter(l => !busca || norm(l).includes(norm(busca)))
  const th: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: '#F5F8FC', padding: '10px 10px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'bottom', textAlign: 'center', minWidth: 140, maxWidth: 190 }

  function alternar(linha: string, si: number) {
    onUpdate(d => {
      const its = d.sections[si].items
      const idx = its.indexOf(linha)
      if (idx >= 0) its.splice(idx, 1)
      else { const nota = its.findIndex(isNota); its.splice(nota >= 0 ? nota : its.length, 0, linha) }
    })
  }
  function renomear(antigo: string, novo: string) {
    const n = novo.trim()
    if (!n || n === antigo) return
    onUpdate(d => d.sections.forEach(s => {
      if (isComum(s.label)) return
      const i = s.items.indexOf(antigo)
      if (i >= 0) { if (s.items.includes(n)) s.items.splice(i, 1); else s.items[i] = n }
    }))
    onExtraRows(extraRows.map(x => x === antigo ? n : x))
  }
  function removerLinha(linha: string) {
    if (!confirm(`Remover "${linha}" de todos os critérios?`)) return
    onUpdate(d => d.sections.forEach(s => { if (!isComum(s.label)) s.items = s.items.filter(i => i !== linha) }))
    onExtraRows(extraRows.filter(x => x !== linha))
  }
  function adicionarLinha() {
    const n = novaLinha.trim()
    if (!n || linhas.includes(n)) { setNovaLinha(''); return }
    onExtraRows([...extraRows, n]); setNovaLinha('')
  }

  return (
    <div>
      {comuns.length > 0 && (
        <div style={{ background: '#EEF4FF', border: '1px solid #CFDDF7', borderRadius: 14, padding: '12px 16px', marginBottom: 14 }}>
          {comuns.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: i ? 8 : 0 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '.6px' }}>{c.label}</span>
              {c.items.map((it, k) => <span key={k} style={{ background: '#fff', border: '1px solid #CFDDF7', borderRadius: 999, padding: '3px 11px', fontSize: 12.5 }}>{it}</span>)}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar contratante…" className="mn-input"
          style={{ width: 220, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        <span style={{ fontSize: 12, color: MUTED }}>{visiveis.length} contratante(s) · {colunas.length} critério(s)</span>
        {editing && <span style={{ fontSize: 12, color: '#92400E' }}>Clique nas células para marcar/desmarcar</span>}
      </div>

      <div style={{ background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 14, overflow: 'auto', maxHeight: '58vh' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th, left: 0, zIndex: 3, textAlign: 'left', minWidth: 160, fontSize: 10.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.8px' }}>Contratante</th>
              {colunas.map(c => (
                <th key={c.si} style={th}>
                  {editing ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                      <AutoText value={c.s.label} onChange={v => onUpdate(d => { d.sections[c.si].label = v })} style={{ fontSize: 12, fontWeight: 700, padding: '5px 7px' }} />
                      <button title="Remover critério" style={{ ...iconBtn, color: '#DC2626', width: 24, height: 24 }}
                        onClick={() => { if (confirm(`Remover o critério "${c.s.label}"?`)) onUpdate(d => { d.sections.splice(c.si, 1) }) }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.35 }}>{c.s.label}</div>
                  )}
                  <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>{c.s.items.filter(i => !isNota(i)).length} contratante(s)</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map(l => (
              <tr key={l} className="mn-row">
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: '#fff', padding: '8px 12px', borderTop: '1px solid #F1F5F9', fontWeight: 700, fontSize: 13.5 }}>
                  {editing ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input defaultValue={l} onBlur={e => renomear(l, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="mn-input" style={{ width: '100%', padding: '5px 8px', borderRadius: 7, border: `1.5px solid ${BORDER}`, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }} />
                      <button title="Remover contratante" style={{ ...iconBtn, color: '#DC2626', width: 24, height: 24 }} onClick={() => removerLinha(l)}>✕</button>
                    </div>
                  ) : l}
                </td>
                {colunas.map(c => {
                  const on = c.s.items.includes(l)
                  return (
                    <td key={c.si} style={{ textAlign: 'center', padding: 6, borderTop: '1px solid #F1F5F9', background: on ? '#F0FAF4' : undefined }}>
                      {editing ? (
                        <button onClick={() => alternar(l, c.si)} title={on ? 'Desmarcar' : 'Marcar'}
                          style={{ width: 34, height: 30, borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${on ? '#22A06B' : BORDER}`, background: on ? '#22A06B' : '#fff', color: '#fff', fontWeight: 800, fontSize: 15 }}>{on ? '✓' : ''}</button>
                      ) : on
                        ? <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 999, background: '#22A06B', color: '#fff', fontWeight: 800, fontSize: 14, alignItems: 'center', justifyContent: 'center' }}>✓</span>
                        : <span style={{ color: '#CBD5E0' }}>—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr><td colSpan={colunas.length + 1} style={{ padding: 30, textAlign: 'center', color: MUTED, fontSize: 13 }}>
                {linhas.length === 0 ? 'Nenhum contratante nesta matriz ainda.' : 'Nenhum contratante encontrado.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <input value={novaLinha} onChange={e => setNovaLinha(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') adicionarLinha() }}
            placeholder="Novo contratante…" className="mn-input"
            style={{ width: 220, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={adicionarLinha} style={btnGhost}>＋ Contratante</button>
          <button onClick={() => onUpdate(d => { d.sections.push({ label: 'Novo critério', items: [] }) })} style={btnGhost}>＋ Critério (coluna)</button>
        </div>
      )}

      {/* Observações e regras que não são de um contratante específico */}
      {colunas.some(c => c.s.items.some(isNota)) && (
        <div style={{ marginTop: 16, background: '#FFFBF0', border: '1px solid #F1E2B8', borderLeft: `4px solid ${ACCENT}`, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#7A5B12', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Observações</div>
          {colunas.map(c => c.s.items.filter(isNota).map((n, k) => (
            <div key={c.si + ':' + k} style={{ fontSize: 13, color: '#4A4636', lineHeight: 1.55, padding: '2px 0' }}>
              <b>{c.s.label}:</b> {n}
            </div>
          )))}
        </div>
      )}
    </div>
  )
}

// ── PDF (impressão do navegador → "Salvar como PDF") ───────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function htmlDoc(d: Doc, tab: DocTab, caixas: boolean, quebra: boolean): string {
  const cab = `<h3>${esc(d.nome)} <span class="pill">${esc(d.periodicidade || '—')}</span></h3>`
  let corpo: string
  if (tab === 'variacoes') {
    const { colunas, comuns, linhas } = derivarMatriz(d.sections, [])
    const comunsHtml = comuns.map(c => `<p class="comum"><b>${esc(c.label)}:</b> ${c.items.map(esc).join(' · ')}</p>`).join('')
    const head = `<tr><th>Contratante</th>${colunas.map(c => `<th>${esc(c.s.label)}</th>`).join('')}</tr>`
    const rows = linhas.map(l => `<tr><td class="l">${esc(l)}</td>${colunas.map(c => `<td class="c">${c.s.items.includes(l) ? '✓' : ''}</td>`).join('')}</tr>`).join('')
    const notas = colunas.flatMap(c => c.s.items.filter(isNota).map(n => `<li><b>${esc(c.s.label)}:</b> ${esc(n)}</li>`)).join('')
    corpo = `${comunsHtml}<table class="mx">${head}${rows}</table>${notas ? `<ul class="obs">${notas}</ul>` : ''}`
  } else {
    corpo = d.sections.map(s => `<h4>${esc(s.label)}</h4><ul class="${caixas ? 'box' : ''}">${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')
  }
  return `<section class="doc${quebra ? ' pb' : ''}">${cab}${corpo}</section>`
}

function htmlNrs(data: ManuaisData): string {
  const rows = [...data.nrs].sort((a, b) => a.origem.localeCompare(b.origem, 'pt-BR', { numeric: true }) || a.treinamento.localeCompare(b.treinamento, 'pt-BR'))
  const cols = ['Origem', 'Treinamento', 'CH formação', 'Periodicidade', 'CH reciclagem', 'Qualif. instrutor', 'Resp. técnico']
  const tb = rows.map(r => `<tr>${[r.origem, r.treinamento, r.ch, r.periodicidade, r.reciclagem, r.instrutor, r.resp].map(v => `<td>${esc(v || '—')}</td>`).join('')}</tr>`).join('')
  const obs = [...data.nrsObs].sort((a, b) => a.tag.localeCompare(b.tag, 'pt-BR')).map(o => `<li><b>${esc(o.tag)}:</b> ${esc(o.texto)}</li>`).join('')
  return `<section class="doc"><h3>Tabela de treinamentos normativos</h3><table class="nr"><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>${tb}</table>${obs ? `<h4>Orientações complementares</h4><ul class="obs">${obs}</ul>` : ''}</section>`
}

function imprimirPdf(titulo: string, corpoHtml: string) {
  const css = `
    @page{size:A4;margin:14mm 12mm}
    *{box-sizing:border-box}
    body{font-family:Calibri,Arial,sans-serif;color:#1E253D;font-size:11pt;margin:0}
    h1{font-size:20pt;margin:0 0 2px;color:#2A4F96}
    .sub{color:#6B7A99;font-size:9.5pt;margin-bottom:14px;border-bottom:2px solid #D1AE6E;padding-bottom:8px}
    h2{font-size:14pt;color:#fff;background:#2A4F96;padding:6px 10px;border-radius:5px;margin:18px 0 8px;break-after:avoid}
    h3{font-size:12pt;margin:12px 0 4px;break-after:avoid}
    h4{font-size:9pt;text-transform:uppercase;letter-spacing:.6px;color:#2A4F96;margin:8px 0 3px;break-after:avoid}
    .pill{font-size:8pt;font-weight:700;background:#EEF1F6;border-radius:99px;padding:1px 8px;margin-left:6px;vertical-align:middle}
    ul{margin:0 0 4px 16px;padding:0}li{margin:2px 0;line-height:1.35}
    ul.box{list-style:none;margin-left:2px}ul.box li{padding-left:18px;position:relative}
    ul.box li:before{content:"";position:absolute;left:0;top:3px;width:9px;height:9px;border:1.3px solid #6B7A99;border-radius:2px}
    .doc{break-inside:avoid-page;margin-bottom:10px}.doc.pb{break-before:page}
    table{border-collapse:collapse;width:100%;font-size:9pt;margin:6px 0}
    th,td{border:1px solid #CBD5E0;padding:4px 6px;text-align:left;vertical-align:top}
    th{background:#EEF3FB;color:#2A4F96}
    table.mx td.c{text-align:center;font-weight:700;color:#1E7A4A}table.mx th{text-align:center}table.mx td.l{font-weight:700}
    tr{break-inside:avoid}thead{display:table-header-group}
    .comum{font-size:9.5pt;background:#EEF4FF;padding:5px 8px;border-radius:4px;margin:4px 0}
    ul.obs{font-size:9.5pt;background:#FFFBF0;border-left:3px solid #D1AE6E;padding:6px 8px 6px 22px;margin-top:6px}
    .rod{margin-top:16px;font-size:8pt;color:#98A4B8;text-align:center}
  `
  const data = new Date().toLocaleDateString('pt-BR')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${css}</style></head><body>` +
    `<h1>${esc(titulo)}</h1><div class="sub">GT3 · Manuais — emitido em ${data}</div>${corpoHtml}<div class="rod">Documento gerado pelo Sistema Interno GT3 — confira sempre a versão mais atual no sistema.</div></body></html>`
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const w = iframe.contentWindow
  if (!w) { iframe.remove(); return }
  w.document.open(); w.document.write(html); w.document.close()
  const limpar = () => setTimeout(() => iframe.remove(), 1500)
  setTimeout(() => { w.focus(); w.print(); limpar() }, 250)
}

function PdfModal({ data, escopo, onClose, onToast }: {
  data: ManuaisData; escopo: TabKey; onClose: () => void; onToast: (m: string, err?: boolean) => void
}) {
  const grupos = useMemo(() => CATS_AZ
    .filter(c => c.key === escopo)
    .map(c => ({
      cat: c,
      itens: c.key === 'nrs'
        ? (data.nrs.length ? [{ id: '__nrs__', nome: 'Tabela de treinamentos (NRs)', per: `${data.nrs.length} linhas` }] : [])
        : data[c.key as DocTab].map(d => ({ id: d.id, nome: d.nome, per: d.periodicidade })),
    }))
    .filter(g => g.itens.length > 0), [data, escopo])

  // Tudo marcado por padrão — é só desmarcar o que não quiser imprimir.
  const [sel, setSel] = useState<Set<string>>(() => new Set(grupos.flatMap(g => g.itens.map(i => i.id))))
  const [caixas, setCaixas] = useState(true)
  const [quebra, setQuebra] = useState(false)
  const [busca, setBusca] = useState('')
  const total = grupos.reduce((n, g) => n + g.itens.length, 0)

  function alternar(ids: string[], marcar: boolean) {
    setSel(prev => { const n = new Set(prev); ids.forEach(id => marcar ? n.add(id) : n.delete(id)); return n })
  }

  function gerar() {
    const partes: string[] = []
    for (const g of grupos) {
      const marcados = g.itens.filter(i => sel.has(i.id))
      if (!marcados.length) continue
      partes.push(`<h2>${g.cat.icon} ${esc(g.cat.label)}</h2>`)
      if (g.cat.key === 'nrs') partes.push(htmlNrs(data))
      else marcados.forEach(i => {
        const d = data[g.cat.key as DocTab].find(x => x.id === i.id)
        if (d) partes.push(htmlDoc(d, g.cat.key as DocTab, caixas, quebra))
      })
    }
    if (!partes.length) { onToast('Marque ao menos um documento.', true); return }
    const titulo = `Manuais GT3 — ${catOf(escopo).label}`
    imprimirPdf(titulo, partes.join(''))
    onToast('Na janela de impressão, escolha "Salvar como PDF" ou a impressora.')
    onClose()
  }

  const q = norm(busca)
  return (
    <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, background: 'rgba(14,20,37,.5)', backdropFilter: 'blur(2px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="gt3-drop-in" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 24px 12px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>📄 Gerar PDF — {catOf(escopo).label}</div>
            <button onClick={onClose} style={{ ...iconBtn, marginLeft: 'auto', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 12.5, color: MUTED, margin: '4px 0 12px' }}>Tudo vem marcado. Desmarque o que não quiser imprimir.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar documento…" className="mn-input"
              style={{ flex: '1 1 180px', padding: '7px 11px', borderRadius: 9, border: `1.5px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <button style={btnGhost} onClick={() => alternar(grupos.flatMap(g => g.itens.map(i => i.id)), true)}>Marcar tudo</button>
            <button style={btnGhost} onClick={() => alternar(grupos.flatMap(g => g.itens.map(i => i.id)), false)}>Desmarcar tudo</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 24px' }}>
          {grupos.map(g => {
            const itens = g.itens.filter(i => !q || norm(i.nome).includes(q))
            if (!itens.length) return null
            const ids = g.itens.map(i => i.id)
            const n = ids.filter(id => sel.has(id)).length
            return (
              <div key={g.cat.key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>
                  <input type="checkbox" checked={n === ids.length} ref={el => { if (el) el.indeterminate = n > 0 && n < ids.length }}
                    onChange={e => alternar(ids, e.target.checked)} style={{ width: 17, height: 17, accentColor: PRIMARY }} />
                  <span>{g.cat.icon} {g.cat.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: MUTED }}>{n}/{ids.length}</span>
                </label>
                <div style={{ paddingLeft: 26 }}>
                  {itens.map(i => (
                    <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', cursor: 'pointer', fontSize: 13.5 }}>
                      <input type="checkbox" checked={sel.has(i.id)} onChange={e => alternar([i.id], e.target.checked)} style={{ width: 16, height: 16, accentColor: PRIMARY }} />
                      <span style={{ flex: 1 }}>{i.nome}</span>
                      {i.per && <span style={{ fontSize: 11, color: MUTED }}>{i.per}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
          {total === 0 && <div style={{ padding: 30, textAlign: 'center', color: MUTED }}>Nada para imprimir.</div>}
        </div>

        <div style={{ padding: '12px 24px 16px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, marginBottom: 12 }}>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={caixas} onChange={e => setCaixas(e.target.checked)} style={{ accentColor: PRIMARY }} /> Caixinhas ☐ de conferência
            </label>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={quebra} onChange={e => setQuebra(e.target.checked)} style={{ accentColor: PRIMARY }} /> Um documento por página
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, color: MUTED }}><b style={{ color: TEXT }}>{sel.size}</b> de {total} selecionado(s)</span>
            <span style={{ flex: 1 }} />
            <button onClick={onClose} style={btnGhost}>Cancelar</button>
            <button onClick={gerar} disabled={sel.size === 0} style={{ ...btnPrimary, opacity: sel.size ? 1 : .5 }}>📄 Gerar PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── NRs ────────────────────────────────────────────────────────────────────

const NR_COLS: { key: keyof NRRow; label: string; w?: number }[] = [
  { key: 'treinamento', label: 'Treinamento', w: 240 },
  { key: 'ch', label: 'CH formação', w: 100 },
  { key: 'periodicidade', label: 'Periodicidade', w: 120 },
  { key: 'reciclagem', label: 'CH reciclagem', w: 110 },
  { key: 'instrutor', label: 'Qualif. instrutor', w: 200 },
  { key: 'resp', label: 'Resp. técnico', w: 150 },
]

function origemColor(o: string): { bg: string; color: string } {
  if (o.startsWith('NR')) return { bg: '#EBF4FF', color: PRIMARY }
  if (o.startsWith('PF')) return { bg: '#EDE9FE', color: '#5B21B6' }
  return { bg: '#EEF1F6', color: '#4A5568' }
}

function NRsView({ data, canEdit, saveState, onChange, onPdf }: {
  data: ManuaisData; canEdit: boolean; saveState: SaveState; onPdf: () => void
  onChange: (fn: (rows: NRRow[], obs: NRObs[]) => void) => void
}) {
  const [edit, setEdit] = useState(false)
  const [origem, setOrigem] = useState('todas')
  const [texto, setTexto] = useState('')
  const modoEdicao = edit && canEdit
  const origens = useMemo(() => ['todas', ...Array.from(new Set(data.nrs.map(r => r.origem))).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))], [data.nrs])
  // Ordenação A–Z (clique no cabeçalho alterna). Em modo de edição a ordem fica fixa, senão a linha
  // "pula" de lugar enquanto se digita.
  const [sort, setSort] = useState<{ key: keyof NRRow; dir: 1 | -1 }>({ key: 'treinamento', dir: 1 })
  const linhas = data.nrs
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => (origem === 'todas' || r.origem === origem) && (!texto || norm(r.treinamento + ' ' + r.origem).includes(norm(texto))))
  if (!modoEdicao) {
    linhas.sort((a, b) => sort.dir * a.r[sort.key].localeCompare(b.r[sort.key], 'pt-BR', { numeric: true }) || a.r.treinamento.localeCompare(b.r.treinamento, 'pt-BR'))
  }

  const cell: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top', fontSize: 13, lineHeight: 1.45 }
  const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 7, border: `1.5px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>📚 NRs</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>Tabela de treinamentos normativos · {data.nrs.length} linha(s)</div>
        </div>
        {modoEdicao && saveState !== 'idle' && (
          <span style={{ fontSize: 12, fontWeight: 600, color: saveState === 'error' ? '#B91C1C' : saveState === 'saving' ? MUTED : '#1E7A4A' }}>
            {saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? '✓ Salvo' : '⚠ Erro ao salvar'}
          </span>
        )}
        <button onClick={onPdf} style={btnGhost}>📄 PDF desta categoria</button>
        {canEdit && (
          <button onClick={() => setEdit(v => !v)} style={edit ? btnPrimary : btnGhost}>{edit ? '✓ Concluir edição' : '✏️ Editar tabela'}</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Filtrar treinamento…" className="mn-input"
          style={{ ...inp, width: 240, padding: '8px 12px', borderRadius: 10 }} />
        {origens.map(o => <Chip key={o} on={origem === o} onClick={() => setOrigem(o)}>{o === 'todas' ? 'Todas' : o}</Chip>)}
      </div>

      <div style={{ background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
            <thead>
              <tr>
                {[{ key: 'origem', label: 'Origem', w: 90 }, ...NR_COLS, ...(modoEdicao ? [{ key: 'x', label: '', w: 44 }] : [])].map(h => (
                  <th key={h.key} onClick={() => { if (!modoEdicao && h.key !== 'x') setSort(p => ({ key: h.key as keyof NRRow, dir: p.key === h.key ? (p.dir === 1 ? -1 : 1) : 1 })) }} style={{ cursor: modoEdicao || h.key === 'x' ? 'default' : 'pointer', position: 'sticky', top: 0, zIndex: 1, background: '#F5F8FC', padding: '11px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.8px', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap', width: h.w }}>{h.label}{!modoEdicao && sort.key === h.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 36, textAlign: 'center', color: MUTED, fontSize: 13 }}>Nenhum treinamento encontrado.</td></tr>
              )}
              {linhas.map(({ r, i }) => {
                const oc = origemColor(r.origem)
                return (
                  <tr key={i} className="mn-row" style={{ borderTop: `1px solid #F1F5F9` }}>
                    <td style={cell}>
                      {modoEdicao
                        ? <input value={r.origem} onChange={e => onChange(rows => { rows[i].origem = e.target.value })} className="mn-input" style={inp} />
                        : <span style={{ background: oc.bg, color: oc.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{r.origem}</span>}
                    </td>
                    {NR_COLS.map(c => (
                      <td key={c.key} style={{ ...cell, color: c.key === 'resp' && r.resp.startsWith('Sim') ? '#1E7A4A' : TEXT, fontWeight: c.key === 'treinamento' ? 600 : 400 }}>
                        {modoEdicao
                          ? <input value={r[c.key]} onChange={e => onChange(rows => { rows[i][c.key] = e.target.value })} className="mn-input" style={inp} />
                          : (r[c.key] || '—')}
                      </td>
                    ))}
                    {modoEdicao && (
                      <td style={{ ...cell, textAlign: 'center' }}>
                        <button title="Remover linha" style={{ ...iconBtn, color: '#DC2626' }}
                          onClick={() => { if (confirm('Remover esta linha?')) onChange(rows => { rows.splice(i, 1) }) }}>🗑</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {modoEdicao && (
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: 10 }}>
            <button onClick={() => onChange(rows => { rows.push({ origem: 'NR ?', treinamento: 'Novo treinamento', ch: '—', periodicidade: '—', reciclagem: '—', instrutor: '—', resp: '—' }) })}
              style={{ ...btnGhost, width: '100%', borderStyle: 'dashed', color: PRIMARY }}>＋ Adicionar linha</button>
          </div>
        )}
      </div>

      {/* Orientações complementares */}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>Orientações complementares</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {data.nrsObs.map((o, i) => ({ o, i })).sort((a, b) => modoEdicao ? 0 : a.o.tag.localeCompare(b.o.tag, 'pt-BR')).map(({ o, i }) => (
            <div key={i} style={{ background: '#FFFBF0', border: '1px solid #F1E2B8', borderLeft: `4px solid ${ACCENT}`, borderRadius: 12, padding: '12px 14px' }}>
              {modoEdicao ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={o.tag} onChange={e => onChange((_r, obs) => { obs[i].tag = e.target.value })} className="mn-input" style={{ ...inp, fontWeight: 700 }} />
                    <button title="Remover" style={{ ...iconBtn, color: '#DC2626' }} onClick={() => onChange((_r, obs) => { obs.splice(i, 1) })}>🗑</button>
                  </div>
                  <AutoText value={o.texto} onChange={v => onChange((_r, obs) => { obs[i].texto = v })} />
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#7A5B12', marginBottom: 4 }}>{o.tag}</div>
                  <div style={{ fontSize: 13, color: '#4A4636', lineHeight: 1.55 }}>{o.texto}</div>
                </>
              )}
            </div>
          ))}
          {modoEdicao && (
            <button onClick={() => onChange((_r, obs) => { obs.push({ tag: 'Nova orientação', texto: '' }) })}
              style={{ border: `1.5px dashed #E0CB8F`, background: 'transparent', borderRadius: 12, padding: 14, color: '#7A5B12', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>＋ Adicionar orientação</button>
          )}
        </div>
      </div>
    </div>
  )
}
