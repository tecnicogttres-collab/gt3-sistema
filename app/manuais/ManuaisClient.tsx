'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import seedJson from './seedData.json'

// ── Types ──────────────────────────────────────────────────────────────────

type DocSection = { label: string; items: string[] }
type Doc = { id: string; nome: string; periodicidade: string; sections: DocSection[] }
type NRRow = { origem: string; treinamento: string; ch: string; periodicidade: string; reciclagem: string; instrutor: string; resp: string }
type NRObs = { tag: string; texto: string }

type DocTab = 'funcionarios' | 'empresas' | 'veiculos' | 'alimentar' | 'bsa' | 'rescissorios' | 'geral'
type TabKey = DocTab | 'nrs'

type ManuaisData = Record<DocTab, Doc[]> & { nrs: NRRow[]; nrsObs: NRObs[] }

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'gt3_manuais_v1'
const SEED = seedJson as unknown as ManuaisData

const TABS: { key: TabKey; label: string }[] = [
  { key: 'funcionarios', label: 'Funcionários' },
  { key: 'nrs', label: 'NRs' },
  { key: 'empresas', label: 'Empresas' },
  { key: 'veiculos', label: 'Veículos' },
  { key: 'alimentar', label: 'Alimentar' },
  { key: 'bsa', label: 'BSA' },
  { key: 'rescissorios', label: 'Rescisórios' },
  { key: 'geral', label: 'Geral' },
]

const TAB_TITLES: Record<TabKey, { title: string; sub: string }> = {
  funcionarios: { title: 'Manuais — Funcionários', sub: 'Documentos relacionados aos colaboradores' },
  nrs: { title: 'Manuais — NRs', sub: 'Tabela de treinamentos normativos' },
  empresas: { title: 'Manuais — Empresas', sub: 'Documentos relacionados às empresas' },
  veiculos: { title: 'Manuais — Veículos', sub: 'Documentos relacionados aos veículos' },
  alimentar: { title: 'Manuais — Alimentar', sub: 'Documentos do setor alimentar' },
  bsa: { title: 'Manuais — BSA', sub: 'Documentos BSA' },
  rescissorios: { title: 'Manuais — Rescisórios', sub: 'Documentos rescisórios — GPF / Marcopolo / Ciferal / Volare' },
  geral: { title: 'Manuais — Geral', sub: 'Definições e rotinas operacionais' },
}

const PILL: Record<string, { bg: string; color: string }> = {
  Anual:       { bg: '#EBF4FF', color: '#2A4F96' },
  Única:       { bg: '#F0FFF4', color: '#276749' },
  Bienal:      { bg: '#EDE9FE', color: '#5B21B6' },
  Condicional: { bg: '#FFF8EE', color: '#92400E' },
}

function pillStyle(p: string): React.CSSProperties {
  const s = PILL[p] ?? { bg: '#F1EFE8', color: '#444441' }
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: 10,
    fontSize: 11, fontWeight: 600,
    background: s.bg, color: s.color,
  }
}

// ── Storage ────────────────────────────────────────────────────────────────

function loadData(): ManuaisData {
  if (typeof window === 'undefined') return SEED
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ManuaisData
      // Migra novas abas que podem não existir em versões anteriores
      if (!parsed.rescissorios) parsed.rescissorios = JSON.parse(JSON.stringify(SEED.rescissorios))
      if (!parsed.geral) parsed.geral = JSON.parse(JSON.stringify(SEED.geral))
      // Alimentar estava vazio — repopula se ainda vazio
      if (!parsed.alimentar || parsed.alimentar.length === 0) parsed.alimentar = JSON.parse(JSON.stringify(SEED.alimentar))
      // Merge docs do SEED que ainda não existem no array salvo (por id)
      const docTabs: DocTab[] = ['funcionarios', 'empresas', 'veiculos', 'alimentar', 'bsa', 'rescissorios', 'geral']
      for (const tab of docTabs) {
        const existing = parsed[tab] ?? []
        const existingIds = new Set(existing.map((d: Doc) => d.id))
        const missing = (SEED[tab] ?? []).filter((d: Doc) => !existingIds.has(d.id))
        if (missing.length > 0) parsed[tab] = [...existing, ...JSON.parse(JSON.stringify(missing))]
      }
      return parsed
    }
  } catch {}
  return JSON.parse(JSON.stringify(SEED))
}

function saveData(data: ManuaisData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function deepCopy<T>(v: T): T { return JSON.parse(JSON.stringify(v)) }

// ── Main component ─────────────────────────────────────────────────────────

export default function ManuaisClient() {
  const [hydrated, setHydrated] = useState(false)
  const [data, setData] = useState<ManuaisData>(SEED)
  const [activeTab, setActiveTab] = useState<TabKey>('funcionarios')
  const [modalDoc, setModalDoc] = useState<Doc | null>(null)
  const [modalTab, setModalTab] = useState<DocTab>('funcionarios')
  const [addModal, setAddModal] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [nrsText, setNrsText] = useState('')
  const [nrsOrigem, setNrsOrigem] = useState('todas')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setData(loadData())
    setHydrated(true)
  }, [])

  useEffect(() => { if (hydrated) saveData(data) }, [data, hydrated])

  const updateData = useCallback((updater: (d: ManuaisData) => ManuaisData) => {
    setData(prev => updater(deepCopy(prev)))
  }, [])

  // ── Modal ────────────────────────────────────────────────────────────────

  function openDoc(tab: DocTab, docId: string) {
    const doc = data[tab].find(d => d.id === docId)
    if (!doc) return
    setModalDoc(deepCopy(doc))
    setModalTab(tab)
  }

  function closeModal() {
    if (modalDoc) {
      updateData(d => ({
        ...d,
        [modalTab]: d[modalTab].map((doc: Doc) => doc.id === modalDoc.id ? modalDoc : doc),
      }))
    }
    setModalDoc(null)
  }

  function updateModalDoc(updater: (d: Doc) => Doc) {
    setModalDoc(prev => prev ? updater(deepCopy(prev)) : prev)
  }

  // ── Add doc ──────────────────────────────────────────────────────────────

  function confirmAddDoc() {
    const name = newDocName.trim()
    if (!name) return
    const id = 'doc_' + Date.now()
    const tab = activeTab as DocTab
    const newDoc: Doc = {
      id, nome: name, periodicidade: 'Única',
      sections: [{ label: 'Verificação', items: ['Novo item'] }],
    }
    updateData(d => ({ ...d, [tab]: [...d[tab], newDoc] }))
    setAddModal(false)
    setNewDocName('')
    setTimeout(() => openDoc(tab, id), 50)
  }

  // ── Delete doc ───────────────────────────────────────────────────────────

  function deleteDoc() {
    if (!modalDoc) return
    if (!confirm(`Excluir o documento "${modalDoc.nome}"? Esta ação não pode ser desfeita.`)) return
    updateData(d => ({ ...d, [modalTab]: d[modalTab].filter((doc: Doc) => doc.id !== modalDoc.id) }))
    setModalDoc(null)
  }

  if (!hydrated) return null

  const info = TAB_TITLES[activeTab]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 400 }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#2D3748' }}>{info.title}</h2>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: '#718096' }}>{info.sub}</p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 3, background: '#EDF2F7', borderRadius: 8,
        padding: 3, marginBottom: 18, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setSearch('') }}
            style={{
              flex: 1, minWidth: 80, padding: '7px 12px', border: 'none',
              borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              fontWeight: activeTab === t.key ? 600 : 400,
              background: activeTab === t.key ? '#fff' : 'transparent',
              color: activeTab === t.key ? '#2A4F96' : '#718096',
              boxShadow: activeTab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab !== 'nrs' && (
        <div style={{ marginBottom: 14, flexShrink: 0 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar documento…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 12px', borderRadius: 8,
              border: '1.5px solid #E2E8F0', fontSize: 13,
              fontFamily: 'inherit', outline: 'none', color: '#2D3748',
              background: '#fff',
            }}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'nrs' ? (
          <NRsView
            nrs={data.nrs}
            nrsObs={data.nrsObs}
            filterText={nrsText}
            filterOrigem={nrsOrigem}
            onFilterText={setNrsText}
            onFilterOrigem={setNrsOrigem}
            onUpdateRow={(idx, field, val) => updateData(d => {
              d.nrs[idx][field as keyof NRRow] = val; return d
            })}
            onDeleteRow={idx => {
              if (!confirm('Remover esta linha?')) return
              updateData(d => { d.nrs.splice(idx, 1); return d })
            }}
            onAddRow={() => updateData(d => {
              d.nrs.push({ origem: 'NR ?', treinamento: 'Novo treinamento', ch: '—', periodicidade: '—', reciclagem: '—', instrutor: '—', resp: '—' })
              return d
            })}
            onUpdateObs={(idx, field, val) => updateData(d => {
              d.nrsObs[idx][field as keyof NRObs] = val; return d
            })}
            onDeleteObs={idx => updateData(d => { d.nrsObs.splice(idx, 1); return d })}
            onAddObs={() => updateData(d => {
              d.nrsObs.push({ tag: 'Nova orientação', texto: 'Descrição da orientação' })
              return d
            })}
          />
        ) : (
          <DocGrid
            docs={(data[activeTab as DocTab] ?? []).filter(d =>
              !search || d.nome.toLowerCase().includes(search.toLowerCase())
            )}
            onOpen={id => openDoc(activeTab as DocTab, id)}
            onAdd={() => { setNewDocName(''); setAddModal(true) }}
          />
        )}
      </div>

      {/* ── Doc modal ─────────────────────────────────────────────────── */}
      {modalDoc && (
        <DocModal
          doc={modalDoc}
          onClose={closeModal}
          onDelete={deleteDoc}
          onChange={updateModalDoc}
        />
      )}

      {/* ── Add doc modal ──────────────────────────────────────────────── */}
      {addModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setAddModal(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, padding: '24px 28px',
            width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2D3748', marginBottom: 14 }}>
              Novo documento
            </div>
            <input
              autoFocus
              value={newDocName}
              onChange={e => setNewDocName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmAddDoc() }}
              placeholder="Nome do documento…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setAddModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={confirmAddDoc} style={btnPrimary}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Doc grid ───────────────────────────────────────────────────────────────

function DocGrid({ docs, onOpen, onAdd }: { docs: Doc[]; onOpen: (id: string) => void; onAdd: () => void }) {
  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
      }}>
        {docs.map(doc => (
          <div
            key={doc.id}
            onClick={() => onOpen(doc.id)}
            style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
              padding: '14px 14px 12px', cursor: 'pointer', minHeight: 88,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              transition: 'border-color 0.12s, box-shadow 0.12s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#BFD0FF'
              el.style.boxShadow = '0 2px 8px rgba(42,79,150,0.08)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#E2E8F0'
              el.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: '#2D3748', lineHeight: 1.4, marginBottom: 10 }}>
              {doc.nome}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={pillStyle(doc.periodicidade)}>{doc.periodicidade || '—'}</span>
              <span style={{ fontSize: 14, color: '#A0AEC0' }}>›</span>
            </div>
          </div>
        ))}
        <button
          onClick={onAdd}
          style={{
            border: '1px dashed #CBD5E0', background: 'transparent', borderRadius: 10,
            padding: 14, minHeight: 88, cursor: 'pointer', fontSize: 13, color: '#A0AEC0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'inherit', transition: 'color 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#2A4F96'
            ;(e.currentTarget as HTMLElement).style.borderColor = '#2A4F96'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = '#A0AEC0'
            ;(e.currentTarget as HTMLElement).style.borderColor = '#CBD5E0'
          }}
        >
          + Adicionar documento
        </button>
      </div>
      {docs.length === 0 && (
        <p style={{ marginTop: 20, color: '#A0AEC0', fontSize: 13, textAlign: 'center' }}>
          Nenhum documento cadastrado. Use o botão acima para começar.
        </p>
      )}
    </div>
  )
}

// ── Doc modal ──────────────────────────────────────────────────────────────

function DocModal({
  doc, onClose, onDelete, onChange,
}: {
  doc: Doc
  onClose: () => void
  onDelete: () => void
  onChange: (updater: (d: Doc) => Doc) => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const sectionLabelRefs = useRef<(HTMLParagraphElement | null)[]>([])
  const itemRefs = useRef<(HTMLSpanElement | null)[][]>([])

  const sectionCount = doc.sections.length
  sectionLabelRefs.current = sectionLabelRefs.current.slice(0, sectionCount)
  itemRefs.current = itemRefs.current.slice(0, sectionCount)

  const addSection = () => {
    // Flush any in-flight title edit
    if (titleRef.current) {
      onChange(d => ({ ...d, nome: titleRef.current!.textContent?.trim() || d.nome }))
    }
    onChange(d => ({ ...d, sections: [...d.sections, { label: 'Nova seção', items: ['Novo item'] }] }))
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '3rem 1rem', zIndex: 9998, overflowY: 'auto',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640,
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        border: '1px solid #E2E8F0',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 14px', borderBottom: '1px solid #EDF2F7',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <h3
              ref={titleRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onBlur={() => onChange(d => ({ ...d, nome: titleRef.current?.textContent?.trim() || d.nome }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); titleRef.current?.blur() } }}
              style={{
                margin: '0 0 4px', fontSize: 17, fontWeight: 600, color: '#2D3748',
                outline: 'none', cursor: 'text',
                borderRadius: 4,
              }}
            >
              {doc.nome}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: '#A0AEC0' }}>
              Critérios para validação · clique em qualquer texto para editar
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: '#A0AEC0', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px', maxHeight: '62vh', overflowY: 'auto' }}>
          {/* Meta row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>
                Periodicidade
              </label>
              <input
                value={doc.periodicidade}
                onChange={e => onChange(d => ({ ...d, periodicidade: e.target.value }))}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 8, boxSizing: 'border-box',
                  border: '1px solid #CBD5E0', fontSize: 13, background: '#fff',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>
                Identificador
              </label>
              <input
                value={doc.id} disabled
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 8,
                  border: '1px solid #E2E8F0', fontSize: 13, background: '#F7F9FC',
                  fontFamily: 'inherit', color: '#A0AEC0', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Sections */}
          {doc.sections.map((section, si) => {
            if (!itemRefs.current[si]) itemRefs.current[si] = []
            return (
              <div key={si} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p
                    ref={el => { sectionLabelRefs.current[si] = el }}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={() => {
                      const val = sectionLabelRefs.current[si]?.textContent?.trim()
                      if (val) onChange(d => {
                        d.sections[si] = { ...d.sections[si], label: val }
                        return d
                      })
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sectionLabelRefs.current[si]?.blur() } }}
                    style={{
                      margin: 0, fontSize: 11, fontWeight: 600, color: '#A0AEC0',
                      textTransform: 'uppercase', letterSpacing: '0.6px',
                      outline: 'none', cursor: 'text',
                    }}
                  >
                    {section.label}
                  </p>
                  <button
                    onClick={() => {
                      if (!confirm('Remover esta seção e todos seus itens?')) return
                      onChange(d => { d.sections.splice(si, 1); return d })
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E0', fontSize: 13, padding: '0 4px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CBD5E0' }}
                    title="Remover seção"
                  >✕</button>
                </div>

                {section.items.map((item, ii) => {
                  if (!itemRefs.current[si]) itemRefs.current[si] = []
                  return (
                    <div
                      key={ii}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '7px 0', borderBottom: '1px solid #EDF2F7', fontSize: 13,
                      }}
                      onMouseEnter={e => {
                        const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-del]')
                        if (btn) btn.style.opacity = '1'
                      }}
                      onMouseLeave={e => {
                        const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-del]')
                        if (btn) btn.style.opacity = '0'
                      }}
                    >
                      <span style={{ color: '#A0AEC0', flexShrink: 0, paddingTop: 2 }}>•</span>
                      <span
                        ref={el => { itemRefs.current[si][ii] = el }}
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                        onBlur={() => {
                          const val = itemRefs.current[si]?.[ii]?.textContent?.trim()
                          if (val !== undefined) onChange(d => {
                            d.sections[si].items[ii] = val
                            return d
                          })
                        }}
                        style={{ flex: 1, outline: 'none', lineHeight: 1.55, color: '#2D3748', cursor: 'text' }}
                      >
                        {item}
                      </span>
                      <button
                        data-del="1"
                        onClick={() => onChange(d => { d.sections[si].items.splice(ii, 1); return d })}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#A0AEC0', fontSize: 13, padding: '0 4px', opacity: 0, flexShrink: 0,
                          transition: 'color 0.12s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#A0AEC0' }}
                        title="Remover item"
                      >✕</button>
                    </div>
                  )
                })}

                <button
                  onClick={() => onChange(d => { d.sections[si].items.push('Novo item'); return d })}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: '#718096', padding: '8px 0',
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#2D3748' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#718096' }}
                >
                  + Adicionar item
                </button>
              </div>
            )
          })}

          <button
            onClick={addSection}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: '#2A4F96', padding: '8px 0', marginTop: 4,
              fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            + Adicionar seção
          </button>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px 16px', borderTop: '1px solid #EDF2F7',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={onDelete}
            style={{ ...btnSecondary, color: '#E53E3E', borderColor: '#FEB2B2' }}
          >
            ✕ Excluir documento
          </button>
          <button onClick={onClose} style={btnSecondary}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── NRs view ───────────────────────────────────────────────────────────────

type NRsViewProps = {
  nrs: NRRow[]
  nrsObs: NRObs[]
  filterText: string
  filterOrigem: string
  onFilterText: (v: string) => void
  onFilterOrigem: (v: string) => void
  onUpdateRow: (idx: number, field: string, val: string) => void
  onDeleteRow: (idx: number) => void
  onAddRow: () => void
  onUpdateObs: (idx: number, field: string, val: string) => void
  onDeleteObs: (idx: number) => void
  onAddObs: () => void
}

function NRsView({
  nrs, nrsObs, filterText, filterOrigem,
  onFilterText, onFilterOrigem,
  onUpdateRow, onDeleteRow, onAddRow,
  onUpdateObs, onDeleteObs, onAddObs,
}: NRsViewProps) {
  const origens = ['todas', ...Array.from(new Set(nrs.map(r => r.origem)))]

  const filtered = nrs
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => {
      const t = filterText.toLowerCase()
      const matchText = !t || r.treinamento.toLowerCase().includes(t) || r.origem.toLowerCase().includes(t)
      const matchOrigem = filterOrigem === 'todas' || r.origem === filterOrigem
      return matchText && matchOrigem
    })

  function origemStyle(origem: string): React.CSSProperties {
    const base: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }
    if (origem.startsWith('NR')) return { ...base, background: '#EBF4FF', color: '#2A4F96' }
    if (origem.startsWith('PF')) return { ...base, background: '#EDE9FE', color: '#5B21B6' }
    return { ...base, background: '#F1EFE8', color: '#444441' }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar por treinamento ou origem…"
          value={filterText}
          onChange={e => onFilterText(e.target.value)}
          style={{
            flex: 1, minWidth: 200, maxWidth: 320, padding: '7px 10px',
            borderRadius: 8, border: '1px solid #CBD5E0', fontSize: 13,
            fontFamily: 'inherit', outline: 'none', background: '#fff',
          }}
        />
        <select
          value={filterOrigem}
          onChange={e => onFilterOrigem(e.target.value)}
          style={{
            padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E0',
            fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff',
          }}
        >
          {origens.map(o => (
            <option key={o} value={o}>{o === 'todas' ? 'Todas as origens' : o}</option>
          ))}
        </select>
        <button
          onClick={onAddRow}
          style={{ ...btnSecondary, whiteSpace: 'nowrap' }}
        >
          + Adicionar linha
        </button>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        <div style={{ overflowX: 'auto', maxHeight: '52vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                {['Origem', 'Treinamento', 'CH formação', 'Periodicidade', 'CH reciclagem', 'Qualif. instrutor', 'Resp. técnico', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 12px', borderBottom: '1px solid #E2E8F0',
                    textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#718096',
                    textTransform: 'uppercase', letterSpacing: '0.4px',
                    whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#F7F9FC', zIndex: 1,
                    ...(i === 7 ? { width: 36 } : {}),
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#A0AEC0', fontSize: 13 }}>
                  Nenhum treinamento encontrado.
                </td></tr>
              )}
              {filtered.map(({ r, i }) => (
                <NRRow
                  key={i}
                  row={r}
                  realIdx={i}
                  origemStyle={origemStyle}
                  onUpdate={(field, val) => onUpdateRow(i, field, val)}
                  onDelete={() => onDeleteRow(i)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observations */}
      <div style={{
        marginTop: 20, padding: '14px 18px', background: '#F7F9FC',
        borderRadius: 10, border: '1px solid #E2E8F0',
      }}>
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Orientações complementares
        </p>
        {nrsObs.map((obs, i) => (
          <NRObsRow
            key={i}
            obs={obs}
            onUpdate={(field, val) => onUpdateObs(i, field, val)}
            onDelete={() => onDeleteObs(i)}
          />
        ))}
        <button
          onClick={onAddObs}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#718096', padding: '8px 0',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#2D3748' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#718096' }}
        >
          + Adicionar orientação
        </button>
      </div>
    </div>
  )
}

// ── NR table row ───────────────────────────────────────────────────────────

function NRRow({ row, realIdx, origemStyle, onUpdate, onDelete }: {
  row: NRRow
  realIdx: number
  origemStyle: (o: string) => React.CSSProperties
  onUpdate: (field: string, val: string) => void
  onDelete: () => void
}) {
  const fields: (keyof NRRow)[] = ['treinamento', 'ch', 'periodicidade', 'reciclagem', 'instrutor', 'resp']
  const refs = useRef<(HTMLTableCellElement | null)[]>([])

  return (
    <tr style={{ borderBottom: '1px solid #EDF2F7' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F7F9FC' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {/* Origem tag */}
      <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
        <OrigemCell
          value={row.origem}
          style={origemStyle(row.origem)}
          onSave={val => onUpdate('origem', val)}
        />
      </td>

      {fields.map((field, fi) => {
        const isResp = field === 'resp'
        return (
          <td
            key={field}
            ref={el => { refs.current[fi] = el }}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={() => onUpdate(field, refs.current[fi]?.textContent?.trim() ?? '')}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); refs.current[fi]?.blur() } }}
            style={{
              padding: '8px 12px', verticalAlign: 'top', outline: 'none', cursor: 'text',
              color: isResp && row.resp.startsWith('Sim') ? '#276749' : '#2D3748',
              fontWeight: isResp && row.resp.startsWith('Sim') ? 500 : 400,
            }}
          >
            {row[field]}
          </td>
        )
      })}

      <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'top' }}>
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E0', fontSize: 13, padding: '2px 4px' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CBD5E0' }}
          title="Remover linha"
        >✕</button>
      </td>
    </tr>
  )
}

function OrigemCell({ value, style, onSave }: { value: string; style: React.CSSProperties; onSave: (v: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={() => onSave(ref.current?.textContent?.trim() ?? '')}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ref.current?.blur() } }}
      style={style}
    >
      {value}
    </span>
  )
}

// ── NRs obs row ────────────────────────────────────────────────────────────

function NRObsRow({ obs, onUpdate, onDelete }: {
  obs: NRObs
  onUpdate: (field: string, val: string) => void
  onDelete: () => void
}) {
  const tagRef = useRef<HTMLSpanElement>(null)
  const textoRef = useRef<HTMLSpanElement>(null)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', fontSize: 12 }}>
      <span
        ref={tagRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={() => {
          let val = tagRef.current?.textContent?.trim() ?? ''
          val = val.replace(/:$/, '')
          onUpdate('tag', val)
        }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); tagRef.current?.blur() } }}
        style={{ fontWeight: 600, color: '#2D3748', flexShrink: 0, outline: 'none', cursor: 'text' }}
      >
        {obs.tag}:
      </span>
      <span
        ref={textoRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={() => onUpdate('texto', textoRef.current?.textContent?.trim() ?? '')}
        style={{ flex: 1, color: '#718096', outline: 'none', cursor: 'text', lineHeight: 1.6 }}
      >
        {obs.texto}
      </span>
      <button
        onClick={onDelete}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E0', fontSize: 13, padding: '2px 4px', flexShrink: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CBD5E0' }}
        title="Remover"
      >✕</button>
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, border: 'none',
  background: '#2A4F96', color: '#fff', cursor: 'pointer', fontSize: 13,
  fontWeight: 600, fontFamily: 'inherit',
}

const btnSecondary: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0',
  background: '#fff', color: '#4A5568', cursor: 'pointer', fontSize: 13,
  fontWeight: 500, fontFamily: 'inherit',
}
