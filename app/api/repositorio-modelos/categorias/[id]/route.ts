import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { requireGestorAdmin } from '../../../../lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const SELECT = 'id, nome, cor, ordem'

/** Renomeia e/ou troca a cor. Renomear leva junto os arquivos da categoria
 *  (repositorio_modelos.categoria guarda o nome). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { nome?: string; cor?: string }
  const admin = createAdminClient()
  const { data: atual } = await admin.from('repositorio_categorias').select('nome').eq('id', id).single()
  if (!atual) return Response.json({ error: 'Categoria não encontrada' }, { status: 404 })

  const patch: Record<string, string> = {}
  const nome = body.nome?.trim()
  if (nome && nome !== atual.nome) {
    const { data: outras } = await admin.from('repositorio_categorias').select('nome').neq('id', id)
    if ((outras ?? []).some(c => c.nome.toLowerCase() === nome.toLowerCase())) return Response.json({ error: 'Já existe uma categoria com esse nome' }, { status: 400 })
    patch.nome = nome
  }
  if (body.cor) patch.cor = body.cor

  const { data, error } = await admin
    .from('repositorio_categorias')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (patch.nome) {
    const { error: upErr } = await admin
      .from('repositorio_modelos')
      .update({ categoria: patch.nome })
      .eq('categoria', atual.nome)
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
  }

  return Response.json(data)
}

/** Só exclui categoria sem arquivos — os arquivos precisam trocar de categoria antes. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data: atual } = await admin.from('repositorio_categorias').select('nome').eq('id', id).single()
  if (!atual) return Response.json({ error: 'Categoria não encontrada' }, { status: 404 })

  const { count } = await admin
    .from('repositorio_modelos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria', atual.nome)
  if ((count ?? 0) > 0) {
    return Response.json({ error: 'A categoria ainda tem arquivos — troque a categoria deles antes' }, { status: 400 })
  }

  const { error } = await admin.from('repositorio_categorias').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
