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

  const papel = (profile?.papel as string) ?? 'colaborador'
  const pdiSlug = (profile?.pdi_slug as string) ?? null

  // Colaborador só acessa o próprio PDI
  if (papel === 'colaborador' && pdiSlug !== id) {
    if (pdiSlug) redirect(`/pdi/${pdiSlug}`)
    redirect('/pdi')
  }

  // Seed ciclo 1 na primeira abertura de qualquer usuário
  const { data: existingCiclo } = await admin
    .from('pdi_ciclos')
    .select('id')
    .eq('pdi_id', id)
    .limit(1)
    .maybeSingle()

  if (!existingCiclo) {
    // Encontra o colaborador dono deste PDI
    const { data: colab } = await admin
      .from('profiles')
      .select('id')
      .eq('pdi_slug', id)
      .maybeSingle()

    await admin.from('pdi_ciclos').insert({
      pdi_id: id,
      colaborador_id: colab?.id ?? null,
      numero_ciclo: 1,
      status: 'ativo',
      avaliacao_diretiva: pdi.matrizAvaliacao.diretiva,
      autoavaliacao: pdi.matrizAvaliacao.auto,
      ambicao: pdi.matrizAvaliacao.ambicao,
      autoavaliacao_salva: true,
      criado_por: user.id,
    })
  }

  return <PdiDetailClient pdi={pdi} papel={papel} />
}
