import { createAdminClient } from '../../../lib/supabase-admin'
import { getAuthUser } from '../../../lib/api-helpers'
import { getUsuariosDesativados } from '../../../lib/usuarios-desativados'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()
  if (!['gestor', 'admin'].includes(callerProfile?.papel ?? '')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const [{ data, error }, desativados] = await Promise.all([
    admin.from('profiles').select('id, nome, papel, pdi_slug').in('papel', ['colaborador', 'trainee']).order('nome'),
    getUsuariosDesativados(admin),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })
  // Só oferece colaborador ativo para abrir PDI novo — conta desativada não some do
  // histórico de PDIs já existentes, só para de aparecer como opção ao criar um novo.
  return Response.json((data ?? []).filter(p => !desativados.has(p.id)))
}
