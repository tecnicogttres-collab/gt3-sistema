import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'
import { hojeBrasil, type DiaSemExpediente } from '../../../lib/feriados'
import { calcularAvisoFerias } from '../../../lib/ferias-aviso'

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const fmtDia = (s: string) => {
  const d = new Date(s + 'T00:00:00')
  return `${DIAS_SEMANA[d.getDay()]}, ${s.slice(8, 10)}/${s.slice(5, 7)}`
}

/** Aviso de férias no Dashboard de quem está logado: "boas férias" no último dia antes de
 *  sair e "ótimo retorno" no 1º dia útil depois de voltar. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  // Só em desenvolvimento (localhost): ?hoje=AAAA-MM-DD simula outra data pra testar os avisos
  const simular = req.nextUrl.searchParams.get('hoje')
  const hojeSimulado = process.env.NODE_ENV === 'development' && simular && /^\d{4}-\d{2}-\d{2}$/.test(simular) ? simular : null

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('nome').eq('id', user.id).single()
  const nome = (prof?.nome as string | null)?.trim()
  if (!nome) return Response.json({ aviso: null })

  const hoje = hojeSimulado ?? hojeBrasil()
  // Janela: retorno até ~20 dias depois do fim; saída até ~20 dias antes do início
  const d = new Date(hoje + 'T00:00:00')
  const menos = new Date(d); menos.setDate(d.getDate() - 20)
  const mais = new Date(d); mais.setDate(d.getDate() + 20)
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`

  const [{ data: registros }, { data: config }, { data: perfis }] = await Promise.all([
    admin.from('ferias').select('pessoa, inicio, fim, tipo').gte('fim', iso(menos)).lte('inicio', iso(mais)),
    admin.from('ferias_feriados').select('id, data, descricao, anual'),
    admin.from('profiles').select('nome'),
  ])

  const aviso = calcularAvisoFerias({
    nome,
    todosNomes: (perfis ?? []).map(p => p.nome as string | null).filter((n): n is string => !!n),
    registros: registros ?? [],
    config: (config ?? []) as DiaSemExpediente[],
    hoje,
  })
  if (!aviso) return Response.json({ aviso: null })

  const primeiroNome = nome.split(/\s+/)[0]
  if (aviso.tipo === 'retorno') {
    return Response.json({ aviso: { ...aviso, primeiroNome, titulo: `Ótimo retorno, ${primeiroNome}!`, texto: 'Que bom ter você de volta. Bom trabalho!' } })
  }
  return Response.json({
    aviso: {
      ...aviso,
      primeiroNome,
      titulo: `Boas férias, ${primeiroNome}!`,
      texto: `Lhe vejo ${fmtDia(aviso.retorno)}.`,
    },
  })
}
