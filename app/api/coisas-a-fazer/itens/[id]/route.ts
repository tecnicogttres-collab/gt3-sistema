import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, usuario, papel')
    .eq('id', user.id)
    .single()

  const papel = profile?.papel ?? 'colaborador'
  if (papel !== 'admin' && papel !== 'gestor') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const nome_autor = profile?.nome?.trim() || profile?.usuario?.trim() || 'Usuário'

  const patch: Record<string, unknown> = {}

  if (body.status !== undefined) {
    patch.status = body.status
    if (body.status === 'finalizado') {
      patch.finalizado_por = nome_autor
      patch.finalizado_em = new Date().toISOString()
    } else {
      patch.finalizado_por = null
      patch.finalizado_em = null
    }
  }

  if (body.texto !== undefined) patch.texto = String(body.texto).trim()
  if (body.visibilidade !== undefined) patch.visibilidade = body.visibilidade

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const { data, error } = await supabase
    .from('caf_itens')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
