import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'

type Params = { params: Promise<{ cliente: string }> }

// Exclui a contratante inteira: todas as atas do cliente + o registro de arquivamento, se houver.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { cliente: rawCliente } = await params
  const cliente = decodeURIComponent(rawCliente)

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })

  if (profile.papel !== 'gestor' && profile.papel !== 'admin') {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { error } = await admin.from('atas_contratantes').delete().eq('cliente', cliente)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await admin.from('atas_contratantes_clientes_arquivados').delete().eq('cliente', cliente)

  return new Response(null, { status: 204 })
}
