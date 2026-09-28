import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { requireGestorAdmin } from '../../lib/api-helpers'
import { CRONO_SELECT, PROJETO_PADRAO, type Item, iso, instanciarModelo, paraModelo, startOfToday } from '../../cronogramas/model'

/** Cronogramas e modelos (campo `modelo`) de uma vez — a tela separa no cliente. */
export async function GET() {
  if (!await requireGestorAdmin()) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cronogramas')
    .select(CRONO_SELECT)
    .order('cliente', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

/**
 * Cria um cronograma ou um modelo.
 *  - cronograma novo: `base_id` opcional aponta para um MODELO; as etapas são copiadas e as datas
 *    deslocadas para a semana de `inicio` (padrão: hoje).
 *  - modelo novo (`modelo: true`): `base_id` opcional aponta para um cronograma ou outro modelo
 *    do qual copiar a estrutura.
 */
export async function POST(req: NextRequest) {
  const caller = await requireGestorAdmin()
  if (!caller) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { cliente?: string; projeto?: string; modelo?: boolean; base_id?: string; inicio?: string }
  const cliente = String(body.cliente ?? '').trim()
  const projeto = String(body.projeto ?? '').trim() || PROJETO_PADRAO
  const modelo = body.modelo === true
  if (!cliente) return Response.json({ error: modelo ? 'Informe o nome do modelo' : 'Informe o contratante' }, { status: 400 })

  const admin = createAdminClient()
  let itens: Item[] = []
  if (body.base_id) {
    const { data: base, error: baseErr } = await admin
      .from('cronogramas').select(CRONO_SELECT).eq('id', body.base_id).single()
    if (baseErr || !base) return Response.json({ error: 'Modelo de origem não encontrado' }, { status: 404 })
    const origem = (base.itens ?? []) as Item[]
    if (modelo) {
      itens = paraModelo(origem, base.modelo ? undefined : base.cliente)
    } else {
      if (!base.modelo) return Response.json({ error: 'A origem precisa ser um modelo' }, { status: 400 })
      const inicio = /^\d{4}-\d{2}-\d{2}$/.test(body.inicio ?? '') ? body.inicio! : iso(startOfToday())
      itens = instanciarModelo(origem, cliente, inicio)
    }
  }

  const { data, error } = await admin
    .from('cronogramas')
    .insert({ cliente, projeto, modelo, itens, criado_por: caller.user.id })
    .select(CRONO_SELECT)
    .single()
  if (error) {
    if (error.code === '23505') return Response.json({ error: modelo ? 'Já existe um modelo com esse nome e projeto' : 'Já existe um cronograma desse contratante com esse nome de projeto' }, { status: 409 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data)
}
