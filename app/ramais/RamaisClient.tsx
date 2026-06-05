'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '../lib/supabase'

const PRIMARY = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'
const DANGER = '#DC2626'
const DANGER_LIGHT = '#FEF2F2'

type Ramal = { id: string; nome: string; ramal: string }

type ModalState =
  | { type: 'closed' }
  | { type: 'add-form'; nome: string; ramal: string }
  | { type: 'add-confirm'; nome: string; ramal: string }
  | { type: 'edit-form'; id: string; nome: string; ramal: string; origNome: string; origRamal: string }
  | { type: 'edit-confirm'; id: string; nome: string; ramal: string; origNome: string; origRamal: string }
  | { type: 'delete-view'; id: string; nome: string; ramal: string }
  | { type: 'delete-confirm'; id: string; nome: string; ramal: string }

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(14,20,37,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

export default function RamaisClient() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Ramal[]>([])
  const [modal, setModal] = useState<ModalState>({ type: 'closed' })
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    supabase
      .from('ramais')
      .select('id, nome, numero')
      .order('nome')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Erro ao carregar ramais:', error)
        setItems((data ?? []).map(r => ({ id: r.id as string, nome: r.nome as string, ramal: r.numero as string })))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, show: true })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2500)
  }

  function closeModal() { setModal({ type: 'closed' }) }

  async function handleAdd() {
    if (modal.type !== 'add-confirm') return
    if (!modal.nome.trim() || !modal.ramal.trim()) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('ramais')
      .insert({ nome: modal.nome.trim(), numero: modal.ramal.trim() })
      .select('id, nome, numero')
      .single()
    if (error) { console.error('Erro ao adicionar ramal:', error); return }
    setItems(prev => [...prev, { id: data.id as string, nome: data.nome as string, ramal: data.numero as string }]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    closeModal()
    showToast('Ramal adicionado com sucesso')
  }

  async function handleEdit() {
    if (modal.type !== 'edit-confirm') return
    const supabase = createClient()
    const { error } = await supabase
      .from('ramais')
      .update({ nome: modal.nome.trim(), numero: modal.ramal.trim() })
      .eq('id', modal.id)
    if (error) { console.error('Erro ao editar ramal:', error); return }
    setItems(prev =>
      prev.map(r => r.id === modal.id ? { ...r, nome: modal.nome.trim(), ramal: modal.ramal.trim() } : r)
    )
    closeModal()
    showToast('Ramal atualizado com sucesso')
  }

  async function handleDelete() {
    if (modal.type !== 'delete-confirm') return
    const supabase = createClient()
    const { error } = await supabase.from('ramais').delete().eq('id', modal.id)
    if (error) { console.error('Erro ao excluir ramal:', error); return }
    setItems(prev => prev.filter(r => r.id !== modal.id))
    closeModal()
    showToast('Ramal excluído')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: MUTED, fontSize: 14 }}>
        Carregando ramais…
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: `1.5px solid ${BORDER}`, outline: 'none', fontSize: 14,
    fontFamily: 'inherit', color: INK, background: '#fff', boxSizing: 'border-box',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: PRIMARY, color: '#fff', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  }

  const btnGhost: React.CSSProperties = {
    padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: INK, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  }

  const btnDanger: React.CSSProperties = {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: DANGER, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }

  return (
    <>
      {/* Modals */}
      {modal.type !== 'closed' && (
        <Backdrop onClose={closeModal}>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420,
            boxShadow: '0 20px 60px rgba(30,37,61,0.2)', overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}>
            {/* Add – Form */}
            {modal.type === 'add-form' && (
              <>
                <ModalHeader step="Passo 1 de 2 — Preenchimento" title="Novo ramal" desc="Preencha os dados do colaborador." />
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Nome completo
                    <input autoFocus style={{ ...inputStyle, marginTop: 6 }} value={modal.nome}
                      onChange={e => setModal({ ...modal, nome: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && setModal({ ...modal, type: 'add-confirm' })}
                      placeholder="Ex.: João da Silva" />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Número do ramal
                    <input style={{ ...inputStyle, marginTop: 6 }} value={modal.ramal}
                      onChange={e => setModal({ ...modal, ramal: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && setModal({ ...modal, type: 'add-confirm' })}
                      placeholder="Ex.: 1004" maxLength={6} />
                  </label>
                </div>
                <ModalFooter>
                  <button style={btnGhost} onClick={closeModal}>Cancelar</button>
                  <button style={{ ...btnPrimary, opacity: (!modal.nome.trim() || !modal.ramal.trim()) ? 0.5 : 1 }}
                    disabled={!modal.nome.trim() || !modal.ramal.trim()}
                    onClick={() => setModal({ ...modal, type: 'add-confirm' })}>
                    Continuar →
                  </button>
                </ModalFooter>
              </>
            )}

            {/* Add – Confirm */}
            {modal.type === 'add-confirm' && (
              <>
                <ModalHeader step="Passo 2 de 2 — Confirmação" title="Confirmar inclusão" desc="Verifique os dados antes de salvar." />
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <PreviewRow label="Nome" value={modal.nome} />
                  <PreviewRow label="Ramal" value={modal.ramal} mono />
                  <InfoBox>Confirme que os dados estão corretos antes de salvar.</InfoBox>
                </div>
                <ModalFooter>
                  <button style={btnGhost} onClick={() => setModal({ ...modal, type: 'add-form' })}>← Voltar</button>
                  <button style={btnPrimary} onClick={() => void handleAdd()}>✓ Confirmar e salvar</button>
                </ModalFooter>
              </>
            )}

            {/* Edit – Form */}
            {modal.type === 'edit-form' && (
              <>
                <ModalHeader step="Passo 1 de 2 — Edição" title="Editar ramal" desc="Altere os dados do colaborador." />
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Nome completo
                    <input autoFocus style={{ ...inputStyle, marginTop: 6 }} value={modal.nome}
                      onChange={e => setModal({ ...modal, nome: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Número do ramal
                    <input style={{ ...inputStyle, marginTop: 6 }} value={modal.ramal}
                      onChange={e => setModal({ ...modal, ramal: e.target.value })} maxLength={6} />
                  </label>
                </div>
                <ModalFooter>
                  <button style={btnGhost} onClick={closeModal}>Cancelar</button>
                  <button style={{ ...btnPrimary, opacity: (!modal.nome.trim() || !modal.ramal.trim()) ? 0.5 : 1 }}
                    disabled={!modal.nome.trim() || !modal.ramal.trim()}
                    onClick={() => setModal({ ...modal, type: 'edit-confirm' })}>
                    Continuar →
                  </button>
                </ModalFooter>
              </>
            )}

            {/* Edit – Confirm */}
            {modal.type === 'edit-confirm' && (
              <>
                <ModalHeader step="Passo 2 de 2 — Confirmação" title="Confirmar alteração" desc="Compare os dados antes de salvar." />
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Antes</div>
                      <div style={{ background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>Nome</div>
                        <div style={{ fontSize: 13, color: MUTED }}>{modal.origNome}</div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 8, marginBottom: 2 }}>Ramal</div>
                        <div style={{ fontSize: 13, color: MUTED, fontFamily: 'monospace' }}>{modal.origRamal}</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Depois</div>
                      <div style={{ background: PRIMARY_LIGHT, border: `1px solid #C7D7F5`, borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>Nome</div>
                        <div style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{modal.nome}</div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 8, marginBottom: 2 }}>Ramal</div>
                        <div style={{ fontSize: 13, color: PRIMARY, fontFamily: 'monospace', fontWeight: 600 }}>{modal.ramal}</div>
                      </div>
                    </div>
                  </div>
                  <InfoBox>Confirme que as alterações estão corretas antes de salvar.</InfoBox>
                </div>
                <ModalFooter>
                  <button style={btnGhost} onClick={() => setModal({ ...modal, type: 'edit-form' })}>← Voltar</button>
                  <button style={btnPrimary} onClick={() => void handleEdit()}>✓ Confirmar alteração</button>
                </ModalFooter>
              </>
            )}

            {/* Delete – View */}
            {modal.type === 'delete-view' && (
              <>
                <ModalHeader step="Passo 1 de 2 — Solicitação" title="Excluir ramal" desc="Você está prestes a remover o seguinte registro:" />
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <PreviewRow label="Nome" value={modal.nome} />
                  <PreviewRow label="Ramal" value={modal.ramal} mono />
                </div>
                <ModalFooter>
                  <button style={btnGhost} onClick={closeModal}>Cancelar</button>
                  <button style={{ ...btnGhost, color: DANGER, borderColor: '#FECACA' }}
                    onClick={() => setModal({ ...modal, type: 'delete-confirm' })}>
                    Continuar →
                  </button>
                </ModalFooter>
              </>
            )}

            {/* Delete – Confirm */}
            {modal.type === 'delete-confirm' && (
              <>
                <ModalHeader step="Passo 2 de 2 — Confirmação final" title="Confirmar exclusão" desc="" />
                <div style={{ padding: '4px 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: DANGER_LIGHT, border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: DANGER }}>
                    Esta ação não pode ser desfeita. O registro será removido permanentemente.
                  </div>
                  <PreviewRow label="Nome" value={modal.nome} />
                  <PreviewRow label="Ramal" value={modal.ramal} mono />
                </div>
                <ModalFooter>
                  <button style={btnGhost} onClick={() => setModal({ ...modal, type: 'delete-view' })}>← Voltar</button>
                  <button style={btnDanger} onClick={() => void handleDelete()}>✕ Confirmar exclusão</button>
                </ModalFooter>
              </>
            )}
          </div>
        </Backdrop>
      )}

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        background: PRIMARY, color: '#fff',
        borderRadius: 8, padding: '12px 18px', fontSize: 13, fontWeight: 500,
        zIndex: 2000, pointerEvents: 'none',
        opacity: toast.show ? 1 : 0,
        transform: toast.show ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all 0.2s',
      }}>
        {toast.msg}
      </div>

      {/* Page */}
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              Ramais
              <span style={{
                fontSize: 11, fontWeight: 600, background: PRIMARY_LIGHT, color: PRIMARY,
                borderRadius: 999, padding: '2px 10px', fontVariantNumeric: 'tabular-nums',
              }}>
                {items.length}
              </span>
            </h1>
            <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>GT3 Consultoria — lista de ramais internos</p>
          </div>
          <button
            style={btnPrimary}
            onClick={() => setModal({ type: 'add-form', nome: '', ramal: '' })}
          >
            + Adicionar ramal
          </button>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
          {items.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: MUTED, fontSize: 14 }}>
              Nenhum ramal cadastrado ainda.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Nome', 'Ramal', ''].map((h, i) => (
                    <th key={i} style={{
                      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: MUTED, padding: '12px 20px', textAlign: i === 2 ? 'right' : 'left',
                      borderBottom: `1px solid ${BORDER}`, background: '#FAFBFD',
                      width: i === 0 ? '50%' : i === 1 ? '25%' : '25%',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={r.id} style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : undefined }}>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 500, color: INK }}>{r.nome}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, fontFamily: 'monospace', color: PRIMARY, fontWeight: 600, letterSpacing: '0.04em' }}>{r.ramal}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#F0F4FA', color: PRIMARY, cursor: 'pointer', fontWeight: 500 }}
                          onClick={() => setModal({ type: 'edit-form', id: r.id, nome: r.nome, ramal: r.ramal, origNome: r.nome, origRamal: r.ramal })}
                        >
                          ✎ Editar
                        </button>
                        <button
                          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #FECACA', background: DANGER_LIGHT, color: DANGER, cursor: 'pointer', fontWeight: 500 }}
                          onClick={() => setModal({ type: 'delete-view', id: r.id, nome: r.nome, ramal: r.ramal })}
                        >
                          ✕ Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

function ModalHeader({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div style={{ background: `linear-gradient(135deg, #2A4F96 0%, #1E3A6E 100%)`, padding: '16px 24px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>{step}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</div>
      {desc && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{desc}</div>}
    </div>
  )
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 24px', borderTop: `1px solid #E2E8F0`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      {children}
    </div>
  )
}

function PreviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: '#F8FAFC', border: `1px solid #E2E8F0`, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: mono ? '#2A4F96' : '#1E253D', fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400E' }}>
      {children}
    </div>
  )
}
