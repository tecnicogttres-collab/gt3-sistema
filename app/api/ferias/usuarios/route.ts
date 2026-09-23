import { getAuthUser, getActiveProfileIds } from '../../../lib/api-helpers'
import { createAdminClient } from '../../../lib/supabase-admin'
import { pickNextFeriasColor } from '../../../lib/feriasColors'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data, error }, ativos, { data: coresData }] = await Promise.all([
    admin.from('profiles').select('id, nome').order('nome', { ascending: true }),
    getActiveProfileIds(admin),
    admin.from('ferias_cores_usuarios').select('usuario_id, cor'),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const ativosList = (data ?? []).filter(p => ativos.has(p.id) && p.nome?.trim())

  const coresMap = new Map<string, string>((coresData ?? []).map(c => [c.usuario_id as string, c.cor as string]))
  const usedColors = new Set(coresMap.values())

  // Colaboradores ativos sem cor ainda (login novo, ou primeira vez que essa
  // rota roda) recebem uma cor estável agora, gravada de uma vez por todas.
  const novasCores: { usuario_id: string; cor: string }[] = []
  for (const p of ativosList) {
    if (!coresMap.has(p.id)) {
      const cor = pickNextFeriasColor(usedColors, coresMap.size + novasCores.length)
      usedColors.add(cor)
      coresMap.set(p.id, cor)
      novasCores.push({ usuario_id: p.id, cor })
    }
  }
  if (novasCores.length > 0) {
    await admin.from('ferias_cores_usuarios').insert(novasCores)
  }

  return Response.json(
    ativosList.map(p => ({ id: p.id, nome: p.nome as string, cor: coresMap.get(p.id) ?? '#888' }))
  )
}
