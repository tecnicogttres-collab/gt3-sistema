'use client'

import { useMemo, useRef, useState } from 'react'
import { MODULES } from '../lib/modules'
import { useModules } from '../components/ModulesContext'

const PRIMARY = '#2A4F96'

// Cores sugeridas (atalho rápido — o usuário também pode escolher qualquer cor)
const PRESET_COLORS = ['#4A90D9', '#2A4F96', '#D1AE6E', '#16A34A', '#DC2626', '#9333EA', '#0891B2', '#EA580C', '#475569']

type DraftRow = { label: string; color: string }

export default function ModulosNomenclaturaModal({ onClose }: { onClose: () => void }) {
  const { modules, overrides, saveOverride, resetOverride } = useModules()

  // Padrões do código — usados para "restaurar" e para detectar alterações
  const defaults = useMemo(() => {
    const map: Record<string, DraftRow> = {}
    for (const m of MODULES) map[m.id] = { label: m.label, color: m.color }
    return map
  }, [])

  // Rascunho local dos inputs — inicializado com os valores efetivos atuais
  const [draft, setDraft] = useState<Record<string, DraftRow>>(() => {
    const map: Record<string, DraftRow> = {}
    for (const m of modules) map[m.id] = { label: m.label, color: m.color }
    return map
  })
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  function scheduleSave(id: string, row: DraftRow) {
    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(async () => {
      try {
        await saveOverride(id, row.label, row.color)
        setSaved(prev => ({ ...prev, [id]: true }))
        clearTimeout(savedTimers.current[id])
        savedTimers.current[id] = setTimeout(() => {
          setSaved(prev => ({ ...prev, [id]: false }))
        }, 1500)
      } catch {
        alert('Erro ao salvar — verifique sua conexão e permissões.')
      }
    }, 450)
  }

  function update(id: string, patch: Partial<DraftRow>) {
    setDraft(prev => {
      const next = { ...prev[id], ...patch }
      scheduleSave(id, next)
      return { ...prev, [id]: next }
    })
  }

  async function restaurar(id: string) {
    clearTimeout(timers.current[id])
    const def = defaults[id]
    setDraft(prev => ({ ...prev, [id]: { ...def } }))
    try {
      await resetOverride(id)
      setSaved(prev => ({ ...prev, [id]: true }))
      clearTimeout(savedTimers.current[id])
      savedTimers.current[id] = setTimeout(() => setSaved(prev => ({ ...prev, [id]: false })), 1500)
    } catch {
      alert('Erro ao restaurar.')
    }
  }

  // Ordenado por nome efetivo, igual à sidebar
  const ordered = useMemo(
    () => [...modules].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [modules]
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '24px 28px', width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B' }}>⚙️ Nomenclatura dos módulos</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#6B7A99' }}>
          Edite o nome e a cor de cada módulo. As mudanças são salvas e aplicadas automaticamente para todos, em tempo real.
        </p>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
          {ordered.map((mod) => {
            const row = draft[mod.id] ?? { label: mod.label, color: mod.color }
            const isCustom = !!overrides[mod.id]
            return (
              <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, backgroundColor: '#F9FAFB' }}>
                {/* Cor */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <input
                    type="color"
                    value={row.color}
                    onChange={(e) => update(mod.id, { color: e.target.value })}
                    title="Cor do card"
                    style={{ width: 30, height: 30, padding: 0, border: '1px solid #D1D5DB', borderRadius: 6, cursor: 'pointer', background: 'none' }}
                  />
                </div>

                {/* Nome */}
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => update(mod.id, { label: e.target.value })}
                  placeholder={defaults[mod.id]?.label}
                  style={{ flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13.5, color: '#1E293B', outline: 'none' }}
                  onFocus={(e) => { e.target.style.borderColor = PRIMARY }}
                  onBlur={(e) => { e.target.style.borderColor = '#D1D5DB' }}
                />

                {/* Status / restaurar */}
                <div style={{ width: 80, flexShrink: 0, textAlign: 'right' }}>
                  {saved[mod.id] ? (
                    <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>salvo ✓</span>
                  ) : isCustom ? (
                    <button
                      onClick={() => restaurar(mod.id)}
                      title="Voltar ao nome e cor padrão"
                      style={{ fontSize: 11, color: '#6B7A99', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      restaurar
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        {/* Atalhos de cor */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Cores rápidas:</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((c) => (
              <span key={c} title={c} style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: c, border: '1px solid rgba(0,0,0,0.1)' }} />
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', backgroundColor: PRIMARY, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
