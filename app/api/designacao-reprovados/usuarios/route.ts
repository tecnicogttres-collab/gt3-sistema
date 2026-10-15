import { getCaller } from '../../../lib/api-helpers'
import { getUsuariosDesativados } from '../../../lib/usuarios-desativados'
import { createAdminClient } from '../../../lib/supabase-admin'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data, error }, desativados] = await Promise.all([
    admin.from('profiles').select('id, nome, papel').order('nome', { ascending: true }),
    getUsuariosDesativados(admin),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })
  // Conta desativada não entra como responsável pertinente nem em designação nova.
  return Response.json((data ?? []).filter(p => !desativados.has(p.id)))
}
