import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase-server'
import { createAdminClient } from '../../lib/supabase-admin'
import * as allPdis from '../../../data/pdis/index'
import type { PdiColaborador } from '../../../data/pdis/types'
import PdiDetailClient from './PdiDetailClient'

const pdisMap = Object.values(allPdis).reduce<Record<string, PdiColaborador>>((acc, pdi) => {
  acc[(pdi as PdiColaborador).id] = pdi as PdiColaborador
  return acc
}, {})

export function generateStaticParams() {
  return Object.keys(pdisMap).map(id => ({ id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pdi = pdisMap[id]
  return { title: pdi ? `PDI — ${pdi.nome}` : 'PDI — GT3 Sistema' }
}

export default async function PdiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pdi = pdisMap[id]
  if (!pdi) notFound()

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
  const pdiSlug = (profile?.pdi_slug as string) ?? null

  // Colaborador só acessa o próprio PDI
  if (papel === 'colaborador' && pdiSlug !== id) {
    if (pdiSlug) redirect(`/pdi/${pdiSlug}`)
    redirect('/pdi')
  }

  return <PdiDetailClient pdi={pdi} />
}
