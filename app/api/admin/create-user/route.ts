import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import { createClient } from '../../../lib/supabase-server'

export async function POST(request: NextRequest) {
  // Identify caller via session cookies
  const serverClient = await createClient()
  const { data: { user: caller } } = await serverClient.auth.getUser()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  // Check role via admin client (bypasses RLS)
  const admin = createAdminClient()
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('papel')
    .eq('id', caller.id)
    .single()

  const callerRole = callerProfile?.papel as string | undefined
  if (!callerRole || !['gestor', 'admin'].includes(callerRole)) {
    return Response.json(
      { error: `Sem permissão. Papel atual: ${callerRole ?? 'não encontrado'}` },
      { status: 403 }
    )
  }

  const body = await request.json() as {
    nome: string
    usuario: string
    senha: string
    papel: string
    pdi_slug?: string
    aniversario_dia?: number | string
    aniversario_mes?: number | string
  }
  const { nome, usuario, senha, papel, pdi_slug } = body

  if (!nome?.trim() || !usuario?.trim() || !senha || !papel) {
    return Response.json({ error: 'Campos obrigatórios: nome, usuario, senha, papel' }, { status: 400 })
  }
  if (!['colaborador', 'gestor', 'trainee'].includes(papel)) {
    return Response.json({ error: 'Papel inválido' }, { status: 400 })
  }

  const aniversario_dia = body.aniversario_dia ? Number(body.aniversario_dia) : null
  const aniversario_mes = body.aniversario_mes ? Number(body.aniversario_mes) : null

  const nomeParte = usuario.trim().replace(/^GT3\./i, '').toLowerCase()
  const normalizedEmail = `gt3.${nomeParte}@gt3.internal`

  // Create auth user
  const { data: { user: newUser }, error: createError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: nome.trim() },
  })

  if (createError) {
    const msg = createError.message.toLowerCase().includes('already been registered')
      ? `E-mail ${normalizedEmail} já está cadastrado`
      : createError.message
    return Response.json({ error: msg }, { status: 400 })
  }

  // Insert profile (admin client bypasses RLS)
  const { error: insertError } = await admin.from('profiles').insert({
    id: newUser!.id,
    nome: nome.trim(),
    email: normalizedEmail,
    papel,
    ...(pdi_slug ? { pdi_slug } : {}),
    ...(aniversario_dia ? { aniversario_dia } : {}),
    ...(aniversario_mes ? { aniversario_mes } : {}),
  })

  if (insertError) {
    console.error('[create-user] profile insert error:', insertError.message)
  }

  const usuarioFormatado = 'GT3.' + nomeParte.toUpperCase()
  return Response.json({ success: true, nome: nome.trim(), usuario: usuarioFormatado })
}
