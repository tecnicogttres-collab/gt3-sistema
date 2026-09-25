'use client'

import { useEffect, useMemo, useState } from 'react'
import PdiCard from './components/PdiCard'
import { useUser } from './components/UserContext'
import { useModules } from './components/ModulesContext'
import type { Role } from './lib/modules'
import DashboardSidebar from './dashboard/DashboardSidebar'
import DashboardModuleGrid from './components/DashboardModuleGrid'

function greeting(profile: ReturnType<typeof useUser>['profile']): string {
  const first = profile?.nome?.trim().split(' ')[0] || ''
  const n = first ? `, ${first}` : ''

  const now = new Date()
  const day = now.getDay() // 0=dom, 1=seg, ..., 5=sex, 6=sáb
  const total = now.getHours() * 60 + now.getMinutes()

  if (day === 0 || day === 6) return `Não seria dia de estar aqui${n}...`

  if (total >= 360 && total < 720)  return day === 1 ? `Boa semana${n}!` : `Bom dia${n}!`
  if (total >= 720 && total < 1080) return `Boa tarde${n}!`
  if (total >= 1080 && total <= 1260) return `Boa noite${n}!`
  return `Essa hora, você aqui${n}!`
}

export default function DashboardPage() {
  const { profile, loading } = useUser()
  const { modules: MODULES, loading: modulesLoading } = useModules()
  const role = (profile?.papel ?? 'colaborador') as Role
  const [moduleNotifs, setModuleNotifs] = useState<Record<string, number>>({})
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Aviso de férias de quem está logado: "boas férias" no último dia antes de sair e
  // "ótimo retorno" no 1º dia útil depois de voltar (cálculo de dia útil fica na API)
  const [avisoFerias, setAvisoFerias] = useState<{ tipo: 'saida' | 'retorno'; titulo: string; texto: string; chave: string } | null>(null)
  useEffect(() => {
    if (!profile) return
    // Teste no localhost: /?simularHoje=AAAA-MM-DD (a API ignora fora do ambiente de desenvolvimento)
    const simular = new URLSearchParams(window.location.search).get('simularHoje')
    fetch(simular ? `/api/ferias/aviso?hoje=${encodeURIComponent(simular)}` : '/api/ferias/aviso')
      .then(r => r.ok ? r.json() : null)
      .then((d: { aviso: { tipo: 'saida' | 'retorno'; titulo: string; texto: string; inicio: string } | null } | null) => {
        const a = d?.aviso
        if (!a) return
        const chave = `gt3-aviso-ferias-fechado-${a.tipo}-${a.inicio}`
        if (!simular) { try { if (localStorage.getItem(chave)) return } catch { /* sem storage: mostra */ } }
        setAvisoFerias({ tipo: a.tipo, titulo: a.titulo, texto: a.texto, chave })
      })
      .catch(() => {})
  }, [profile])

  function fecharAvisoFerias() {
    if (avisoFerias) { try { localStorage.setItem(avisoFerias.chave, '1') } catch { /* ignore */ } }
    setAvisoFerias(null)
  }

  useEffect(() => {
    if (!profile) return
    fetch('/api/notificacoes/usuario')
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, number>) => setModuleNotifs(data))
      .catch(() => {})
  }, [profile])

  // Antes, admin ignorava por completo a configuração de "Usuários" (modulos_dashboard/
  // modulos_permitidos) e sempre via tudo — por isso desmarcar um item lá não tinha efeito
  // nenhum pra contas admin. Agora admin respeita a configuração igual a qualquer outro
  // papel; sem nenhuma configurada (o caso mais comum), o comportamento é o mesmo de sempre.
  const modulos_permitidos = profile?.modulos_permitidos ?? null
  const modulos_dashboard = profile?.modulos_dashboard ?? null

  const dashboardModules = useMemo(() => MODULES.filter((m) => {
    if (m.id === 'pdi') return false
    if (modulos_dashboard !== null) return modulos_dashboard.includes(m.id)
    if (modulos_permitidos !== null) return modulos_permitidos.includes(m.id)
    return (m.dashboardRoles ?? m.allowedRoles).includes(role)
  }), [role, modulos_dashboard, modulos_permitidos, MODULES])

  if (loading || modulesLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6B7A99', fontSize: 14 }}>
        Carregando...
      </div>
    )
  }

  const pdi = MODULES.find((m) => m.id === 'pdi')

  const showPdi = !!pdi && (
    modulos_dashboard !== null
      ? modulos_dashboard.includes('pdi')
      : modulos_permitidos !== null
        ? modulos_permitidos.includes('pdi')
        : (pdi.dashboardRoles ?? pdi.allowedRoles).includes(role)
  )

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', paddingLeft: 216 }}>
      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 960 }}>
        {avisoFerias && (
          <style>{`
            @keyframes gt3FeriasIn {
              0%   { opacity: 0; transform: translateY(-18px) scale(.96); }
              60%  { opacity: 1; transform: translateY(4px) scale(1.01); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes gt3FeriasEmoji {
              0%   { opacity: 0; transform: scale(.3) rotate(-30deg); }
              55%  { opacity: 1; transform: scale(1.25) rotate(10deg); }
              75%  { transform: scale(.95) rotate(-6deg); }
              100% { opacity: 1; transform: scale(1) rotate(0); }
            }
            @keyframes gt3FeriasBalanco {
              0%, 100% { transform: rotate(0); }
              25% { transform: rotate(-10deg); }
              75% { transform: rotate(10deg); }
            }
            @keyframes gt3FeriasTexto {
              from { opacity: 0; transform: translateX(-8px); }
              to   { opacity: 1; transform: translateX(0); }
            }
            .gt3-ferias-banner { animation: gt3FeriasIn .7s cubic-bezier(.2,.9,.3,1.2) both; }
            .gt3-ferias-emoji  { display: inline-block; animation: gt3FeriasEmoji .6s .25s cubic-bezier(.3,1.4,.5,1) both, gt3FeriasBalanco 1.4s 1s ease-in-out 3; transform-origin: 50% 90%; }
            .gt3-ferias-titulo { animation: gt3FeriasTexto .45s .35s ease-out both; }
            .gt3-ferias-texto  { animation: gt3FeriasTexto .45s .5s ease-out both; }
            @media (prefers-reduced-motion: reduce) {
              .gt3-ferias-banner, .gt3-ferias-emoji, .gt3-ferias-titulo, .gt3-ferias-texto { animation: none; }
            }
          `}</style>
        )}
        {avisoFerias && (
          <div className="gt3-ferias-banner" style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20,
            background: avisoFerias.tipo === 'saida'
              ? 'linear-gradient(135deg, #F59E0B 0%, #EA580C 55%, #DB2777 100%)'
              : 'linear-gradient(135deg, #2A4F96 0%, #1E3A6E 100%)',
            color: '#fff', borderRadius: 14, padding: '16px 20px',
            boxShadow: avisoFerias.tipo === 'saida' ? '0 6px 20px rgba(234,88,12,0.28)' : '0 6px 20px rgba(42,79,150,0.25)',
          }}>
            <span className="gt3-ferias-emoji" style={{ fontSize: 30, lineHeight: 1 }}>{avisoFerias.tipo === 'saida' ? '🏖️' : '🌴'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gt3-ferias-titulo" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>{avisoFerias.titulo}</div>
              <div className="gt3-ferias-texto" style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 3 }}>{avisoFerias.texto}</div>
            </div>
            <button
              onClick={fecharAvisoFerias}
              title="Fechar"
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1E253D', margin: 0 }}>
            {greeting(profile)}
          </h1>
          <p style={{ fontSize: 13, color: '#6B7A99', marginTop: 4 }}>
            Bem-vindo ao Sistema Interno GT3 — selecione um módulo abaixo
          </p>
        </div>

        <DashboardModuleGrid modules={dashboardModules} moduleNotifs={moduleNotifs} />

        {showPdi && <PdiCard path={pdi!.path} />}
      </div>

      {/* Right panel */}
      <DashboardSidebar role={role} />
    </div>
  )
}
