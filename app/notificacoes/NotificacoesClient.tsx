'use client'

import { useState, useEffect, useRef } from 'react'
import { MODULES } from '../lib/modules'
import { SQL_SCHEMA, SQL_TRIGGER } from './sql-schema'

const PRIMARY = '#2A4F96'
const BORDER = '#E2E8F0'
const INK = '#1E253D'
const MUTED = '#6B7A99'

const PERFIS = ['colaborador', 'trainee', 'gestor', 'admin'] as const
type Perfil = typeof PERFIS[number]

const PERFIL_LABELS: Record<Perfil, string> = {
  colaborador: 'Colaborador',
  trainee: 'Trainee',
  gestor: 'Gestor',
  admin: 'Admin',
}

type Config = {
  modulo: string
  perfis_notificados: Perfil[]
  ativo: boolean
}

const MODULOS_SKIP = new Set(['notificacoes'])

export default function NotificacoesClient() {
  const [configs, setConfigs] = useState<Record<string, Config>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [showSql, setShowSql] = useState(false)
  const [copied, setCopied] = useState(false)

  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    return () => {
      clearTimeout(savedTimer.current)
      clearTimeout(copiedTimer.current)
    }
  }, [])

  const modules = MODULES.filter(m => !MODULOS_SKIP.has(m.id))

  useEffect(() => {
    fetch('/api/notificacoes/config')
      .then(r => r.ok ? r.json() : [])
      .then((data: Config[]) => {
        const map: Record<string, Config> = {}
        for (const c of data) map[c.modulo] = c
        setConfigs(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function getConfig(modulo: string): Config {
    return configs[modulo] ?? { modulo, perfis_notificados: [], ativo: false }
  }

  async function save(config: Config) {
    setSaving(prev => ({ ...prev, [config.modulo]: true }))
    await fetch('/api/notificacoes/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).catch(() => {})
    setSaving(prev => ({ ...prev, [config.modulo]: false }))
    setSaved(prev => ({ ...prev, [config.modulo]: true }))
    clearTimeout(savedTimer.current!)
    savedTimer.current = setTimeout(() => setSaved(prev => ({ ...prev, [config.modulo]: false })), 1500)
  }

  function toggleAtivo(modulo: string) {
    const cur = getConfig(modulo)
    const next: Config = { ...cur, ativo: !cur.ativo }
    setConfigs(prev => ({ ...prev, [modulo]: next }))
    save(next)
  }

  function togglePerfil(modulo: string, perfil: Perfil) {
    const cur = getConfig(modulo)
    const has = cur.perfis_notificados.includes(perfil)
    const next: Config = {
      ...cur,
      perfis_notificados: has
        ? cur.perfis_notificados.filter(p => p !== perfil)
        : [...cur.perfis_notificados, perfil],
    }
    setConfigs(prev => ({ ...prev, [modulo]: next }))
    save(next)
  }

  function copySQL() {
    navigator.clipboard.writeText(SQL_SCHEMA + '\n\n' + SQL_TRIGGER).catch(() => {})
    setCopied(true)
    clearTimeout(copiedTimer.current!)
    copiedTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: INK, margin: 0 }}>Configuração de Notificações</h1>
        <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
          Ative alertas por módulo e defina quais perfis os recebem. A bolinha vermelha aparece na sidebar e nos cards do Dashboard.
        </p>
      </div>

      {/* SQL setup block */}
      <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, marginBottom: 24, overflow: 'hidden' }}>
        <button
          onClick={() => setShowSql(s => !s)}
          style={{
            width: '100%', background: 'none', border: 'none', padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>🗄</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>SQL — criação das tabelas</span>
            <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}>
              Executar uma vez no Supabase
            </span>
          </div>
          <span style={{ color: MUTED, fontSize: 14 }}>{showSql ? '▲' : '▼'}</span>
        </button>

        {showSql && (
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: 20 }}>
            <p style={{ fontSize: 13, color: MUTED, margin: '0 0 12px' }}>
              Abra o <strong>SQL Editor</strong> no painel do Supabase e execute o bloco abaixo.
              O segundo bloco é opcional — mostra como criar triggers para disparar as notificações automaticamente.
            </p>
            <div style={{ position: 'relative' }}>
              <pre style={{
                background: '#0F172A', color: '#E2E8F0', borderRadius: 8,
                padding: '16px 20px', fontSize: 12, lineHeight: 1.65,
                overflowX: 'auto', margin: 0, fontFamily: 'monospace', whiteSpace: 'pre',
              }}>
                {SQL_SCHEMA}
                {'\n\n'}
                {SQL_TRIGGER}
              </pre>
              <button
                onClick={copySQL}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: copied ? '#16A34A' : 'rgba(255,255,255,0.12)',
                  border: 'none', borderRadius: 6, padding: '4px 12px',
                  color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Module config table */}
      <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '12px 20px', borderBottom: `1px solid ${BORDER}`,
          display: 'grid', gridTemplateColumns: '200px 72px 1fr',
          gap: 16, alignItems: 'center',
        }}>
          {['Módulo', 'Ativo', 'Notificar perfis'].map(col => (
            <span key={col} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {col}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: MUTED, fontSize: 14 }}>Carregando...</div>
        ) : (
          modules.map((mod, i) => {
            const cfg = getConfig(mod.id)
            return (
              <div
                key={mod.id}
                style={{
                  padding: '13px 20px',
                  borderBottom: i < modules.length - 1 ? `1px solid ${BORDER}` : 'none',
                  display: 'grid', gridTemplateColumns: '200px 72px 1fr',
                  gap: 16, alignItems: 'center',
                  opacity: cfg.ativo ? 1 : 0.6,
                  transition: 'opacity 0.15s',
                }}
              >
                {/* Nome do módulo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: mod.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {mod.label}
                  </span>
                  {saving[mod.id] && <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>…</span>}
                  {saved[mod.id] && <span style={{ fontSize: 11, color: '#16A34A', marginLeft: 4 }}>✓</span>}
                </div>

                {/* Toggle */}
                <div>
                  <button
                    onClick={() => toggleAtivo(mod.id)}
                    aria-label={cfg.ativo ? 'Desativar' : 'Ativar'}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: cfg.ativo ? PRIMARY : '#CBD5E1',
                      border: 'none', cursor: 'pointer', padding: 0,
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      left: cfg.ativo ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                    }} />
                  </button>
                </div>

                {/* Checkboxes de perfil */}
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  {PERFIS.map(perfil => {
                    const checked = cfg.perfis_notificados.includes(perfil)
                    return (
                      <label
                        key={perfil}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, color: checked ? INK : MUTED, userSelect: 'none' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerfil(mod.id, perfil)}
                          style={{ width: 14, height: 14, accentColor: PRIMARY, cursor: 'pointer' }}
                        />
                        {PERFIL_LABELS[perfil]}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      <p style={{ fontSize: 12, color: MUTED, marginTop: 14, lineHeight: 1.6 }}>
        As alterações são salvas automaticamente. Para que os alertas sejam criados quando um módulo for atualizado,
        use triggers SQL (ver exemplo acima) ou adicione chamadas à tabela{' '}
        <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>notificacoes_usuario</code>{' '}
        nas funções de cada módulo.
      </p>
    </div>
  )
}
