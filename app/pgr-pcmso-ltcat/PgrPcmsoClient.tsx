'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '../components/UserContext'

// ─── Types ─────────────────────────────────────────────────────────────────────

type DocKey = 'pgr_pcmso' | 'pgr' | 'pcmso' | 'ltcat' | 'pgr_ltcat' | 'todos'
type ResultadoKey = 'aprovado' | '60dias'
type PeriodKey = 'anual' | 'bienal' | 'na'

type ContratanteConfig = {
  id: string
  name: string
  has60Dias: boolean
  portal: string
}

type Texts = {
  trein_aprovado: string
  trein_restricao: string
  consideracoes: string
  assinatura: string
  frente_intro: string
  frente_inventario: string
  fechamento_aprovado: string
  fechamento_restricao: string
}

type SituationKey = 'aprovado' | '60dias' | 'all'

type FileEntry = {
  id: string
  name: string      // display name, editável
  filename: string  // nome original do arquivo
  mimeType: string
  sizeBytes: number
  notes: string
  situations: SituationKey[]  // quais tipos de e-mail incluem este arquivo
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CONTRATANTES: ContratanteConfig[] = [
  { id: 'mar-ana',   name: 'Marcopolo Ana Rech',                                   has60Dias: true, portal: 'Marcopolo' },
  { id: 'mar-sc',    name: 'Marcopolo São Cristóvão',                              has60Dias: true, portal: 'Marcopolo' },
  { id: 'volare',    name: 'Volare',                                                has60Dias: true, portal: 'Marcopolo e Volare' },
  { id: 'mar-ambos', name: 'Marcopolo Ana Rech e Marcopolo São Cristóvão',         has60Dias: true, portal: 'Marcopolo' },
  { id: 'todos',     name: 'Marcopolo Ana Rech, Marcopolo São Cristóvão e Volare', has60Dias: true, portal: 'Marcopolo e Volare' },
]

const DEFAULT_TEXTS: Texts = {
  trein_aprovado: `Caso tenha previsão de realizar trabalho em altura (NR 35), operação de PEMT (NR 18), atividades com elétrica (NR 10), operação/manutenção de equipamentos com partes móveis (NR 12) ou atividades em espaço confinado (NR 33), ou outros aplicáveis, por favor nos indicar, a fim de regularizar os requisitos de treinamentos específicos e auxiliar na liberação operacional da atividade no cliente.`,
  trein_restricao: `• Comunicar (se aplicável) os treinamentos necessários para cada funcionário conforme a atividade prevista, ou seja, qual(is) funcionário(s) irá(ão) realizar atividades em altura (NR 35), eletricidade (NR 10), operação de máquinas e equipamentos com partes móveis (NR 12), operação de PEMT (NR 18), espaço confinado (NR 33), manuseio de inflamáveis (NR 20), ou outros aplicáveis.`,
  consideracoes: `Considerações:\n\n• O aditivo ao PGR deve estar assinado e com identificação/registro do elaborador do PGR de referência;\n\n• Ao cadastrar pessoas no Portal, a função indicada no sistema deve ser a mais próxima ao ASO e ficha registro (estes dois precisam conter a mesma função). Havendo dúvida neste ou outro processo no Portal, a pasta à sua esquerda irá lhe auxiliar;`,
  assinatura: `Quanto à assinatura: não é necessário escanear todo o documento. Você pode pegar apenas a página indicada, coletar a assinatura e anexar junto ao documento novamente. Ou, se preferir, pode assinar digitalmente.`,
  frente_intro: `Na indicação da frente de trabalho devem estar descritos os riscos que os funcionários da empresa estão expostos ao realizar as atividades dentro da contratante, a atividade, dados da contratante, os ambientes/setores onde habitualmente as atividades da sua empresa ocorrerão e as medidas preventivas para esses riscos.`,
  frente_inventario: `Para facilitar a verificação dos riscos, o Grupo Marcopolo disponibilizou o Inventário de Riscos para os terceiros (em anexo), que você encontra dentro do Portal no caminho: Pasta Contratantes > Download Documentos > {portal} > Inventário de Riscos-PGR.\n\nAlém do inventário, também em anexo, você encontrará uma sugestão de modelo, onde pode preencher as informações e anexar junto ao seu PGR, bem como o(s) CNPJ de sua(s) contratante(s), para facilitar o preenchimento dos dados no campo "Dados da contratante".`,
  fechamento_aprovado: `Se necessário atualizá-los antes do prazo do portal, por favor nos contate.`,
  fechamento_restricao: `Dúvidas, estamos à disposição.`,
}

const TEXT_LABELS: Record<keyof Texts, string> = {
  trein_aprovado:       'Bloco de treinamentos NR — Aprovação',
  trein_restricao:      'Bloco de treinamentos NR — Restrição 60 dias',
  consideracoes:        'Considerações — Restrição 60 dias',
  assinatura:           'Texto sobre assinatura do documento',
  frente_intro:         'Introdução da frente de trabalho',
  frente_inventario:    'Inventário de riscos — caminho do portal',
  fechamento_aprovado:  'Fechamento — Aprovação',
  fechamento_restricao: 'Fechamento — Restrição 60 dias',
}

const DOC_OPTIONS: { val: DocKey; label: string }[] = [
  { val: 'pgr_pcmso', label: 'PGR + PCMSO' },
  { val: 'pgr',       label: 'PGR' },
  { val: 'pcmso',     label: 'PCMSO' },
  { val: 'ltcat',     label: 'LTCAT' },
  { val: 'pgr_ltcat', label: 'PGR + LTCAT' },
  { val: 'todos',     label: 'PGR + PCMSO + LTCAT' },
]

const PERIOD_OPTIONS: { val: PeriodKey; label: string }[] = [
  { val: 'anual',  label: 'Anual' },
  { val: 'bienal', label: 'Bienal' },
  { val: 'na',     label: 'N/A (sem PCMSO)' },
]

const SAUDACAO_OPTIONS = ['Bom dia!', 'Boa tarde!', 'Olá!']

const DOC_LABEL:  Record<DocKey, string> = { pgr_pcmso:'PGR e PCMSO', pgr:'PGR', pcmso:'PCMSO', ltcat:'LTCAT', pgr_ltcat:'PGR e LTCAT', todos:'PGR, PCMSO e LTCAT' }
const DOC_PLURAL: Record<DocKey, string> = { pgr_pcmso:'os programas', pgr:'o programa', pcmso:'o programa', ltcat:'o programa', pgr_ltcat:'os programas', todos:'os programas' }
const DOC_AMBOS:  Record<DocKey, string> = { pgr_pcmso:'ambos aprovados', pgr:'aprovado', pcmso:'aprovado', ltcat:'aprovado', pgr_ltcat:'ambos aprovados', todos:'todos aprovados' }

function hasPcmso(d: DocKey) { return ['pgr_pcmso','pcmso','todos'].includes(d) }
function hasPgr(d: DocKey)   { return ['pgr_pcmso','pgr','pgr_ltcat','todos'].includes(d) }
function hasLtcat(d: DocKey) { return ['ltcat','pgr_ltcat','todos'].includes(d) }

// ─── Theme ─────────────────────────────────────────────────────────────────────

const C = {
  primary:      '#2A4F96',
  primaryDark:  '#1f3d75',
  primaryLight: '#eaf0fa',
  primaryMid:   '#c4d0ee',
  accent:       '#D1AE6E',
  bg:           '#F4F6FA',
  surface:      '#ffffff',
  border:       '#d8dde8',
  borderLight:  '#eaecf3',
  text:         '#1a1f2e',
  muted:        '#6b7490',
  hint:         '#9ba3bc',
  ok:           '#16a34a',
  okBg:         '#e6f4ec',
  warn:         '#7d5a00',
  warnBg:       '#fff8e6',
  radius:       '10px',
  radiusSm:     '6px',
}

// ─── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY_CT    = 'pgr-pcmso-contratantes'
const STORAGE_KEY_TX    = 'pgr-pcmso-texts'
const STORAGE_KEY_FILES = 'pgr-pcmso-files-meta'

// ─── IndexedDB helpers (file blobs) ───────────────────────────────────────────

const IDB_NAME  = 'pgr-files'
const IDB_STORE = 'blobs'

function openFilesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}
async function idbPut(id: string, blob: Blob) {
  const db = await openFilesDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}
async function idbGet(id: string): Promise<Blob | null> {
  const db = await openFilesDB()
  return new Promise(resolve => {
    const tx  = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(id)
    req.onsuccess = () => resolve((req.result as Blob) ?? null)
    req.onerror   = () => resolve(null)
  })
}
async function idbDelete(id: string) {
  const db = await openFilesDB()
  return new Promise<void>(resolve => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => resolve()
  })
}

// ─── File helpers ──────────────────────────────────────────────────────────────

function fileTypeInfo(mime: string): { color: string; label: string; bg: string } {
  if (mime.includes('pdf'))                                       return { color: '#c53030', bg: '#fff5f5', label: 'PDF' }
  if (mime.includes('word') || mime.includes('document'))         return { color: '#2b6cb0', bg: '#ebf8ff', label: 'DOC' }
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('spreadsheet')) return { color: '#276749', bg: '#f0fff4', label: 'XLS' }
  return { color: '#718096', bg: '#f7fafc', label: 'ARQ' }
}

function formatSize(bytes: number): string {
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─── Custom Dropdown ───────────────────────────────────────────────────────────

function Dropdown({
  value, options, onSelect, placeholder,
}: {
  value: string
  options: { val: string; label: string }[]
  onSelect: (val: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    if (open) { setSearch(''); setTimeout(() => searchRef.current?.focus(), 40) }
  }, [open])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.val === value)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%', padding: '10px 14px',
          border: `1px solid ${open ? C.primary : C.border}`,
          borderRadius: C.radius, background: C.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          cursor: 'pointer', userSelect: 'none',
          boxShadow: open ? `0 0 0 3px rgba(42,79,150,.1)` : 'none',
          transition: 'border-color .15s, box-shadow .15s',
        }}
      >
        <span style={{ fontSize: 14, color: selected ? C.text : C.hint, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected?.label ?? placeholder ?? '—'}
        </span>
        <svg style={{ width: 16, height: 16, color: C.muted, flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius,
          boxShadow: '0 8px 24px rgba(0,0,0,.1)', overflow: 'hidden',
        }}>
          {options.length > 4 && (
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg style={{ width: 14, height: 14, color: C.hint, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar…"
                style={{ border: 'none', outline: 'none', fontSize: 13, color: C.text, background: 'transparent', width: '100%' }}
              />
            </div>
          )}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 13, color: C.hint, textAlign: 'center' }}>Nenhum resultado</div>
            ) : filtered.map(o => (
              <div
                key={o.val}
                onClick={() => { onSelect(o.val); setOpen(false) }}
                style={{
                  padding: '9px 14px', fontSize: 13.5, color: o.val === value ? C.primary : C.text,
                  background: o.val === value ? C.primaryLight : 'transparent',
                  fontWeight: o.val === value ? 600 : 400,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (o.val !== value) (e.currentTarget as HTMLElement).style.background = C.primaryLight }}
                onMouseLeave={e => { if (o.val !== value) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <svg style={{ width: 14, height: 14, color: C.primary, flexShrink: 0, opacity: o.val === value ? 1 : 0 }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PgrPcmsoClient() {
  const { profile } = useUser()
  const papel = profile?.papel ?? 'colaborador'
  const canEdit               = papel === 'admin' || papel === 'gestor' || papel === 'colaborador'
  const canManageContratantes = papel === 'admin' || papel === 'gestor' || papel === 'colaborador'

  // form state
  const [empresa, setEmpresa] = useState('')
  const [contratanteId, setContratanteId] = useState('mar-ana')
  const [docs, setDocs] = useState<DocKey>('pgr_pcmso')
  const [resultado, setResultado] = useState<ResultadoKey>('aprovado')
  const [periodicidade, setPeriodicidade] = useState<PeriodKey>('anual')
  const [treinamentos, setTreinamentos] = useState('sim')
  const [restricoes, setRestricoes] = useState<Set<string>>(new Set())
  const [saudacao, setSaudacao] = useState('Bom dia!')

  // config
  const [contratantes, setContratantes] = useState<ContratanteConfig[]>(DEFAULT_CONTRATANTES)
  const [texts, setTexts] = useState<Texts>(DEFAULT_TEXTS)

  // files
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([])
  const [fileEnabled, setFileEnabled] = useState<Record<string, boolean>>({})
  const [fileCopyStatus, setFileCopyStatus] = useState<Record<string, 'idle' | 'ok' | 'dl'>>({})
  const fileTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)

  // edit panel
  const [editOpen, setEditOpen] = useState(false)
  const [editSection, setEditSection] = useState<'textos' | 'contratantes' | 'anexos'>('textos')
  const [openTextKey, setOpenTextKey] = useState<keyof Texts | null>(null)
  const [newCtName, setNewCtName] = useState('')
  const [newCtPortal, setNewCtPortal] = useState('Marcopolo')
  const [newCt60, setNewCt60] = useState(true)

  // copy text
  const [copied, setCopied] = useState<'assunto' | 'corpo' | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const ct = localStorage.getItem(STORAGE_KEY_CT)
      if (ct) setContratantes(JSON.parse(ct))
      const tx = localStorage.getItem(STORAGE_KEY_TX)
      if (tx) setTexts(prev => ({ ...prev, ...JSON.parse(tx) }))
      const fm = localStorage.getItem(STORAGE_KEY_FILES)
      if (fm) {
        const entries: FileEntry[] = JSON.parse(fm)
        setFileEntries(entries)
        setFileEnabled(Object.fromEntries(entries.map(e => [e.id, true])))
      }
    } catch { /* noop */ }
  }, [])

  function saveCt(list: ContratanteConfig[]) {
    setContratantes(list)
    localStorage.setItem(STORAGE_KEY_CT, JSON.stringify(list))
  }

  function saveTx(t: Texts) {
    setTexts(t)
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(t))
  }

  function saveFileMeta(list: FileEntry[]) {
    setFileEntries(list)
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(list))
  }

  function updateFileEntry(id: string, patch: Partial<FileEntry>) {
    saveFileMeta(fileEntries.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const id = `f-${Date.now()}`
    await idbPut(id, new Blob([await file.arrayBuffer()], { type: file.type }))
    const entry: FileEntry = {
      id,
      name: file.name.replace(/\.[^.]+$/, ''),
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      notes: '',
      situations: ['all'],
    }
    const updated = [...fileEntries, entry]
    saveFileMeta(updated)
    setFileEnabled(prev => ({ ...prev, [id]: true }))
    e.target.value = ''
  }

  async function handleRemoveFile(id: string) {
    await idbDelete(id)
    saveFileMeta(fileEntries.filter(e => e.id !== id))
    setFileEnabled(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function copyFileToClipboard(entry: FileEntry) {
    const blob = await idbGet(entry.id)
    if (!blob) return

    const setStatus = (s: 'ok' | 'dl') => {
      setFileCopyStatus(prev => ({ ...prev, [entry.id]: s }))
      if (fileTimers.current[entry.id]) clearTimeout(fileTimers.current[entry.id])
      fileTimers.current[entry.id] = setTimeout(() =>
        setFileCopyStatus(prev => ({ ...prev, [entry.id]: 'idle' })), 3500)
    }

    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setStatus('ok')
    } catch {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = entry.filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus('dl')
    }
  }

  const [copyAllStatus, setCopyAllStatus] = useState<'idle' | 'ok' | 'dl'>('idle')
  const copyAllTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function fileMatchesSituation(fe: FileEntry): boolean {
    const sits = fe.situations ?? ['all']
    return sits.includes('all') || sits.includes(resultado as SituationKey)
  }

  async function copyAllMatching() {
    const matching = fileEntries.filter(fe => fileMatchesSituation(fe) && fileEnabled[fe.id])
    if (matching.length === 0) return

    // tenta clipboard; como múltiplos ClipboardItem não acumulam no Outlook,
    // a estratégia mais confiável é baixar todos e arrastar para o e-mail
    let downloaded = 0
    for (const fe of matching) {
      const blob = await idbGet(fe.id)
      if (!blob) continue
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fe.filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      downloaded++
      await new Promise(r => setTimeout(r, 250))
    }

    setCopyAllStatus(downloaded > 0 ? 'dl' : 'idle')
    if (copyAllTimer.current) clearTimeout(copyAllTimer.current)
    copyAllTimer.current = setTimeout(() => setCopyAllStatus('idle'), 4000)
  }

  const selectedCt = contratantes.find(c => c.id === contratanteId) ?? contratantes[0]

  const resultadoOptions = [
    { val: 'aprovado', label: '✅ Aprovado' },
    ...(selectedCt?.has60Dias ? [{ val: '60dias', label: '⏳ Aprovado com restrição — 60 dias' }] : []),
  ]

  useEffect(() => {
    if (resultado === '60dias' && !selectedCt?.has60Dias) setResultado('aprovado')
  }, [contratanteId, selectedCt?.has60Dias, resultado])

  // auto-ativa arquivos da situação atual
  useEffect(() => {
    if (fileEntries.length === 0) return
    setFileEnabled(Object.fromEntries(
      fileEntries.map(fe => {
        const sits = fe.situations ?? ['all']
        return [fe.id, sits.includes('all') || sits.includes(resultado as SituationKey)]
      })
    ))
  }, [resultado, fileEntries])

  // ── Email builder ────────────────────────────────────────────

  const buildAssunto = useCallback(() => {
    const emp = empresa.trim() || '[Empresa]'
    return `Portal GT3 - Parecer ${DOC_LABEL[docs]} - ${emp}`
  }, [empresa, docs])

  const buildCorpo = useCallback(() => {
    const s = saudacao
    const plural = DOC_PLURAL[docs]
    const ambos  = DOC_AMBOS[docs]
    const cont   = selectedCt?.name ?? ''

    if (resultado === 'aprovado') {
      let periLine = ''
      if (hasPcmso(docs) && periodicidade !== 'na') {
        periLine = docs === 'pgr_pcmso'
          ? ` (PGR com periodicidade bienal e PCMSO com periodicidade ${periodicidade}, podendo ambos ser bienais conforme NR 1, a critério do elaborador)`
          : ` (PCMSO com periodicidade ${periodicidade})`
      }
      let body = `${s}\n\nFinalizamos a verificação ${plural} de SSO, ${ambos}${periLine}. ${texts.fechamento_aprovado}`
      if (treinamentos === 'sim') body += `\n\n${texts.trein_aprovado}`
      return body + `\n\nAtenciosamente,`
    }

    if (resultado === '60dias') {
      const r = restricoes
      const sufixo = r.has('portal') ? ', bem como demais itens informados no portal' : ''
      let body = `${s}\n\nFinalizamos a verificação ${plural} de SSO enviados ao portal de terceiros, ${ambos} com restrição por 60 dias para que sejam atualizados com a indicação da frente de trabalho ${cont}${sufixo}:\n`
      if (hasPgr(docs))   body += `\nPGR:\n`
      if (hasPcmso(docs)) body += `\nPCMSO:\n`
      if (hasLtcat(docs)) body += `\nLTCAT:\n`
      body += `\n${texts.frente_intro}\n\n`
      body += texts.frente_inventario.replace('{portal}', selectedCt?.portal ?? 'Marcopolo')
      if (r.has('assinatura')) body += `\n\n${texts.assinatura}`
      body += `\n\n${texts.consideracoes}`
      if (r.has('treinamentos')) body += `\n\n${texts.trein_restricao}`
      return body + `\n\n${texts.fechamento_restricao}\n\nAtenciosamente,`
    }

    return ''
  }, [resultado, docs, saudacao, selectedCt, periodicidade, treinamentos, restricoes, texts])

  function copiar(tipo: 'assunto' | 'corpo') {
    const txt = tipo === 'assunto' ? buildAssunto() : buildCorpo()
    navigator.clipboard.writeText(txt).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    })
    if (copyTimer.current) clearTimeout(copyTimer.current)
    setCopied(tipo)
    copyTimer.current = setTimeout(() => setCopied(null), 2500)
  }

  function toggleRestricao(key: string) {
    setRestricoes(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }

  function addContratante() {
    const name = newCtName.trim()
    if (!name) return
    const id = `custom-${Date.now()}`
    saveCt([...contratantes, { id, name, has60Dias: newCt60, portal: newCtPortal }])
    setNewCtName('')
  }

  function removeContratante(id: string) {
    if (contratanteId === id) setContratanteId(contratantes.find(c => c.id !== id)?.id ?? '')
    saveCt(contratantes.filter(c => c.id !== id))
  }

  // ─────────────────────────────────────────────────────────────

  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '.07em',
    marginBottom: 6, marginTop: 20,
  }
  const condLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: C.primary,
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
  }

  const assunto = buildAssunto()
  const corpo   = buildCorpo()


  return (
    <div style={{ background: C.bg, minHeight: '100%', padding: '24px 20px 48px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.primary, margin: 0 }}>PGR / PCMSO / LTCAT</h1>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Preencha os campos abaixo e copie o resultado</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setEditOpen(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 14px', borderRadius: C.radiusSm,
                border: `1px solid ${editOpen ? C.primary : C.border}`,
                background: editOpen ? C.primaryLight : C.surface,
                color: editOpen ? C.primary : C.muted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .15s',
              }}
            >
              <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {editOpen ? 'Fechar editor' : 'Editar textos padrão'}
            </button>
          )}
        </div>

        {/* ── Painel de edição ── */}
        {editOpen && (
          <div style={{ background: C.warnBg, border: '1px solid #e8d49a', borderRadius: C.radius, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.warn, marginBottom: 4 }}>Modo de edição</div>
            <p style={{ fontSize: 12, color: '#9b7a1a', marginBottom: 12, lineHeight: 1.5 }}>
              Edite os blocos de texto, gerencie os contratantes ou configure os arquivos padrão de anexo.
            </p>

            {/* Section tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['textos', ...(canManageContratantes ? ['contratantes'] : []), 'anexos'] as ('textos' | 'contratantes' | 'anexos')[]).map(s => (
                <button
                  key={s}
                  onClick={() => setEditSection(s)}
                  style={{
                    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${editSection === s ? C.warn : '#e8d49a'}`,
                    background: editSection === s ? C.warn : 'rgba(255,255,255,.5)',
                    color: editSection === s ? '#fff' : C.warn,
                    transition: 'all .15s',
                  }}
                >
                  {s === 'textos' ? 'Textos padrão' : s === 'contratantes' ? 'Contratantes' : 'Arquivos'}
                </button>
              ))}
            </div>

            {/* Textos */}
            {editSection === 'textos' && (
              <div style={{ border: '1px solid #e8d49a', borderRadius: C.radiusSm, overflow: 'hidden' }}>
                {(Object.keys(TEXT_LABELS) as (keyof Texts)[]).map(key => (
                  <div key={key} style={{ borderBottom: '1px solid #e8d49a' }}>
                    <button
                      onClick={() => setOpenTextKey(openTextKey === key ? null : key)}
                      style={{
                        width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.warn,
                        background: openTextKey === key ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.5)',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
                        transition: 'background .15s',
                      }}
                    >
                      <span>{TEXT_LABELS[key]}</span>
                      <svg style={{ width: 14, height: 14, transition: 'transform .2s', transform: openTextKey === key ? 'rotate(180deg)' : 'none' }}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {openTextKey === key && (
                      <div style={{ padding: '12px 14px', background: '#fff' }}>
                        <textarea
                          value={texts[key]}
                          onChange={e => saveTx({ ...texts, [key]: e.target.value })}
                          rows={5}
                          style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 12.5, lineHeight: 1.6, fontFamily: 'inherit', color: C.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <button
                          onClick={() => saveTx({ ...texts, [key]: DEFAULT_TEXTS[key] })}
                          style={{ marginTop: 4, fontSize: 11.5, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0 }}
                        >
                          Restaurar padrão
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Contratantes */}
            {editSection === 'contratantes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contratantes.map(ct => (
                  <div key={ct.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid #e8d49a', borderRadius: C.radiusSm, background: 'rgba(255,255,255,.7)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{ct.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Portal: {ct.portal}</div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', color: ct.has60Dias ? C.warn : C.muted }}>
                      <input type="checkbox" checked={ct.has60Dias} onChange={() => saveCt(contratantes.map(c => c.id === ct.id ? { ...c, has60Dias: !c.has60Dias } : c))} style={{ cursor: 'pointer' }} />
                      60 dias
                    </label>
                    <button
                      onClick={() => removeContratante(ct.id)}
                      style={{ background: 'none', border: '1px solid #e8d49a', borderRadius: C.radiusSm, color: '#c0392b', cursor: 'pointer', padding: '3px 8px', fontSize: 13 }}
                    >✕</button>
                  </div>
                ))}

                <div style={{ marginTop: 4, padding: '12px 14px', border: '1px dashed #e8d49a', borderRadius: C.radiusSm, background: 'rgba(255,255,255,.5)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.warn, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Novo contratante</div>
                  <input
                    type="text" value={newCtName} placeholder="Nome do contratante…"
                    onChange={e => setNewCtName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addContratante()}
                    style={{ width: '100%', padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={newCtPortal} onChange={e => setNewCtPortal(e.target.value)}
                      style={{ flex: 1, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="Marcopolo">Portal: Marcopolo</option>
                      <option value="Marcopolo e Volare">Portal: Marcopolo e Volare</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={newCt60} onChange={e => setNewCt60(e.target.checked)} />
                      60 dias
                    </label>
                    <button
                      onClick={addContratante}
                      style={{ padding: '7px 14px', borderRadius: C.radiusSm, border: 'none', background: C.primary, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => { saveCt(DEFAULT_CONTRATANTES); setContratanteId('mar-ana') }}
                  style={{ alignSelf: 'flex-start', fontSize: 11.5, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0 }}
                >
                  Restaurar lista padrão
                </button>
              </div>
            )}

            {/* Arquivos */}
            {editSection === 'anexos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: '#9b7a1a', marginBottom: 2, lineHeight: 1.5 }}>
                  Carregue os arquivos que costuma enviar neste tipo de e-mail. Use as anotações para indicar em quais situações cada arquivo se aplica — a seleção é sempre manual.
                </p>

                {/* Upload */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 16px', borderRadius: C.radiusSm,
                      border: '2px dashed #e8d49a', background: 'rgba(255,255,255,.6)',
                      color: C.warn, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      width: '100%', justifyContent: 'center',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.9)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.6)')}
                  >
                    <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Carregar arquivo (PDF, Word, Excel…)
                  </button>
                </div>

                {/* File list */}
                {fileEntries.length === 0 ? (
                  <div style={{ padding: '12px 0', fontSize: 13, color: '#9b7a1a', textAlign: 'center' }}>
                    Nenhum arquivo carregado ainda.
                  </div>
                ) : fileEntries.map(fe => {
                  const ti = fileTypeInfo(fe.mimeType)
                  const isEditing = editingFileId === fe.id
                  return (
                    <div key={fe.id} style={{ border: '1px solid #e8d49a', borderRadius: C.radiusSm, background: 'rgba(255,255,255,.8)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                        {/* Type badge */}
                        <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 6, background: ti.bg, border: `1px solid ${ti.color}22`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: ti.color, letterSpacing: '.04em' }}>{ti.label}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isEditing ? (
                            <input
                              autoFocus
                              value={fe.name}
                              onChange={e => updateFileEntry(fe.id, { name: e.target.value })}
                              onBlur={() => setEditingFileId(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingFileId(null)}
                              style={{ width: '100%', padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                            />
                          ) : (
                            <div
                              onClick={() => setEditingFileId(fe.id)}
                              title="Clique para renomear"
                              style={{ fontSize: 13, fontWeight: 500, color: C.text, cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {fe.name}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{fe.filename} · {formatSize(fe.sizeBytes)}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(fe.id)}
                          style={{ background: 'none', border: '1px solid #e8d49a', borderRadius: C.radiusSm, color: '#c0392b', cursor: 'pointer', padding: '3px 8px', fontSize: 13, flexShrink: 0 }}
                        >✕</button>
                      </div>
                      {/* Situations */}
                      <div style={{ padding: '0 12px 10px', borderTop: '1px solid #f5e4a0' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#c0922b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, marginTop: 8 }}>Incluir neste tipo de e-mail</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {([
                            { val: 'all',      label: 'Todos os e-mails' },
                            { val: 'aprovado', label: '✅ Aprovado' },
                            { val: '60dias',   label: '⏳ 60 dias' },
                          ] as { val: SituationKey; label: string }[]).map(opt => {
                            const sits = fe.situations ?? ['all']
                            const active = sits.includes(opt.val)
                            return (
                              <button
                                key={opt.val}
                                onClick={() => {
                                  let next: SituationKey[]
                                  if (opt.val === 'all') {
                                    next = active ? ['aprovado'] : ['all']
                                  } else {
                                    const without = sits.filter(s => s !== 'all' && s !== opt.val)
                                    next = active ? (without.length ? without : ['all']) : [...sits.filter(s => s !== 'all'), opt.val]
                                  }
                                  updateFileEntry(fe.id, { situations: next })
                                }}
                                style={{
                                  padding: '4px 11px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
                                  cursor: 'pointer', transition: 'all .15s',
                                  background: active ? C.warn : 'rgba(255,255,255,.7)',
                                  color: active ? '#fff' : C.warn,
                                  border: `1px solid ${active ? C.warn : '#e8d49a'}`,
                                  fontWeight: active ? 600 : 400,
                                }}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                        <input
                          type="text"
                          value={fe.notes}
                          onChange={e => updateFileEntry(fe.id, { notes: e.target.value })}
                          placeholder="Observação opcional…"
                          style={{ marginTop: 8, width: '100%', padding: '5px 8px', border: `1px solid #e8d49a`, borderRadius: 4, fontSize: 12, fontFamily: 'inherit', color: C.text, outline: 'none', background: 'rgba(255,248,230,.5)', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Campos ── */}

        {/* 1. Empresa */}
        <div style={{ ...sectionTitle, marginTop: 0 }}>Empresa destinatária</div>
        <input
          type="text" value={empresa} placeholder="Nome da empresa contratada…"
          onChange={e => setEmpresa(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: C.radius, fontSize: 14, fontFamily: 'inherit', background: C.surface, outline: 'none', color: C.text, boxSizing: 'border-box', transition: 'border-color .15s' }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.primary; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(42,79,150,.08)' }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = C.border; (e.target as HTMLInputElement).style.boxShadow = 'none' }}
        />

        {/* 2. Contratante */}
        <div style={sectionTitle}>Contratante</div>
        <Dropdown
          value={contratanteId}
          options={contratantes.map(c => ({ val: c.id, label: c.name }))}
          onSelect={setContratanteId}
        />

        {/* 3. Documentos */}
        <div style={sectionTitle}>Documentos avaliados</div>
        <Dropdown value={docs} options={DOC_OPTIONS} onSelect={v => setDocs(v as DocKey)} />

        {/* 4. Resultado */}
        <div style={sectionTitle}>Resultado do parecer</div>
        <Dropdown value={resultado} options={resultadoOptions} onSelect={v => setResultado(v as ResultadoKey)} />

        {/* Bloco aprovado */}
        {resultado === 'aprovado' && (
          <div style={{ marginTop: 12, padding: '14px 16px', background: C.primaryLight, border: `1px solid ${C.primaryMid}`, borderRadius: C.radius }}>
            <div style={condLabel}>Aprovação — opções adicionais</div>

            {hasPcmso(docs) && (
              <>
                <div style={{ ...sectionTitle, marginTop: 6 }}>Periodicidade do PCMSO</div>
                <Dropdown value={periodicidade} options={PERIOD_OPTIONS} onSelect={v => setPeriodicidade(v as PeriodKey)} />
              </>
            )}

            <div style={{ ...sectionTitle, marginTop: hasPcmso(docs) ? 14 : 6 }}>Bloco de treinamentos NR</div>
            <Dropdown
              value={treinamentos}
              options={[{ val: 'sim', label: 'Sim, incluir' }, { val: 'nao', label: 'Não incluir' }]}
              onSelect={setTreinamentos}
            />
          </div>
        )}

        {/* Bloco 60 dias */}
        {resultado === '60dias' && (
          <div style={{ marginTop: 12, padding: '14px 16px', background: C.primaryLight, border: `1px solid ${C.primaryMid}`, borderRadius: C.radius }}>
            <div style={condLabel}>Motivos complementares da restrição</div>
            <p style={{ fontSize: 12, color: C.primary, marginBottom: 10 }}>Frente de trabalho sempre inclusa. Marque os adicionais:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { key: 'assinatura',   label: '+ Assinatura' },
                { key: 'portal',       label: '+ Outros itens do portal' },
                { key: 'treinamentos', label: '+ Treinamentos NR' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleRestricao(key)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12.5, fontFamily: 'inherit',
                    cursor: 'pointer', userSelect: 'none', transition: 'all .15s',
                    background: restricoes.has(key) ? C.primary : C.surface,
                    color: restricoes.has(key) ? '#fff' : C.muted,
                    border: `1px solid ${restricoes.has(key) ? C.primary : C.border}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. Saudação */}
        <div style={sectionTitle}>Saudação</div>
        <Dropdown
          value={saudacao}
          options={SAUDACAO_OPTIONS.map(s => ({ val: s, label: s }))}
          onSelect={setSaudacao}
        />

        {/* Divider */}
        <div style={{ height: 1, background: C.borderLight, margin: '24px 0' }} />

        {/* ── Anexos ── */}
        {fileEntries.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>Anexos</div>
                <div style={{ fontSize: 11, color: C.hint, marginTop: 2 }}>
                  Arquivos da situação atual selecionados automaticamente
                </div>
              </div>
              {/* Copiar todos */}
              {fileEntries.some(fe => fileMatchesSituation(fe) && fileEnabled[fe.id]) && (
                <button
                  onClick={copyAllMatching}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: C.radiusSm, fontFamily: 'inherit',
                    border: `1px solid ${copyAllStatus === 'dl' ? '#b7caf5' : C.primary}`,
                    background: copyAllStatus === 'dl' ? C.primaryLight : C.primary,
                    color: copyAllStatus === 'dl' ? C.primary : '#fff',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
                  }}
                >
                  {copyAllStatus === 'dl' ? (
                    <><svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg> Baixados!</>
                  ) : (
                    <><svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Baixar todos</>
                  )}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fileEntries.map(fe => {
                const ti = fileTypeInfo(fe.mimeType)
                const enabled = !!fileEnabled[fe.id]
                const matches = fileMatchesSituation(fe)
                const st = fileCopyStatus[fe.id] ?? 'idle'

                return (
                  <div
                    key={fe.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px',
                      background: enabled ? C.surface : '#f9fafb',
                      border: `1px solid ${matches && enabled ? C.primaryMid : enabled ? C.border : C.borderLight}`,
                      borderRadius: C.radius,
                      opacity: enabled ? 1 : 0.5,
                      transition: 'opacity .15s, border-color .15s',
                    }}
                  >
                    {/* Toggle */}
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => setFileEnabled(prev => ({ ...prev, [fe.id]: !prev[fe.id] }))}
                      style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0, accentColor: C.primary }}
                    />

                    {/* Type badge */}
                    <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 8, background: ti.bg, border: `1px solid ${ti.color}33`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: ti.color, letterSpacing: '.04em' }}>{ti.label}</span>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fe.name}
                        </span>
                        {matches && (
                          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: C.primaryLight, color: C.primary, letterSpacing: '.03em' }}>
                            {(fe.situations ?? ['all']).includes('all') ? 'Sempre' : resultado === 'aprovado' ? 'Aprovado' : '60 dias'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {formatSize(fe.sizeBytes)}
                        {fe.notes && (
                          <span style={{ marginLeft: 8, color: C.hint }}>· {fe.notes}</span>
                        )}
                      </div>
                    </div>

                    {/* Copy button */}
                    <button
                      onClick={() => enabled && copyFileToClipboard(fe)}
                      disabled={!enabled}
                      style={{
                        flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: C.radiusSm,
                        border: `1px solid ${
                          st === 'ok' ? '#a3d4b5' :
                          st === 'dl' ? '#b7caf5' :
                          enabled ? C.border : C.borderLight
                        }`,
                        background: st === 'ok' ? C.okBg : st === 'dl' ? C.primaryLight : C.bg,
                        color: st === 'ok' ? C.ok : st === 'dl' ? C.primary : enabled ? C.muted : C.hint,
                        fontSize: 12, fontWeight: 500, cursor: enabled ? 'pointer' : 'default',
                        fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap',
                      }}
                    >
                      {st === 'ok' ? (
                        <>
                          <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                          Copiado
                        </>
                      ) : st === 'dl' ? (
                        <>
                          <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Baixado
                        </>
                      ) : (
                        <>
                          <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Hint */}
            <div style={{ marginTop: 8, padding: '8px 12px', background: C.primaryLight, borderRadius: C.radiusSm, fontSize: 11.5, color: C.primary, lineHeight: 1.5 }}>
              <strong>Baixar todos</strong> salva os arquivos da situação atual na pasta de Downloads — arraste-os para o e-mail no Outlook. <strong>Copiar</strong> (individual) tenta copiar para a área de transferência para colar diretamente.
            </div>

            <div style={{ height: 1, background: C.borderLight, margin: '24px 0' }} />
          </>
        )}

        {/* ── Preview ── */}

        {/* Assunto */}
        <div style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: C.radius, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Assunto</span>
            <button
              onClick={() => copiar('assunto')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                border: `1px solid ${copied === 'assunto' ? '#a3d4b5' : C.border}`,
                borderRadius: C.radiusSm, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                cursor: 'pointer', transition: 'all .15s',
                background: copied === 'assunto' ? C.okBg : C.bg,
                color: copied === 'assunto' ? C.ok : C.muted,
              }}
            >
              {copied === 'assunto' ? (
                <><svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg> Copiado!</>
              ) : (
                <><svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar</>
              )}
            </button>
          </div>
          <div style={{ padding: '10px 16px', fontSize: 14, fontWeight: 500, color: empresa ? C.text : C.hint, fontStyle: empresa ? 'normal' : 'italic', wordBreak: 'break-word' }}>
            {empresa ? assunto : 'Preencha a empresa para gerar o assunto'}
          </div>
        </div>

        {/* Corpo */}
        <div style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: C.radius, overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Corpo do e-mail</span>
            <button
              onClick={() => copiar('corpo')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                border: `1px solid ${copied === 'corpo' ? '#a3d4b5' : C.border}`,
                borderRadius: C.radiusSm, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                cursor: 'pointer', transition: 'all .15s',
                background: copied === 'corpo' ? C.okBg : C.bg,
                color: copied === 'corpo' ? C.ok : C.muted,
              }}
            >
              {copied === 'corpo' ? (
                <><svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg> Copiado!</>
              ) : (
                <><svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar</>
              )}
            </button>
          </div>
          <div style={{ padding: '16px', fontSize: 13.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: corpo ? C.text : C.hint, fontStyle: corpo ? 'normal' : 'italic', minHeight: 200 }}>
            {corpo || 'Preencha os campos acima para gerar o e-mail.'}
          </div>
        </div>

      </div>
    </div>
  )
}
