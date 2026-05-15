import { redirect } from 'next/navigation'
import { createClient } from '../lib/supabase-server'
import { createAdminClient } from '../lib/supabase-admin'
import PdiListClient from './PdiListClient'

export const metadata = { title: 'PDI — GT3 Sistema' }

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
  if (papel === 'colaborador') {
    const slug = profile?.pdi_slug as string | null
    if (slug) redirect(`/pdi/${slug}`)
    // Sem PDI vinculado — mostra mensagem
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: '#6B7A99', textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1E293B' }}>Nenhum PDI vinculado</div>
        <div style={{ fontSize: 13 }}>Seu PDI ainda não foi configurado. Fale com o gestor.</div>
      </div>
    )
  }

  // Gestor e admin veem a lista completa
  return <PdiListClient />
}
