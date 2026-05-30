import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase-server'
import { createAdminClient } from '../../lib/supabase-admin'
import * as allPdis from '../../../data/pdis/index'
import type { PdiColaborador, EneagramaRank, Animal } from '../../../data/pdis/types'
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

type DbPdiRow = {
  id: string
  nome: string
  funcao: string
  data_inicio?: string | null
  eneagrama?: unknown
  animais?: unknown
  conclusoes?: unknown
  competencias?: unknown
}

function dbRowToColaborador(row: DbPdiRow): PdiColaborador {
  const en = row.eneagrama as { ranking?: EneagramaRank[]; pontosFortes?: string[]; pontosAtencao?: string[]; comoDesenvolver?: string[] } | null
  return {
    id: row.id,
    nome: row.nome,
    funcao: row.funcao,
    periodo: row.data_inicio ? new Date(row.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '',
    matrizAvaliacao: { competencias: (row.competencias as string[] | null) ?? [], diretiva: [], auto: [], ambicao: [], totais: { diretiva: 0, auto: 0, ambicao: 0, max: 0 } },
    planoDeAcao: [],
    perfilComportamental: {
      eneagrama: {
        ranking: en?.ranking ?? [],
        pontosFortes: en?.pontosFortes ?? [],
        pontosAtencao: en?.pontosAtencao ?? [],
        comoDesenvolver: en?.comoDesenvolver ?? [],
      },
      animais: (row.animais as Animal[] | null) ?? [],
      mbti: (() => {
        const m = (row.conclusoes as Record<string, unknown> | null)?._mbti as Record<string, string> | null
        if (!m?.tipo) return undefined
        return {
          tipo: m.tipo ?? '',
          nucleo: m.nucleo ?? '',
          veredito: m.veredito ?? '',
          estiloDecisao: m.estiloDecisao ?? '',
          relacionamentoAutoridade: m.relacionamentoAutoridade ?? '',
          curvaAprendizado: m.curvaAprendizado ?? '',
          impactoClima: m.impactoClima ?? '',
          zonaRisco: m.zonaRisco ?? '',
        }
      })(),
    },
    conclusoes: (() => {
      const c = row.conclusoes as Record<string, unknown> | null
      return {
        forcas: (c?.forcas as string[] | null) ?? [],
        pontosAtencao: (c?.pontosAtencao as string[] | null) ?? [],
        ondeAgrega: (c?.ondeAgrega as string[] | null) ?? [],
        comoPodeApoiar: (c?.comoPodeApoiar as string[] | null) ?? [],
        riscos: (c?.riscos as string[] | null) ?? [],
        comoLiderar: (c?.comoLiderar as string[] | null) ?? [],
      }
    })(),
  }
}

export default async function PdiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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

  // Try static PDI first, then DB
  let pdi: PdiColaborador | undefined = pdisMap[id]
  let isDbPdi = false

  if (!pdi) {
    const { data: dbRow } = await admin
      .from('pdis')
      .select('id, nome, funcao, data_inicio, eneagrama, animais, conclusoes, competencias')
      .eq('id', id)
      .maybeSingle()

    if (!dbRow) notFound()
    pdi = dbRowToColaborador(dbRow as DbPdiRow)
    isDbPdi = true
  }

  // Seed ciclo 1 on first visit (skip if already seeded during creation)
  const { data: existingCiclo } = await admin
    .from('pdi_ciclos')
    .select('id')
    .eq('pdi_id', id)
    .limit(1)
    .maybeSingle()

  if (!existingCiclo) {
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
      autoavaliacao_salva: pdi.matrizAvaliacao.diretiva.length > 0,
      criado_por: user.id,
    })
  }

  return <PdiDetailClient pdi={pdi} papel={papel} isDbPdi={isDbPdi} />
}
