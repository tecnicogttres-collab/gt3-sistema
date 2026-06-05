import { redirect } from 'next/navigation'
import { createClient } from '../lib/supabase-server'
import { createAdminClient } from '../lib/supabase-admin'
import PdiListClient from './PdiListClient'

export const metadata = { title: 'PDI — Sistema Interno GT3' }

export type DbPdi = {
  id: string
  nome: string
  funcao: string
  data_inicio: string | null
  colaborador_id: string | null
  created_at: string
  status: string
  conclusoes: { _original_slug?: string; _mbti_tipo?: string } | null
  eneagrama: { ranking: { rank: number; tipo: string; pontuacao: string }[] } | null
  animais: { animal: string; emoji: string; percentual?: number }[] | null
}

export type DbCicloScore = {
  pdi_id: string
  status: string
  avaliacao_diretiva: number[]
  autoavaliacao: number[]
  ambicao: number[]
  data_inicio: string | null
  data_fim: string | null
}

export default async function PdiPage() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('papel, pdi_slug')
    .eq('id', user.id)
    .single()

  const papel = (profile?.papel as string) ?? null

  // Colaborador vê apenas o próprio PDI
  if (papel === 'colaborador' || papel === 'trainee') {
    const slug = profile?.pdi_slug as string | null
    if (slug) redirect(`/pdi/${slug}`)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: '#6B7A99', textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1E293B' }}>Nenhum PDI vinculado</div>
        <div style={{ fontSize: 13 }}>Seu PDI ainda não foi configurado. Fale com o gestor.</div>
      </div>
    )
  }

  // Gestor e admin: busca PDIs do banco e ciclos com scores em paralelo
  const [{ data: dbPdis }, { data: ciclos }] = await Promise.all([
    admin
      .from('pdis')
      .select('id, nome, funcao, data_inicio, colaborador_id, created_at, status, conclusoes, eneagrama, animais')
      .order('created_at', { ascending: true }),
    admin
      .from('pdi_ciclos')
      .select('pdi_id, status, avaliacao_diretiva, autoavaliacao, ambicao, data_inicio, data_fim')
      .order('numero_ciclo', { ascending: false }),
  ])

  return (
    <PdiListClient
      dbPdis={(dbPdis ?? []) as DbPdi[]}
      ciclosScores={(ciclos ?? []) as DbCicloScore[]}
      papel={papel ?? 'gestor'}
    />
  )
}
