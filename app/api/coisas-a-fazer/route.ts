import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [{ data: modulos }, { data: itens }] = await Promise.all([
    supabase.from('caf_modulos').select('*').order('created_at', { ascending: true }),
    supabase.from('caf_itens').select('*').order('criado_em', { ascending: false }),
  ])

  return NextResponse.json({ modulos: modulos ?? [], itens: itens ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, usuario, papel')
    .eq('id', user.id)
    .single()

  const nome_autor = profile?.nome?.trim() || profile?.usuario?.trim() || 'Usuário'
  const papel = profile?.papel ?? 'colaborador'
  const canManage = papel === 'admin' || papel === 'gestor'

  const body = await req.json()

  if (body.tipo === 'modulo') {
    if (!canManage) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { data, error } = await supabase
      .from('caf_modulos')
      .insert({ nome: body.nome, criado_por: nome_autor })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  if (body.tipo === 'item') {
    const { data, error } = await supabase
      .from('caf_itens')
      .insert({
        modulo_id: body.modulo_id,
        texto: body.texto,
        status: 'ativo',
        origem: body.origem ?? 'interna',
        autor: nome_autor,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
}
