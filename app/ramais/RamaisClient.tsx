'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '../lib/supabase'
import * as XLSX from 'xlsx'

const PRIMARY      = '#2A4F96'
const PRIMARY_LIGHT = '#EBF0FB'
const BORDER       = '#E2E8F0'
const MUTED        = '#6B7A99'
const INK          = '#1E253D'
const DANGER       = '#DC2626'
const DANGER_LIGHT = '#FEF2F2'

type Ramal = { id: string; nome: string; ramal: string }

type ModalState =
  | { type: 'closed' }
  | { type: 'add'; nome: string; ramal: string }
  | { type: 'edit'; id: string; nome: string; ramal: string }
  | { type: 'delete'; id: string; nome: string; ramal: string }

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="gt3-overlay-fade"
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

function exportToExcel(items: Ramal[]) {
  const data = [
    ['Nome', 'Ramal'],
    ...items.map(r => [r.nome, r.ramal]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 36 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ramais')
  XLSX.writeFile(wb, 'Ramais GT3.xlsx')
}

export default function RamaisClient() {
  const [loading, setLoading] = useState(true)
  const [items, setItems]     = useState<Ramal[]>([])
  const [modal, setModal]     = useState<ModalState>({ type: 'closed' })
  const [toast, setToast]     = useState<{ msg: string; show: boolean }>({ msg: '', show: false })
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

  async function handleAdd(andAnother = false) {
    if (modal.type !== 'add') return
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
    showToast('Ramal adicionado')
    if (andAnother) setModal({ type: 'add', nome: '', ramal: '' })
    else closeModal()
  }

  async function handleEdit() {
    if (modal.type !== 'edit') return
    const supabase = createClient()
    const { error } = await supabase
      .from('ramais')
      .update({ nome: modal.nome.trim(), numero: modal.ramal.trim() })
      .eq('id', modal.id)
    if (error) { console.error('Erro ao editar ramal:', error); return }
    setItems(prev => prev.map(r => r.id === modal.id ? { ...r, nome: modal.nome.trim(), ramal: modal.ramal.trim() } : r))
    closeModal()
    showToast('Ramal atualizado')
  }

  async function handleDelete() {
    if (modal.type !== 'delete') return
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
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: `1.5px solid ${BORDER}`, outline: 'none', fontSize: 13,
    fontFamily: 'inherit', color: INK, background: '#fff', boxSizing: 'border-box',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 6, border: 'none',
    background: PRIMARY, color: '#fff', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
  }

  const btnGhost: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 6, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: INK, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  }

  const btnDanger: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 6, border: 'none',
    background: DANGER, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }

  return (
    <>
      {/* Modals */}
      {modal.type !== 'closed' && (
        <Backdrop onClose={closeModal}>
          <div className="gt3-drop-in" style={{
            background: '#fff', borderRadius: 10, width: '100%', maxWidth: 380,
            boxShadow: '0 16px 48px rgba(30,37,61,0.2)', overflow: 'hidden',
          }}>
            {/* Add */}
            {modal.type === 'add' && (
              <>
                <ModalHeader title="Novo ramal" />
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    NOME COMPLETO
                    <input autoFocus style={inputStyle} value={modal.nome}
                      onChange={e => setModal({ ...modal, nome: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') void handleAdd() }}
                      placeholder="Ex.: João da Silva" />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    RAMAL
                    <input style={inputStyle} value={modal.ramal}
                      onChange={e => setModal({ ...modal, ramal: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') void handleAdd() }}
                      placeholder="Ex.: 1004" maxLength={6} />
                  </label>
                </div>
                <ModalFooter>
                  <button style={btnGhost} onClick={closeModal}>Cancelar</button>
                  <button
                    style={{ ...btnGhost, color: PRIMARY, borderColor: '#C7D7F5', opacity: (!modal.nome.trim() || !modal.ramal.trim()) ? 0.4 : 1 }}
                    disabled={!modal.nome.trim() || !modal.ramal.trim()}
                    onClick={() => void handleAdd(true)}>
                    + Escrever outro
                  </button>
                  <button
                    style={{ ...btnPrimary, opacity: (!modal.nome.trim() || !modal.ramal.trim()) ? 0.5 : 1 }}
                    disabled={!modal.nome.trim() || !modal.ramal.trim()}
                    onClick={() => void handleAdd()}>
                    ✓ Salvar
                  </button>
                </ModalFooter>
              </>
            )}

            {/* Edit */}
            {modal.type === 'edit' && (
              <>
                <ModalHeader title="Editar ramal" />
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    NOME COMPLETO
                    <input autoFocus style={inputStyle} value={modal.nome}
                      onChange={e => setModal({ ...modal, nome: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') void handleEdit() }} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    RAMAL
                    <input style={inputStyle} value={modal.ramal}
                      onChange={e => setModal({ ...modal, ramal: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') void handleEdit() }}
                      maxLength={6} />
                  </label>
                </div>
                <ModalFooter>
                  <button style={btnGhost} onClick={closeModal}>Cancelar</button>
                  <button
                    style={{ ...btnPrimary, opacity: (!modal.nome.trim() || !modal.ramal.trim()) ? 0.5 : 1 }}
                    disabled={!modal.nome.trim() || !modal.ramal.trim()}
                    onClick={() => void handleEdit()}>
                    ✓ Salvar
                  </button>
                </ModalFooter>
              </>
            )}

            {/* Delete */}
            {modal.type === 'delete' && (
              <>
                <ModalHeader title="Excluir ramal" />
                <div style={{ padding: '16px 20px', fontSize: 13, color: INK }}>
                  Remover <strong>{modal.nome}</strong> (ramal <strong>{modal.ramal}</strong>)?
                  <div style={{ marginTop: 8, fontSize: 12, color: DANGER }}>Esta ação não pode ser desfeita.</div>
                </div>
                <ModalFooter>
                  <button style={btnGhost} onClick={closeModal}>Cancelar</button>
                  <button style={btnDanger} onClick={() => void handleDelete()}>Excluir</button>
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
        borderRadius: 6, padding: '10px 16px', fontSize: 12, fontWeight: 500,
        zIndex: 2000, pointerEvents: 'none',
        opacity: toast.show ? 1 : 0,
        transform: toast.show ? 'translateY(0)' : 'translateY(6px)',
        transition: 'all 0.2s',
      }}>
        {toast.msg}
      </div>

      {/* Page */}
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>Ramais</span>
            <span style={{
              fontSize: 11, fontWeight: 600, background: PRIMARY_LIGHT, color: PRIMARY,
              borderRadius: 999, padding: '1px 8px',
            }}>
              {items.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={{ ...btnGhost, color: '#166534', borderColor: '#BBF7D0', background: '#F0FDF4', fontSize: 12 }}
              onClick={() => exportToExcel(items)}
              title="Exportar para Excel"
            >
              ↓ Exportar Excel
            </button>
            <button style={btnPrimary} onClick={() => setModal({ type: 'add', nome: '', ramal: '' })}>
              + Adicionar
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          {items.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: MUTED, fontSize: 13 }}>
              Nenhum ramal cadastrado.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(to bottom, #FAFCFE, #F5F8FC)', borderBottom: '1px solid var(--border-soft)' }}>
                  <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.9px', width: '65%' }}>Nome</th>
                  <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.9px', width: '15%' }}>Ramal</th>
                  <th style={{ width: '20%' }} />
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={r.id} style={{ borderTop: idx > 0 ? '1px solid var(--border-soft)' : undefined }}>
                    <td style={{ padding: '6px 12px', color: INK, fontWeight: 400 }}>{r.nome}</td>
                    <td style={{ padding: '6px 12px', color: PRIMARY, fontFamily: 'monospace', fontWeight: 600 }}>{r.ramal}</td>
                    <td style={{ padding: '4px 10px' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: `1px solid ${BORDER}`, background: '#F5F7FB', color: PRIMARY, cursor: 'pointer' }}
                          onClick={() => setModal({ type: 'edit', id: r.id, nome: r.nome, ramal: r.ramal })}
                        >✎</button>
                        <button
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #FECACA', background: DANGER_LIGHT, color: DANGER, cursor: 'pointer' }}
                          onClick={() => setModal({ type: 'delete', id: r.id, nome: r.nome, ramal: r.ramal })}
                        >✕</button>
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

function ModalHeader({ title }: { title: string }) {
  return (
    <div style={{ background: PRIMARY, padding: '14px 20px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{title}</div>
    </div>
  )
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
      {children}
    </div>
  )
}
